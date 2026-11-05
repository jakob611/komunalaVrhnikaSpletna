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
