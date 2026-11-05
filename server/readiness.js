import { emailEnabled } from "./email.js";
import { adminConfigurationReady } from "./admin-auth.js";
import { publicOrigin } from "./public-origin.js";

const requiredTables = [
  "submissions",
  "contact_submissions",
  "email_outbox",
  "cms_content",
  "cms_history",
  "cms_media",
  "admin_users",
  "admin_sessions",
  "admin_session_users",
  "admin_auth_challenges",
  "admin_auth_events",
  "admin_login_limits",
  "admin_cases",
  "admin_case_events",
  "internal_tasks",
  "notification_settings",
  "email_subscribers",
  "subscription_limits",
  "notification_campaigns",
  "subscription_deliveries",
  "email_delivery_windows",
  "public_submission_requests",
  "public_form_limits",
  "admin_user_permissions",
  "privacy_erasure_events",
  "cms_drafts",
  "cms_publications",
  "cms_scheduled_publications",
  "cms_draft_values",
  "cms_publication_values",
  "cms_scheduled_values",
];

export async function readiness(env) {
  let database = "unavailable";
  if (env.DB) {
    try {
      const { results } = await env.DB.prepare(
        "SELECT name FROM sqlite_master WHERE type='table'",
      ).all();
      const present = new Set(results.map((row) => row.name));
      database = requiredTables.every((table) => present.has(table))
        ? "ready"
        : "schema-incomplete";
    } catch {
      database = "unavailable";
    }
  }
  const local = Boolean(env.LOCAL_STORAGE);
  const bot =
    local ||
    Boolean(
      env.TURNSTILE_SECRET && env.TURNSTILE_SITE_KEY && env.TURNSTILE_HOSTNAMES,
    );
  const photos = Boolean(env.PHOTOS);
  const email = local || emailEnabled(env);
  const subscriptions = local || Boolean(env.SUBSCRIPTION_SIGNING_SECRET);
  const admin = adminConfigurationReady(env);
  let origin = true;
  try {
    publicOrigin(env);
  } catch {
    origin = false;
  }
  const ready =
    database === "ready" &&
    bot &&
    photos &&
    email &&
    subscriptions &&
    admin &&
    origin;
  return {
    ok: ready,
    demo: false,
    storage: local
      ? env.DB
        ? "local-sqlite"
        : "local-file"
      : env.DB
        ? "d1"
        : "unavailable",
    email: emailEnabled(env) ? "resend" : "not-configured",
    payments: "not-enabled",
    botProtection: local ? "local-demo" : bot ? "turnstile" : "not-configured",
    readiness: {
      status: ready ? "ready" : "unavailable",
      database,
      botProtection: bot,
      photos,
      email,
      subscriptions,
      admin,
      origin,
    },
  };
}
