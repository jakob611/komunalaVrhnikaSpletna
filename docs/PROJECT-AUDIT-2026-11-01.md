# Project audit — 1 November 2026

## Assessment

The project is a recoverable, moderately sized application with a sensible underlying stack. It has meaningful security controls, domain validation, concurrency protection, and regression tests. It also has accumulated prototype decisions, particularly in the CMS and editorial workflow. I would not yet approve it for an institutional public launch.

Code quality cannot establish whether a person or an AI wrote it. The observable problems are unstable content identity, duplicated sources of truth, overly broad modules, weak failure semantics, and unfinished operational ownership. Focused refactoring is appropriate; a wholesale rewrite would discard useful work and introduce avoidable risk.

## Baseline and access

- Reviewed checkout: `codex/admin-workflows`, commit `32ab3d1ec1d97af8e50fa70f77fc1c90b287ed85`.
- GitHub confirms `jakob611`, email `tomincjakob@gmail.com`, and repository admin/push permission. Remote branch head matches the checkout. `main` is eight commits behind this branch; integrate deliberately before adopting a deployment process based on `main`.
- Cloudflare confirms `tomincjakob@gmail.com`, access to the configured account, Worker `kpv-portal`, D1 `kpv-portal`, and R2 `kpv-portal-photos`.
- Latest inspected deployment: 31 October 2026, 20:41 UTC. There is no verified source-commit provenance tying that deployment to the checkout. Live observations and source findings are distinguished below.
- Web requests and computer/browser access work. The deployed portal is reachable at `https://kpv.jakobtominc.com`.
- Baseline size: 142 tracked files; approximately 22,340 physical lines of application/script/type files, 10,607 lines of CSS, and 5,202 lines in test-related files. JSON/data/lockfiles are excluded from those code totals. Large modules concentrate change risk: `AdminPage.tsx`, `ServicePages.tsx`, and `App.tsx`.

No application code or cloud settings were changed. This report is the only added tracked file; build and dry-run artifacts are ignored. No emails, campaigns, invitations, or citizen submissions were sent.

## Verification

| Check | Result |
| --- | --- |
| `npm test` | 125 backend/shared tests and 45 UI tests passed |
| `npm run build` | TypeScript frontend checks and production build passed |
| `npx wrangler deploy --dry-run --outdir .deploy/audit-bundle` | Worker bundle and configured bindings packaged successfully; nothing deployed |
| `npm audit --omit=dev --json` | No reported production dependency vulnerabilities |
| Full `npm audit --json` | Three moderate findings in the development chain `react-email → glob → minimatch`; no high/critical findings |
| Limited tracked-file credential-pattern scan | No matching Resend/GitHub token or private-key patterns; not a historical secret audit |
| Live HTTP checks | Public HTML/API accessible; admin document has no-store/noindex/no-referrer headers |
| Live browser inspection | Home, services, cemetery, report/contact, collection, calculator, market, notices, collection locations, My Home, privacy, and admin sign-in inspected without submitting forms |
| Phone-width spot check | Cemetery page checked at 390 CSS pixels; no horizontal document overflow observed; this is not a full responsive audit |

The existing tests exercise many real regressions, including authentication, revisions, uploads, address matching, pricing, calendars, and editor context. They run in Node/SQLite and jsdom. Passing them does not establish Cloudflare runtime equivalence, full browser usability, accessibility conformance, actual inbox delivery, or official correctness of operational records.

## Findings requiring action

Priorities express remediation order. P1 requires prompt attention; P2 is a substantive correctness/privacy/workflow issue; P3 is polish or a lower-risk limitation. A code-confirmed issue is not automatically evidence of a historical incident.

### 1. P1 — Request logging can retain subscription capabilities and household addresses

**Evidence:** Live Cloudflare settings have persisted invocation logs enabled with `redact_query_string: false`. `server/subscriptions.js:29` places signed management capabilities in page URLs. `src/pages/SubscriptionPage.tsx:12` repeats them in API URLs, including POST requests. Collection and calendar endpoints read household addresses from query strings at `server/worker.js:440`.

Cloudflare documents that invocation logs include request URLs. Together, the code and live settings establish an exposure path into operational logs. This audit did not retrieve historical personal records or prove third-party access. `no-store` and `no-referrer` do not remove a request's own URL from logging.

**Action:** Enable query-string redaction, review access and handling of existing logs, and reduce sensitive URL parameters. Prefer a token exchange into a bounded session/body-based workflow. Coordinate this with finding 2 so previously exposed capabilities can be revoked.

Sources: [Workers Logs](https://developers.cloudflare.com/workers/observability/logs/workers-logs/), [observability configuration](https://developers.cloudflare.com/workers/wrangler/configuration/#observability).

### 2. P2 — Old subscription management links continue controlling a replacement subscription

**Evidence:** `server/subscriptions.js:13`, `:49`, and `:153` issue management tokens with the default version zero. Token verification checks the signature but does not enforce management-token generation or expiration. `:96` returns the current address and `:103` permits preference changes. The same broadly privileged capability is used for the unsubscribe header at `:154-157`.

**Reproduced in isolated in-memory SQLite:** subscribe and confirm, keep the old management URL, unsubscribe, resubscribe with a different address, and confirm. The old URL still returns the new address and permits preference changes with HTTP 200. This requires possession of a valid old URL; tokens are not readily guessable.

**Action:** Introduce a separately revocable management-token generation, rotate it on relevant lifecycle changes, and use an unsubscribe-only capability for automated unsubscribe handling. Add a regression test for the reproduced sequence.

### 3. P2 — CMS read failures silently substitute operational defaults

**Evidence:** `server/admin.js:115-130` catches database, JSON, and validation errors and returns bundled defaults. Market restrictions at `server/worker.js:555` then operate on default empty date/closure lists. Collection/calendar reads can similarly revive bundled routes or dates that editors changed or removed. `src/content/SiteContent.tsx:109-119` also silently leaves bundled contacts, tariffs, and other content visible when `/api/content` fails.

**Reproduced:** a controlled failed market configuration read returned `{ dates: [], closedDates: [] }`; when the independent storage write remained available, an enquiry was accepted. This is an enquiry-validation defect, not proof of an automatically confirmed booking.

**Action:** Distinguish initial setup from an unavailable published configuration. Use explicit unavailable responses for operational decisions, or a versioned last-known-good publication with visible freshness information. Do not silently reinterpret a read failure as unrestricted availability.

### 4. P2 — Personal-data retention and erasure have no complete supported workflow

**Evidence:** Submission payloads, report photographs, subscriber addresses, and email bodies persist across related tables/R2. Existing cleanup targets authentication and rate-limit records. `docs/ADMIN.md:103` explicitly says unwanted submissions remain stored. `src/App.tsx:1255` promises an erasure-request contact without a reviewed purge operation covering all related copies.

**Action:** Agree retention periods and organizational responsibility, then implement an auditable purge/anonymization workflow covering cases, events, photographs, outbox bodies, subscriber data, and delivery references. Include expired unconfirmed subscriptions. Coordinate backups and external email copies with that policy. This is an operational gap; this review does not determine legal compliance.

### 5. P2 — A content editor receives citizen-data access

**Evidence:** `server/admin.js:320-340` authenticates an editor and permits subscriber emails/addresses without a separate content-only permission. Work items and private report photographs are likewise accessible to the editor role. Owner checks do protect account invitations and recipient settings.

**Action:** Define permissions by duties before inviting staff: content publishing, citizen-case handling, subscriber/campaign operations, and ownership. If every invited editor is intentionally a case handler, document that broad grant clearly.

### 6. P2 — Malformed JSON import can crash the admin editor

**Evidence:** `src/pages/AdminPage.tsx:2379` checks only that imported JSON is a non-null object, then replaces the draft. `{}` satisfies this check. `src/components/admin/WebsiteEditor.tsx:26` immediately expects `value.layout.pages`. Typed editors trust similar structures. No React error boundary was found.

**Action:** Validate imported data against the appropriate shared schema before replacing the current draft, preserve the previous draft on error, and provide a recoverable editor error boundary. Server validation occurs too late to protect this client-side render.

### 7. P2 — CMS content identity depends on presentation details

**Evidence:** `src/content/ContentBridge.tsx:46-75` derives text identity from the original wording and rewrites React-owned DOM nodes. Repeated wording on a page shares the override; changing source wording disconnects an existing override. `src/content/PageComposer.tsx:232-235` derives native section IDs from React child keys, commonly source positions. Inserting/reordering source sections can misassociate saved visibility/order settings.

**Action:** Introduce explicit permanent field and section IDs. Migrate existing published overrides before changing page structures, then render fields directly through React. The current mechanism is a central refactoring constraint: extracting or rewriting pages without migration can damage editorial state even when route tests pass.

### 8. P2 — Website publishing can leave a partial release

**Evidence:** `src/pages/AdminPage.tsx:1169-1183` publishes copy, images, links, layout, and settings through separate writes. A later conflict leaves earlier writes live. The UI acknowledges partial success, so the limitation is disclosed, but a single apparent website change has no transactional release boundary.

**Action:** Validate and publish related sections as one revision-checked database transaction/publication. Keep drafts distinct from live content and support an identifiable rollback point.

### 9. P2 — Reauthentication discards unsaved work; future publication is manual

**Evidence:** `src/pages/AdminPage.tsx:1012-1014` clears the draft on an expired session. Reauthentication cannot restore it. `src/components/admin/TariffsEditor.tsx:116-122` explicitly tells editors that future tariff drafts are not durable and must be published manually on the effective day. Notice dates do not schedule publication either.

**Action:** Add recoverable drafts and a clear publish lifecycle. Implement scheduling only where the editorial process needs it, with explicit effective dates and operator visibility. Treat these as workflow limitations rather than hidden calculation bugs.

### 10. P2 — Emergency contacts have multiple sources of truth

**Evidence:** The configurable emergency number is used at `src/pages/ServicePages.tsx:2206`. The report panel at `:1139` and water panel at `src/App.tsx:1038` hardcode the old number.

**Action:** Route all emergency displays and telephone links through one validated setting. Verify every urgent pathway after a configuration change.

### 11. P2 — Retrying a public form can create duplicate cases and emails

**Evidence:** `server/worker.js:581` generates a new submission ID for each POST. `src/pages/ServicePages.tsx:208-240` aborts a delayed request and invites retry. If storage succeeds but the receipt is lost, retry creates another case, email, and potentially photograph. Two identical controlled contact submissions produced separate successful records. Internal tasks already have a request identity pattern.

**Action:** Generate a stable client request ID per intended submission, retain it across retries, and enforce transactional deduplication on the server. Distinguish a new submission from retrying an uncertain result.

### 12. P2 — Public form rate limiting is optional but unconfigured

**Evidence:** `server/bot-protection.js:42` only applies its form limiter if `FORM_RATE_LIMITER` is bound. Neither the checked-in configuration nor inspected live bindings include it. The inspected account/zone ruleset inventory showed managed protections, with no custom application rate-limit ruleset visible.

**Action:** Configure an explicit submission quota alongside Turnstile. Verify legitimate bursts, shared connections, and failure behavior. This is a missing application abuse control, not evidence that Cloudflare provides no other network protection.

### 13. P2 — Readiness, migrations, and restore procedures are incomplete

**Evidence:** `/api/health` at `server/worker.js:392` reports `ok: true` based on binding presence. A controlled unusable database still produced success. `schema.sql` provides initial/idempotent setup without ordered migration history. `package.json` deploys with build plus Wrangler; CI lacks Worker-runtime execution. No tested combined D1/R2 restoration runbook is present.

**Action:** Separate liveness from readiness; check schema compatibility and database access for operators. Add ordered migrations, Worker-runtime tests for critical paths, and a restore rehearsal/runbook. Strict TypeScript currently covers `src`, not backend/shared JavaScript. Actual account backups were not comprehensively inspected, so their absence is not established.

### 14. P3 — Live public forms and incomplete features reveal unfinished production work

**Evidence:** Both source and deployed report/contact forms contain `Testna oseba` and `test@primer.si` placeholders (`src/pages/ServicePages.tsx:1090`, `:1099`, `:2032`, `:2042`). The deployed cemetery has zero sectors, graves, and persons, yet offers search/filter/select instructions and introduces itself as a working grave finder. The privacy page uses the personal administrator Gmail; the footer links to another site as the official website. Wrangler defaults also identify the personal account as owner and email destination; a database setting may override the delivery recipient.

**Action:** Remove test wording; show a purposeful contact-led cemetery state until verified records are available, or complete the feature with approved records. Establish official domain, mailbox, owner, sender, privacy contact, and editorial responsibility. Verify imagery rights; README already records an unresolved photograph-rights handoff. Confirm operational content with KPV rather than merely removing signs of incompleteness.

### 15. P3 — HTTP discovery and defensive headers need production treatment

**Evidence:** Live `/robots.txt`, `/sitemap.xml`, and an unknown path all return HTTP 200 with the same HTML application shell. `CustomCmsPage` displays a client-side missing-page screen, but cannot change HTTP status. Public pages share the initial description and have no initial route content. No public document CSP was observed; private routes have additional protective headers.

**Action:** Serve real crawler files and correct missing-page status; define route metadata/canonical URLs. Evaluate prerendering for public informational routes without automatically replacing the stack. Add a tested CSP and consistent document headers compatible with Turnstile, maps, and the CMS preview. No exploitable XSS was demonstrated by this finding.

## Architecture and product limitations

- **Keep the stack:** React/Vite, a modular Fetch API Worker, D1, and R2 are proportionate to this application. A distributed services architecture would not fix the identified problems.
- **Preserve good engineering:** parameterized SQL, hashed sessions, password plus email code, production cookie flags, Origin/CSRF checks, guarded OTP consumption, private report media, file signature checks, bounded bodies, revision conflicts, atomic history, transactional outbox, queue leases/retries, and careful address/pricing/calendar rules.
- **Consolidate the CMS:** the unified editor coexists with older copy/image/link/layout editing paths and a broad JSON escape hatch. Define one draft/publication model before removing duplication.
- **Extract by domain:** split public pages and admin orchestration into cohesive feature modules, with shared API/form primitives. Large file sizes are a risk concentration; arbitrary line-count targets are not the goal.
- **Make backend contracts checkable:** add TypeScript or checked JSDoc incrementally around environment bindings, HTTP payloads, and storage adapters.
- **Menu editing has a disclosed limitation:** custom navigation is flat (`src/App.tsx:367-374`, `LayoutEditor.tsx:758-760`) and drops the native submenu structure. Decide whether editors need nested menus.
- **Content projection will need improvement:** every visit loads all CMS sections, with no-store and visibility refreshes. Cemetery data would accompany unrelated pages as it grows. Separate public projections and revision-based caching when introducing a real registry.
- **Dependencies:** address the moderate development advisories deliberately. The audit's suggested downgrade of `react-email` is not a safe instruction to run blindly. The lockfile already pins installations, but `latest` manifests for Wrangler/types make intentional upgrade policy useful.

## Focused remediation sequence

1. **Contain exposure and correctness failures:** logging redaction, capability revocation, operational read-failure behavior, emergency-contact consistency, import validation, public submission deduplication, and quotas. Add targeted tests for each reproduced failure.
2. **Make daily administration reliable:** durable drafts, stable CMS IDs with data migration, transactional publication, role boundaries, and erasure/retention tools. Preserve existing published content throughout migration.
3. **Refactor around those contracts:** replace DOM text rewriting, consolidate editor paths, extract domain modules, and introduce backend typing. Keep existing useful regression coverage; add real browser editing/publishing scenarios and Worker-runtime checks.
4. **Complete institutional launch:** approved records and contacts, cemetery readiness, image rights, metadata/discovery/headers, migrations, restore rehearsal, accessibility/mobile QA, delivery verification, and deliberate integration of the eight branch commits.

Each stage should have a specific user-visible acceptance criterion. “De-slopping” succeeds when changing a contact updates every pathway, retrying a form produces one case, an outage never invents availability, and a source refactor preserves editorial content. Cosmetic cleanup alone will not achieve that.

## Review limits

This was a repository-wide review split across three specialist agents, with root verification of tests, build, bundle, account access, cloud configuration, HTTP behavior, and selected live browser flows. It is not a line-by-line proof of every execution path or a penetration-test certification.

Authenticated admin behavior was assessed from implementation and automated tests; no production admin session was opened. No live personal-data export, historical log inspection, full Git-history secret scan, campaign send, or destructive erasure was performed. Delivery into an inbox, complete accessibility conformance, official tariff/address/grave accuracy, legal/privacy requirements, traffic capacity, and complete backup policy remain separate acceptance work.
