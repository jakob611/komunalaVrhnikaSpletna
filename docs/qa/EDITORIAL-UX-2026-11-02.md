# Final editorial and UX pass · 2 November 2026

The owner requested natural, useful Slovenian across the public website and admin, without forced slogans or phrases that describe the service as “human”. This pass implements that request and follows the preceding 164-family functional/product review. It does not claim a mathematically optimal UX or replace testing with residents and staff.

## Scope and changes

- [Guest review](EDITORIAL-GUEST-2026-11-02.md): public task pages, forms, addresses, maps, cemetery, pricing, subscriptions and calendar handoffs.
- [Admin review](EDITORIAL-ADMIN-2026-11-02.md): all editor and operations families, including sign-in, permissions, content, work orders, recipient/notification handling, scheduling, private drafts and erasure.
- Primary reviewer: homepage, navigation, category pages, search descriptions, footer, document title, integration review and browser verification. Existing official contacts, prices, dates, permissions, form limits, calculations and API contracts were retained.

Examples: the homepage now says “Odpadki, voda in okolje.” and names the available tasks. “Vaš naslov. Vaše informacije.” becomes “Urnik za vaš naslov”. “Pravi odgovor se začne s stikom.” becomes “Kontakti in uradne ure”. The admin dashboard names editing tasks instead of saying “Urejena stran. Urejene informacije.” Draft, publication and separate email instructions name the actual buttons and their effects. The editor recovery message accurately describes the in-window copy instead of implying that it has already been saved durably.

The homepage's former decorative environmental card now links directly to the waste dictionary. Its empty-notices card offers the subscription route. Whole empty datasets for notices, collection points and waste items now explain that no records are published and offer the appropriate existing contact/source; filtered no-results still offer search/filter recovery. The admin notice list also distinguishes an empty list from an unmatched filter. No records, availability or operational promises were invented.

All existing `CmsText` and native-section IDs and frozen legacy aliases remain intact. Six new field IDs describe the three new empty-dataset states. The actual public snapshot contained only one copy override, the collection heading “Vaš naslednji odvoz.”; it remains deliberately unchanged. A read-only remote D1 check confirmed no saved `settings` row, so the reviewed new default footer applies without rewriting operator settings. No private production data was copied into the local preview.

The [editorial guide](../EDITORIAL.md) records the tone and task/confirmation distinctions for future changes. Old phrases in `legacy-fields.ts` remain compatibility aliases, not default visible copy.

## Verification

- `npm run check`: **175 server/shared + 178 UI = 353 tests passed**, TypeScript and production build. The three new regressions exercise honest empty-dataset recovery; existing exact-text expectations were updated while retaining their behavioral assertions. Stable CMS-identity/legacy-override regressions passed.
- Wrangler production dry-run passed. No schema migration, security configuration change or database publication is part of the code change.
- Actual loopback browser preview used the public production content snapshot and a fresh isolated local database with a synthetic owner account. Genuine local password/private-mail OTP sign-in succeeded; no external email was sent.
- Desktop homepage layout and the new waste-guidance link were checked; clicking it reached the waste search page. At a 375px measured content viewport, the revised homepage remained within document width and its text/actions were readable.
- Admin sign-in/session and desktop dashboard, mobile menu selection and the notice editor's save/publication instructions were checked. At a 375px measured content viewport, the document did not overflow horizontally; instructions and the three save controls wrapped within their panels. The temporary viewport override was reset.
- Public content, sensitive state handling and device/provider limits remain as documented in the earlier release and remote-QA reports. This wording pass does not repeat the 382-request remote run or assert new Google/Apple/Outlook account additions, physical GPS/camera/print, legal compliance or official data completeness.

The temporary local preview contains public content and synthetic authentication data only and is ignored by Git. Application commit, live observations and final cleanup are recorded in the release report after deployment.

Deployment completed: app commit `e03a452`, Worker version `1b74b2bb-1919-4f8a-a2d1-4fca7bf2ecce`; both push and PR CI passed. Live smoke and an exact verified-build comparison passed. Public section data/revisions and the saved copy override were preserved; the default footer changed as intended. Live browser checks confirmed the new homepage/footer, retained collection heading and accurate empty notices. Preview servers/tabs were closed and viewport sizing reset. Full evidence is in [the release report](RELEASE-2026-11-02.md).
