-- Staff-created issues remain separate from public form submissions and email outbox.
CREATE TABLE IF NOT EXISTS internal_tasks (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL DEFAULT 'internal' CHECK (kind = 'internal'),
  created_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'demo-saved',
  payload TEXT NOT NULL CHECK (json_valid(payload))
);
CREATE INDEX IF NOT EXISTS internal_tasks_created ON internal_tasks(created_at);
