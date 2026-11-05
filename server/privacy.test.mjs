import test from "node:test";
import assert from "node:assert/strict";
import { localD1 } from "./local-d1.mjs";
import { handlePrivacy } from "./privacy.js";

const owner = { email: "owner@example.com", role: "owner" };
function environment() {
  const removed = [];
  return {
    DB: localD1(":memory:"),
    ADMIN_OWNER_EMAIL: owner.email,
    SUBSCRIPTION_SIGNING_SECRET: "test-private-erasure-key",
    removed,
    PHOTOS: {
      async delete(key) {
        removed.push(key);
      },
    },
  };
}
const fail = (status, message) => {
  throw Object.assign(Error(message), { status });
};
const call = (env, action, data, session = owner) =>
  handlePrivacy(
    new Request("https://audit.example/api/admin/privacy/" + action, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }),
    env,
    { session, json: Response.json, body: (request) => request.json(), fail },
  );
async function count(env, table) {
  return (await env.DB.prepare(`SELECT COUNT(*) AS n FROM ${table}`).first()).n;
}
async function seed(env) {
  const at = "2026-11-01T00:00:00.000Z";
  for (const [id, email] of [
    ["KPV-private", "citizen@example.com"],
    ["KPV-other", "other@example.com"],
  ]) {
    await env.DB.prepare(
      "INSERT INTO contact_submissions(id,kind,created_at,status,payload) VALUES(?,'contact',?,'demo-saved',?)",
    )
      .bind(
        id,
        at,
        JSON.stringify({
          email,
          name: "Test Citizen",
          message: "Private message",
          ...(id === "KPV-private" ? { photoKey: "private-report.jpg" } : {}),
        }),
      )
      .run();
    await env.DB.prepare(
      "INSERT INTO admin_cases(submission_id,checklist,version,updated_at,update_token) VALUES(?,'[]',1,?,'version-one')",
    )
      .bind(id, at)
      .run();
    await env.DB.prepare(
      "INSERT INTO admin_case_events(id,submission_id,created_at,event,detail) VALUES(?,?,?,'note','Private case note')",
    )
      .bind(id + "-event", id, at)
      .run();
    await env.DB.prepare(
      "INSERT INTO email_outbox(id,created_at,next_attempt,message) VALUES(?,1,1,?)",
    )
      .bind(
        id,
        JSON.stringify({
          to: [owner.email],
          reply_to: email,
          text: "Private message",
        }),
      )
      .run();
    await env.DB.prepare(
      "INSERT INTO email_delivery_windows(outbox_id,started_at) VALUES(?,1)",
    )
      .bind(id)
      .run();
    await env.DB.prepare(
      "INSERT INTO public_submission_requests(request_id,fingerprint,submission_id,kind,receipt,created_at) VALUES(?,'hash',?,'contact','{}',1)",
    )
      .bind(id + "-request", id)
      .run();
  }
  await env.DB.prepare(
    "INSERT INTO email_subscribers(id,email,name,address,district_id,topics,created_at,updated_at) VALUES('subscriber-one','citizen@example.com','Test Citizen','Verd 1, Vrhnika','vrhnika','[\"water\"]',1,1)",
  ).run();
  await env.DB.prepare(
    "INSERT INTO subscriber_management_versions(subscriber_id,version) VALUES('subscriber-one',2)",
  ).run();
  await env.DB.prepare(
    "INSERT INTO email_outbox(id,created_at,next_attempt,message) VALUES('subscriber-confirm-one',1,1,'{\"text\":\"Personal confirmation link\"}')",
  ).run();
  await env.DB.prepare(
    "INSERT INTO subscription_deliveries(outbox_id,subscriber_id,generation,kind) VALUES('subscriber-confirm-one','subscriber-one',1,'confirmation')",
  ).run();
}

test("owner previews and explicitly erases related citizen data, photos and retries without touching other people", async () => {
  const env = environment();
  await seed(env);
  const response = await call(env, "preview", {
      reference: "citizen@example.com",
    }),
    preview = await response.json();
  assert.deepEqual(preview.counts, {
    submissions: 1,
    cases: 1,
    events: 1,
    subscribers: 1,
    deliveries: 1,
    outbox: 2,
    photos: 1,
  });
  assert.equal(preview.payload, undefined);
  assert.equal(await count(env, "contact_submissions"), 2);
  assert.deepEqual(env.removed, []);
  const erased = await call(env, "erase", {
    reference: "citizen@example.com",
    confirmationToken: preview.confirmationToken,
  });
  assert.equal((await erased.json()).erased, true);
  assert.deepEqual(env.removed, ["private-report.jpg"]);
  for (const table of [
    "contact_submissions",
    "admin_cases",
    "admin_case_events",
    "email_outbox",
    "email_delivery_windows",
    "public_submission_requests",
  ])
    assert.equal(await count(env, table), 1, table);
  for (const table of [
    "email_subscribers",
    "subscription_deliveries",
    "subscriber_management_versions",
  ])
    assert.equal(await count(env, table), 0, table);
  const audit = await env.DB.prepare(
    "SELECT * FROM privacy_erasure_events",
  ).first();
  assert.ok(audit);
  assert.equal(JSON.stringify(audit).includes("citizen"), false);
  assert.equal(JSON.stringify(audit).includes("owner@"), false);
  assert.match(
    (await (await call(env, "preview", { reference: "KPV-other" })).json())
      .scopeNote,
    /Že poslana/,
  );
  env.DB.close();
});

test("erasure rejects editors, unsigned confirmations, different references and records changed after preview", async () => {
  const env = environment();
  await seed(env);
  await assert.rejects(
    call(
      env,
      "preview",
      { reference: "citizen@example.com" },
      { email: "editor@example.com", role: "editor" },
    ),
    (e) => e.status === 403,
  );
  const preview = await (
    await call(env, "preview", { reference: "citizen@example.com" })
  ).json();
  await assert.rejects(
    call(env, "erase", {
      reference: "citizen@example.com",
      confirmationToken: "forged",
    }),
    (e) => e.status === 400,
  );
  await assert.rejects(
    call(env, "erase", {
      reference: "other@example.com",
      confirmationToken: preview.confirmationToken,
    }),
    (e) => e.status === 410,
  );
  await env.DB.prepare(
    "UPDATE admin_cases SET notes='New material for review' WHERE submission_id='KPV-private'",
  ).run();
  await assert.rejects(
    call(env, "erase", {
      reference: "citizen@example.com",
      confirmationToken: preview.confirmationToken,
    }),
    (e) => e.status === 409,
  );
  assert.equal(await count(env, "contact_submissions"), 2);
  assert.deepEqual(env.removed, []);
  env.DB.close();
});

test("a photo storage failure preserves source records for retry and stops queued notifications", async () => {
  const env = environment();
  await seed(env);
  env.PHOTOS.delete = async () => {
    throw Error("Object storage unavailable");
  };
  const preview = await (
    await call(env, "preview", { reference: "KPV-private" })
  ).json();
  await assert.rejects(
    call(env, "erase", {
      reference: "KPV-private",
      confirmationToken: preview.confirmationToken,
    }),
    (e) => e.status === 503,
  );
  assert.equal(await count(env, "contact_submissions"), 2);
  assert.equal(
    (
      await env.DB.prepare(
        "SELECT status FROM email_outbox WHERE id='KPV-private'",
      ).first()
    ).status,
    "failed",
  );
  assert.equal(await count(env, "privacy_erasure_events"), 0);
  assert.equal(
    (
      await env.DB.prepare(
        "SELECT status FROM email_subscribers WHERE email='citizen@example.com'",
      ).first()
    ).status,
    "pending",
    "Erasing a submission reference must preserve a separate subscription",
  );
  env.DB.close();
});

test("email erasure suppresses subscription work before object deletion and a new reviewed attempt completes cleanup", async () => {
  const env = environment();
  await seed(env);
  env.PHOTOS.delete = async () => {
    throw Error("Object storage unavailable");
  };
  const first = await (
    await call(env, "preview", { reference: "citizen@example.com" })
  ).json();
  await assert.rejects(
    call(env, "erase", {
      reference: "citizen@example.com",
      confirmationToken: first.confirmationToken,
    }),
    (error) => error.status === 503,
  );
  const subscriber = await env.DB.prepare(
    "SELECT * FROM email_subscribers WHERE email='citizen@example.com'",
  ).first();
  assert.equal(subscriber.status, "suppressed");
  assert.equal(subscriber.pending_payload, null);
  env.PHOTOS.delete = async (key) => env.removed.push(key);
  const retry = await (
    await call(env, "preview", { reference: "citizen@example.com" })
  ).json();
  assert.equal(
    (
      await (
        await call(env, "erase", {
          reference: "citizen@example.com",
          confirmationToken: retry.confirmationToken,
        })
      ).json()
    ).erased,
    true,
  );
  assert.equal(await count(env, "email_subscribers"), 0);
  assert.equal(await count(env, "contact_submissions"), 1);
  env.DB.close();
});
