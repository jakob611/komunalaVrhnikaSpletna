import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { cleanupAdmin, handleAdmin, readPublished } from "./admin.js";
import defaults from "../shared/site-defaults.json" with { type: "json" };
import {
  createTestSession,
  installTestMail,
} from "./admin-auth-test-helpers.mjs";

const password = "test-only-admin-passphrase";
const salt = new Uint8Array(16).fill(17);
const material = await crypto.subtle.importKey(
  "raw",
  new TextEncoder().encode(password),
  "PBKDF2",
  false,
  ["deriveBits"],
);
const derived = await crypto.subtle.deriveBits(
  { name: "PBKDF2", hash: "SHA-256", salt, iterations: 100000 },
  material,
  256,
);
const hex = (value) => Buffer.from(value).toString("hex");
const passwordHash = `v1:100000:${hex(salt)}:${hex(derived)}`;
function environment() {
  const sql = new DatabaseSync(":memory:");
  sql.exec(readFileSync(new URL("../schema.sql", import.meta.url), "utf8"));
  const wrap = (query, bindings = []) => ({
    bind: (...values) => wrap(query, values),
    run: async () => sql.prepare(query).run(...bindings),
    first: async () => sql.prepare(query).get(...bindings) || null,
    all: async () => ({ results: sql.prepare(query).all(...bindings) }),
    execute: () => ({ results: sql.prepare(query).all(...bindings) }),
  });
  const objects = new Map();
  return {
    DB: {
      sql,
      prepare: wrap,
      async batch(statements) {
        sql.exec("BEGIN");
        try {
          const result = statements.map((statement) => statement.execute());
          sql.exec("COMMIT");
          return result;
        } catch (error) {
          sql.exec("ROLLBACK");
          throw error;
        }
      },
    },
    LOCAL_STORAGE: {},
    ADMIN_PASSWORD_HASH: passwordHash,
    ADMIN_OWNER_EMAIL: "owner@example.com",
    EMAIL_FROM: "KPV <auth@example.com>",
    RESEND_API_KEY: "test-only-key",
    AUTH_TEST_MAIL: [],
    async ADMIN_AUTH_SEND(message) {
      this.AUTH_TEST_MAIL.push(message);
    },
    PHOTOS: {
      objects,
      async put(key, bytes, options) {
        objects.set(key, { bytes: new Uint8Array(bytes), options });
      },
      async delete(key) {
        objects.delete(key);
      },
      async get(key) {
        const value = objects.get(key);
        return value
          ? { body: value.bytes, httpMetadata: value.options?.httpMetadata }
          : null;
      },
    },
  };
}
const base = "http://127.0.0.1:5173";
function request(
  path,
  {
    method = "GET",
    body,
    cookie,
    csrf,
    origin = base,
    ip = "192.0.2.10",
    host = base,
  } = {},
) {
  const headers = { "cf-connecting-ip": ip };
  if (method !== "GET") headers.Origin = origin;
  if (cookie) headers.Cookie = cookie;
  if (csrf) headers["X-CSRF-Token"] = csrf;
  if (body && !(body instanceof FormData))
    headers["Content-Type"] = "application/json";
  return new Request(host + path, {
    method,
    headers,
    body:
      body instanceof FormData
        ? body
        : body === undefined
          ? undefined
          : JSON.stringify(
              path === "/api/admin/login"
                ? { email: "owner@example.com", ...body }
                : body,
            ),
  });
}
async function login(env) {
  return createTestSession(env, { password });
}
const mutation = (session, body, method = "PUT") => ({
  method,
  body,
  cookie: session.cookie,
  csrf: session.csrfToken,
});

test("public content works before DB setup and admin routes fail closed", async () => {
  const response = await handleAdmin(request("/api/content"));
  const data = await response.json();
  assert.deepEqual(data.sections, defaults);
  assert.ok(Object.values(data.revisions).every((value) => value === 0));
  assert.equal((await handleAdmin(request("/api/admin/content"))).status, 503);
  const env = environment();
  for (const path of [
    "/api/admin/content",
    "/api/admin/session",
    "/api/admin/submissions",
    "/api/admin/media",
    "/api/admin/history/settings",
  ])
    assert.equal((await handleAdmin(request(path), env)).status, 401);
  assert.equal(
    (
      await handleAdmin(
        request("/api/content", { method: "POST", body: {} }),
        env,
      )
    ).status,
    405,
  );
});

test("login enforces exact origin and stores hashed expiring sessions with CSRF", async () => {
  const env = environment();
  for (const origin of ["", "https://attacker.example"])
    assert.equal(
      (
        await handleAdmin(
          request("/api/admin/login", {
            method: "POST",
            origin,
            body: { password },
          }),
          env,
        )
      ).status,
      403,
    );
  const session = await login(env);
  assert.match(
    session.header,
    /kpv_admin_dev=[a-f0-9]{64}; Path=\/; HttpOnly; SameSite=Strict; Max-Age=28800/,
  );
  const stored = env.DB.sql.prepare("SELECT * FROM admin_sessions").get();
  assert.notEqual(stored.token_hash, session.cookie.split("=")[1]);
  assert.equal(stored.csrf_token, session.csrfToken);
  assert.ok(stored.expires_at > Date.now() + 7 * 3600000);
  assert.equal(
    (
      await handleAdmin(
        request("/api/admin/session", { cookie: session.cookie }),
        env,
      )
    ).status,
    200,
  );
  env.DB.sql
    .prepare("UPDATE admin_sessions SET expires_at = ?")
    .run(Date.now() - 1);
  assert.equal(
    (
      await handleAdmin(
        request("/api/admin/session", { cookie: session.cookie }),
        env,
      )
    ).status,
    401,
  );
});

test("production sessions require Turnstile, password AND email code and use secure cookies", async (t) => {
  const env = environment();
  delete env.LOCAL_STORAGE;
  env.TURNSTILE_SECRET = "test-only-turnstile";
  env.TURNSTILE_HOSTNAMES = "admin.example";
  const options = {
    method: "POST",
    host: "https://admin.example",
    origin: "https://admin.example",
    body: { password, "cf-turnstile-response": "test-token" },
  };
  let sent;
  t.mock.method(globalThis, "fetch", async (url, init) => {
    if (url === "https://api.resend.com/emails") {
      sent = JSON.parse(init.body);
      return Response.json({ id: "test-receipt" });
    }
    return Response.json({
      success: true,
      action: "adminlogin",
      hostname: "admin.example",
    });
  });
  const first = await handleAdmin(request("/api/admin/login", options), env);
  assert.equal(first.status, 200, await first.clone().text());
  assert.equal(first.headers.get("set-cookie"), null);
  const challenge = await first.json();
  assert.equal(challenge.authenticated, undefined);
  assert.deepEqual(sent.to, ["owner@example.com"]);
  const response = await handleAdmin(
    request("/api/admin/verify", {
      ...options,
      body: {
        challengeId: challenge.challengeId,
        code: sent.text.match(/Koda: (\d{8})/)[1],
      },
    }),
    env,
  );
  assert.equal(response.status, 200, await response.clone().text());
  assert.match(
    response.headers.get("set-cookie"),
    /^__Host-kpv_admin=[a-f0-9]{64}; Path=\/; HttpOnly; SameSite=Strict; Max-Age=28800; Secure$/,
  );
  const data = await response.json();
  const cookie = response.headers.get("set-cookie").split(";")[0];
  assert.equal(
    (
      await handleAdmin(
        request("/api/admin/session", {
          host: "https://admin.example",
          cookie,
        }),
        { ...env, ADMIN_PASSWORD_HASH: passwordHash.replace(/.$/, "0") },
      )
    ).status,
    401,
  );
  assert.equal(data.user.email, "owner@example.com");
  assert.equal(data.user.role, "owner");
  assert.equal(
    (
      await handleAdmin(
        request("/api/admin/login", { ...options, body: { password } }),
        env,
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await handleAdmin(
        request("/api/admin/login", {
          ...options,
          host: "https://not-loopback.example",
          origin: "https://not-loopback.example",
        }),
        { ...env, LOCAL_STORAGE: {} },
      )
    ).status,
    503,
  );
});

test("per-IP and global login limits reject attempts before expensive password verification", async () => {
  const env = environment();
  for (let index = 0; index < 5; index++)
    assert.equal(
      (
        await handleAdmin(
          request("/api/admin/login", {
            method: "POST",
            body: { password: "incorrect" },
          }),
          env,
        )
      ).status,
      401,
    );
  assert.equal(
    (
      await handleAdmin(
        request("/api/admin/login", { method: "POST", body: { password } }),
        env,
      )
    ).status,
    429,
  );
  assert.ok(
    !JSON.stringify(
      env.DB.sql.prepare("SELECT * FROM admin_login_limits").all(),
    ).includes("192.0.2.10"),
  );
  const global = environment();
  global.DB.sql
    .prepare(
      "INSERT INTO admin_login_limits(key,window,attempts) VALUES(?,?,?)",
    )
    .run("900000:login-global", Math.floor(Date.now() / 900000), 50);
  assert.equal(
    (
      await handleAdmin(
        request("/api/admin/login", { method: "POST", body: { password } }),
        global,
      )
    ).status,
    429,
  );
});

test("unverified IPs cannot consume the global login quota while per-IP limits remain active", async (t) => {
  const env = environment();
  delete env.LOCAL_STORAGE;
  env.TURNSTILE_SECRET = "test-only-turnstile";
  env.TURNSTILE_HOSTNAMES = "admin.example";
  let verified = false;
  let challenges = 0;
  t.mock.method(globalThis, "fetch", async (url) => {
    if (url === "https://api.resend.com/emails")
      return Response.json({ id: "test-receipt" });
    challenges++;
    return Response.json({
      success: verified,
      action: "adminlogin",
      hostname: "admin.example",
    });
  });
  const options = {
    method: "POST",
    host: "https://admin.example",
    origin: "https://admin.example",
    body: { password, "cf-turnstile-response": "test-token" },
  };
  for (let index = 1; index <= 60; index++) {
    const response = await handleAdmin(
      request("/api/admin/login", { ...options, ip: `192.0.2.${index}` }),
      env,
    );
    assert.equal(response.status, 403);
  }
  assert.equal(
    env.DB.sql
      .prepare(
        "SELECT attempts FROM admin_login_limits WHERE key = '900000:login-global'",
      )
      .get(),
    undefined,
  );
  for (let index = 0; index < 4; index++)
    assert.equal(
      (
        await handleAdmin(
          request("/api/admin/login", { ...options, ip: "192.0.2.1" }),
          env,
        )
      ).status,
      403,
    );
  const beforeLimited = challenges;
  assert.equal(
    (
      await handleAdmin(
        request("/api/admin/login", { ...options, ip: "192.0.2.1" }),
        env,
      )
    ).status,
    429,
  );
  assert.equal(challenges, beforeLimited, "IP limit must run before Turnstile");
  verified = true;
  assert.equal(
    (
      await handleAdmin(
        request("/api/admin/login", { ...options, ip: "203.0.113.8" }),
        env,
      )
    ).status,
    200,
  );
  assert.equal(
    env.DB.sql
      .prepare(
        "SELECT attempts FROM admin_login_limits WHERE key = '900000:login-global'",
      )
      .get().attempts,
    1,
  );
});

test("admin cleanup removes at most 500 expired rows per table and preserves active data", async () => {
  const env = environment();
  const now = Date.now();
  const currentWindow = Math.floor(now / 900000);
  const session = env.DB.sql.prepare(
    "INSERT INTO admin_sessions(token_hash,csrf_token,password_tag,created_at,expires_at) VALUES(?,?,?,?,?)",
  );
  const limit = env.DB.sql.prepare(
    "INSERT INTO admin_login_limits(key,window,attempts) VALUES(?,?,?)",
  );
  for (let index = 0; index < 620; index++) {
    session.run(
      `expired-${index}`,
      "test-csrf",
      "test-tag",
      now - 3600000,
      now - 1000,
    );
    limit.run(`old-${index}`, currentWindow - 1, 5);
  }
  session.run("active", "test-csrf", "test-tag", now, now + 3600000);
  limit.run("900000:login-global", currentWindow, 17);
  await cleanupAdmin(env);
  assert.equal(
    env.DB.sql.prepare("SELECT count(*) AS n FROM admin_sessions").get().n,
    121,
  );
  assert.equal(
    env.DB.sql.prepare("SELECT count(*) AS n FROM admin_login_limits").get().n,
    121,
  );
  assert.equal(
    env.DB.sql
      .prepare(
        "SELECT attempts FROM admin_login_limits WHERE key = '900000:login-global'",
      )
      .get().attempts,
    17,
  );
  await cleanupAdmin(env);
  assert.equal(
    env.DB.sql.prepare("SELECT token_hash FROM admin_sessions").get()
      .token_hash,
    "active",
  );
  assert.equal(
    env.DB.sql.prepare("SELECT count(*) AS n FROM admin_login_limits").get().n,
    1,
  );
});

test("admin cleanup failures are contained and log only the safe event name", async (t) => {
  const log = t.mock.method(console, "error", () => {});
  await cleanupAdmin({
    DB: {
      prepare() {
        throw new Error("private database connection detail");
      },
    },
  });
  assert.equal(log.mock.calls.length, 1);
  assert.deepEqual(log.mock.calls[0].arguments, [
    JSON.stringify({ event: "admin_cleanup_failed" }),
  ]);
  await cleanupAdmin({});
  assert.equal(log.mock.calls.length, 1);
});

test("CMS writes validate content, use revision CAS, keep atomic history and restore defaults", async () => {
  const env = environment();
  const session = await login(env);
  const value = { ...defaults.settings, siteName: "Testni naslov" };
  assert.equal(
    (
      await handleAdmin(
        request("/api/admin/content/settings", {
          ...mutation(session, { value, revision: 0 }),
          csrf: undefined,
        }),
        env,
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await handleAdmin(
        request("/api/admin/content/settings", {
          ...mutation(session, { value, revision: 0 }),
          origin: "https://attacker.example",
        }),
        env,
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await handleAdmin(
        request(
          "/api/admin/content/settings",
          mutation(session, {
            value: { ...value, siteName: "<script>alert(1)</script>" },
            revision: 0,
          }),
        ),
        env,
      )
    ).status,
    400,
  );
  const first = await handleAdmin(
    request(
      "/api/admin/content/settings",
      mutation(session, { value, revision: 0 }),
    ),
    env,
  );
  assert.equal(first.status, 200);
  assert.equal((await first.json()).revision, 1);
  const simultaneous = await Promise.all(
    ["Prvi urejevalnik", "Drugi urejevalnik"].map((siteName) =>
      handleAdmin(
        request(
          "/api/admin/content/settings",
          mutation(session, { value: { ...value, siteName }, revision: 1 }),
        ),
        env,
      ),
    ),
  );
  assert.deepEqual(
    simultaneous.map((response) => response.status).sort(),
    [200, 409],
  );
  const history = await (
    await handleAdmin(
      request("/api/admin/history/settings", { cookie: session.cookie }),
      env,
    )
  ).json();
  assert.deepEqual(
    history.items.map((row) => row.revision),
    [2, 1, 0],
  );
  assert.deepEqual(history.items[2].value, defaults.settings);
  const restored = await handleAdmin(
    request(
      "/api/admin/restore/settings",
      mutation(session, { revision: 0, currentRevision: 2 }, "POST"),
    ),
    env,
  );
  assert.equal(restored.status, 200);
  assert.deepEqual((await restored.json()).value, defaults.settings);
  const published = await (
    await handleAdmin(request("/api/content"), env)
  ).json();
  assert.equal(published.revisions.settings, 3);
  assert.deepEqual(published.sections.settings, defaults.settings);
  assert.equal(
    env.DB.sql.prepare("SELECT count(*) AS n FROM cms_history").get().n,
    4,
  );
  assert.deepEqual(await readPublished(env, "settings"), defaults.settings);
  assert.deepEqual(await readPublished({}, "settings"), defaults.settings);
  assert.deepEqual(
    await readPublished(
      {
        DB: {
          prepare() {
            throw new Error("unavailable");
          },
        },
      },
      "settings",
    ),
    defaults.settings,
  );
});

test("CMS media checks magic bytes and only metadata-backed CMS images are public", async () => {
  const env = environment();
  const session = await login(env);
  const invalid = new FormData();
  invalid.set(
    "photo",
    new Blob(['<svg onload="alert(1)"></svg>'], { type: "image/png" }),
    "fake.png",
  );
  assert.equal(
    (
      await handleAdmin(
        request("/api/admin/media", mutation(session, invalid, "POST")),
        env,
      )
    ).status,
    400,
  );
  assert.equal(env.PHOTOS.objects.size, 0);
  const image = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jS1kAAAAASUVORK5CYII=",
    "base64",
  );
  const form = new FormData();
  form.set("photo", new Blob([image], { type: "image/png" }), "test.png");
  const response = await handleAdmin(
    request("/api/admin/media", mutation(session, form, "POST")),
    env,
  );
  assert.equal(response.status, 201);
  const media = await response.json();
  assert.match([...env.PHOTOS.objects.keys()][0], /^cms\//);
  const publicImage = await handleAdmin(request(media.url), env);
  assert.equal(publicImage.status, 200);
  assert.equal(publicImage.headers.get("content-type"), "image/png");
  assert.equal(publicImage.headers.get("x-content-type-options"), "nosniff");
  assert.deepEqual(Buffer.from(await publicImage.arrayBuffer()), image);
  const reportId = crypto.randomUUID();
  await env.PHOTOS.put(`${reportId}.png`, image, {});
  assert.equal(
    (await handleAdmin(request(`/api/media/${reportId}`), env)).status,
    404,
  );
  assert.equal(
    (await handleAdmin(request("/api/media/private-report.png"), env)).status,
    404,
  );
});

test("submissions are paginated/admin-only and report originals require authentication", async () => {
  const env = environment();
  const session = await login(env);
  for (let index = 0; index < 23; index++)
    env.DB.sql
      .prepare(
        "INSERT INTO submissions(id,kind,created_at,status,payload) VALUES(?,?,?,?,?)",
      )
      .run(
        `KPV-${index}`,
        "reports",
        new Date(Date.now() + index).toISOString(),
        "demo-saved",
        JSON.stringify({
          email: "test@example.com",
          photoKey: "private-test.png",
        }),
      );
  env.DB.sql
    .prepare(
      "INSERT INTO contact_submissions(id,kind,created_at,status,payload) VALUES(?,?,?,?,?)",
    )
    .run(
      "KPV-contact",
      "contact",
      new Date().toISOString(),
      "demo-saved",
      '{"subject":"Test"}',
    );
  const page = await (
    await handleAdmin(
      request("/api/admin/submissions?kind=reports", {
        cookie: session.cookie,
      }),
      env,
    )
  ).json();
  assert.equal(page.items.length, 20);
  assert.equal(page.hasMore, true);
  assert.equal(page.items[0].kind, "reports");
  const next = await (
    await handleAdmin(
      request("/api/admin/submissions?kind=reports&page=2", {
        cookie: session.cookie,
      }),
      env,
    )
  ).json();
  assert.equal(next.items.length, 3);
  assert.equal(next.hasMore, false);
  assert.equal(
    (await handleAdmin(request("/api/admin/submissions/KPV-0/photo"), env))
      .status,
    401,
  );
  await env.PHOTOS.put(
    "private-test.png",
    new Uint8Array([137, 80, 78, 71]),
    {},
  );
  assert.equal(
    (
      await handleAdmin(
        request("/api/admin/submissions/KPV-0/photo", {
          cookie: session.cookie,
        }),
        env,
      )
    ).status,
    200,
  );
  assert.equal(
    (
      await handleAdmin(
        request(
          "/api/admin/submissions/KPV-0",
          mutation(session, { status: "in-progress" }, "PATCH"),
        ),
        env,
      )
    ).status,
    200,
  );
  assert.equal(
    env.DB.sql
      .prepare("SELECT status FROM submissions WHERE id = ?")
      .get("KPV-0").status,
    "in-progress",
  );
  assert.equal(
    (
      await handleAdmin(
        request(
          "/api/admin/submissions/KPV-contact",
          mutation(session, { status: "spam" }, "PATCH"),
        ),
        env,
      )
    ).status,
    200,
  );
  assert.equal(
    (
      await handleAdmin(
        request(
          "/api/admin/submissions/KPV-0",
          mutation(session, { status: "unknown" }, "PATCH"),
        ),
        env,
      )
    ).status,
    400,
  );
});

test("body limits, methods, logout CSRF and revocation fail safely", async () => {
  const env = environment();
  const session = await login(env);
  assert.equal(
    (
      await handleAdmin(
        request("/api/admin/login", {
          method: "POST",
          body: { password: "x".repeat(9000) },
        }),
        env,
      )
    ).status,
    413,
  );
  assert.equal(
    (
      await handleAdmin(
        request(
          "/api/admin/content/settings",
          mutation(session, {
            value: "x".repeat(1024 * 1024 + 1),
            revision: 0,
          }),
        ),
        env,
      )
    ).status,
    413,
  );
  assert.equal(
    (
      await handleAdmin(
        request("/api/admin/content", mutation(session, {}, "DELETE")),
        env,
      )
    ).status,
    405,
  );
  assert.equal(
    (
      await handleAdmin(
        request("/api/admin/logout", {
          method: "POST",
          cookie: session.cookie,
          body: {},
        }),
        env,
      )
    ).status,
    403,
  );
  const logout = await handleAdmin(
    request("/api/admin/logout", mutation(session, {}, "POST")),
    env,
  );
  assert.equal(logout.status, 200);
  assert.match(logout.headers.get("set-cookie"), /Max-Age=0/);
  assert.equal(
    (
      await handleAdmin(
        request("/api/admin/session", { cookie: session.cookie }),
        env,
      )
    ).status,
    401,
  );
  assert.equal(
    env.DB.sql.prepare("SELECT count(*) AS n FROM admin_sessions").get().n,
    0,
  );
});
