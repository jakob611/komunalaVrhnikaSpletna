import template from './email-template.generated.js';
import { Buffer } from 'node:buffer';
import { notificationRecipient } from './notification-settings.js';
import { subscriberDeliveryAllowed } from './subscriptions.js';
import {mapPointUrl,mapAddressUrl} from '../shared/location.js';

export function emailEnabled(env) {
  // File-backed development and automated tests never send real email.
  return !env.LOCAL_STORAGE && env.EMAIL_ENABLED === 'true' &&
    Boolean(env.RESEND_API_KEY && env.EMAIL_FROM && env.EMAIL_TO && env.DB);
}

const kinds = { contact: 'Kontaktno sporočilo', reports: 'Prijava poškodbe',
  requests: 'Povpraševanje za storitev', market: 'Prijava na tržnico', subscriptions: 'Naročilo obvestil' };
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
    if(['latitude','longitude'].includes(key))continue;
    const value = record.payload[key];
    if (value == null || value === '') continue;
    const display = choiceFields.has(key)
      ? (Array.isArray(value) ? value.map(v => values[v] || v).join(', ') : values[value] || value)
      : value;
    lines.push(`${label}: ${display}`);
  }
  const mapUrl=mapPointUrl(record.payload.latitude,record.payload.longitude)||mapAddressUrl(record.payload.address);
  if(mapUrl)lines.push(`Lokacija na zemljevidu: ${mapUrl}`);
  if (record.payload.photoKey) lines.push('Fotografija: v priponki.');
  if (record.kind === 'subscriptions') lines.push('', 'Preverite izbrane teme in zabeležite obravnavo naročila v konzoli.');
  const details = lines.join('\n');
  const detailsHtml = lines.map(line=>mapUrl&&line===`Lokacija na zemljevidu: ${mapUrl}`
    ? `Lokacija na zemljevidu: <a href="${escapeHtml(mapUrl)}">Odpri lokacijo v Google Zemljevidih</a>`
    : escapeHtml(line)).join('<br/>');
  const adminUrl = `https://kpv.jakobtominc.com/admin?case=${encodeURIComponent(record.id)}`;
  return {
    from: env.EMAIL_FROM, to: [env.EMAIL_TO], reply_to: record.payload.email,
    subject: `[KPV] ${title} · ${record.id.slice(0, 12)}`,
    html: template.replace('KPV_TITLE_TOKEN', escapeHtml(title)).replace('KPV_DETAILS_TOKEN', () => detailsHtml).replace('KPV_ADMIN_LINK_TOKEN', escapeHtml(adminUrl)),
    text: `${title}\n\n${details}\n\nObravnava v skrbniški konzoli (potrebna je prijava): ${adminUrl}\n\nOddaja je evidentirana. Termin storitve ali rezervacijo mora potrditi pristojna služba.`,
  };
}

// Keep the exact JSON stable across retries (Resend idempotency keys last 24h).
export async function outboxInsert(db, record, env) {
  const recipient = await notificationRecipient({ ...env, DB: db });
  return db.prepare(`INSERT INTO email_outbox (id, created_at, next_attempt, message, photo_key)
    VALUES (?, ?, ?, ?, ?)`).bind(record.id, Date.parse(record.createdAt), Date.parse(record.createdAt),
      JSON.stringify(notification(record, { ...env, EMAIL_TO: recipient })), record.payload.photoKey || null);
}

export async function deliverPending(env, { id = null, fetcher = fetch, now = Date.now(), limit = 20 } = {}) {
  if (!emailEnabled(env)) return;
  // Stop uncertain retries before the provider's 24h deduplication window expires.
  await env.DB.prepare(`UPDATE email_outbox SET status = 'failed', last_error = 'retry_window_expired'
    WHERE status = 'pending' AND EXISTS(SELECT 1 FROM email_delivery_windows w WHERE w.outbox_id=email_outbox.id AND w.started_at < ?)`).bind(now - 20 * 60 * 60 * 1000).run();
  const { results } = await env.DB.prepare(`SELECT id FROM email_outbox
    WHERE status = 'pending' AND next_attempt <= ? AND (? IS NULL OR id = ?)
    ORDER BY CASE WHEN id LIKE 'subscriber-confirm-%' THEN 0 WHEN id LIKE 'subscriber-notice-%' THEN 2 ELSE 1 END,next_attempt,id LIMIT ?`).bind(now, id, id, Math.max(1,Math.min(20,Math.floor(limit)||20))).all();
  if(!results.length)return;
  const claimed=await env.DB.batch(results.flatMap(candidate=>[
    env.DB.prepare(`INSERT OR IGNORE INTO email_delivery_windows(outbox_id,started_at) SELECT id,CASE WHEN attempts>0 THEN created_at ELSE ? END FROM email_outbox WHERE id=?`).bind(now,candidate.id),
    env.DB.prepare(`UPDATE email_outbox SET next_attempt=?,attempts=attempts+1 WHERE id=? AND status='pending' AND next_attempt<=? AND EXISTS(SELECT 1 FROM email_delivery_windows w WHERE w.outbox_id=email_outbox.id AND w.started_at>=?) RETURNING *`).bind(now+360000,candidate.id,now,now-20*60*60*1000)
  ]));
  const leases=claimed.filter((_,index)=>index%2===1);
  const settlements=[];
  let sentRequests=0;
  for (const lease of leases) {
    // A conditional lease prevents request and cron invocations from racing.
    const row=lease.results?.[0];
    if (!row) continue;
    if (!await subscriberDeliveryAllowed(env,row.id,now)) {
      settlements.push(env.DB.prepare("UPDATE email_outbox SET status='failed',last_error='subscription_inactive' WHERE id=?").bind(row.id));
      continue;
    }
    let failure = 'network';
    let transient = true;
    try {
      const message = JSON.parse(row.message);
      // Stay below the provider's standard two requests/second; mocks do not sleep.
      if(fetcher===fetch&&sentRequests++)await new Promise(resolve=>setTimeout(resolve,600));
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
        settlements.push(env.DB.prepare(`UPDATE email_outbox SET status = 'sent', provider_id = ?, last_error = NULL
          WHERE id = ?`).bind(data.id, row.id));
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
    settlements.push(env.DB.prepare(`UPDATE email_outbox SET status = ?, next_attempt = ?, last_error = ? WHERE id = ?`)
      .bind(status, next, failure, row.id));
    console.warn(JSON.stringify({ event: 'email_delivery', status, reason: failure }));
  }
  if(settlements.length)await env.DB.batch(settlements);
}

export async function processEmail(env, options) {
  try { await deliverPending(env, options); }
  catch { console.error(JSON.stringify({ event: 'email_queue_unavailable' })); }
}
