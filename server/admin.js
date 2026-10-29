import defaults from "../shared/site-defaults.json" with { type: "json" };
import { validateSection } from "../shared/cms-validation.js";
import { BotError, verifyBot } from "./bot-protection.js";
import { handleWork, getWorkItem, saveWorkItem } from "./work-queue.js";
import { timingSafeEqual } from "node:crypto";

const PHOTO_LIMIT = 5 * 1024 * 1024;
const HOUR = 60 * 60 * 1000;
const headers = {
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "same-origin",
};
class AdminError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
const fail = (status, message) => {
  throw new AdminError(status, message);
};
const json = (value, status = 200, extra = {}) =>
  Response.json(value, { status, headers: { ...headers, ...extra } });
const hex = (bytes) =>
  [...new Uint8Array(bytes)]
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
const random = () => hex(crypto.getRandomValues(new Uint8Array(32)));
const digest = async (text) =>
  hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)));
const unhex = (value) =>
  Uint8Array.from(value.match(/../g) || [], (byte) => parseInt(byte, 16));
function equal(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length)
    return false;
  const left = new TextEncoder().encode(a);
  const right = new TextEncoder().encode(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
function database(env) {
  if (!env.DB) fail(503, "Skrbniška shramba trenutno ni povezana.");
  return env.DB;
}
function secret(env) {
  const value = env.ADMIN_PASSWORD_HASH;
  if (
    typeof value !== "string" ||
    !/^v1:100000:(?:[a-f0-9]{2}){16,64}:[a-f0-9]{64}$/i.test(value)
  )
    fail(503, "Skrbniška prijava trenutno ni pripravljena.");
  return value;
}
function cookieName(request, env) {
  const url = new URL(request.url);
  const loopback = ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname);
  if (env.LOCAL_STORAGE && !loopback)
    fail(503, "Lokalna skrbniška prijava ni na voljo na tem naslovu.");
  if (env.LOCAL_STORAGE && loopback) return "kpv_admin_dev";
  if (url.protocol !== "https:")
    fail(403, "Za prijavo uporabite varno povezavo HTTPS.");
  return "__Host-kpv_admin";
}
function cookie(request, env, value, maxAge) {
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
function allow(request, method) {
  if (request.method !== method) fail(405, "Metoda ni dovoljena.");
}
async function bytes(request, limit) {
  if (Number(request.headers.get("content-length")) > limit)
    fail(413, "Oddaja je prevelika.");
  if (!request.body) fail(400, "Oddaja je prazna.");
  const reader = request.body.getReader();
  const chunks = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) {
      await reader.cancel();
      fail(413, "Oddaja je prevelika.");
    }
    chunks.push(value);
  }
  const output = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.length;
  }
  return output;
}
async function body(request, limit = 1024 * 1024) {
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    fail(415, "Pričakovana je oddaja JSON.");
  let data;
  try {
    data = JSON.parse(new TextDecoder().decode(await bytes(request, limit)));
  } catch (error) {
    if (error instanceof AdminError) throw error;
    fail(400, "Oddaja ni veljaven JSON.");
  }
  if (!data || typeof data !== "object" || Array.isArray(data))
    fail(400, "Oddaja ni veljavna.");
  return data;
}
function revision(value) {
  if (!Number.isSafeInteger(value) || value < 0)
    fail(400, "Revizija ni veljavna.");
  return value;
}
function sectionName(value) {
  if (!Object.hasOwn(defaults, value))
    fail(404, "Vsebinski razdelek ne obstaja.");
  return value;
}
async function authenticate(request, env) {
  const db = database(env);
  const configuration = secret(env);
  const name = cookieName(request, env);
  const values = (request.headers.get("cookie") || "")
    .split(";")
    .map((part) => part.trim())
    .filter((part) => part.startsWith(`${name}=`));
  if (values.length !== 1) fail(401, "Za nadaljevanje se prijavite.");
  const token = values[0].slice(name.length + 1);
  if (!/^[a-f0-9]{64}$/.test(token)) fail(401, "Za nadaljevanje se prijavite.");
  const row = await db
    .prepare(
      "SELECT * FROM admin_sessions WHERE token_hash = ? AND expires_at > ? AND password_tag = ?",
    )
    .bind(await digest(token), Date.now(), await digest(configuration))
    .first();
  if (!row) fail(401, "Prijava je potekla. Prijavite se znova.");
  if (!["GET", "HEAD"].includes(request.method)) {
    sameOrigin(request);
    if (!equal(row.csrf_token, request.headers.get("x-csrf-token")))
      fail(403, "Varnostna potrditev ni veljavna. Osvežite prijavo.");
  }
  return row;
}
async function content(env, admin = false) {
  const sections = structuredClone(defaults);
  const revisions = {};
  const metadata = {};
  Object.keys(defaults).forEach((section) => {
    revisions[section] = 0;
  });
  if (env.DB) {
    const { results } = await env.DB.prepare(
      "SELECT section, value, revision, updated_at FROM cms_content",
    ).all();
    for (const row of results)
      if (Object.hasOwn(defaults, row.section)) {
        sections[row.section] = validateSection(
          row.section,
          JSON.parse(row.value),
        );
        revisions[row.section] = row.revision;
        metadata[row.section] = {
          updatedAt: new Date(row.updated_at).toISOString(),
        };
      }
  }
  return { sections, revisions, ...(admin ? { metadata } : {}) };
}

/** Public operational feeds retain safe defaults during an unavailable CMS read. */
export async function readPublished(env, section) {
  sectionName(section);
  if (!env.DB) return structuredClone(defaults[section]);
  try {
    const row = await env.DB.prepare(
      "SELECT value FROM cms_content WHERE section = ?",
    )
      .bind(section)
      .first();
    return row
      ? validateSection(section, JSON.parse(row.value))
      : structuredClone(defaults[section]);
  } catch {
    return structuredClone(defaults[section]);
  }
}
async function save(env, section, value, expected, source = "edit") {
  const db = database(env);
  sectionName(section);
  revision(expected);
  const sanitized = validateSection(section, value);
  // Initial revision is retained for restoration. Triggers make every CAS write/history pair atomic.
  await db
    .prepare(
      "INSERT INTO cms_content(section,value,revision,updated_at,source) VALUES(?,?,0,?,'default') ON CONFLICT(section) DO NOTHING",
    )
    .bind(section, JSON.stringify(defaults[section]), Date.now())
    .run();
  const row = await db
    .prepare(
      "UPDATE cms_content SET value = ?, revision = revision + 1, updated_at = ?, source = ? WHERE section = ? AND revision = ? RETURNING revision",
    )
    .bind(JSON.stringify(sanitized), Date.now(), source, section, expected)
    .first();
  if (!row)
    fail(
      409,
      "Vsebino je medtem nekdo spremenil. Osvežite razdelek in poskusite znova.",
    );
  return { value: sanitized, revision: row.revision };
}
async function login(request, env) {
  allow(request, "POST");
  sameOrigin(request);
  const db = database(env);
  const configuration = secret(env);
  cookieName(request, env);
  const data = await body(request, 8192);
  const window = Math.floor(Date.now() / (15 * 60 * 1000));
  const ip = request.headers.get("cf-connecting-ip") || "unknown";
  const increment = (key) =>
    db
      .prepare(
        "INSERT INTO admin_login_limits(key,window,attempts) VALUES(?,?,1) ON CONFLICT(key,window) DO UPDATE SET attempts = attempts + 1 RETURNING attempts",
      )
      .bind(key, window)
      .first();
  if ((await increment(`ip:${await digest(ip)}`)).attempts > 5)
    fail(429, "Preveč poskusov prijave. Poskusite čez 15 minut.");
  await verifyBot(
    request,
    env,
    data["cf-turnstile-response"],
    "adminlogin",
    data.website,
  );
  // Anonymous failed challenges cannot exhaust the owner's global password-attempt budget.
  if ((await increment("global")).attempts > 50)
    fail(429, "Prijava je začasno omejena. Poskusite čez 15 minut.");
  if (
    typeof data.password !== "string" ||
    data.password.length < 1 ||
    data.password.length > 256
  )
    fail(401, "Geslo ni pravilno.");
  const [, , salt, expected] = configuration.split(":");
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(data.password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const derived = hex(
    await crypto.subtle.deriveBits(
      {
        name: "PBKDF2",
        hash: "SHA-256",
        salt: unhex(salt),
        iterations: 100000,
      },
      key,
      256,
    ),
  );
  if (!equal(derived, expected.toLowerCase())) fail(401, "Geslo ni pravilno.");
  const token = random();
  const csrfToken = random();
  const now = Date.now();
  const expires = now + 8 * HOUR;
  await db
    .prepare(
      "INSERT INTO admin_sessions(token_hash,csrf_token,password_tag,created_at,expires_at) VALUES(?,?,?,?,?)",
    )
    .bind(
      await digest(token),
      csrfToken,
      await digest(configuration),
      now,
      expires,
    )
    .run();
  await cleanupAdmin(env);
  return json(
    {
      authenticated: true,
      csrfToken,
      expiresAt: new Date(expires).toISOString(),
    },
    200,
    { "Set-Cookie": cookie(request, env, token, 8 * 3600) },
  );
}

/** Bounded maintenance can run alongside the email cron without delaying user requests. */
export async function cleanupAdmin(env = {}) {
  if (!env.DB) return;
  try {
    const now = Date.now();
    const currentWindow = Math.floor(now / (15 * 60 * 1000));
    await env.DB.prepare(
      "DELETE FROM admin_sessions WHERE rowid IN (SELECT rowid FROM admin_sessions WHERE expires_at <= ? ORDER BY expires_at LIMIT 500)",
    )
      .bind(now)
      .run();
    await env.DB.prepare(
      "DELETE FROM admin_login_limits WHERE rowid IN (SELECT rowid FROM admin_login_limits WHERE window < ? ORDER BY window LIMIT 500)",
    )
      .bind(currentWindow)
      .run();
  } catch {
    console.error(JSON.stringify({ event: "admin_cleanup_failed" }));
  }
}
function mediaItem(row) {
  return {
    id: row.id,
    url: `/api/media/${row.id}`,
    name: row.name,
    type: row.type,
    size: row.size,
    createdAt: new Date(row.created_at).toISOString(),
  };
}
async function publicMedia(request, env, id) {
  allow(request, "GET");
  if (!/^[a-f0-9-]{36}$/.test(id)) fail(404, "Slika ne obstaja.");
  const row = await database(env)
    .prepare("SELECT * FROM cms_media WHERE id = ?")
    .bind(id)
    .first();
  if (!row || !row.object_key.startsWith(`cms/${id}.`) || !env.PHOTOS)
    fail(404, "Slika ne obstaja.");
  const object = await env.PHOTOS.get(row.object_key);
  if (!object) fail(404, "Slika ne obstaja.");
  return new Response(object.body, {
    headers: {
      "Content-Type": row.type,
      "Content-Length": String(row.size),
      "Content-Disposition": "inline",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "public, max-age=86400",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    },
  });
}
async function upload(request, env) {
  if (!env.PHOTOS) fail(503, "Shramba slik trenutno ni povezana.");
  if (!request.headers.get("content-type")?.startsWith("multipart/form-data"))
    fail(415, "Sliko oddajte kot obrazec.");
  const bounded = await bytes(request, PHOTO_LIMIT + 65536);
  let form;
  try {
    form = await new Request(request.url, {
      method: "POST",
      headers: { "Content-Type": request.headers.get("content-type") },
      body: bounded,
    }).formData();
  } catch {
    fail(400, "Obrazca ni mogoče prebrati.");
  }
  const photo = form.get("photo");
  if (!photo || typeof photo === "string" || !photo.size)
    fail(400, "Izberite sliko.");
  if (photo.size > PHOTO_LIMIT) fail(413, "Slika je lahko velika največ 5 MB.");
  const value = new Uint8Array(await photo.arrayBuffer());
  const png =
    value.length > 8 &&
    [137, 80, 78, 71, 13, 10, 26, 10].every(
      (byte, index) => value[index] === byte,
    );
  const jpg =
    value.length > 4 &&
    value[0] === 255 &&
    value[1] === 216 &&
    value[2] === 255;
  const webp =
    value.length > 12 &&
    new TextDecoder().decode(value.slice(0, 4)) === "RIFF" &&
    new TextDecoder().decode(value.slice(8, 12)) === "WEBP";
  const extension =
    photo.type === "image/png" && png
      ? "png"
      : photo.type === "image/jpeg" && jpg
        ? "jpg"
        : photo.type === "image/webp" && webp
          ? "webp"
          : null;
  if (!extension) fail(400, "Dovoljene so prave slike JPG, PNG ali WebP.");
  const id = crypto.randomUUID();
  const key = `cms/${id}.${extension}`;
  const row = {
    id,
    object_key: key,
    name: (photo.name || "Slika")
      .replace(/[\u0000-\u001f\u007f\\/]/g, "_")
      .slice(0, 120),
    type: photo.type,
    size: photo.size,
    created_at: Date.now(),
  };
  await env.PHOTOS.put(key, value, { httpMetadata: { contentType: row.type } });
  try {
    await database(env)
      .prepare(
        "INSERT INTO cms_media(id,object_key,name,type,size,created_at) VALUES(?,?,?,?,?,?)",
      )
      .bind(id, key, row.name, row.type, row.size, row.created_at)
      .run();
  } catch (error) {
    await env.PHOTOS.delete(key);
    throw error;
  }
  return json(mediaItem(row), 201);
}
const kinds = ["subscriptions", "requests", "market", "reports", "contact"];
const statuses = ["demo-saved", "in-progress", "resolved", "spam"];
const submission = (row) => ({
  id: row.id,
  kind: row.kind,
  createdAt: row.created_at,
  status: row.status,
  payload: JSON.parse(row.payload),
});
async function findSubmission(env, id) {
  if (typeof id !== "string" || id.length > 100)
    fail(404, "Oddaja ne obstaja.");
  const row = await database(env)
    .prepare(
      "SELECT * FROM submissions WHERE id = ? UNION ALL SELECT * FROM contact_submissions WHERE id = ? LIMIT 1",
    )
    .bind(id, id)
    .first();
  if (!row) fail(404, "Oddaja ne obstaja.");
  return row;
}

/** Return null for routes handled by the normal public Worker. */
export async function handleAdmin(request, env = {}) {
  const url = new URL(request.url);
  const path = url.pathname;
  if (
    path !== "/api/content" &&
    !path.startsWith("/api/media/") &&
    !path.startsWith("/api/admin/")
  )
    return null;
  try {
    if (path === "/api/content") {
      allow(request, "GET");
      return json(await content(env));
    }
    if (path.startsWith("/api/media/"))
      return await publicMedia(request, env, path.slice("/api/media/".length));
    if (path === "/api/admin/login") return await login(request, env);
    const session = await authenticate(request, env);
    const workResponse = await handleWork(request, env, { json, body, fail });
    if (workResponse) return workResponse;
    const db = database(env);
    if (path === "/api/admin/session") {
      allow(request, "GET");
      return json({
        authenticated: true,
        csrfToken: session.csrf_token,
        expiresAt: new Date(session.expires_at).toISOString(),
      });
    }
    if (path === "/api/admin/logout") {
      allow(request, "POST");
      await db
        .prepare("DELETE FROM admin_sessions WHERE token_hash = ?")
        .bind(session.token_hash)
        .run();
      return json({ authenticated: false }, 200, {
        "Set-Cookie": cookie(request, env, "", 0),
      });
    }
    if (path === "/api/admin/content") {
      allow(request, "GET");
      return json(await content(env, true));
    }
    const edit = path.match(/^\/api\/admin\/content\/([A-Za-z0-9_-]+)$/);
    if (edit) {
      allow(request, "PUT");
      const data = await body(request);
      return json(await save(env, edit[1], data.value, data.revision));
    }
    const history = path.match(/^\/api\/admin\/history\/([A-Za-z0-9_-]+)$/);
    if (history) {
      allow(request, "GET");
      sectionName(history[1]);
      const { results } = await db
        .prepare(
          "SELECT revision,value,created_at,source FROM cms_history WHERE section = ? ORDER BY revision DESC LIMIT 10",
        )
        .bind(history[1])
        .all();
      const items = results.map((row) => ({
        revision: row.revision,
        value: JSON.parse(row.value),
        createdAt: new Date(row.created_at).toISOString(),
        source: row.source,
      }));
      if (!items.length)
        items.push({
          revision: 0,
          value: structuredClone(defaults[history[1]]),
          createdAt: null,
          source: "default",
        });
      return json({ items });
    }
    const restore = path.match(/^\/api\/admin\/restore\/([A-Za-z0-9_-]+)$/);
    if (restore) {
      allow(request, "POST");
      sectionName(restore[1]);
      const data = await body(request);
      revision(data.revision);
      const row = await db
        .prepare(
          "SELECT value FROM cms_history WHERE section = ? AND revision = ?",
        )
        .bind(restore[1], data.revision)
        .first();
      if (!row && data.revision !== 0) fail(404, "Revizija ne obstaja.");
      return json(
        await save(
          env,
          restore[1],
          row ? JSON.parse(row.value) : structuredClone(defaults[restore[1]]),
          data.currentRevision,
          "restore",
        ),
      );
    }
    if (path === "/api/admin/media") {
      if (request.method === "POST") return await upload(request, env);
      allow(request, "GET");
      const { results } = await db
        .prepare("SELECT * FROM cms_media ORDER BY created_at DESC LIMIT 100")
        .all();
      return json({ items: results.map(mediaItem) });
    }
    if (path === "/api/admin/submissions") {
      allow(request, "GET");
      const kind = url.searchParams.get("kind") || "";
      if (kind && !kinds.includes(kind)) fail(400, "Vrsta oddaje ni veljavna.");
      const page = Number(url.searchParams.get("page") || 1);
      if (!Number.isSafeInteger(page) || page < 1 || page > 10000)
        fail(400, "Stran ni veljavna.");
      const { results } = await db
        .prepare(
          "SELECT * FROM (SELECT * FROM submissions UNION ALL SELECT * FROM contact_submissions) WHERE (? = '' OR kind = ?) ORDER BY created_at DESC,id DESC LIMIT 21 OFFSET ?",
        )
        .bind(kind, kind, (page - 1) * 20)
        .all();
      return json({
        items: results.slice(0, 20).map(submission),
        hasMore: results.length > 20,
      });
    }
    const photo = path.match(/^\/api\/admin\/submissions\/([^/]+)\/photo$/);
    if (photo) {
      allow(request, "GET");
      const row = await findSubmission(env, photo[1]);
      const key = JSON.parse(row.payload).photoKey;
      if (
        row.kind !== "reports" ||
        typeof key !== "string" ||
        !/^[A-Za-z0-9_-]+\.(?:jpg|png|webp)$/.test(key) ||
        !env.PHOTOS
      )
        fail(404, "Fotografija ne obstaja.");
      const object = await env.PHOTOS.get(key);
      if (!object) fail(404, "Fotografija ne obstaja.");
      const type = key.endsWith(".png")
        ? "image/png"
        : key.endsWith(".webp")
          ? "image/webp"
          : "image/jpeg";
      return new Response(object.body, {
        headers: {
          ...headers,
          "Content-Type": type,
          "Content-Disposition": "inline",
          "Content-Security-Policy": "default-src 'none'; sandbox",
        },
      });
    }
    const update = path.match(/^\/api\/admin\/submissions\/([^/]+)$/);
    if (update) {
      allow(request, "PATCH");
      const data = await body(request, 8192);
      if (!statuses.includes(data.status)) fail(400, "Status ni veljaven.");
      const item = await getWorkItem(env, update[1], fail);
      const result = await saveWorkItem(
        env,
        item.id,
        { ...item, status: data.status },
        fail,
      );
      return json(result.item);
    }
    fail(404, "Skrbniška pot ne obstaja.");
  } catch (error) {
    if (
      error instanceof AdminError ||
      error instanceof BotError ||
      error?.status === 400
    )
      return json({ error: error.message }, error.status);
    return json(
      { error: "Zahteve trenutno ni mogoče izvesti. Poskusite pozneje." },
      503,
    );
  }
}
