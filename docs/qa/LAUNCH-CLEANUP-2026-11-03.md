# Production test-data reset — 3 November 2026

The owner explicitly identified all existing operational records and history as test data and requested their removal. The reset completed against production D1 `kpv-portal` on 3 November, with post-operation verification at 05:36:47 UTC. It did not reset source control, current portal configuration or the owner account.

Before deletion, a private ignored snapshot of all 32 application tables was restored successfully into isolated local SQLite. The guarded reset was rehearsed there. A separate simulated arrival proved that a changed record count aborts the reset and preserves the prior database. The production batch guarded table counts and current content revisions/metadata, then completed 65 statements with 98 changed rows.

Post-reset verification found **27 operational/history tables empty**: submissions, contact messages, cases/events, internal tasks, email subscribers/campaigns/deliveries/outbox/windows, auth/test sessions/challenges/events/limits, public submission retry/limit records, subscriber management versions, privacy events, CMS history/drafts/publications and scheduled values/publications. This includes 13 old operational items, one old subscriber, two completed campaigns, nine sent outbox entries and 20 content-history entries. No pending campaign or mail existed at reset time.

Both unpublished test notice objects were removed from the current notices section, now revision **7**, with no earlier test version available through website history. Market dates remain empty. Current collection, text and layout settings, owner account, permissions and operational recipient configuration were verified unchanged. The reset leaves the owner able to sign in again; old test sessions are not retained.

The two exact old report-photo objects were removed from `kpv-portal-photos`; a subsequent Cloudflare API list returned an empty bucket. No public CMS media existed. Managed `r2.dev` exposure is disabled and there are no custom bucket domains. No bucket, account, secret or unrelated Cloudflare resource was removed.

Private ignored release snapshots are recovery artifacts outside the application, and this record does not claim to purge Cloudflare recovery/log retention or messages already accepted by external mail providers/mailboxes. No new synthetic submissions or test emails were sent to production to replace the deleted test records. Follow-up feature testing uses isolated local data.
