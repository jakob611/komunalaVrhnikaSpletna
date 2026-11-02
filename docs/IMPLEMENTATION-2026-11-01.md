# Implementation record — 1 November 2026

This implements the audit's concrete security, reliability, and editorial-workflow fixes locally. No production deployment, account change, email campaign, live-data erasure, or Git push was performed.

## Delivered

- Subscription capabilities are revocable. Confirmation and revocation commit together; unsubscribe-only capabilities cannot disclose or edit household preferences. New email links carry tokens in fragments and the browser sends tokens in API bodies. Legacy confirmation links remain compatible; legacy zero-version management links are intentionally revoked with recovery instructions.
- Worker logging configuration redacts query strings. Absolute mail links use the deployment's `PUBLIC_ORIGIN`; calendar links follow the current browser origin. Existing calendar event identities remain stable.
- Content and operations access are enforced in the API and reflected in navigation. Existing editors retain their original broad access; new invitations default to content-only. Scope changes invalidate sessions. Operations staff have a dedicated published-notice delivery screen.
- Owner-only personal-data erasure has a bounded preview, expiring snapshot confirmation, associated R2/database cleanup, retry behavior, and a counts-only audit. Campaign/signup race tests prevent erased subscriber identities or pending mail from being recreated.
- Published operational reads fail closed on storage/validation failure. The public UI distinguishes initial loading, unavailability, and a previously loaded but stale publication.
- Public form retries share a transactional request identity and receipt. Concurrent retries create one case/email and retain one report photograph. Verified first submissions have explicit application quotas.
- Website publication uses one revision-guarded transaction, including history and normalized release snapshots. A failed section write rolls everything back.
- Per-editor server-backed drafts survive reloads and stay private. Future tariffs may be saved without becoming active. Draft CAS and child write tokens prevent stale tabs overwriting newer drafts. In-memory editorial work also survives session expiry until the same user signs back in within that window.
- Scheduled publications store immutable snapshots, activate on a Ljubljana date, use recoverable leases, and reconcile committed publications after uncertain acknowledgement. Conflicts or revoked author permissions stop a schedule visibly. Notice publication does not automatically email residents.
- Large website snapshots store sections separately rather than exceeding D1's row limit. Actual workerd/D1 tests cover multi-megabyte drafts, publication, and scheduled activation.
- Native page sections have explicit identities that preserve existing saved layout IDs. More than 230 static content fields now render through React with stable IDs and frozen aliases for older edits. Legacy DOM editing remains as a compatibility adapter for unmigrated content; see `CMS-CONTENT.md`.
- Imported JSON is validated before replacing a draft. Editor failures have a recovery boundary. Emergency telephone links share the configured number. Live-default test placeholders are removed. The cemetery offers a useful contact-led state when no records are published; its populated search/map and admin tools remain available.
- Documents have consistent security headers, genuine 404 status, crawler files, route metadata and canonical/share URLs. `/api/live` and storage/schema/configuration readiness are distinct.
- Ordered migrations, schema equivalence/upgrade tests, CI Worker bundling, explicit runtime test dependencies, and an operations/restore runbook are included. Targeted development dependency overrides eliminate the audit's reported advisories without downgrading React Email.

## Verification

Final verification passed: all 224 tests (162 backend/shared and 62 UI), TypeScript checking, the production build, Worker deployment dry run, and diff whitespace checks. The dependency audit reports zero vulnerabilities. Tests include isolated workerd execution. Browser checks used a separate local database, synthetic credentials, a local-only authentication mailbox, and no external email.

Observed browser flows: password plus email-code sign-in; migrated-field click-to-edit; live preview; private draft save; unchanged public page before publication; visible content after transactional publication; invalid JSON preserving the editor; pending scheduled publication; and the cemetery's phone-width empty state without horizontal overflow. These were local checks, not changes to the deployed site's records.

## Preserved and remaining work

Public forms, calculators, calendars, notice delivery, maps, cemetery administration, media management, history, account management, and work queues remain. Additive database migrations preserve existing rows and photo references. Empty-state presentation changes do not remove populated features.

The application is substantially hardened, but this is not a claim that all architectural or institutional launch work is finished. Some legacy editor code and DOM-based compatibility handling remain. The backend is still predominantly JavaScript; strict frontend checks and real Worker-runtime tests improve contract confidence, but a full backend TypeScript migration is separate work. Public content still uses a broad CMS projection, and a real cemetery registry will justify a narrower query path.

Official domain/mail ownership, operational data approval, photograph rights, retention periods, actual inbox delivery, complete accessibility/device QA, and a rehearsed production D1/R2 restore still need institutional acceptance. The restore runbook clearly distinguishes instructions from an executed production restore. No deadlines, official records, or ownership claims were invented to disguise these dependencies.

Before rollout, inspect `OPERATIONS.md`, back up the existing resources, apply the additive migrations, then deploy the verified bundle. The eight earlier branch commits also remain to be deliberately integrated into the desired release branch. The currently deployed site continues to run the previous implementation until a deployment is performed.
