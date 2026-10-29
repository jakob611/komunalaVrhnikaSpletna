import test from "node:test";
import assert from "node:assert/strict";
import { localD1 } from "./local-d1.mjs";
import { handleAdmin } from "./admin.js";
import { hashAdminPassword } from "./admin-auth.js";
import {
  createTestSession,
  installTestMail,
} from "./admin-auth-test-helpers.mjs";

const password = "test-only-admin-passphrase";
const passwordHash = await hashAdminPassword(password);
const base = "http://127.0.0.1:5173";
function environment() {
  const env = {
    DB: localD1(":memory:"),
    LOCAL_STORAGE: {},
    ADMIN_PASSWORD_HASH: passwordHash,
    ADMIN_OWNER_EMAIL: "owner@example.com",
    EMAIL_FROM: "KPV <auth@example.com>",
  };
  installTestMail(env);
  return env;
}
function request(
  path,
  data,
  session,
  method = data ? "POST" : "GET",
  extra = {},
) {
  return new Request(base + path, {
    method,
    headers: {
      Origin: base,
      "Content-Type": "application/json",
      "CF-Connecting-IP": "198.51.100.24",
      ...(session
        ? { Cookie: session.cookie, "X-CSRF-Token": session.csrfToken }
        : {}),
      ...extra,
    },
    body: data ? JSON.stringify(data) : undefined,
  });
}
const call = (env, path, data, session, method, extra) =>
  handleAdmin(request(path, data, session, method, extra), env);
const latestCode = (env) =>
  env.AUTH_TEST_MAIL.at(-1).text.match(/Koda: (\d{8})/)[1];
async function begin(env, address = "owner@example.com", pass = password) {
  const response = await call(env, "/api/admin/login", {
    email: address,
    password: pass,
  });
  assert.equal(response.status, 200, await response.clone().text());
  assert.equal(response.headers.get("set-cookie"), null);
  return response.json();
}
async function invitation(env, owner, address = "editor@example.com") {
  const response = await call(
    env,
    "/api/admin/users",
    { email: address },
    owner,
  );
  assert.equal(response.status, 201, await response.clone().text());
  const message = env.AUTH_TEST_MAIL.at(-1);
  return {
    email: address,
    challengeId: message.text.match(/\?invite=([a-f0-9]{64})/)[1],
    code: latestCode(env),
    password: "editor-test-only-password",
  };
}

test("password and allowlisted email never create a session before a single-use OTP", async () => {
  const env = environment();
  const challenge = await begin(env);
  const code = latestCode(env);
  assert.equal(challenge.verificationRequired, true);
  assert.equal(challenge.code, undefined);
  assert.equal((await call(env, "/api/admin/content")).status, 401);
  assert.deepEqual(env.AUTH_TEST_MAIL[0].to, ["owner@example.com"]);
  const stored = await env.DB.prepare(
    "SELECT * FROM admin_auth_challenges",
  ).first();
  assert.notEqual(stored.code_hash, code);
  assert.ok(!JSON.stringify(stored).includes(code));
  const responses = await Promise.all(
    [0, 1].map(() =>
      call(env, "/api/admin/verify", {
        challengeId: challenge.challengeId,
        code,
      }),
    ),
  );
  assert.deepEqual(responses.map((r) => r.status).sort(), [200, 401]);
  assert.equal(
    (await env.DB.prepare("SELECT count(*) AS n FROM admin_sessions").first())
      .n,
    1,
  );
  const sessionResponse = responses.find((r) => r.status === 200);
  const result = await sessionResponse.json();
  assert.equal(result.user.role, "owner");
  assert.equal(result.user.email, "owner@example.com");
  env.DB.close();
});

test("unknown, revoked, and incorrect-password accounts share one rejection and send no email", async () => {
  const env = environment();
  const unknown = await call(env, "/api/admin/login", {
    email: "stranger@example.com",
    password,
  });
  const wrong = await call(env, "/api/admin/login", {
    email: "owner@example.com",
    password: "incorrect",
  });
  assert.equal(unknown.status, 401);
  assert.equal(wrong.status, 401);
  assert.deepEqual(await unknown.json(), await wrong.json());
  assert.equal(env.AUTH_TEST_MAIL.length, 0);
  env.DB.close();
});

test("five wrong code guesses exhaust the challenge, expiration and cross-origin verification fail", async () => {
  const env = environment();
  const challenge = await begin(env);
  const code = latestCode(env);
  const wrong = code === "00000000" ? "11111111" : "00000000";
  for (let i = 0; i < 5; i++)
    assert.equal(
      (
        await call(env, "/api/admin/verify", {
          challengeId: challenge.challengeId,
          code: wrong,
        })
      ).status,
      401,
    );
  assert.equal(
    (
      await call(env, "/api/admin/verify", {
        challengeId: challenge.challengeId,
        code,
      })
    ).status,
    401,
  );
  const next = await begin(env);
  const nextCode = latestCode(env);
  assert.equal(
    (
      await call(
        env,
        "/api/admin/verify",
        { challengeId: next.challengeId, code: nextCode },
        null,
        "POST",
        { Origin: "https://attacker.example" },
      )
    ).status,
    403,
  );
  await env.DB.prepare(
    "UPDATE admin_auth_challenges SET expires_at=? WHERE id=?",
  )
    .bind(Date.now() - 1, next.challengeId)
    .run();
  assert.equal(
    (
      await call(env, "/api/admin/verify", {
        challengeId: next.challengeId,
        code: nextCode,
      })
    ).status,
    401,
  );
  env.DB.close();
});

test("resending is throttled and invalidates the previous login code", async () => {
  const env = environment();
  const challenge = await begin(env);
  const oldCode = latestCode(env);
  assert.equal(
    (
      await call(env, "/api/admin/resend", {
        challengeId: challenge.challengeId,
      })
    ).status,
    429,
  );
  await env.DB.prepare(
    "UPDATE admin_auth_challenges SET resend_at=? WHERE id=?",
  )
    .bind(Date.now() - 1, challenge.challengeId)
    .run();
  const response = await call(env, "/api/admin/resend", {
    challengeId: challenge.challengeId,
  });
  assert.equal(response.status, 200);
  const replacement = await response.json();
  assert.notEqual(replacement.challengeId, challenge.challengeId);
  assert.equal(
    replacement.expiresAt,
    challenge.expiresAt,
    "Resend must not indefinitely renew the password verification window",
  );
  assert.equal(env.AUTH_TEST_MAIL.length, 2);
  assert.equal(
    (
      await call(env, "/api/admin/verify", {
        challengeId: challenge.challengeId,
        code: oldCode,
      })
    ).status,
    401,
  );
  assert.equal(
    (
      await call(env, "/api/admin/verify", {
        challengeId: replacement.challengeId,
        code: latestCode(env),
      })
    ).status,
    200,
  );
  env.DB.close();
});

test("owner invitations require CSRF and create personal passwords; editors cannot manage accounts", async () => {
  const env = environment();
  const owner = await createTestSession(env);
  const noCsrf = await call(
    env,
    "/api/admin/users",
    { email: "editor@example.com" },
    { ...owner, csrfToken: "wrong" },
  );
  assert.equal(noCsrf.status, 403);
  const invite = await invitation(env, owner);
  assert.equal(
    (await call(env, "/api/admin/login", { email: invite.email, password }))
      .status,
    401,
  );
  assert.equal(
    (await call(env, "/api/admin/enroll", { ...invite, password: "short" }))
      .status,
    400,
  );
  assert.equal((await call(env, "/api/admin/enroll", invite)).status, 200);
  assert.equal((await call(env, "/api/admin/enroll", invite)).status, 401);
  const editor = await createTestSession(env, {
    email: invite.email,
    password: invite.password,
  });
  assert.equal(editor.user.role, "editor");
  assert.equal(
    (await call(env, "/api/admin/content", null, editor)).status,
    200,
  );
  assert.equal((await call(env, "/api/admin/users", null, editor)).status, 403);
  assert.equal(
    (
      await call(
        env,
        "/api/admin/users",
        { email: "stranger@example.com" },
        editor,
      )
    ).status,
    403,
  );
  const users = await (await call(env, "/api/admin/users", null, owner)).json();
  assert.equal(users.items.length, 2);
  assert.ok(!JSON.stringify(users).includes("password_hash"));
  const stored = await env.DB.prepare(
    "SELECT password_hash FROM admin_users WHERE email=?",
  )
    .bind(invite.email)
    .first();
  assert.match(stored.password_hash, /^v1:100000:/);
  assert.ok(!stored.password_hash.includes(invite.password));
  env.DB.close();
});

test("revocation invalidates sessions and pending codes; owner cannot be removed", async () => {
  const env = environment();
  const owner = await createTestSession(env);
  const invite = await invitation(env, owner);
  await call(env, "/api/admin/enroll", invite);
  const editor = await createTestSession(env, {
    email: invite.email,
    password: invite.password,
  });
  const pending = await begin(env, invite.email, invite.password);
  const code = latestCode(env);
  assert.equal(
    (await call(env, "/api/admin/users/revoke", { email: invite.email }, owner))
      .status,
    200,
  );
  assert.equal(
    (await call(env, "/api/admin/content", null, editor)).status,
    401,
  );
  assert.equal(
    (
      await call(env, "/api/admin/verify", {
        challengeId: pending.challengeId,
        code,
      })
    ).status,
    401,
  );
  assert.equal(
    (
      await call(
        env,
        "/api/admin/users/revoke",
        { email: "owner@example.com" },
        owner,
      )
    ).status,
    400,
  );
  assert.equal(
    (await call(env, "/api/admin/session", null, owner)).status,
    200,
  );
  env.DB.close();
});

test("reissuing an invitation invalidates the previous invitation and only invited recipients receive mail", async () => {
  const env = environment();
  const owner = await createTestSession(env);
  const first = await invitation(env, owner);
  const second = await invitation(env, owner);
  assert.equal((await call(env, "/api/admin/enroll", first)).status, 401);
  assert.equal((await call(env, "/api/admin/enroll", second)).status, 200);
  assert.deepEqual(
    env.AUTH_TEST_MAIL.slice(1).map((message) => message.to),
    [["editor@example.com"], ["editor@example.com"]],
  );
  env.DB.close();
});

test("legacy password-only sessions are invalid and delivery failures never establish sessions or expose codes", async () => {
  const env = environment();
  const token = "a".repeat(64);
  const tokenHash = Buffer.from(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token)),
  ).toString("hex");
  await env.DB.prepare("INSERT INTO admin_sessions VALUES(?,?,?,?,?)")
    .bind(tokenHash, "csrf", "legacy", Date.now(), Date.now() + 3600000)
    .run();
  assert.equal(
    (
      await call(env, "/api/admin/session", null, {
        cookie: `kpv_admin_dev=${token}`,
      })
    ).status,
    401,
  );
  env.ADMIN_AUTH_SEND = async () => {
    throw Error("transport-failed-private");
  };
  const failed = await call(env, "/api/admin/login", {
    email: "owner@example.com",
    password,
  });
  assert.equal(failed.status, 503);
  assert.equal(failed.headers.get("set-cookie"), null);
  const response = await failed.text();
  assert.ok(!response.includes("transport-failed-private"));
  assert.equal(
    (
      await env.DB.prepare(
        "SELECT consumed_at FROM admin_auth_challenges",
      ).first()
    ).consumed_at > 0,
    true,
  );
  env.DB.close();
});
