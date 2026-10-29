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
