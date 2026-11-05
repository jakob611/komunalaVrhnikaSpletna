import { Buffer } from "node:buffer";
import { timingSafeEqual } from "node:crypto";

const encoder = new TextEncoder();
const scopeNote =
  "Izbris velja za podatke v portalu in njegove fotografije. Že poslana e-pošta, kopije pri ponudnikih, varnostne kopije in morebitne ločene evidence niso izbrisane s tem postopkom.";
const hex = (value) => Buffer.from(value).toString("hex");
const digest = async (value) =>
  hex(await crypto.subtle.digest("SHA-256", encoder.encode(value)));
async function sign(env, value) {
  const secret = env.SUBSCRIPTION_SIGNING_SECRET || env.ADMIN_PASSWORD_HASH;
  if (!secret) throw Error("Privacy confirmation signing unavailable");
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return hex(await crypto.subtle.sign("HMAC", key, encoder.encode(value)));
}
function referenceValue(input, fail) {
  if (typeof input !== "string" || !input.trim() || input.length > 254)
    fail(400, "Vnesite e-poštni naslov osebe ali referenco oddaje.");
  const value = input.trim();
  if (/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(value))
    return { kind: "email", value: value.toLowerCase() };
  if (/^KPV-[A-Za-z0-9_-]{1,96}$/.test(value))
    return { kind: "submission", value };
  fail(400, "Vnesite veljaven e-poštni naslov ali referenco oddaje KPV-.");
}
async function all(db, query, ...args) {
  return (
    await db
      .prepare(query)
      .bind(...args)
      .all()
  ).results;
}
async function snapshot(env, reference, fail) {
  const predicate =
    reference.kind === "email"
      ? "lower(json_extract(payload,'$.email'))=?"
      : "id=?";
  const selectedIds = `SELECT id FROM submissions WHERE ${predicate} UNION ALL SELECT id FROM contact_submissions WHERE ${predicate}`;
  const submissions = await all(
    env.DB,
    `SELECT 'submissions' AS source,* FROM submissions WHERE ${predicate}
    UNION ALL SELECT 'contact_submissions' AS source,* FROM contact_submissions WHERE ${predicate} ORDER BY id LIMIT 201`,
    reference.value,
    reference.value,
  );
  if (submissions.length > 200)
    fail(
      413,
      "Za ta naslov je več kot 200 oddaj. Izbris izvedite po posameznih referencah in nato ponovno preverite naslov.",
    );
  const subscribers =
    reference.kind === "email"
      ? await all(
          env.DB,
          "SELECT * FROM email_subscribers WHERE email=?",
          reference.value,
        )
      : [];
  const deliveries = [];
  for (const person of subscribers)
    deliveries.push(
      ...(await all(
        env.DB,
        "SELECT * FROM subscription_deliveries WHERE subscriber_id=? ORDER BY outbox_id LIMIT 501",
        person.id,
      )),
    );
  if (deliveries.length > 500)
    fail(
      413,
      "Naročnina vsebuje več kot 500 dostav. Pred izbrisom je potrebna obravnava evidence dostav.",
    );
  const outboxIds = [
    ...new Set([
      ...submissions.map((row) => row.id),
      ...deliveries.map((row) => row.outbox_id),
    ]),
  ].sort();
  const outbox = await all(
    env.DB,
    `SELECT * FROM email_outbox WHERE id IN (${selectedIds}) OR id IN
    (SELECT outbox_id FROM subscription_deliveries WHERE subscriber_id IN (SELECT id FROM email_subscribers WHERE email=?)) ORDER BY id`,
    reference.value,
    reference.value,
    reference.kind === "email" ? reference.value : "",
  );
  const cases = await all(
    env.DB,
    `SELECT * FROM admin_cases WHERE submission_id IN (${selectedIds}) ORDER BY submission_id`,
    reference.value,
    reference.value,
  );
  const events = await all(
    env.DB,
    `SELECT * FROM admin_case_events WHERE submission_id IN (${selectedIds}) ORDER BY id`,
    reference.value,
    reference.value,
  );
  const photoKeys = [
    ...new Set(
      submissions
        .map((row) => JSON.parse(row.payload).photoKey)
        .filter(Boolean),
    ),
  ];
  if (
    photoKeys.some(
      (key) =>
        typeof key !== "string" ||
        !/^[A-Za-z0-9_-]+\.(?:jpg|png|webp)$/.test(key),
    )
  )
    fail(
      409,
      "Evidenca vsebuje nepričakovan ključ fotografije. Izbris mora preveriti skrbnik shrambe.",
    );
  const counts = {
    submissions: submissions.length,
    cases: cases.length,
    events: events.length,
    subscribers: subscribers.length,
    deliveries: deliveries.length,
    outbox: outbox.length,
    photos: photoKeys.length,
  };
  const fingerprint = await digest(
    JSON.stringify({
      submissions,
      subscribers,
      deliveries,
      outbox,
      cases,
      events,
    }),
  );
  return {
    submissions,
    subscribers,
    deliveries,
    outboxIds,
    photoKeys,
    counts,
    fingerprint,
  };
}
function deleteIds(db, table, column, ids) {
  const statements = [];
  for (let start = 0; start < ids.length; start += 50) {
    const chunk = ids.slice(start, start + 50);
    statements.push(
      db
        .prepare(
          `DELETE FROM ${table} WHERE ${column} IN (${chunk.map(() => "?").join(",")})`,
        )
        .bind(...chunk),
    );
  }
  return statements;
}
async function issueToken(env, session, reference, fingerprint) {
  const payload = Buffer.from(
    JSON.stringify({
      actor: session.email,
      reference,
      fingerprint,
      expires: Date.now() + 10 * 60000,
    }),
  ).toString("base64url");
  return `${payload}.${await sign(env, payload)}`;
}
async function verifyToken(env, session, reference, current, token, fail) {
  if (typeof token !== "string" || token.length > 2000)
    fail(400, "Najprej preverite obseg izbrisa.");
  const [payload, signature, ...rest] = token.split(".");
  if (rest.length || !/^[a-f0-9]{64}$/.test(signature || "") || !payload)
    fail(400, "Potrditev izbrisa ni veljavna.");
  const expected = await sign(env, payload);
  if (!timingSafeEqual(encoder.encode(signature), encoder.encode(expected)))
    fail(400, "Potrditev izbrisa ni veljavna.");
  let value;
  try {
    value = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    fail(400, "Potrditev izbrisa ni veljavna.");
  }
  if (
    value.actor !== session.email ||
    JSON.stringify(value.reference) !== JSON.stringify(reference) ||
    value.expires < Date.now()
  )
    fail(410, "Preverjanje izbrisa je poteklo. Ponovno preverite obseg.");
  if (value.fingerprint !== current.fingerprint)
    fail(
      409,
      "Podatki so se po preverjanju spremenili. Ponovno preverite obseg izbrisa.",
    );
}

// The router authenticates the session and enforces Origin+CSRF before calling.
export async function handlePrivacy(
  request,
  env,
  { session, json, body, fail },
) {
  const path = new URL(request.url).pathname;
  if (
    !["/api/admin/privacy/preview", "/api/admin/privacy/erase"].includes(path)
  )
    return null;
  if (
    session?.role !== "owner" ||
    session.email !==
      String(env.ADMIN_OWNER_EMAIL || env.EMAIL_TO || "")
        .trim()
        .toLowerCase()
  )
    fail(403, "Izbris osebnih podatkov lahko izvede samo lastnik portala.");
  if (request.method !== "POST") fail(405, "Metoda ni dovoljena.");
  if (!env.DB) fail(503, "Shramba portala ni na voljo.");
  const input = await body(request, 8192),
    reference = referenceValue(input.reference, fail);
  const current = await snapshot(env, reference, fail);
  if (path.endsWith("/preview"))
    return json({
      counts: current.counts,
      confirmationToken: await issueToken(
        env,
        session,
        reference,
        current.fingerprint,
      ),
      scopeNote,
    });
  await verifyToken(
    env,
    session,
    reference,
    current,
    input.confirmationToken,
    fail,
  );
  // Stop queued deliveries before touching object storage. Already in-flight or
  // provider-accepted email cannot be recalled by a database deletion.
  const cancel = [];
  for (const person of current.subscribers)
    cancel.push(
      env.DB.prepare(
        `UPDATE email_subscribers SET status='suppressed',pending_payload=NULL,
    pending_version=pending_version+1,generation=generation+1 WHERE id=?`,
      ).bind(person.id),
    );
  if (cancel.length) await env.DB.batch(cancel.splice(0));
  // A campaign may have completed a batch between preview and suppression.
  // Its guarded queue inserts cannot add anything after suppression commits.
  for (const person of current.subscribers) {
    const deliveries = await all(
      env.DB,
      "SELECT outbox_id FROM subscription_deliveries WHERE subscriber_id=?",
      person.id,
    );
    current.outboxIds = [
      ...new Set([
        ...current.outboxIds,
        ...deliveries.map((row) => row.outbox_id),
      ]),
    ];
    current.counts.deliveries = deliveries.length;
  }
  current.counts.outbox = 0;
  for (let at = 0; at < current.outboxIds.length; at += 50) {
    const ids = current.outboxIds.slice(at, at + 50);
    const row = await env.DB.prepare(
      `SELECT COUNT(*) AS n FROM email_outbox WHERE id IN (${ids.map(() => "?").join(",")})`,
    )
      .bind(...ids)
      .first();
    current.counts.outbox += row.n;
  }
  for (let at = 0; at < current.outboxIds.length; at += 50) {
    const ids = current.outboxIds.slice(at, at + 50);
    cancel.push(
      env.DB.prepare(
        `UPDATE email_outbox SET status='failed',last_error='privacy_erasure_pending' WHERE id IN (${ids.map(() => "?").join(",")}) AND status='pending'`,
      ).bind(...ids),
    );
  }
  if (cancel.length) await env.DB.batch(cancel);
  if (current.photoKeys.length && !env.PHOTOS)
    fail(
      503,
      "Shramba fotografij ni povezana. Zapisi ostajajo shranjeni; po povezavi shrambe ponovno preverite izbris.",
    );
  try {
    for (const key of current.photoKeys) await env.PHOTOS.delete(key);
  } catch {
    fail(
      503,
      "Vseh fotografij ni bilo mogoče izbrisati. Zapisi ostajajo shranjeni, čakajoča pošta je ustavljena. Ponovno preverite in ponovite izbris.",
    );
  }
  const statements = [];
  statements.push(
    ...deleteIds(
      env.DB,
      "email_delivery_windows",
      "outbox_id",
      current.outboxIds,
    ),
    ...deleteIds(env.DB, "email_outbox", "id", current.outboxIds),
  );
  const submissionIds = current.submissions.map((row) => row.id);
  for (const table of [
    "admin_case_events",
    "admin_cases",
    "public_submission_requests",
  ])
    statements.push(
      ...deleteIds(env.DB, table, "submission_id", submissionIds),
    );
  for (const table of ["submissions", "contact_submissions"])
    statements.push(
      ...deleteIds(
        env.DB,
        table,
        "id",
        current.submissions
          .filter((row) => row.source === table)
          .map((row) => row.id),
      ),
    );
  for (const person of current.subscribers)
    statements.push(
      env.DB.prepare(
        "DELETE FROM subscription_deliveries WHERE subscriber_id=?",
      ).bind(person.id),
      env.DB.prepare(
        "DELETE FROM subscriber_management_versions WHERE subscriber_id=?",
      ).bind(person.id),
      env.DB.prepare("DELETE FROM email_subscribers WHERE id=?").bind(
        person.id,
      ),
    );
  statements.push(
    env.DB.prepare(
      "INSERT INTO privacy_erasure_events(id,created_at,counts) VALUES(?,?,?)",
    ).bind(crypto.randomUUID(), Date.now(), JSON.stringify(current.counts)),
  );
  await env.DB.batch(statements);
  return json({
    erased: true,
    counts: current.counts,
    scopeNote,
    message:
      "Podatki iz prikazanega obsega so izbrisani iz portala. Ločene kopije pri ponudnikih in prejemnikih preverite posebej.",
  });
}
