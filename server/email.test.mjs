import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { emailEnabled, notification, outboxInsert, deliverPending } from './email.js';
import { handleRequest } from './worker.js';

function database() {
  const sql = new DatabaseSync(':memory:');
  sql.exec(readFileSync(new URL('../schema.sql', import.meta.url), 'utf8'));
  const wrap = (query, bindings = []) => ({
    bind: (...args) => wrap(query, args),
    run: async () => sql.prepare(query).run(...bindings),
    all: async () => ({ results: sql.prepare(query).all(...bindings) }),
    first: async () => sql.prepare(query).get(...bindings) || null,
  });
  return { sql, prepare: wrap, async batch(statements) {
    sql.exec('BEGIN');
    try { for (const stmt of statements) await stmt.run(); sql.exec('COMMIT'); }
    catch (error) { sql.exec('ROLLBACK'); throw error; }
  } };
}
const now = Date.now();
function env() { return { DB: database(), EMAIL_ENABLED: 'true', RESEND_API_KEY: 'test-secret',
  EMAIL_FROM: 'KPV <obvestila@kpv.example>', EMAIL_TO: 'owner@example.com' }; }
const record = { id: 'KPV-test', kind: 'contact', createdAt: new Date(now).toISOString(),
  payload: { name: '<script>unsafe</script>', email: 'person@example.com', category: 'other',
    subject: 'Vprašanje', message: 'Besedilo z znakom & in $& brez sprememb.' } };
const row = e => e.DB.sql.prepare('SELECT * FROM email_outbox').get();
async function enqueue(e, value = record) { await outboxInsert(e.DB, value, e).run(); }

test('notification fixes recipient, sets reply-to, escapes HTML and preserves plain text', () => {
  const email = notification(record, env());
  assert.deepEqual(email.to, ['owner@example.com']);
  assert.equal(email.reply_to, 'person@example.com');
  assert.ok(email.html.includes('&lt;script&gt;unsafe&lt;/script&gt;'));
  assert.ok(email.html.includes('$&amp;'));
  assert.ok(email.text.includes('<script>unsafe</script>'));
  assert.ok(!email.html.includes('KPV_DETAILS_TOKEN'));
  assert.ok(email.html.includes('https://kpv.jakobtominc.com/admin?case=KPV-test'));
  assert.ok(email.text.includes('/admin?case=KPV-test'));
});

test('local file storage cannot enable real email even when credentials are present', async () => {
  const e = { ...env(), LOCAL_STORAGE: { save: async () => {} } };
  assert.equal(emailEnabled(e), false);
  await deliverPending(e, { fetcher: () => assert.fail('must not send') });
});

test('outbox sends private photo attachment once with stable idempotency key', async () => {
  const e = env();
  e.PHOTOS = { get: async () => ({ arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer }) };
  await enqueue(e, { ...record, payload: { ...record.payload, photoKey: 'private.jpg' } });
  let count = 0;
  const fetcher = async (url, init) => {
    count++;
    assert.equal(url, 'https://api.resend.com/emails');
    assert.equal(init.headers['Idempotency-Key'], 'submission/KPV-test');
    const body = JSON.parse(init.body);
    assert.equal(body.attachments[0].content, 'AQID');
    assert.ok(!body.html.includes('private.jpg'));
    return Response.json({ id: 'provider-id' });
  };
  await Promise.all([deliverPending(e, { fetcher, now }), deliverPending(e, { fetcher, now })]);
  await deliverPending(e, { fetcher, now: now + 1000000 });
  assert.equal(count, 1);
  assert.equal(row(e).status, 'sent');
  assert.equal(row(e).provider_id, 'provider-id');
});

test('transient provider failures retry the same payload and stop after eight attempts', async () => {
  const e = env(); await enqueue(e);
  const bodies = [];
  const fetcher = async (_url, init) => { bodies.push(init.body); return new Response('', { status: 429 }); };
  for (let attempt = 0; attempt < 8; attempt++)
    await deliverPending(e, { fetcher, now: now + attempt * 3600000 });
  assert.equal(row(e).status, 'failed');
  assert.equal(row(e).attempts, 8);
  assert.equal(new Set(bodies).size, 1);
});

test('permanent provider rejection stops retries and stale queues never resend', async () => {
  const e = env(); await enqueue(e);
  await deliverPending(e, { now, fetcher: async () => new Response('', { status: 403 }) });
  assert.equal(row(e).status, 'failed');
  assert.equal(row(e).last_error, 'http_403');
  const stale = env(); await enqueue(stale);
  await deliverPending(stale, { now: now + 21 * 3600000, fetcher: () => assert.fail('expired') });
  assert.equal(row(stale).last_error, 'retry_window_expired');
});

test('verified form stores submission and outbox atomically, and config never exposes the key', async () => {
  const e = { ...env(), TURNSTILE_SECRET: 'test', TURNSTILE_SITE_KEY: 'public', TURNSTILE_HOSTNAMES: 'kpv.example' };
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => Response.json({ success: true, hostname: 'kpv.example', action: 'contact' });
  try {
    const makeRequest = () => new Request('https://kpv.example/api/contact', { method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'https://kpv.example' },
      body: JSON.stringify({ ...record.payload, category: 'other', subcategory: '', consent: true, 'cf-turnstile-response': 'test' }) });
    const response = await handleRequest(makeRequest(), e);
    assert.equal(response.status, 201);
    assert.equal((await response.json()).emailStatus, 'queued');
    assert.equal(e.DB.sql.prepare('SELECT COUNT(*) AS count FROM contact_submissions').get().count, 1);
    assert.equal(row(e).status, 'pending');
    const config = await (await handleRequest(new Request('https://kpv.example/api/config'), e)).json();
    assert.equal(config.email.enabled, true);
    assert.ok(!JSON.stringify(config).includes('test-secret'));
    // Simulate broken queue persistence: the submission must roll back too.
    e.DB.sql.exec('DROP TABLE email_outbox');
    assert.equal((await handleRequest(makeRequest(), e)).status, 503);
    assert.equal(e.DB.sql.prepare('SELECT COUNT(*) AS count FROM contact_submissions').get().count, 1);
  } finally { globalThis.fetch = originalFetch; }
});
