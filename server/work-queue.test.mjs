import test from "node:test";
import assert from "node:assert/strict";
import { localD1 } from "./local-d1.mjs";
import { handleAdmin } from "./admin.js";
import { createTestSession } from "./admin-auth-test-helpers.mjs";

const password = "internal-test-password";
const salt = crypto.getRandomValues(new Uint8Array(16));
const material = await crypto.subtle.importKey(
  "raw",
  new TextEncoder().encode(password),
  "PBKDF2",
  false,
  ["deriveBits"],
);
const derived = await crypto.subtle.deriveBits(
  { name: "PBKDF2", hash: "SHA-256", salt, iterations: 100000 },
  material,
  256,
);
const hash = `v1:100000:${Buffer.from(salt).toString("hex")}:${Buffer.from(derived).toString("hex")}`;
const base = "http://127.0.0.1:5173";
function call(path, session, body, method = body ? "PUT" : "GET") {
  return new Request(base + path, {
    method,
    headers: {
      Origin: base,
      "Content-Type": "application/json",
      ...(session
        ? { Cookie: session.cookie, "X-CSRF-Token": session.csrfToken }
        : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}
async function setup() {
  const env = {
    DB: localD1(":memory:"),
    LOCAL_STORAGE: {},
    ADMIN_PASSWORD_HASH: hash,
  };
  const session = await createTestSession(env, { password });
  const payload = {
    name: "Testna oseba",
    email: "person@example.com",
    address: "Testna ulica",
    description: "Poškodovana svetilka pri prehodu.",
    category: "lighting",
  };
  await env.DB.prepare(
    "INSERT INTO submissions(id,kind,created_at,status,payload) VALUES(?,?,?,?,?)",
  )
    .bind(
      "KPV-test",
      "reports",
      new Date().toISOString(),
      "demo-saved",
      JSON.stringify(payload),
    )
    .run();
  return { env, session };
}
test("work items require authentication and preserve reporter data privately", async () => {
  const { env, session } = await setup();
  assert.equal((await handleAdmin(call("/api/admin/work"), env)).status, 401);
  const response = await handleAdmin(call("/api/admin/work", session), env);
  const data = await response.json();
  assert.equal(data.items.length, 1);
  assert.equal(data.stats.new, 1);
  assert.equal(data.items[0].checklist.length, 3);
  assert.equal(data.items[0].version, 0);
  const publicData = await (
    await handleAdmin(call("/api/content"), env)
  ).text();
  assert.ok(!publicData.includes("person@example.com"));
  env.DB.close();
});
test("checklists, status, notes and history update atomically, reject stale edits and require completion", async () => {
  const { env, session } = await setup();
  const item = (
    await (
      await handleAdmin(call("/api/admin/work/KPV-test", session), env)
    ).json()
  ).item;
  assert.equal(
    (
      await handleAdmin(
        call("/api/admin/work/KPV-test", session, {
          ...item,
          status: "resolved",
        }),
        env,
      )
    ).status,
    400,
  );
  const draft = {
    ...item,
    status: "in-progress",
    priority: "high",
    assignee: "Vzdrževalna ekipa",
    dueDate: "2026-01-01",
    notes: "Preveriti priklop napajanja.",
    checklist: item.checklist.map((step, index) => ({
      ...step,
      done: index === 0,
    })),
  };
  const savedResponse = await handleAdmin(
    call("/api/admin/work/KPV-test", session, draft),
    env,
  );
  assert.equal(savedResponse.status, 200);
  const saved = await savedResponse.json();
  assert.equal(saved.item.version, 1);
  assert.equal(saved.timeline.length, 1);
  assert.match(saved.timeline[0].detail, /Urednik: owner@example\.com/);
  assert.equal(
    (
      await handleAdmin(
        call("/api/admin/work/KPV-test", session, {
          ...draft,
          priority: "urgent",
        }),
        env,
      )
    ).status,
    409,
  );
  assert.equal(
    (
      await handleAdmin(
        call(
          "/api/admin/submissions/KPV-test",
          session,
          { status: "resolved" },
          "PATCH",
        ),
        env,
      )
    ).status,
    400,
  );
  const overdue = await (
    await handleAdmin(
      call("/api/admin/work?overdue=true&priority=high", session),
      env,
    )
  ).json();
  assert.equal(overdue.stats.overdue, 1);
  assert.equal(overdue.items.length, 1);
  const done = {
    ...saved.item,
    status: "resolved",
    checklist: saved.item.checklist.map((step) => ({ ...step, done: true })),
  };
  const completed = await (
    await handleAdmin(call("/api/admin/work/KPV-test", session, done), env)
  ).json();
  assert.equal(completed.item.version, 2);
  assert.equal(completed.timeline.length, 2);
  assert.equal(completed.item.status, "resolved");
  const queue = await (
    await handleAdmin(call("/api/admin/work", session), env)
  ).json();
  assert.equal(queue.items.length, 0);
  assert.equal(queue.stats.resolved, 1);
  assert.equal(
    (
      await handleAdmin(
        call("/api/admin/work/KPV-test", session, {
          ...done,
          version: 2,
          dueDate: "2026-02-31",
        }),
        env,
      )
    ).status,
    400,
  );
  env.DB.close();
});

test("staff can create private internal tasks without sending mail; retries do not duplicate tasks", async () => {
  const { env, session } = await setup();
  const input = {
    requestId: crypto.randomUUID(),
    title: "Popravi povezavo v mobilnem meniju",
    description: "Puščica odpre napačno stran. Preveri delovanje po popravku.",
    category: "portal",
    address: "/kontakt",
    priority: "high",
    assignee: "Uredništvo",
    dueDate: "2026-11-05",
  };
  assert.equal(
    (await handleAdmin(call("/api/admin/work", null, input, "POST"), env))
      .status,
    401,
  );
  const simultaneous = await Promise.all(
    [0, 1].map(() =>
      handleAdmin(call("/api/admin/work", session, input, "POST"), env),
    ),
  );
  assert.ok(simultaneous.every((response) => response.status === 201));
  const response = simultaneous[0];
  assert.equal(response.status, 201);
  const created = await response.json();
  assert.equal(created.item.kind, "internal");
  assert.equal(created.item.payload.subject, input.title);
  assert.equal(created.item.payload.createdBy, "owner@example.com");
  assert.equal(created.item.dueDate, input.dueDate);
  assert.equal(created.item.priority, "high");
  assert.equal(created.item.checklist.length, 3);
  assert.equal(created.item.notificationStatus, "not-queued");
  assert.equal(created.timeline.length, 1);
  assert.match(created.timeline[0].detail, /Urednik: owner@example\.com/);
  assert.equal(
    (await env.DB.prepare("SELECT COUNT(*) AS total FROM email_outbox").first())
      .total,
    0,
  );
  const repeated = await handleAdmin(
    call("/api/admin/work", session, input, "POST"),
    env,
  );
  assert.equal(repeated.status, 201);
  const replay = await repeated.json();
  assert.equal(replay.item.id, created.item.id);
  assert.equal(replay.timeline.length, 1);
  const conflict = await handleAdmin(
    call(
      "/api/admin/work",
      session,
      { ...input, title: "Drug popravek" },
      "POST",
    ),
    env,
  );
  assert.equal(conflict.status, 409);
  const queue = await (
    await handleAdmin(call("/api/admin/work?kind=internal", session), env)
  ).json();
  assert.equal(queue.items.length, 1);
  assert.equal(queue.stats.open, 2);
  const publicContent = await (
    await handleAdmin(call("/api/content"), env)
  ).text();
  assert.ok(!publicContent.includes(input.title));
  const done = await handleAdmin(
    call(`/api/admin/work/${created.item.id}`, session, {
      ...created.item,
      status: "resolved",
      checklist: created.item.checklist.map((step) => ({
        ...step,
        done: true,
      })),
    }),
    env,
  );
  assert.equal(done.status, 200);
  const saved = await done.json();
  assert.equal(saved.item.status, "resolved");
  assert.equal(saved.item.version, 2);
  assert.equal(saved.timeline.length, 2);
  env.DB.close();
});

test("internal task creation validates input and refuses client-supplied creator or missing CSRF", async () => {
  const { env, session } = await setup();
  const input = { title: "Preveri urnik", category: "waste" };
  for (const patch of [
    { title: " " },
    { priority: "invalid" },
    { dueDate: "2026-02-31" },
    { category: "invalid" },
    { createdBy: "forged@example.com" },
    { requestId: "not-a-request-id" },
    { description: "x".repeat(5001) },
  ]) {
    const response = await handleAdmin(
      call("/api/admin/work", session, { ...input, ...patch }, "POST"),
      env,
    );
    assert.equal(response.status, 400);
  }
  const request = new Request(base + "/api/admin/work", {
    method: "POST",
    headers: {
      Origin: base,
      Cookie: session.cookie,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });
  assert.equal((await handleAdmin(request, env)).status, 403);
  assert.equal(
    (
      await env.DB.prepare(
        "SELECT COUNT(*) AS total FROM internal_tasks",
      ).first()
    ).total,
    0,
  );
  env.DB.close();
});
test("case mutations enforce CSRF and search treats SQL wildcards as literal text", async () => {
  const { env, session } = await setup();
  const item = (
    await (
      await handleAdmin(call("/api/admin/work/KPV-test", session), env)
    ).json()
  ).item;
  const forged = new Request(base + "/api/admin/work/KPV-test", {
    method: "PUT",
    headers: {
      Cookie: session.cookie,
      Origin: base,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(item),
  });
  assert.equal((await handleAdmin(forged, env)).status, 403);
  const result = await (
    await handleAdmin(call("/api/admin/work?q=%25", session), env)
  ).json();
  assert.equal(result.items.length, 0);
  assert.equal(
    (await handleAdmin(call("/api/admin/work?priority=invalid", session), env))
      .status,
    400,
  );
  env.DB.close();
});
