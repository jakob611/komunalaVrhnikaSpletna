import test from "node:test";
import assert from "node:assert/strict";
import { localD1 } from "./local-d1.mjs";
import { handleNotificationSettings, readNotificationSettings } from "./notification-settings.js";
import { outboxInsert, deliverPending } from "./email.js";

const base = "https://kpv.example/api/admin/notifications";
const owner = { email: "owner@example.com", role: "owner" };
function environment() {
  return { DB: localD1(":memory:"), EMAIL_TO: "current@example.com", EMAIL_FROM: "KPV <portal@example.com>", EMAIL_ENABLED: "true", RESEND_API_KEY: "test-secret" };
}
async function call(env, value, actor = owner) {
  const request = new Request(base, { method: value ? "PUT" : "GET", body: value ? JSON.stringify(value) : undefined });
  try {
    return await handleNotificationSettings(request, env, {
      json: value => Response.json(value), body: request => request.json(), actor,
      fail: (status, message) => { throw Object.assign(Error(message), { status }); },
    });
  } catch (error) { return Response.json({ error: error.message }, { status: error.status || 500 }); }
}

test("recipient defaults remain unchanged, owners can save and restore, stale writes are rejected", async () => {
  const env = environment();
  const original = await (await call(env)).json();
  assert.equal(original.recipient, env.EMAIL_TO);
  assert.equal(original.revision, 0);
  assert.equal(original.override, "");
  const unchanged = await (await call(env, { recipient: env.EMAIL_TO, revision: 0 })).json();
  assert.equal(unchanged.revision, 0);
  const saved = await (await call(env, { recipient: "office@example.com", revision: 0 })).json();
  assert.equal(saved.recipient, "office@example.com");
  assert.equal(saved.updatedBy, owner.email);
  assert.equal(saved.revision, 1);
  assert.equal(env.EMAIL_TO, "current@example.com");
  const stale = await call(env, { recipient: "other@example.com", revision: 0 });
  assert.equal(stale.status, 409);
  const restored = await (await call(env, { recipient: env.EMAIL_TO, revision: 1 })).json();
  assert.equal(restored.override, "");
  assert.equal(restored.recipient, env.EMAIL_TO);
  assert.equal(restored.revision, 2);
  env.DB.close();
});

test("only owners can read or write private recipient settings; recipient must be one valid email", async () => {
  const env = environment();
  for (const role of ["editor", "", undefined]) {
    assert.equal((await call(env, undefined, { role })).status, 403);
    assert.equal((await call(env, { recipient: "office@example.com", revision: 0 }, { role })).status, 403);
  }
  for (const recipient of ["", "not-email", "one@example.com,two@example.com", "Name <one@example.com>", "one@example.com\r\nBcc: two@example.com", ".one@example.com", "one..two@example.com", "one@example"]) {
    assert.equal((await call(env, { recipient, revision: 0 })).status, 400, recipient);
  }
  assert.equal((await call(env, { recipient: "office@example.com", revision: -1 })).status, 400);
  assert.equal((await readNotificationSettings(env)).recipient, env.EMAIL_TO);
  env.DB.close();
});

test("queued notifications freeze their recipient and new settings only affect new submissions", async () => {
  const env = environment();
  const now = Date.now();
  const makeRecord = id => ({ id, kind: "contact", createdAt: new Date(now).toISOString(), payload: { name: "Test", email: "sender@example.com", subject: "Vprašanje", message: "Preverjanje" } });
  await (await outboxInsert(env.DB, makeRecord("KPV-before"), env)).run();
  assert.equal((await call(env, { recipient: "office@example.com", revision: 0 })).status, 200);
  await (await outboxInsert(env.DB, makeRecord("KPV-after"), env)).run();
  const sent = [];
  await deliverPending(env, { now, fetcher: async (_url, init) => { sent.push(JSON.parse(init.body)); return Response.json({ id: crypto.randomUUID() }); } });
  assert.deepEqual(sent.map(message => message.to[0]).sort(), ["current@example.com", "office@example.com"]);
  const payload = await env.DB.prepare("SELECT message FROM email_outbox WHERE id='KPV-before'").first();
  assert.deepEqual(JSON.parse(payload.message).to, ["current@example.com"]);
  assert.equal(sent.length, 2);
  env.DB.close();
});
