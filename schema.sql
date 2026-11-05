-- Idempotent initial schema. Personal submissions are never exposed through public GET routes.
CREATE TABLE IF NOT EXISTS submissions (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('subscriptions', 'requests', 'market', 'reports')),
  created_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'demo-saved',
  payload TEXT NOT NULL CHECK (json_valid(payload))
);
CREATE INDEX IF NOT EXISTS submissions_kind_created ON submissions(kind, created_at);

-- Contact messages use their own table, preserving all existing prototype submissions.
CREATE TABLE IF NOT EXISTS contact_submissions (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind = 'contact'),
  created_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'demo-saved',
  payload TEXT NOT NULL CHECK (json_valid(payload))
);
CREATE INDEX IF NOT EXISTS contact_submissions_created ON contact_submissions(created_at);

-- Created atomically with each new submission; no previous demo records are emailed.
CREATE TABLE IF NOT EXISTS email_outbox (
  id TEXT PRIMARY KEY,
  created_at INTEGER NOT NULL,
  next_attempt INTEGER NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  message TEXT NOT NULL CHECK (json_valid(message)),
  photo_key TEXT,
  provider_id TEXT,
  last_error TEXT
);
CREATE INDEX IF NOT EXISTS email_outbox_pending ON email_outbox(status, next_attempt);

-- Passwords remain deployment secrets. Only hashes of opaque session cookies are stored.
CREATE TABLE IF NOT EXISTS admin_sessions (
  token_hash TEXT PRIMARY KEY,
  csrf_token TEXT NOT NULL,
  password_tag TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS admin_sessions_expiry ON admin_sessions(expires_at);
CREATE TABLE IF NOT EXISTS admin_login_limits (
  key TEXT NOT NULL,
  window INTEGER NOT NULL,
  attempts INTEGER NOT NULL,
  PRIMARY KEY (key, window)
);
CREATE TABLE IF NOT EXISTS cms_content (
  section TEXT PRIMARY KEY,
  value TEXT NOT NULL CHECK (json_valid(value)),
  revision INTEGER NOT NULL CHECK (revision >= 0),
  updated_at INTEGER NOT NULL,
  source TEXT NOT NULL DEFAULT 'edit'
);
CREATE TABLE IF NOT EXISTS cms_history (
  section TEXT NOT NULL,
  revision INTEGER NOT NULL,
  value TEXT NOT NULL CHECK (json_valid(value)),
  created_at INTEGER NOT NULL,
  source TEXT NOT NULL,
  PRIMARY KEY (section, revision)
);
CREATE TRIGGER IF NOT EXISTS cms_history_insert AFTER INSERT ON cms_content
BEGIN
  INSERT INTO cms_history(section, revision, value, created_at, source)
  VALUES(NEW.section, NEW.revision, NEW.value, NEW.updated_at, NEW.source);
END;
CREATE TRIGGER IF NOT EXISTS cms_history_update AFTER UPDATE OF revision ON cms_content
WHEN NEW.revision != OLD.revision
BEGIN
  INSERT INTO cms_history(section, revision, value, created_at, source)
  VALUES(NEW.section, NEW.revision, NEW.value, NEW.updated_at, NEW.source);
END;
CREATE TABLE IF NOT EXISTS cms_media (
  id TEXT PRIMARY KEY,
  object_key TEXT NOT NULL UNIQUE CHECK (object_key LIKE 'cms/%'),
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('image/jpeg','image/png','image/webp')),
  size INTEGER NOT NULL CHECK (size > 0 AND size <= 5242880),
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS cms_media_created ON cms_media(created_at);

CREATE TABLE IF NOT EXISTS admin_cases (
  submission_id TEXT PRIMARY KEY,
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low','normal','high','urgent')),
  assignee TEXT NOT NULL DEFAULT '',
  due_date TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  checklist TEXT NOT NULL CHECK (json_valid(checklist)),
  version INTEGER NOT NULL,
  updated_at TEXT NOT NULL,
  update_token TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS admin_case_events (
  id TEXT PRIMARY KEY,
  submission_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  event TEXT NOT NULL,
  detail TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS admin_case_events_submission ON admin_case_events(submission_id, created_at);

-- Email-verified individual accounts. Old password-only sessions have no user mapping
-- and are rejected after the two-factor upgrade. No schema ALTER is needed.
CREATE TABLE IF NOT EXISTS admin_users (
  email TEXT PRIMARY KEY,
  role TEXT NOT NULL CHECK (role IN ('owner','editor')),
  status TEXT NOT NULL CHECK (status IN ('invited','active','revoked')),
  password_hash TEXT,
  version INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS admin_session_users (
  token_hash TEXT PRIMARY KEY,
  email TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS admin_session_users_email ON admin_session_users(email);
CREATE TABLE IF NOT EXISTS admin_auth_challenges (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  purpose TEXT NOT NULL CHECK (purpose IN ('login','enroll')),
  code_hash TEXT NOT NULL,
  credential_tag TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  resend_at INTEGER NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  consumed_at INTEGER
);
CREATE INDEX IF NOT EXISTS admin_auth_challenges_expiry ON admin_auth_challenges(expires_at);
CREATE INDEX IF NOT EXISTS admin_auth_challenges_email ON admin_auth_challenges(email);
CREATE TABLE IF NOT EXISTS admin_auth_events (
  id TEXT PRIMARY KEY,
  actor_email TEXT NOT NULL,
  event TEXT NOT NULL,
  target_email TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS admin_auth_events_created ON admin_auth_events(created_at);

-- Staff-created issues remain separate from public form submissions and email outbox.
CREATE TABLE IF NOT EXISTS internal_tasks (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL DEFAULT 'internal' CHECK (kind = 'internal'),
  created_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'demo-saved',
  payload TEXT NOT NULL CHECK (json_valid(payload))
);
CREATE INDEX IF NOT EXISTS internal_tasks_created ON internal_tasks(created_at);

-- Private owner-managed delivery destination, separate from public CMS settings.
CREATE TABLE IF NOT EXISTS notification_settings (
  key TEXT PRIMARY KEY CHECK(key = 'recipient'),
  recipient TEXT NOT NULL,
  revision INTEGER NOT NULL,
  updated_at TEXT NOT NULL,
  updated_by TEXT NOT NULL
);

-- Confirmed household subscriptions; existing form submissions are not activated automatically.
CREATE TABLE IF NOT EXISTS email_subscribers (
 id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','active','unsubscribed','suppressed')),
 name TEXT NOT NULL,address TEXT NOT NULL,district_id TEXT NOT NULL,topics TEXT NOT NULL CHECK(json_valid(topics)),
 created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL,confirmed_at INTEGER,
 pending_payload TEXT,pending_version INTEGER NOT NULL DEFAULT 0,confirm_until INTEGER NOT NULL DEFAULT 0,last_request INTEGER NOT NULL DEFAULT 0,generation INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS email_subscribers_active ON email_subscribers(status,id);
CREATE TABLE IF NOT EXISTS subscription_limits (key TEXT NOT NULL,window INTEGER NOT NULL,attempts INTEGER NOT NULL,PRIMARY KEY(key,window));
CREATE TABLE IF NOT EXISTS notification_campaigns (
 id TEXT PRIMARY KEY,notice_id TEXT NOT NULL,payload TEXT NOT NULL CHECK(json_valid(payload)),created_at INTEGER NOT NULL,created_by TEXT NOT NULL,
 cursor TEXT NOT NULL DEFAULT '',status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','complete','cancelled'))
);
CREATE TABLE IF NOT EXISTS subscription_deliveries (
 outbox_id TEXT PRIMARY KEY,subscriber_id TEXT NOT NULL,generation INTEGER NOT NULL,kind TEXT NOT NULL CHECK(kind IN ('confirmation','notice')),campaign_id TEXT
);
CREATE INDEX IF NOT EXISTS subscription_deliveries_campaign ON subscription_deliveries(campaign_id);

CREATE TABLE IF NOT EXISTS email_delivery_windows(outbox_id TEXT PRIMARY KEY,started_at INTEGER NOT NULL);

-- Versioned production hardening additions. Also applied by migrations/0002_editor_reliability.sql.
CREATE TABLE IF NOT EXISTS admin_user_permissions (
  email TEXT PRIMARY KEY,
  access_scope TEXT NOT NULL CHECK(access_scope IN ('all','content','operations'))
);
CREATE TABLE IF NOT EXISTS subscriber_management_versions (
  subscriber_id TEXT PRIMARY KEY,
  version INTEGER NOT NULL DEFAULT 1 CHECK(version > 0)
);
CREATE TABLE IF NOT EXISTS public_form_limits (
  key TEXT NOT NULL, window INTEGER NOT NULL, attempts INTEGER NOT NULL,
  PRIMARY KEY(key, window)
);
CREATE TABLE IF NOT EXISTS public_submission_requests (
  request_id TEXT PRIMARY KEY, fingerprint TEXT NOT NULL,
  submission_id TEXT NOT NULL UNIQUE, kind TEXT NOT NULL,
  receipt TEXT NOT NULL CHECK(json_valid(receipt)), created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS public_submission_requests_created ON public_submission_requests(created_at);
CREATE TABLE IF NOT EXISTS cms_drafts (
  owner_email TEXT NOT NULL, section TEXT NOT NULL,
  value TEXT NOT NULL CHECK(json_valid(value)),
  base_revisions TEXT NOT NULL CHECK(json_valid(base_revisions)),
  revision INTEGER NOT NULL CHECK(revision > 0), updated_at INTEGER NOT NULL,
  write_token TEXT NOT NULL,
  PRIMARY KEY(owner_email, section)
);
CREATE TABLE IF NOT EXISTS cms_draft_values (
  owner_email TEXT NOT NULL, draft_section TEXT NOT NULL, section TEXT NOT NULL,
  value TEXT NOT NULL CHECK(json_valid(value)),
  PRIMARY KEY(owner_email,draft_section,section)
);
CREATE TABLE IF NOT EXISTS cms_publications (
  id TEXT PRIMARY KEY, created_at INTEGER NOT NULL, actor TEXT NOT NULL,
  sections TEXT NOT NULL CHECK(json_valid(sections))
);
CREATE INDEX IF NOT EXISTS cms_publications_created ON cms_publications(created_at);
CREATE TABLE IF NOT EXISTS cms_publication_values (
  publication_id TEXT NOT NULL, section TEXT NOT NULL,
  kind TEXT NOT NULL CHECK(kind IN ('before','after')),
  value TEXT NOT NULL CHECK(json_valid(value)),
  PRIMARY KEY(publication_id,section,kind)
);
CREATE TABLE IF NOT EXISTS privacy_erasure_events (
  id TEXT PRIMARY KEY, created_at INTEGER NOT NULL,
  counts TEXT NOT NULL CHECK(json_valid(counts))
);
CREATE TABLE IF NOT EXISTS cms_scheduled_publications (
  id TEXT PRIMARY KEY, section TEXT NOT NULL,
  value TEXT NOT NULL CHECK(json_valid(value)),
  base_revisions TEXT NOT NULL CHECK(json_valid(base_revisions)),
  publish_on TEXT NOT NULL, created_at INTEGER NOT NULL, created_by TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('pending','running','published','failed','cancelled')),
  lease_until INTEGER NOT NULL DEFAULT 0, updated_at INTEGER NOT NULL,
  error TEXT, publication_id TEXT NOT NULL UNIQUE
);
CREATE INDEX IF NOT EXISTS cms_scheduled_due ON cms_scheduled_publications(status,publish_on);
CREATE UNIQUE INDEX IF NOT EXISTS cms_scheduled_active_section ON cms_scheduled_publications(section) WHERE status IN ('pending','running');
CREATE TABLE IF NOT EXISTS cms_scheduled_values (
  schedule_id TEXT NOT NULL, section TEXT NOT NULL,
  value TEXT NOT NULL CHECK(json_valid(value)),
  PRIMARY KEY(schedule_id,section)
);
