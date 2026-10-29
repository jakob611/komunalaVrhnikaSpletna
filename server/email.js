import template from './email-template.generated.js';
import { Buffer } from 'node:buffer';

export function emailEnabled(env) {
  // File-backed development and automated tests never send real email.
  return !env.LOCAL_STORAGE && env.EMAIL_ENABLED === 'true' &&
    Boolean(env.RESEND_API_KEY && env.EMAIL_FROM && env.EMAIL_TO && env.DB);
}

const kinds = { contact: 'Kontaktno sporočilo', reports: 'Prijava poškodbe',
  requests: 'Povpraševanje za storitev', market: 'Prijava na tržnico', subscriptions: 'Izbira obvestil (preizkus)' };
const labels = { name: 'Ime in priimek', email: 'E-pošta', phone: 'Telefon', address: 'Naslov / lokacija',
  category: 'Področje', subcategory: 'Podkategorija', subject: 'Zadeva', message: 'Sporočilo',
  service: 'Storitev', preferredDate: 'Želeni datum', date: 'Datum', stallType: 'Vrsta stojnice',
  products: 'Ponudba', description: 'Opis', topics: 'Teme', latitude: 'Zemljepisna širina', longitude: 'Zemljepisna dolžina' };
const values = { water: 'Voda', waste: 'Odpadki', roads: 'Ceste', billing: 'Računi in plačila',
  market: 'Tržnica', depo: 'DEPO', other: 'Drugo', supply: 'Oskrba z vodo', septic: 'Greznice in MKČN',
  connection: 'Priključki', collection: 'Odvoz odpadkov', sorting: 'Ločevanje odpadkov', bulky: 'Kosovni odpadki',
  road: 'Ceste', lighting: 'Javna razsvetljava', public: 'Javne površine', invoice: 'Račun', meter: 'Števec',
  payment: 'Plačilo', booking: 'Rezervacija', conditions: 'Pogoji', donation: 'Oddaja predmetov', purchase: 'Nakup',
  bins: 'Zabojniki', general: 'Splošna obvestila', standard: 'Običajna', food: 'Živila', craft: 'Rokodelstvo' };
const choiceFields = new Set(['category','subcategory','service','stallType','topics']);
const escapeHtml = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export function notification(record, env) {
  const title = kinds[record.kind];
  if (!title) throw new Error('Unknown email kind');
  const lines = [`Referenca: ${record.id}`, `Oddano: ${record.createdAt}`, ''];
  for (const [key, label] of Object.entries(labels)) {
    const value = record.payload[key];
    if (value == null || value === '') continue;
    const display = choiceFields.has(key)
      ? (Array.isArray(value) ? value.map(v => values[v] || v).join(', ') : values[value] || value)
      : value;
    lines.push(`${label}: ${display}`);
  }
  if (record.payload.photoKey) lines.push('Fotografija: v priponki.');
  if (record.kind === 'subscriptions') lines.push('', 'Izbira je prikazna. Samodejna obvestila o motnjah še niso vključena.');
  const details = lines.join('\n');
  return {
    from: env.EMAIL_FROM, to: [env.EMAIL_TO], reply_to: record.payload.email,
    subject: `[KPV preizkus] ${title} · ${record.id.slice(0, 12)}`,
    html: template.replace('KPV_TITLE_TOKEN', escapeHtml(title)).replace('KPV_DETAILS_TOKEN', () => escapeHtml(details).replace(/\n/g, '<br/>')),
    text: `${title}\n\n${details}\n\nPreizkusni portal; oddaja ne pomeni uradnega naročila, rezervacije ali plačila pri KPV.`,
  };
}

// Keep the exact JSON stable across retries (Resend idempotency keys last 24h).
export function outboxInsert(db, record, env) {
  return db.prepare(`INSERT INTO email_outbox (id, created_at, next_attempt, message, photo_key)
    VALUES (?, ?, ?, ?, ?)`).bind(record.id, Date.parse(record.createdAt), Date.parse(record.createdAt),
      JSON.stringify(notification(record, env)), record.payload.photoKey || null);
}

export async function deliverPending(env, { id = null, fetcher = fetch, now = Date.now() } = {}) {
  if (!emailEnabled(env)) return;
  // Stop uncertain retries before the provider's 24h deduplication window expires.
  await env.DB.prepare(`UPDATE email_outbox SET status = 'failed', last_error = 'retry_window_expired'
    WHERE status = 'pending' AND created_at < ?`).bind(now - 20 * 60 * 60 * 1000).run();
  const { results } = await env.DB.prepare(`SELECT id FROM email_outbox
    WHERE status = 'pending' AND next_attempt <= ? AND (? IS NULL OR id = ?)
    ORDER BY next_attempt LIMIT 5`).bind(now, id, id).all();
  for (const candidate of results) {
    // A conditional lease prevents request and cron invocations from racing.
    const row = await env.DB.prepare(`UPDATE email_outbox SET next_attempt = ?, attempts = attempts + 1
      WHERE id = ? AND status = 'pending' AND next_attempt <= ? RETURNING *`)
      .bind(now + 120000, candidate.id, now).first();
    if (!row) continue;
    let failure = 'network';
    let transient = true;
    try {
      const message = JSON.parse(row.message);
      if (row.photo_key) {
        const object = await env.PHOTOS?.get(row.photo_key);
        if (!object) throw new Error('Photo unavailable');
        const content = Buffer.from(await object.arrayBuffer()).toString('base64');
        message.attachments = [{ filename: `fotografija.${row.photo_key.split('.').pop()}`, content }];
      }
      const response = await fetcher('https://api.resend.com/emails', {
        method: 'POST', headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`,
          'Content-Type': 'application/json', 'Idempotency-Key': `submission/${row.id}` },
        body: JSON.stringify(message), signal: AbortSignal.timeout(12000),
      });
      if (response.ok) {
        const data = await response.json();
        if (!data.id) throw new Error('Missing provider receipt');
        await env.DB.prepare(`UPDATE email_outbox SET status = 'sent', provider_id = ?, last_error = NULL
          WHERE id = ?`).bind(data.id, row.id).run();
        continue;
      }
      failure = `http_${response.status}`;
      transient = response.status === 429 || response.status === 408 || response.status === 409 || response.status >= 500;
      await response.body?.cancel();
    } catch {
      // Do not log API tokens, submitted content or email addresses.
    }
    const status = transient && row.attempts < 8 ? 'pending' : 'failed';
    const next = now + Math.min(60, 5 * 2 ** (row.attempts - 1)) * 60000;
    await env.DB.prepare(`UPDATE email_outbox SET status = ?, next_attempt = ?, last_error = ? WHERE id = ?`)
      .bind(status, next, failure, row.id).run();
    console.warn(JSON.stringify({ event: 'email_delivery', status, reason: failure }));
  }
}

export async function processEmail(env, options) {
  try { await deliverPending(env, options); }
  catch { console.error(JSON.stringify({ event: 'email_queue_unavailable' })); }
}
