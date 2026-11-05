import test from "node:test";
import assert from "node:assert/strict";
import { localD1 } from "./local-d1.mjs";
import { hashAdminPassword } from "./admin-auth.js";
import { createTestSession } from "./admin-auth-test-helpers.mjs";
import { handleAdmin } from "./admin.js";
import { processCampaigns } from "./subscriptions.js";
import { addDays, ljubljanaDate } from "./seed.js";

const password = "functional-audit-only-password",
  hash = await hashAdminPassword(password),
  origin = "http://127.0.0.1:5173";
async function setup() {
  const env = {
    DB: localD1(":memory:"),
    LOCAL_STORAGE: {},
    ADMIN_PASSWORD_HASH: hash,
    ADMIN_OWNER_EMAIL: "owner@example.test",
    EMAIL_FROM: "audit@example.test",
    EMAIL_TO: "owner@example.test",
    EMAIL_ENABLED: "true",
    RESEND_API_KEY: "synthetic-not-used",
    SUBSCRIPTION_SIGNING_SECRET: "synthetic-audit-only-secret",
  };
  return { env, owner: await createTestSession(env, { password }) };
}
async function api(env, session, path, body, method = body ? "POST" : "GET") {
  const response = await handleAdmin(
    new Request(origin + path, {
      method,
      headers: {
        Origin: origin,
        "Content-Type": "application/json",
        ...(session
          ? { Cookie: session.cookie, "X-CSRF-Token": session.csrfToken }
          : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
    env,
  );
  return { status: response.status, data: await response.json() };
}
const task = () => ({
  requestId: crypto.randomUUID(),
  title: "Preveri delovanje portala",
  description: "Synthetic audit task",
  category: "portal",
  priority: "high",
  assignee: "Ekipa A",
  dueDate: addDays(ljubljanaDate(), 1),
});

test("AO01-AO12 real password/OTP invitation, enrollment, scope change, logout and revocation form a usable lifecycle", async () => {
  const { env, owner } = await setup();
  const invited = await api(env, owner, "/api/admin/users", {
    email: "operator@example.test",
    accessScope: "operations",
  });
  assert.equal(invited.status, 201);
  const message = env.AUTH_TEST_MAIL.at(-1),
    invitation = {
      email: "operator@example.test",
      password: "operator-audit-password",
      challengeId: message.text.match(/\?invite=([a-f0-9]{64})/)[1],
      code: message.text.match(/Koda: (\d{8})/)[1],
    };
  assert.equal(
    (await api(env, null, "/api/admin/enroll", invitation)).status,
    200,
  );
  const operator = await createTestSession(env, {
    email: invitation.email,
    password: invitation.password,
    ip: "192.0.2.44",
  });
  assert.equal(operator.user.accessScope, "operations");
  assert.equal((await api(env, operator, "/api/admin/work")).status, 200);
  assert.equal((await api(env, operator, "/api/admin/content")).status, 403);
  assert.equal(
    (
      await api(env, owner, "/api/admin/users/scope", {
        email: invitation.email,
        accessScope: "content",
      })
    ).status,
    200,
  );
  assert.equal((await api(env, operator, "/api/admin/session")).status, 401);
  const editor = await createTestSession(env, {
    email: invitation.email,
    password: invitation.password,
    ip: "192.0.2.45",
  });
  assert.equal((await api(env, editor, "/api/admin/content")).status, 200);
  assert.equal((await api(env, editor, "/api/admin/logout", {})).status, 200);
  assert.equal((await api(env, editor, "/api/admin/session")).status, 401);
  assert.equal(
    (
      await api(env, owner, "/api/admin/users/revoke", {
        email: invitation.email,
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await api(env, null, "/api/admin/login", {
        email: invitation.email,
        password: invitation.password,
      })
    ).status,
    401,
  );
  env.DB.close();
});

test("AO14-AO26 work pagination, priority ordering, filters and mutable treatment preserve original submissions", async () => {
  const { env, owner } = await setup(),
    date = "2026-11-01T10:00:00.000Z";
  for (let n = 0; n < 45; n++)
    await env.DB.prepare(
      "INSERT INTO contact_submissions(id,kind,created_at,status,payload) VALUES(?,'contact',?,'demo-saved',?)",
    )
      .bind(
        `KPV-${String(n).padStart(3, "0")}`,
        date,
        JSON.stringify({
          name: "Audit Citizen",
          email: "citizen@example.test",
          subject: `Audit message ${n}`,
          message: "Original private text",
        }),
      )
      .run();
  const pages = [];
  for (let page = 1; page <= 3; page++) {
    const result = await api(
      env,
      owner,
      `/api/admin/work?status=all&page=${page}`,
    );
    assert.equal(result.status, 200);
    assert.equal(result.data.total, 45);
    pages.push(result.data);
  }
  assert.deepEqual(
    pages.map((p) => p.items.length),
    [20, 20, 5],
  );
  assert.deepEqual(
    pages.map((p) => p.hasMore),
    [true, true, false],
  );
  assert.equal(
    new Set(pages.flatMap((p) => p.items.map((i) => i.id))).size,
    45,
  );
  let current = (await api(env, owner, "/api/admin/work/KPV-000")).data.item;
  const updated = {
    ...current,
    status: "in-progress",
    priority: "urgent",
    assignee: "Vzdrževalna ekipa",
    dueDate: "2000-01-01",
    notes: "Dogovor s stranko",
    checklist: [{ id: "one", text: "Preveri lokacijo", done: false }],
  };
  let saved = await api(env, owner, "/api/admin/work/KPV-000", updated, "PUT");
  assert.equal(saved.status, 200);
  assert.equal(saved.data.item.version, 1);
  assert.equal(
    (await api(env, owner, "/api/admin/work/KPV-000", updated, "PUT")).status,
    409,
  );
  const filtered = await api(
    env,
    owner,
    "/api/admin/work?status=open&priority=urgent&overdue=true&q=ekipa",
  );
  assert.deepEqual(
    filtered.data.items.map((i) => i.id),
    ["KPV-000"],
  );
  assert.equal(
    (await api(env, owner, "/api/admin/work?status=all")).data.items[0].id,
    "KPV-000",
  );
  current = saved.data.item;
  saved = await api(
    env,
    owner,
    "/api/admin/work/KPV-000",
    { ...current, status: "resolved" },
    "PUT",
  );
  assert.equal(saved.status, 200);
  assert.equal(saved.data.item.checklist[0].done, false);
  saved = await api(
    env,
    owner,
    "/api/admin/work/KPV-000",
    { ...saved.data.item, status: "in-progress" },
    "PUT",
  );
  assert.equal(saved.status, 200);
  assert.equal(saved.data.item.notes, "Dogovor s stranko");
  assert.equal(saved.data.item.payload.message, "Original private text");
  assert.equal(
    (
      await api(
        env,
        owner,
        "/api/admin/work/KPV-000",
        { ...saved.data.item, dueDate: "2026-02-30" },
        "PUT",
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await api(
        env,
        owner,
        "/api/admin/work/KPV-000",
        {
          ...saved.data.item,
          checklist: [
            { id: "dup", text: "A", done: false },
            { id: "dup", text: "B", done: false },
          ],
        },
        "PUT",
      )
    ).status,
    400,
  );
  assert.equal((await api(env, owner, "/api/admin/work?page=0")).status, 400);
  env.DB.close();
});

test("AO27 internal task retries detect every changed creation field while identical retries remain safe after treatment edits", async () => {
  const { env, owner } = await setup(),
    input = task(),
    created = await api(env, owner, "/api/admin/work", input);
  assert.equal(created.status, 201);
  for (const change of [
    { priority: "urgent" },
    { assignee: "Druga ekipa" },
    { dueDate: addDays(input.dueDate, 1) },
    { title: "Drug nalog" },
  ])
    assert.equal(
      (await api(env, owner, "/api/admin/work", { ...input, ...change }))
        .status,
      409,
      JSON.stringify(change),
    );
  const edited = await api(
    env,
    owner,
    "/api/admin/work/" + created.data.item.id,
    {
      ...created.data.item,
      assignee: "Pozneje dodeljena ekipa",
      priority: "low",
    },
    "PUT",
  );
  assert.equal(edited.status, 200);
  const replay = await api(env, owner, "/api/admin/work", input);
  assert.equal(replay.status, 201);
  assert.equal(replay.data.item.assignee, "Pozneje dodeljena ekipa");
  assert.equal(
    (await env.DB.prepare("SELECT COUNT(*) AS n FROM internal_tasks").first())
      .n,
    1,
  );
  assert.equal(
    (await env.DB.prepare("SELECT COUNT(*) AS n FROM email_outbox").first()).n,
    0,
  );
  env.DB.close();
});

test("AO32-AO37 campaign API previews, queues, deduplicates, rejects stale revisions and cancels retracted content without external mail", async () => {
  const { env, owner } = await setup(),
    notice = {
      id: "audit-notice",
      title: "Preverjanje oskrbe",
      summary: "Synthetic local audit content.",
      category: "water",
      area: "Vrhnika",
      date: ljubljanaDate(),
      status: "info",
      published: true,
      districtIds: ["vrhnika"],
      addressRules: [],
      latitude: null,
      longitude: null,
    };
  await env.DB.prepare(
    "INSERT INTO cms_content(section,value,revision,updated_at) VALUES('notices',?,1,?)",
  )
    .bind(JSON.stringify([notice]), Date.now())
    .run();
  await env.DB.prepare(
    "INSERT INTO email_subscribers(id,email,status,name,address,district_id,topics,created_at,updated_at,confirmed_at) VALUES(?,'reader@example.test','active','Audit Reader','Verd 1, Vrhnika','vrhnika','[\"water\"]',1,1,1)",
  )
    .bind(crypto.randomUUID())
    .run();
  const input = { noticeId: notice.id, revision: 1 };
  const preview = await api(env, owner, "/api/admin/notice-delivery", {
    ...input,
    preview: true,
  });
  assert.equal(preview.status, 200);
  assert.equal(preview.data.recipients, 1);
  assert.equal(preview.data.alreadyQueued, false);
  assert.equal(
    (
      await env.DB.prepare(
        "SELECT COUNT(*) AS n FROM notification_campaigns",
      ).first()
    ).n,
    0,
  );
  assert.equal(
    (
      await api(env, owner, "/api/admin/notice-delivery", {
        ...input,
        revision: 0,
        preview: false,
      })
    ).status,
    409,
  );
  const sent = await api(env, owner, "/api/admin/notice-delivery", {
    ...input,
    preview: false,
  });
  assert.equal(sent.status, 200);
  assert.equal(sent.data.alreadyQueued, true);
  assert.equal(
    (
      await api(env, owner, "/api/admin/notice-delivery", {
        ...input,
        preview: false,
      })
    ).data.id,
    sent.data.id,
  );
  await env.DB.prepare(
    "UPDATE cms_content SET value=?,revision=2 WHERE section='notices'",
  )
    .bind(JSON.stringify([{ ...notice, published: false }]))
    .run();
  await processCampaigns(env);
  assert.equal(
    (await env.DB.prepare("SELECT status FROM notification_campaigns").first())
      .status,
    "cancelled",
  );
  assert.equal(
    (await env.DB.prepare("SELECT COUNT(*) AS n FROM email_outbox").first()).n,
    0,
  );
  env.DB.close();
});

test("AO44-AO48 scheduling endpoint validates future dates, prevents duplicate plans, enforces author/owner cancellation and keeps public content private", async () => {
  const { env, owner } = await setup(),
    input = {
      section: "market",
      value: { dates: [addDays(ljubljanaDate(), 5)], closedDates: [] },
      baseRevisions: { market: 0 },
      publishOn: addDays(ljubljanaDate(), 2),
    };
  assert.equal(
    (
      await api(env, owner, "/api/admin/schedules", {
        ...input,
        publishOn: ljubljanaDate(),
      })
    ).status,
    400,
  );
  const plan = await api(env, owner, "/api/admin/schedules", input);
  assert.equal(plan.status, 201);
  assert.equal(
    (await api(env, owner, "/api/admin/schedules", input)).status,
    409,
  );
  const listed = await api(env, owner, "/api/admin/schedules?section=market");
  assert.equal(listed.data.items[0].id, plan.data.id);
  await env.DB.prepare(
    "INSERT INTO admin_users(email,role,status,password_hash,version,created_at,updated_at) VALUES('other-editor@example.test','editor','active',?,1,1,1)",
  )
    .bind(hash)
    .run();
  const otherEditor = await createTestSession(env, {
    email: "other-editor@example.test",
    password,
    ip: "192.0.2.49",
  });
  assert.equal(
    (
      await api(
        env,
        otherEditor,
        "/api/admin/schedules/" + plan.data.id,
        undefined,
        "DELETE",
      )
    ).status,
    403,
  );
  assert.equal(
    (await api(env, null, "/api/content")).data.sections.market.dates.includes(
      input.value.dates[0],
    ),
    false,
  );
  assert.equal(
    (
      await api(
        env,
        owner,
        "/api/admin/schedules/" + plan.data.id,
        undefined,
        "DELETE",
      )
    ).status,
    200,
  );
  assert.equal(
    (
      await api(
        env,
        owner,
        "/api/admin/schedules/" + plan.data.id,
        undefined,
        "DELETE",
      )
    ).status,
    409,
  );
  env.DB.close();
});

test("AO30 subscriber pagination reaches every older record across tied timestamps and literal search preserves district totals", async () => {
  const { env, owner } = await setup();
  for (let n = 0; n < 123; n++)
    await env.DB.prepare(
      `INSERT INTO email_subscribers(id,email,status,name,address,district_id,topics,created_at,updated_at)
   VALUES(?,?,'active','Audit Subscriber',?,?,'["water"]',1,777)`,
    )
      .bind(
        `sub-${String(n).padStart(3, "0")}`,
        `reader${String(n).padStart(3, "0")}@example.test`,
        n === 50 ? "Target_50% Verd" : `Verd ${n}, Vrhnika`,
        n < 120 ? "vrhnika" : "borovnica",
      )
      .run();
  const seen = [],
    pages = [];
  let cursor = "";
  do {
    const response = await api(
      env,
      owner,
      "/api/admin/subscribers?" +
        new URLSearchParams({ district: "vrhnika", cursor }),
    );
    assert.equal(response.status, 200);
    assert.equal(response.data.counts.active, 120);
    pages.push(response.data.items.length);
    seen.push(...response.data.items.map((item) => item.email));
    cursor = response.data.nextCursor || "";
  } while (cursor);
  assert.deepEqual(pages, [50, 50, 20]);
  assert.equal(new Set(seen).size, 120);
  assert.equal(seen[0], "reader119@example.test");
  assert.equal(seen.at(-1), "reader000@example.test");
  for (const query of ["reader050@", "Target_50%", "%", "_"]) {
    const response = await api(
      env,
      owner,
      "/api/admin/subscribers?" +
        new URLSearchParams({ district: "vrhnika", q: query }),
    );
    assert.equal(response.status, 200);
    assert.deepEqual(
      response.data.items.map((row) => row.email),
      ["reader050@example.test"],
    );
    assert.equal(response.data.counts.active, 120);
    assert.equal(response.data.nextCursor, null);
  }
  assert.equal(
    (await api(env, owner, "/api/admin/subscribers?district=borovnica")).data
      .counts.active,
    3,
  );
  for (const query of [
    "cursor=invalid",
    "cursor=9999999999999999:sub-001",
    "q=" + encodeURIComponent("x".repeat(255)),
  ])
    assert.equal(
      (await api(env, owner, "/api/admin/subscribers?" + query)).status,
      400,
      query,
    );
  assert.equal(
    (await api(env, null, "/api/admin/subscribers?cursor=777:sub-025")).status,
    401,
  );
  env.DB.close();
});
