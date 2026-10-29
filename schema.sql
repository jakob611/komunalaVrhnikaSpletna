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
