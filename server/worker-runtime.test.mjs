import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { build } from "esbuild";
import { Miniflare, convertV4MiniflareOptions } from "miniflare";
import { publishSections, handleCmsEditor } from './cms-editor.js';
import { largeWebsiteFixture } from './cms-large-test-fixture.mjs';
import { addDays, ljubljanaDate } from './seed.js';
import { processScheduledPublications } from './scheduled-publications.js';

// This executes the actual Worker in workerd with local D1/R2, rather than Node
// adapters. Outbound requests are intercepted; no .dev.vars or live services load.
test("workerd serves protected documents and commits a verified public case exactly once in D1", async () => {
  const bundled = await build({ entryPoints: ["server/worker.js"], bundle: true, write: false, format: "esm", platform: "browser", external: ["node:*"], target: "es2022" });
  let verifications = 0;
  const runtime = new Miniflare(convertV4MiniflareOptions({
    modules: true, script: bundled.outputFiles[0].text, compatibilityDate: "2026-10-28", compatibilityFlags: ["nodejs_compat"],
    d1Databases: ["DB"], r2Buckets: ["PHOTOS"],
    bindings: {
      TURNSTILE_SECRET: "test-only-not-a-real-secret", TURNSTILE_SITE_KEY: "test-only-public-key", TURNSTILE_HOSTNAMES: "kpv.example",
      SUBSCRIPTION_SIGNING_SECRET: "test-only-not-a-real-signing-key", EMAIL_ENABLED: "true", RESEND_API_KEY: "test-only-not-a-real-token",
      EMAIL_FROM: "KPV <portal@example.test>", EMAIL_TO: "staff@example.test",
      ADMIN_PASSWORD_HASH: `v1:100000:${"ab".repeat(16)}:${"cd".repeat(32)}`,
    },
    serviceBindings: { ASSETS: async () => new Response("<!doctype html><html lang='sl'><div id='root'></div></html>", { headers: { "Content-Type": "text/html; charset=utf-8" } }) },
    outboundService: async request => {
      const url = new URL(request.url);
      if (url.hostname === "challenges.cloudflare.com") {
        verifications++;
        return Response.json({ success: true, action: "contact", hostname: "kpv.example" });
      }
      if (url.hostname === "api.resend.com") return Response.json({ id: "runtime-provider-receipt" });
      assert.fail("Unexpected outbound runtime request: " + url.hostname);
    },
  }));
  try {
    const db = await runtime.getD1Database("DB");
    // Prepare complete schema statements, preserving trigger BEGIN/END bodies.
    const schema = (await readFile(new URL("../schema.sql", import.meta.url), "utf8"))
      .replace(/^--.*$/gm, "");
    const statements = schema.match(/CREATE TRIGGER[\s\S]*?END;|CREATE (?!TRIGGER)[\s\S]*?;/g);
    await db.batch(statements.map(statement => db.prepare(statement)));
    const health = await runtime.dispatchFetch("https://kpv.example/api/health");
    assert.equal(health.status, 200, await health.clone().text());
    const doc = await runtime.dispatchFetch("https://kpv.example/admin");
    assert.equal(doc.headers.get("X-Frame-Options"), "DENY");
    assert.equal((await runtime.dispatchFetch("https://kpv.example/not-a-route")).status, 404);
    const requestId = crypto.randomUUID();
    const body = { requestId, name: "Runtime test", email: "citizen@example.test", consent: true, category: "other", subcategory: "", subject: "Runtime persistence", message: "A local isolated workerd test message.", "cf-turnstile-response": "runtime-test-token" };
    const submit = value => runtime.dispatchFetch("https://kpv.example/api/contact", { method: "POST", headers: { "Content-Type": "application/json", Origin: "https://kpv.example", "CF-Connecting-IP": "192.0.2.99" }, body: JSON.stringify(value) });
    const first = await submit(body);
    assert.equal(first.status, 201, await first.clone().text());
    const receipt = await first.json();
    const retry = await submit({ ...body, "cf-turnstile-response": "" });
    assert.equal(retry.status, 201);
    assert.deepEqual(await retry.json(), receipt);
    assert.equal(verifications, 1);
    assert.equal((await db.prepare("SELECT COUNT(*) AS n FROM contact_submissions").first()).n, 1);
    assert.equal((await db.prepare("SELECT COUNT(*) AS n FROM email_outbox").first()).n, 1);
    // Actual D1 accepts a multi-MiB website because each snapshot section is its
    // own row. This would fail if before/after or a draft were aggregated in D1.
    const value = largeWebsiteFixture(), revisions=Object.fromEntries(Object.keys(value).map(key=>[key,0]));
    assert.ok(Buffer.byteLength(JSON.stringify(value))>2_000_000);
    const fail=(status,message)=>{throw Object.assign(new Error(message),{status});};
    const release=await publishSections({DB:db},value,revisions,'runtime@example.test',fail);
    const latest=await publishSections({DB:db},value,release.revisions,'runtime@example.test',fail);
    assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM cms_publication_values').first()).n,20);
    const draft=await handleCmsEditor(new Request('https://kpv.example/api/admin/drafts/website',{method:'PUT',body:JSON.stringify({value,baseRevisions:release.revisions,revision:0})}),{DB:db},{fail,session:{email:'runtime@example.test'},json:Response.json,body:request=>request.json()});
    assert.equal(draft.status,200);
    assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM cms_draft_values').first()).n,5);
    await db.prepare("INSERT INTO admin_users(email,role,status,version,created_at,updated_at) VALUES('runtime@example.test','owner','active',1,0,0)").run();
    const publishOn=addDays(ljubljanaDate(),1);
    const queued=await handleCmsEditor(new Request('https://kpv.example/api/admin/schedules',{method:'POST',body:JSON.stringify({section:'website',value,baseRevisions:latest.revisions,publishOn})}),{DB:db},{fail,session:{email:'runtime@example.test'},json:(data,status=200)=>Response.json(data,{status}),body:request=>request.json()});
    assert.equal(queued.status,201);
    assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM cms_scheduled_values').first()).n,5);
    assert.equal((await processScheduledPublications({DB:db},Date.parse(publishOn+'T12:00:00Z'))).published,1);
  } finally { await runtime.dispose(); }
});
