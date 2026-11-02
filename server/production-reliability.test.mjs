import test from "node:test";
import assert from "node:assert/strict";
import { localD1 } from "./local-d1.mjs";
import { handleRequest } from "./worker.js";
import { enforceFormQuota } from "./bot-protection.js";
import { addDays, ljubljanaDate } from "./seed.js";

const origin = "https://kpv.example";
const contact = { name: "Ana Novak", email: "ana@example.test", consent: true, category: "other", subcategory: "", subject: "Vprašanje o računu", message: "Prosim za pojasnilo obračuna storitve." };
const post = (path, value) => new Request(origin + path, { method: "POST", headers: { "Content-Type": "application/json", Origin: origin, "CF-Connecting-IP": "192.0.2.13" }, body: JSON.stringify(value) });
function environment() {
  const objects = new Map();
  return {
    DB: localD1(":memory:"), EMAIL_ENABLED: "true", EMAIL_FROM: "KPV <portal@example.test>", EMAIL_TO: "staff@example.test",
    ADMIN_PASSWORD_HASH: `v1:100000:${"ab".repeat(16)}:${"cd".repeat(32)}`,
    RESEND_API_KEY: "test-only", SUBSCRIPTION_SIGNING_SECRET: "private-test-only-signing-key",
    TURNSTILE_SITE_KEY: "public-test-only", TURNSTILE_SECRET: "private-test-only", TURNSTILE_HOSTNAMES: "kpv.example",
    PHOTOS: { async put(key, bytes) { objects.set(key, bytes); }, async delete(key) { objects.delete(key); } }, objects,
    ASSETS: { async fetch(request) {
      const path = new URL(request.url).pathname;
      if (path === "/assets/app.js") return new Response("console.log('app')", { headers: { "Content-Type": "application/javascript" } });
      return new Response("<!doctype html><html lang='sl'><div id='root'></div></html>", { headers: { "Content-Type": "text/html; charset=utf-8" } });
    } },
  };
}
async function withVerifier(action, run) {
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { calls++; return Response.json({ success: true, action, hostname: "kpv.example" }); };
  try { await run(() => calls); } finally { globalThis.fetch = original; }
}

test("public receipt retries survive a consumed challenge and concurrent first attempts without duplicate cases or mail", async () => {
  const env = environment();
  try {
    await withVerifier("contact", async calls => {
      const requestId = crypto.randomUUID();
      const body = { ...contact, requestId, "cf-turnstile-response": "first-token" };
      const replies = await Promise.all([handleRequest(post("/api/contact", body), env), handleRequest(post("/api/contact", body), env)]);
      assert.deepEqual(replies.map(reply => reply.status), [201, 201]);
      const receipts = await Promise.all(replies.map(reply => reply.json()));
      assert.deepEqual(receipts[0], receipts[1]);
      assert.equal((await env.DB.prepare("SELECT COUNT(*) AS n FROM contact_submissions").first()).n, 1);
      assert.equal((await env.DB.prepare("SELECT COUNT(*) AS n FROM email_outbox").first()).n, 1);
      const before = calls();
      const retry = await handleRequest(post("/api/contact", { ...contact, requestId }), env);
      assert.equal(retry.status, 201);
      assert.deepEqual(await retry.json(), receipts[0]);
      assert.equal(calls(), before, "completed receipt recovery must not consume another challenge");
      assert.equal((await handleRequest(post("/api/contact", { ...body, message: "Drugačna vsebina iste oznake oddaje." }), env)).status, 409);
      const stored = await env.DB.prepare("SELECT receipt,fingerprint FROM public_submission_requests").first();
      assert.ok(!stored.receipt.includes(contact.email));
      assert.ok(!stored.receipt.includes(contact.message));
      assert.match(stored.fingerprint, /^[a-f0-9]{64}$/);
    });
  } finally { env.DB.close(); }
});

test("unverified first attempts create neither a retry receipt, citizen case nor quota record", async () => {
  const env = environment();
  try {
    const response = await handleRequest(post("/api/contact", { ...contact, requestId: crypto.randomUUID() }), env);
    assert.equal(response.status, 403);
    for (const table of ["contact_submissions", "public_submission_requests", "public_form_limits", "email_outbox"])
      assert.equal((await env.DB.prepare(`SELECT COUNT(*) AS n FROM ${table}`).first()).n, 0);
  } finally { env.DB.close(); }
});

test("failed atomic queue persistence leaves no receipt or case and a retry can succeed", async () => {
  const env = environment();
  const originalBatch = env.DB.batch.bind(env.DB);
  let fail = true;
  env.DB.batch = async statements => {
    // Quota uses two statements; a submission transaction has three.
    if (statements.length === 3 && fail) { fail = false; throw new Error("injected transaction failure"); }
    return originalBatch(statements);
  };
  try {
    await withVerifier("contact", async () => {
      const body = { ...contact, requestId: crypto.randomUUID(), "cf-turnstile-response": "token" };
      assert.equal((await handleRequest(post("/api/contact", body), env)).status, 503);
      assert.equal((await env.DB.prepare("SELECT COUNT(*) AS n FROM public_submission_requests").first()).n, 0);
      assert.equal((await handleRequest(post("/api/contact", body), env)).status, 201);
    });
  } finally { env.DB.close(); }
});

test("report retries fingerprint the actual image bytes and retain exactly one photo", async () => {
  const env = environment();
  const requestId = crypto.randomUUID();
  const makeReport = (lastByte = 0) => {
    const form = new FormData();
    for (const [key, value] of Object.entries({ name: contact.name, email: contact.email, consent: "true", requestId, category: "roads", address: "Verd 12, Vrhnika", description: "Poškodba vozišča ob hiši številka 12.", "cf-turnstile-response": "token" })) form.set(key, value);
    form.set("photo", new File([new Uint8Array([255, 216, 255, lastByte])], "photo.jpg", { type: "image/jpeg" }));
    return new Request(origin + "/api/reports", { method: "POST", headers: { Origin: origin, "CF-Connecting-IP": "192.0.2.14" }, body: form });
  };
  try {
    await withVerifier("reports", async () => {
      const replies = await Promise.all([handleRequest(makeReport(), env), handleRequest(makeReport(), env)]);
      assert.deepEqual(replies.map(reply => reply.status), [201, 201]);
      assert.equal(env.objects.size, 1);
      assert.equal((await env.DB.prepare("SELECT COUNT(*) AS n FROM submissions").first()).n, 1);
      assert.equal((await handleRequest(makeReport(1), env)).status, 409);
    });
  } finally { env.DB.close(); }
});

test("D1 quota enforces per-minute and per-hour limits, stores no raw IP and resets by window", async () => {
  const env = environment();
  const request = new Request(origin + "/api/contact", { headers: { "CF-Connecting-IP": "192.0.2.55" } });
  const start = 1800000000000;
  try {
    for (let n = 0; n < 10; n++) await enforceFormQuota(request, env, start);
    await assert.rejects(enforceFormQuota(request, env, start), error => error.status === 429);
    await enforceFormQuota(request, env, start + 60000);
    const { results } = await env.DB.prepare("SELECT key FROM public_form_limits").all();
    assert.ok(results.every(row => !row.key.includes("192.0.2.55")));
    for (let minute = 2; minute < 11; minute++) {
      for (let n = 0; n < 9; n++) {
        if (minute === 10 && n === 8) break;
        await enforceFormQuota(request, env, start + minute * 60000);
      }
    }
    // Above accumulated 92 accepted attempts and one rejected attempt in this hour.
    const hour = await env.DB.prepare("SELECT attempts FROM public_form_limits WHERE key LIKE 'hour:%'").first();
    for (let n = hour.attempts; n < 100; n++) await enforceFormQuota(request, env, start + 12 * 60000);
    await assert.rejects(enforceFormQuota(request, env, start + 13 * 60000), error => error.status === 429);
    await enforceFormQuota(request, env, start + 3600000);
  } finally { env.DB.close(); }
});

test("health differentiates a living Worker from missing schema or unavailable storage", async () => {
  const env = environment();
  try {
    assert.equal((await handleRequest(new Request(origin + "/api/health"), env)).status, 200);
    const noAdmin = await handleRequest(new Request(origin + "/api/health"), { ...env, ADMIN_PASSWORD_HASH: undefined });
    assert.equal(noAdmin.status, 503);
    assert.equal((await noAdmin.json()).readiness.admin, false);
    await env.DB.prepare("DROP TABLE public_form_limits").run();
    const incomplete = await handleRequest(new Request(origin + "/api/health"), env);
    assert.equal(incomplete.status, 503);
    assert.equal((await incomplete.json()).readiness.database, "schema-incomplete");
    const broken = { ...env, DB: { prepare() { throw new Error("offline"); } } };
    assert.equal((await handleRequest(new Request(origin + "/api/health"), broken)).status, 503);
    assert.equal((await handleRequest(new Request(origin + "/api/live"), broken)).status, 200);
  } finally { env.DB.close(); }
});

test("document routing returns real 404, public CMS pages, robots and sitemap with compatible security policy", async () => {
  const env = environment();
  try {
    await env.DB.prepare("INSERT INTO cms_content(section,value,revision,updated_at,source) VALUES('layout',?,1,?,'test')")
      .bind(JSON.stringify({ pages: [{ path: "/strani/obcina", title: "Občina", blocks: [] }], navigation: [] }), Date.now()).run();
    for (const path of ["/", "/odpadki/urnik", "/strani/obcina"]) {
      const response = await handleRequest(new Request(origin + path), env);
      assert.equal(response.status, 200, path);
      assert.match(response.headers.get("Content-Security-Policy"), /frame-ancestors 'self'/);
      assert.match(response.headers.get("Content-Security-Policy"), /https:\/\/challenges.cloudflare.com/);
    }
    for (const path of ["/missing", "/strani/missing", "/assets/missing.js"]) {
      const response = await handleRequest(new Request(origin + path), env);
      assert.equal(response.status, 404, path);
      assert.equal(response.headers.get("X-Robots-Tag"), "noindex, nofollow");
    }
    const admin = await handleRequest(new Request(origin + "/admin"), env);
    assert.equal(admin.headers.get("X-Frame-Options"), "DENY");
    assert.match(admin.headers.get("Content-Security-Policy"), /frame-ancestors 'none'/);
    assert.equal((await handleRequest(new Request(origin + "/kontakt/"), env)).status, 308);
    const script = await handleRequest(new Request(origin + "/assets/app.js"), env);
    assert.equal(script.headers.get("Content-Type"), "application/javascript");
    const sitemap = await (await handleRequest(new Request(origin + "/sitemap.xml"), env)).text();
    assert.ok(sitemap.includes(origin + "/strani/obcina"));
    assert.ok(!sitemap.includes("/admin") && !sitemap.includes("narocnina"));
    const robots = await (await handleRequest(new Request(origin + "/robots.txt"), env)).text();
    assert.ok(robots.includes("Disallow: /api/"));
    assert.ok(robots.includes("Sitemap: " + origin + "/sitemap.xml"));
  } finally { env.DB.close(); }
});

test("operational publication read failures cannot reopen a closed market date", async () => {
  const env = environment();
  const proposed = addDays(ljubljanaDate(), 10);
  try {
    await env.DB.prepare("INSERT INTO cms_content(section,value,revision,updated_at,source) VALUES('market',?,1,?,'test')")
      .bind(JSON.stringify({ dates: [], closedDates: [proposed] }), Date.now()).run();
    const body = { name: contact.name, email: contact.email, consent: true, requestId: crypto.randomUUID(), date: proposed, stallType: "standard", products: "Doma pridelana zelenjava", "cf-turnstile-response": "token" };
    assert.equal((await handleRequest(post("/api/market", body), env)).status, 400);
    const prepare = env.DB.prepare;
    env.DB.prepare = query => {
      if (query === "SELECT value FROM cms_content WHERE section = ?") throw new Error("injected publication read failure");
      return prepare(query);
    };
    assert.equal((await handleRequest(post("/api/market", body), env)).status, 503);
    assert.equal((await env.DB.prepare("SELECT COUNT(*) AS n FROM submissions").first()).n, 0);
  } finally { env.DB.close(); }
});
