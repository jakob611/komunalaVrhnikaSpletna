// Private operational settings are deliberately separate from published CMS data.
async function initialize(db) {
  await db.prepare(`CREATE TABLE IF NOT EXISTS notification_settings (
    key TEXT PRIMARY KEY CHECK(key = 'recipient'),
    recipient TEXT NOT NULL,
    revision INTEGER NOT NULL,
    updated_at TEXT NOT NULL,
    updated_by TEXT NOT NULL
  )`).run();
}

export async function readNotificationSettings(env) {
  if (!env.DB) throw Error("Notification settings storage unavailable");
  await initialize(env.DB);
  const row = await env.DB.prepare("SELECT * FROM notification_settings WHERE key='recipient'").first();
  const defaultRecipient = env.EMAIL_TO || "";
  return {
    recipient: row?.recipient || defaultRecipient,
    override: row?.recipient || "",
    defaultRecipient,
    revision: row?.revision || 0,
    updatedAt: row?.updated_at || null,
    updatedBy: row?.updated_by || null,
    sender: env.EMAIL_FROM || "",
    enabled: !env.LOCAL_STORAGE && env.EMAIL_ENABLED === "true" && Boolean(env.RESEND_API_KEY && env.EMAIL_FROM && defaultRecipient),
  };
}

export async function notificationRecipient(env) {
  return (await readNotificationSettings(env)).recipient;
}

// The admin router authenticates the session and checks CSRF before dispatching.
export async function handleNotificationSettings(request, env, { json, body, fail, actor }) {
  if (new URL(request.url).pathname !== "/api/admin/notifications") return null;
  if (actor?.role !== "owner") fail(403, "Prejemnika obvestil lahko spremeni samo lastnik portala.");
  if (!env.DB) fail(503, "Shramba nastavitev trenutno ni povezana.");
  if (request.method === "GET") return json(await readNotificationSettings(env));
  if (request.method !== "PUT") fail(405, "Metoda ni dovoljena.");
  const data = await body(request, 4096);
  if (!data || typeof data !== "object" || Array.isArray(data) ||
    Object.keys(data).some(key => !["recipient", "revision"].includes(key)) ||
    typeof data.recipient !== "string" || data.recipient.length > 254 ||
    !Number.isSafeInteger(data.revision) || data.revision < 0)
    fail(400, "Preverite e-poštni naslov in različico nastavitev.");
  const recipient = data.recipient.trim();
  if (!/^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)+$/.test(recipient) ||
    recipient.split("@")[0].length > 64 || recipient.includes("..") || /^[.]|[.]@/.test(recipient))
    fail(400, "Vnesite en veljaven e-poštni naslov, brez imena ali dodatnih prejemnikov.");
  const current = await readNotificationSettings(env);
  if (current.revision !== data.revision)
    fail(409, "Prejemnika je medtem spremenil drug skrbnik. Ponovno naložite nastavitve.");
  if (current.recipient === recipient) return json(current);
  const override = recipient === current.defaultRecipient ? "" : recipient;
  const saved = await env.DB.prepare(`INSERT INTO notification_settings(key,recipient,revision,updated_at,updated_by)
    SELECT 'recipient',?,?,?,? WHERE ?=0 OR EXISTS(SELECT 1 FROM notification_settings WHERE key='recipient')
    ON CONFLICT(key) DO UPDATE SET recipient=excluded.recipient,revision=excluded.revision,
      updated_at=excluded.updated_at,updated_by=excluded.updated_by
    WHERE notification_settings.revision=excluded.revision-1 RETURNING revision`)
    .bind(override, data.revision + 1, new Date().toISOString(), actor.email || "", data.revision).first();
  if (!saved) fail(409, "Prejemnika je medtem spremenil drug skrbnik. Ponovno naložite nastavitve.");
  return json(await readNotificationSettings(env));
}
