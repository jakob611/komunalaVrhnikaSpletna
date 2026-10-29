import test from "node:test";
import assert from "node:assert/strict";
import { localD1 } from "./local-d1.mjs";
import { handleAdmin } from "./admin.js";

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
  const response = await handleAdmin(
    call("/api/admin/login", null, { password }, "POST"),
    env,
  );
  assert.equal(response.status, 200);
  const session = {
    ...(await response.json()),
    cookie: response.headers.get("set-cookie").split(";")[0],
  };
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
