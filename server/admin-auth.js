import { timingSafeEqual } from "node:crypto";
import { verifyBot } from "./bot-protection.js";

const MINUTE = 60000;
const HOUR = 60 * MINUTE;
const encoder = new TextEncoder();
const hex = (value) =>
  [...new Uint8Array(value)]
    .map((v) => v.toString(16).padStart(2, "0"))
    .join("");
const random = () => hex(crypto.getRandomValues(new Uint8Array(32)));
const digest = async (value) =>
  hex(await crypto.subtle.digest("SHA-256", encoder.encode(value)));
const unhex = (value) =>
  Uint8Array.from(value.match(/../g) || [], (v) => parseInt(v, 16));
const hashPattern = /^v1:100000:(?:[a-f0-9]{2}){16,64}:[a-f0-9]{64}$/i;
const authHeaders = {
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "same-origin",
};
const json = (value, status = 200, extra = {}) =>
  Response.json(value, { status, headers: { ...authHeaders, ...extra } });
export class AuthError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
const fail = (status, message) => {
  throw new AuthError(status, message);
};
function equal(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length)
    return false;
  return timingSafeEqual(encoder.encode(a), encoder.encode(b));
}
function db(env) {
  if (!env.DB) fail(503, "Skrbniška shramba trenutno ni povezana.");
  return env.DB;
}
function secret(env) {
  if (
    typeof env.ADMIN_PASSWORD_HASH !== "string" ||
    !hashPattern.test(env.ADMIN_PASSWORD_HASH)
  )
    fail(503, "Skrbniška prijava trenutno ni pripravljena.");
  return env.ADMIN_PASSWORD_HASH;
}
function email(value) {
  if (typeof value !== "string") fail(400, "Vnesite veljaven e-poštni naslov.");
  const normalized = value.trim().toLowerCase();
  if (
    normalized.length > 254 ||
    !/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/.test(
      normalized,
    )
  )
    fail(400, "Vnesite veljaven e-poštni naslov.");
  return normalized;
}
function ownerEmail(env) {
  try {
    return email(env.ADMIN_OWNER_EMAIL || env.EMAIL_TO);
  } catch {
    fail(503, "Lastniški račun trenutno ni nastavljen.");
  }
}
function cookieName(request, env) {
  const url = new URL(request.url);
  const local = ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname);
  if (env.LOCAL_STORAGE && !local)
    fail(503, "Lokalna skrbniška prijava ni na voljo na tem naslovu.");
  if (env.LOCAL_STORAGE && local) return "kpv_admin_dev";
  if (url.protocol !== "https:")
    fail(403, "Za prijavo uporabite varno povezavo HTTPS.");
  return "__Host-kpv_admin";
}
export function adminCookie(request, env, value, maxAge) {
  const name = cookieName(request, env);
  return `${name}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${name === "__Host-kpv_admin" ? "; Secure" : ""}`;
}
function sameOrigin(request) {
  if (
    request.headers.get("origin") !== new URL(request.url).origin ||
    request.headers.get("sec-fetch-site") === "cross-site"
  )
    fail(403, "Oddaja z druge spletne strani ni dovoljena.");
}
function method(request, expected) {
  if (request.method !== expected) fail(405, "Metoda ni dovoljena.");
}
async function body(request) {
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    fail(415, "Pričakovana je oddaja JSON.");
  if (Number(request.headers.get("content-length")) > 8192)
    fail(413, "Oddaja je prevelika.");
  const reader = request.body?.getReader();
  if (!reader) fail(400, "Oddaja je prazna.");
  const parts = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 8192) {
      await reader.cancel();
      fail(413, "Oddaja je prevelika.");
    }
    parts.push(value);
  }
  let value;
  try {
    const buffer = new Uint8Array(size);
    let at = 0;
    for (const part of parts) {
      buffer.set(part, at);
      at += part.length;
    }
    value = JSON.parse(new TextDecoder().decode(buffer));
  } catch {
    fail(400, "Oddaja ni veljavna.");
  }
  if (!value || typeof value !== "object" || Array.isArray(value))
    fail(400, "Oddaja ni veljavna.");
  return value;
}
async function bootstrap(env) {
  secret(env);
  const owner = ownerEmail(env);
  await db(env)
    .prepare(
      "INSERT INTO admin_users(email,role,status,password_hash,version,created_at,updated_at) VALUES(?,'owner','active',NULL,1,?,?) ON CONFLICT(email) DO NOTHING",
    )
    .bind(owner, Date.now(), Date.now())
    .run();
  return owner;
}
async function user(env, address) {
  return db(env)
    .prepare("SELECT * FROM admin_users WHERE email = ?")
    .bind(address)
    .first();
}
function passwordHash(env, person) {
  if (person?.email === ownerEmail(env) && person.role === "owner")
    return secret(env);
  return person?.password_hash && hashPattern.test(person.password_hash)
    ? person.password_hash
    : null;
}
async function passwordTag(env, person) {
  const hash = passwordHash(env, person);
  return hash ? digest(`${hash}:${person.version}:email-2fa-v2`) : "";
}
export async function hashAdminPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(24));
  const material = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const value = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations: 100000 },
    material,
    256,
  );
  return `v1:100000:${hex(salt)}:${hex(value)}`;
}
async function validPassword(value, configuration) {
  if (typeof value !== "string" || value.length < 1 || value.length > 256)
    return false;
  const [, , salt, expected] = configuration.split(":");
  const material = await crypto.subtle.importKey(
    "raw",
    encoder.encode(value),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: unhex(salt), iterations: 100000 },
    material,
    256,
  );
  return equal(hex(bits), expected.toLowerCase());
}
async function limit(env, key, max, period = 15 * MINUTE) {
  const window = Math.floor(Date.now() / period);
  const row = await db(env)
    .prepare(
      "INSERT INTO admin_login_limits(key,window,attempts) VALUES(?,?,1) ON CONFLICT(key,window) DO UPDATE SET attempts = attempts + 1 RETURNING attempts",
    )
    .bind(`${period}:${key}`, window)
    .first();
  if (row.attempts > max)
    fail(429, "Preveč poskusov. Počakajte 15 minut in poskusite znova.");
}
const ipKey = async (request) =>
  digest(request.headers.get("cf-connecting-ip") || "unknown");
function code() {
  const values = new Uint32Array(1);
  let value;
  do {
    crypto.getRandomValues(values);
    value = values[0];
  } while (value >= 4200000000);
  return String(value % 100000000).padStart(8, "0");
}
const otpHash = (env, id, value) => digest(`${id}:${value}:${secret(env)}`);
const escape = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
async function mail(env, address, challengeId, value, purpose, expiresAt) {
  const invite = purpose === "enroll";
  const href = `https://kpv.jakobtominc.com/admin${invite ? `?invite=${challengeId}` : ""}`;
  const title = invite
    ? "Povabilo v uredništvo KPV"
    : "Potrdite prijavo v uredništvo KPV";
  const explanation = invite
    ? "Lastnik portala vam je omogočil uredniški dostop. Odprite povezavo, vnesite svoj e-poštni naslov in spodnjo kodo ter določite svoje geslo."
    : "Za dokončanje prijave z e-pošto in geslom v konzolo vnesite spodnjo enkratno kodo.";
  const deadline = new Intl.DateTimeFormat("sl-SI", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Europe/Ljubljana",
  }).format(new Date(expiresAt));
  const expiry = invite
    ? "Koda velja 24 ur. Po petih napačnih poskusih prosite lastnika za novo povabilo."
    : `Koda velja do ${deadline} (čas v Sloveniji). Uporabite jo samo na strani, kjer ste začeli prijavo.`;
  const message = {
    from: env.EMAIL_FROM,
    to: [address],
    subject: title,
    text: `${title}\n\n${explanation}\n\nKoda: ${value}\n${expiry}\n\n${href}\n\nČe tega niste pričakovali, sporočilo prezrite. Kode ne posredujte drugim osebam.`,
    html: `<!doctype html><html lang="sl"><head><meta charset="utf-8"><title>${title}</title></head><body style="margin:0;padding:24px;background:#f1f5f2;font-family:Arial,sans-serif;color:#183b2d"><main style="max-width:560px;margin:auto;background:white;padding:28px;border-radius:16px"><p>KPV · UREDNIŠTVO</p><h1 style="font-size:24px">${title}</h1><p style="font-size:16px;line-height:1.6">${explanation}</p><p style="font-size:32px;font-family:monospace;letter-spacing:4px;text-align:center">${value}</p><p style="font-size:16px;line-height:1.6">${expiry}</p><p><a href="${escape(href)}" style="display:inline-block;padding:14px 18px;background:#194f3a;color:white;border-radius:8px">${invite ? "Nastavi svoj dostop" : "Odpri konzolo"}</a></p><p style="font-size:14px;line-height:1.6">Če tega niste pričakovali, sporočilo prezrite. Kode ne posredujte drugim osebam.</p></main></body></html>`,
  };
  // Local mail is a private file/mock, never a public code endpoint or production bypass.
  if (env.LOCAL_STORAGE) {
    if (typeof env.ADMIN_AUTH_SEND !== "function")
      fail(503, "Lokalna dostava prijavne kode ni nastavljena.");
    await env.ADMIN_AUTH_SEND(message);
    return;
  }
  if (!env.RESEND_API_KEY || !env.EMAIL_FROM)
    fail(503, "Pošiljanje prijavne kode trenutno ni nastavljeno.");
  let response;
  try {
    response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `admin-auth/${challengeId}/${await digest(value)}`,
      },
      body: JSON.stringify(message),
      signal: AbortSignal.timeout(12000),
    });
    if (response.ok) {
      const receipt = await response.json();
      if (typeof receipt.id === "string") return;
    } else await response.body?.cancel();
  } catch {
    /* No credentials, codes or recipient details in logs. */
  }
  fail(503, "Prijavne kode ni bilo mogoče poslati. Poskusite znova pozneje.");
}
async function challenge(env, person, purpose, deadline = null) {
  await limit(env, `mail:${await digest(person.email)}`, 5);
  const now = Date.now();
  const id = random();
  const value = code();
  const expires =
    deadline ?? now + (purpose === "enroll" ? 24 * HOUR : 10 * MINUTE);
  const tag =
    purpose === "login"
      ? await passwordTag(env, person)
      : `invited:${person.version}`;
  await db(env)
    .prepare(
      "INSERT INTO admin_auth_challenges(id,email,purpose,code_hash,credential_tag,created_at,expires_at,resend_at,attempts,consumed_at) VALUES(?,?,?,?,?,?,?,?,0,NULL)",
    )
    .bind(
      id,
      person.email,
      purpose,
      await otpHash(env, id, value),
      tag,
      now,
      expires,
      now + MINUTE,
    )
    .run();
  try {
    await mail(env, person.email, id, value, purpose, expires);
  } catch (error) {
    await db(env)
      .prepare("UPDATE admin_auth_challenges SET consumed_at = ? WHERE id = ?")
      .bind(Date.now(), id)
      .run();
    throw error;
  }
  return {
    verificationRequired: true,
    challengeId: id,
    expiresAt: new Date(expires).toISOString(),
    resendAfter: new Date(now + MINUTE).toISOString(),
  };
}
async function audit(env, actor, event, target = actor) {
  await db(env)
    .prepare(
      "INSERT INTO admin_auth_events(id,actor_email,event,target_email,created_at) VALUES(?,?,?,?,?)",
    )
    .bind(crypto.randomUUID(), actor, event, target, new Date().toISOString())
    .run();
}
function sessionPayload(row) {
  return {
    authenticated: true,
    csrfToken: row.csrf_token,
    expiresAt: new Date(row.expires_at).toISOString(),
    user: { email: row.email, role: row.role },
  };
}
export async function authenticateAdmin(request, env) {
  db(env);
  secret(env);
  const name = cookieName(request, env);
  const values = (request.headers.get("cookie") || "")
    .split(";")
    .map((v) => v.trim())
    .filter((v) => v.startsWith(`${name}=`));
  if (
    values.length !== 1 ||
    !/^[a-f0-9]{64}$/.test(values[0].slice(name.length + 1))
  )
    fail(401, "Za nadaljevanje se prijavite.");
  const row = await db(env)
    .prepare(
      "SELECT s.*,u.email,u.role,u.password_hash,u.version,u.status FROM admin_sessions s JOIN admin_session_users m ON m.token_hash=s.token_hash JOIN admin_users u ON u.email=m.email WHERE s.token_hash=? AND s.expires_at>? AND u.status='active'",
    )
    .bind(await digest(values[0].slice(name.length + 1)), Date.now())
    .first();
  if (!row || !equal(row.password_tag, await passwordTag(env, row)))
    fail(401, "Prijava je potekla. Prijavite se znova.");
  if (!["GET", "HEAD"].includes(request.method)) {
    sameOrigin(request);
    if (!equal(row.csrf_token, request.headers.get("x-csrf-token")))
      fail(403, "Varnostna potrditev ni veljavna. Osvežite prijavo.");
  }
  return row;
}
async function createSession(request, env, person) {
  const token = random();
  const tokenHash = await digest(token);
  const csrfToken = random();
  const now = Date.now();
  const expires = now + 8 * HOUR;
  await db(env).batch([
    db(env)
      .prepare(
        "INSERT INTO admin_sessions(token_hash,csrf_token,password_tag,created_at,expires_at) VALUES(?,?,?,?,?)",
      )
      .bind(tokenHash, csrfToken, await passwordTag(env, person), now, expires),
    db(env)
      .prepare("INSERT INTO admin_session_users(token_hash,email) VALUES(?,?)")
      .bind(tokenHash, person.email),
  ]);
  await audit(env, person.email, "login");
  return json(
    sessionPayload({
      csrf_token: csrfToken,
      expires_at: expires,
      email: person.email,
      role: person.role,
    }),
    200,
    { "Set-Cookie": adminCookie(request, env, token, 8 * 3600) },
  );
}
async function login(request, env) {
  method(request, "POST");
  sameOrigin(request);
  cookieName(request, env);
  await bootstrap(env);
  const input = await body(request);
  await limit(env, `login-ip:${await ipKey(request)}`, 5);
  await verifyBot(
    request,
    env,
    input["cf-turnstile-response"],
    "adminlogin",
    input.website,
  );
  await limit(env, "login-global", 50);
  const address = email(input.email);
  await limit(env, `login-email:${await digest(address)}`, 5);
  const person = await user(env, address);
  const configuration = passwordHash(env, person) || secret(env);
  const correct = await validPassword(input.password, configuration);
  if (
    !person ||
    person.status !== "active" ||
    !passwordHash(env, person) ||
    !correct
  )
    fail(
      401,
      "E-poštni naslov ali geslo ni pravilno oziroma dostop ni omogočen.",
    );
  return json(await challenge(env, person, "login"));
}
async function consume(request, env, input, purpose) {
  await limit(env, `verify-ip:${await ipKey(request)}`, 30);
  if (
    typeof input.challengeId !== "string" ||
    !/^[a-f0-9]{64}$/.test(input.challengeId) ||
    typeof input.code !== "string" ||
    !/^\d{8}$/.test(input.code.trim())
  )
    fail(401, "Koda ni veljavna ali je potekla. Začnite znova.");
  const now = Date.now();
  const row = await db(env)
    .prepare(
      "UPDATE admin_auth_challenges SET attempts=attempts+1 WHERE id=? AND purpose=? AND consumed_at IS NULL AND expires_at>? AND attempts<5 RETURNING *",
    )
    .bind(input.challengeId, purpose, now)
    .first();
  if (
    !row ||
    !equal(
      row.code_hash,
      await otpHash(env, input.challengeId, input.code.trim()),
    )
  )
    fail(401, "Koda ni veljavna ali je potekla. Začnite znova.");
  const person = await user(env, row.email);
  if (purpose === "enroll" && person?.email !== input.email)
    fail(401, "Povabilo ni veljavno za ta račun.");
  const tag =
    purpose === "login" && person?.status === "active"
      ? await passwordTag(env, person)
      : purpose === "enroll" && person?.status === "invited"
        ? `invited:${person.version}`
        : "";
  if (!tag || !equal(tag, row.credential_tag))
    fail(401, "Dostop se je spremenil. Začnite znova.");
  const used = await db(env)
    .prepare(
      "UPDATE admin_auth_challenges SET consumed_at=? WHERE id=? AND consumed_at IS NULL AND expires_at>? AND code_hash=? AND attempts<=5 RETURNING id",
    )
    .bind(now, row.id, now, row.code_hash)
    .first();
  if (!used) fail(401, "Koda je že uporabljena ali je potekla. Začnite znova.");
  return person;
}
async function verify(request, env) {
  method(request, "POST");
  sameOrigin(request);
  cookieName(request, env);
  await bootstrap(env);
  const person = await consume(request, env, await body(request), "login");
  return createSession(request, env, person);
}
async function resend(request, env) {
  method(request, "POST");
  sameOrigin(request);
  cookieName(request, env);
  await bootstrap(env);
  const input = await body(request);
  await limit(env, `resend-ip:${await ipKey(request)}`, 5);
  if (
    typeof input.challengeId !== "string" ||
    !/^[a-f0-9]{64}$/.test(input.challengeId)
  )
    fail(400, "Začnite prijavo znova.");
  const now = Date.now();
  const original = await db(env)
    .prepare(
      "SELECT * FROM admin_auth_challenges WHERE id=? AND purpose='login' AND consumed_at IS NULL AND expires_at>? AND attempts<5",
    )
    .bind(input.challengeId, now)
    .first();
  if (!original) fail(401, "Prijava je potekla. Začnite znova.");
  if (original.resend_at > now)
    fail(429, "Pred ponovnim pošiljanjem počakajte eno minuto.");
  const person = await user(env, original.email);
  if (
    !person ||
    person.status !== "active" ||
    !equal(original.credential_tag, await passwordTag(env, person))
  )
    fail(401, "Dostop se je spremenil. Začnite znova.");
  const lease = await db(env)
    .prepare(
      "UPDATE admin_auth_challenges SET consumed_at=? WHERE id=? AND consumed_at IS NULL AND resend_at<=? RETURNING id",
    )
    .bind(now, original.id, now)
    .first();
  if (!lease) fail(429, "Počakajte in začnite prijavo znova.");
  // Resending must not extend the first-factor authentication window indefinitely.
  return json(await challenge(env, person, "login", original.expires_at));
}
async function enroll(request, env) {
  method(request, "POST");
  sameOrigin(request);
  cookieName(request, env);
  await bootstrap(env);
  const input = await body(request);
  if (
    typeof input.password !== "string" ||
    input.password.length < 12 ||
    input.password.length > 128 ||
    input.password.trim().length < 12
  )
    fail(400, "Novo geslo naj ima od 12 do 128 znakov.");
  const address = email(input.email);
  input.email = address;
  const person = await consume(request, env, input, "enroll");
  if (person.email !== address || person.email === ownerEmail(env))
    fail(401, "Povabilo ni veljavno za ta račun.");
  const updated = await db(env)
    .prepare(
      "UPDATE admin_users SET password_hash=?,status='active',version=version+1,updated_at=? WHERE email=? AND status='invited' AND version=? RETURNING email",
    )
    .bind(
      await hashAdminPassword(input.password),
      Date.now(),
      person.email,
      person.version,
    )
    .first();
  if (!updated)
    fail(409, "Dostop je bil spremenjen. Prosite lastnika za novo povabilo.");
  await audit(env, person.email, "enrolled");
  return json({
    enrolled: true,
    message:
      "Geslo je shranjeno. Zdaj se prijavite z e-pošto, geslom in novo prijavno kodo.",
  });
}
async function adminUsers(request, env, session) {
  if (session.role !== "owner" || session.email !== ownerEmail(env))
    fail(403, "Dostop uporabnikov upravlja samo lastnik portala.");
  const path = new URL(request.url).pathname;
  if (path === "/api/admin/users" && request.method === "GET") {
    const { results } = await db(env)
      .prepare(
        "SELECT email,role,status,created_at,updated_at FROM admin_users ORDER BY role DESC,email",
      )
      .all();
    return json({ items: results, ownerEmail: ownerEmail(env) });
  }
  if (path === "/api/admin/users" && request.method === "POST") {
    const input = await body(request);
    const address = email(input.email);
    if (address === ownerEmail(env))
      fail(400, "Lastniški račun je že omogočen.");
    await limit(env, `invite:${await digest(session.email)}`, 10);
    const previous = await user(env, address);
    if (previous?.status === "active")
      fail(
        409,
        "Ta urednik že ima dostop. Za ponastavitev najprej prekličite njegov dostop in ga ponovno povabite.",
      );
    await db(env)
      .prepare(
        "INSERT INTO admin_users(email,role,status,password_hash,version,created_at,updated_at) VALUES(?,'editor','invited',NULL,1,?,?) ON CONFLICT(email) DO UPDATE SET role='editor',status='invited',password_hash=NULL,version=version+1,updated_at=excluded.updated_at",
      )
      .bind(address, Date.now(), Date.now())
      .run();
    const person = await user(env, address);
    try {
      await challenge(env, person, "enroll");
    } catch (error) {
      await audit(env, session.email, "invitation-send-failed", address);
      throw error;
    }
    await audit(env, session.email, "invited", address);
    return json({ invited: true }, 201);
  }
  if (path === "/api/admin/users/revoke") {
    method(request, "POST");
    const input = await body(request);
    const address = email(input.email);
    if (address === ownerEmail(env))
      fail(400, "Lastniškega dostopa ni mogoče preklicati.");
    await db(env).batch([
      db(env)
        .prepare(
          "UPDATE admin_users SET status='revoked',password_hash=NULL,version=version+1,updated_at=? WHERE email=? AND role='editor'",
        )
        .bind(Date.now(), address),
      db(env)
        .prepare(
          "DELETE FROM admin_sessions WHERE token_hash IN (SELECT token_hash FROM admin_session_users WHERE email=?)",
        )
        .bind(address),
      db(env)
        .prepare("DELETE FROM admin_session_users WHERE email=?")
        .bind(address),
      db(env)
        .prepare(
          "UPDATE admin_auth_challenges SET consumed_at=? WHERE email=? AND consumed_at IS NULL",
        )
        .bind(Date.now(), address),
    ]);
    await audit(env, session.email, "revoked", address);
    return json({ revoked: true });
  }
  fail(405, "Metoda ni dovoljena.");
}
export async function handleAdminAuth(request, env, session = null) {
  const path = new URL(request.url).pathname;
  if (path === "/api/admin/login") return login(request, env);
  if (path === "/api/admin/verify") return verify(request, env);
  if (path === "/api/admin/resend") return resend(request, env);
  if (path === "/api/admin/enroll") return enroll(request, env);
  if (!session) return null;
  if (path.startsWith("/api/admin/users"))
    return adminUsers(request, env, session);
  if (path === "/api/admin/session") {
    method(request, "GET");
    return json(sessionPayload(session));
  }
  if (path === "/api/admin/logout") {
    method(request, "POST");
    await db(env).batch([
      db(env)
        .prepare("DELETE FROM admin_sessions WHERE token_hash=?")
        .bind(session.token_hash),
      db(env)
        .prepare("DELETE FROM admin_session_users WHERE token_hash=?")
        .bind(session.token_hash),
    ]);
    return json({ authenticated: false }, 200, {
      "Set-Cookie": adminCookie(request, env, "", 0),
    });
  }
  return null;
}
export async function cleanupAdminAuth(env) {
  if (!env.DB) return;
  const now = Date.now();
  await db(env)
    .prepare(
      "DELETE FROM admin_auth_challenges WHERE rowid IN (SELECT rowid FROM admin_auth_challenges WHERE expires_at<? ORDER BY expires_at LIMIT 500)",
    )
    .bind(now)
    .run();
  await db(env)
    .prepare(
      "DELETE FROM admin_session_users WHERE rowid IN (SELECT rowid FROM admin_session_users WHERE token_hash NOT IN (SELECT token_hash FROM admin_sessions) LIMIT 500)",
    )
    .run();
}
