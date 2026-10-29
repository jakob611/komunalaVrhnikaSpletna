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
