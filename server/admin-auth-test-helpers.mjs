// Test-only mailbox. Never imported by the Worker or exposed through HTTP.
import assert from "node:assert/strict";
import { handleAdmin } from "./admin.js";
export function installTestMail(env) {
  env.ADMIN_OWNER_EMAIL ||= "owner@example.com";
  env.AUTH_TEST_MAIL ||= [];
  env.ADMIN_AUTH_SEND = async (message) => env.AUTH_TEST_MAIL.push(message);
  return env.AUTH_TEST_MAIL;
}
export async function createTestSession(
  env,
  {
    email = env.ADMIN_OWNER_EMAIL || "owner@example.com",
    password = "test-only-admin-passphrase",
    base = "http://127.0.0.1:5173",
    ip = "192.0.2.10",
  } = {},
) {
  installTestMail(env);
  const call = (path, value) =>
    new Request(base + path, {
      method: "POST",
      headers: {
        Origin: base,
        "Content-Type": "application/json",
        "CF-Connecting-IP": ip,
      },
      body: JSON.stringify(value),
    });
  const first = await handleAdmin(
    call("/api/admin/login", { email, password }),
    env,
  );
  assert.equal(first.status, 200, await first.clone().text());
  assert.equal(
    first.headers.get("set-cookie"),
    null,
    "Password alone must not create a session",
  );
  const challenge = await first.json();
  assert.equal(challenge.verificationRequired, true);
  const code = env.AUTH_TEST_MAIL.at(-1).text.match(/Koda: (\d{8})/)[1];
  const final = await handleAdmin(
    call("/api/admin/verify", { challengeId: challenge.challengeId, code }),
    env,
  );
  assert.equal(final.status, 200, await final.clone().text());
  return {
    ...(await final.json()),
    cookie: final.headers.get("set-cookie").split(";")[0],
    header: final.headers.get("set-cookie"),
  };
}
