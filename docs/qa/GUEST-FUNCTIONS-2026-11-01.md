# Guest function inventory · 1 November 2026

This is the guest-facing function inventory and component/integration audit for the current working tree. It is **not an exhaustive browser or external-service certification**. The new `src/test/guest-functional-audit.test.tsx` contains 29 passing scenarios. Its requests use controlled responses and its environment is jsdom. Two additional retry scenarios in `src/test/submission-retry.test.tsx` passed alongside them: 31/31 in the focused run. TypeScript validation also passed before the final inventory handoff.

An existing test's presence is distinguished below from a scenario newly executed in this pass. Existing route tests check renderability and supported internal destinations; they do not prove touch usability, layout, delivery, or completion in external applications. Actual browser checks are owned by the main audit and must be recorded separately. No production submissions, campaigns, emails, or account mutations were performed by this audit.

## Status legend

- **DOM PASS:** executed against React components in jsdom with controlled API responses.
- **TEST EVIDENCE:** an existing automated scenario covers the stated contract; see the named file. This table does not independently claim a fresh run of every existing server test.
- **SOURCE:** implementation and wording inspected; behavior requiring a browser or external system remains open.
- **EXTERNAL OPEN:** cannot be established by component tests or source inspection.

## Navigation, home, and saved address

| ID | Guest action and states examined | Evidence | Result and remaining limits |
| --- | --- | --- | --- |
| G01 | Open a native submenu with Arrow Down, focus its links, close with Escape, return focus to the trigger. | New G01; `src/App.tsx` Header. | DOM PASS. Actual pointer hover, touch behavior, and responsive geometry still need browser evidence. |
| G02 | Search without diacritics using several words; find a custom page title; no-match result; Escape and focus restoration. | New G02; SiteSearch; final `address-handoff.test.tsx` content-search scenario. | DOM PASS. Final pass expands the task index with published notice text and custom-page block/card content. It does not index every hardcoded paragraph of built-in programmatic pages. |
| G03 | Toggle mobile menu and close it after following a destination. | New G03. | DOM PASS for control and route state. The test does not simulate a phone viewport or certify a touch/focus overlay. |
| G04 | Display a general announcement on the homepage with the correct subject category. | New G04; Home notices. | DOM PASS after fixing general notices incorrectly labeled as waste. General announcements now use the bell and “SPLOŠNO.” |
| G05 | Save a personal address, show fetched collections, forget the address, and remove its event cards. | New G05. | DOM PASS, including localStorage inspection. No account is required. |
| G06 | Continue using a personal address when browser storage refuses the write. | New G06. | DOM PASS after adding explicit storage feedback. The UI no longer silently promises persistence. |
| G07 | Personal collection API error, no misleading old events, retry, partial-schedule warning. | New G07. | DOM PASS with a failed response followed by success. |
| G22 | Enter an address on the homepage while localStorage is denied; retain the address when opening MyHome. | New G22. | DOM PASS after adding transient route state. Persistence across a later visit remains unavailable and is explained. |
| G23 | Forget an address when the browser refuses deletion. | New G23. | DOM PASS after preserving the visible address and explaining how to remove it in browser settings. It no longer claims a failed deletion succeeded. |
| G30 | Use a custom flat menu; follow logo, footer, phone, email, emergency, breadcrumbs, and skip link destinations. | Header/Footer/PageComposer source; existing `routes.test.tsx`; emergency setting test in `content-publication.test.tsx`. | SOURCE / TEST EVIDENCE. Custom menus are deliberately flat and replace native submenu groups; this is disclosed in the editor. Actual dialing/email apps and skip-link visual position require browser/device checks. |

## Notices and email subscriptions

| ID | Guest action and states examined | Evidence | Result and remaining limits |
| --- | --- | --- | --- |
| G08 | Start with a category URL; switch to all notices; combine text and category filters; recover from zero results. | New G08. | DOM PASS. |
| G09 | Notice API failure, explicit error, retry, successful notices. | New G09. | DOM PASS. A failed API is not presented as an empty successful notice list. |
| G10 | Subscription name/email/address/district/topics/consent, disabled action before topics, confirmation instructions after submission. | New G10; `SubscriptionForm.tsx`. | DOM PASS for client form and request values. Real Turnstile and email delivery are EXTERNAL OPEN. |
| G11 | Expired/invalid confirmation capability; no false confirmation; route to a fresh signup. | New G11. | DOM PASS. |
| G31 | Follow a homepage notice link to its anchored article; read category/date/status/location; filter roads and select map information. | `src/App.tsx` Home, `ServicePages.tsx` NoticeCards/RoadsPage; route tests. | SOURCE / TEST EVIDENCE. Real anchor scrolling, map click/tile behavior, and long notice layout require browser checks. |
| G32 | Inspect a confirmation without changing subscription state; explicitly confirm; obtain a fresh management link. | Existing `subscription-security.test.tsx`; `server/subscriptions.test.mjs` confirmation scenarios. | TEST EVIDENCE. Capability appears in fragment/POST body rather than request URL. Inbox delivery and real mail-client opening remain EXTERNAL OPEN. |
| G33 | Manage active preferences: address, active district, topics; block an empty topic selection; save; preserve errors. | `SubscriptionPage.tsx`; existing subscription-security client test and server preference-update scenarios. | SOURCE / TEST EVIDENCE. Full real-email-link → live save flow is not claimed by this component audit. |
| G34 | Unsubscribe-only link; show no household fields; explicit unsubscribe; repeated unsubscribe; stop queued targeting. | Existing `subscription-security.test.tsx`; `server/subscriptions.test.mjs` unsubscribe/queued delivery scenarios. | TEST EVIDENCE. External one-click behavior of receiving mail providers remains EXTERNAL OPEN. |
| G35 | Replace an address/topics by a new signup; require new confirmation before replacing active preferences; recover expired/stale links. | Subscription form wording; existing server replacement/resend/capability scenarios. | SOURCE / TEST EVIDENCE. One email address intentionally has one subscription/address. Mail delivery and spam placement are EXTERNAL OPEN. |

## Waste, collection calendars, maps, and GPS

| ID | Guest action and states examined | Evidence | Result and remaining limits |
| --- | --- | --- | --- |
| G12 | Look up an address, identify a partial schedule, expose calendar actions, clear old schedule while editing a new address. | New G12. | DOM PASS. |
| G13 | Reject malformed collection responses without showing a plausible schedule/download. | New G13. | DOM PASS. |
| G14 | Search a published custom waste item while another group is selected; explain that it exists in another group; recover without losing query. | New G14. | DOM PASS after changing recovery to use the published item list instead of bundled items. |
| G15 | Filter collection points, show no-match state, reset filters; GPS refusal; manual alternative; directions coordinates. | New G15. | DOM PASS. Map tiles, actual location hardware, and Google navigation remain EXTERNAL OPEN. |
| G26 | Obtain a GPS suggestion for a report; distinguish it from a confirmed point; explicitly confirm it; verify its map-link coordinates. | New G26. | DOM PASS. No actual location hardware was queried. |
| G36 | Match exact houses/qualified streets, diacritics, homonymous places, independent waste fractions, ambiguity, expired dates, and no invented continuation. | Existing `shared/collection-utils.test.mjs`, `server/managed-collection.test.mjs`, `server/calendar-published.test.mjs`. | TEST EVIDENCE. Source-data accuracy and future official schedules need operational maintenance. |
| G37 | Calendar dialog: Google/Apple/Outlook/other, one date versus published future dates, work/school Outlook, alternative download, close/focus behavior. | Existing `calendar-providers-audit.test.tsx`, `workflows.test.tsx`; `CalendarDialog.tsx`. | TEST EVIDENCE / SOURCE. Links and dialog state are tested; successful additions in real provider accounts are EXTERNAL OPEN. |
| G38 | Calendar endpoints follow the current domain; all-day boundaries; changes/removals and stable event identities; no home address in feed URL. | `shared/calendar-links.test.mjs`, existing server calendar/feed tests; actual origin passed by CalendarDialog. | TEST EVIDENCE. Refresh delay belongs to the receiving calendar application. Local preview subscriptions are not reachable from public providers. |
| G39 | Waste suggestions, all-group results, synonyms, no-match/manual guidance, category destinations and source links. | New G14; `WasteWizardPage`, `findWasteItems`; existing route tests. | DOM PASS for custom-item recovery; remaining source rules reviewed. Guidance is a bounded published dictionary, not free-form AI inference. Correct disposal instructions require verified source data. |
| G40 | Collection-point list selection, map focus, filters, GPS success/refusal, approximate-point warning, tile-error alternative. | New G15 for filter/refusal/link values; WasteMapPage/TileBase/FocusMap source. | DOM PASS subset / SOURCE. Actual tile error, pan/zoom, marker interaction, map keyboard use, and GPS accuracy need browser/device checks. |

## Forms and receipts

| ID | Guest action and states examined | Evidence | Result and remaining limits |
| --- | --- | --- | --- |
| G16 | Report category shortcut, invalid photo rejection, continue without photo, denied GPS, submit using written location only, safe saved receipt. | New G16. | DOM PASS with controlled API. Native constraint behavior, actual protected submission and downstream handling need browser/backend integration evidence. |
| G17 | Service shortcut selects septic service; preserve entered details after API failure; send selected service type. | New G17. | DOM PASS. |
| G18 | Contact subject customization and saved receipt wording. | New G18; existing `editing-convenience.test.tsx` and `market-and-contact.test.tsx`. | DOM PASS. Receipt means stored, not delivered to an inbox. |
| G24 | Submit a published market date and selected stall type; show saved receipt while explaining that availability is confirmed later. | New G24; existing market availability tests. | DOM PASS. Actual stall availability/operator confirmation and payment are outside this portal flow. |
| G25 | Client preview of a supported report photo; remove it; revoke the preview object URL. | New G25; existing server attachment-signature tests. | DOM PASS for client behavior. Test uses controlled bytes/object URL; real image decoding and camera capture remain browser/device work. |
| G28 | Edit a successful contact form into a new unsent intent; remove the previous saved receipt. | New G28. | DOM PASS after fixing stale receipt display. Change invalidation is applied to all four public submission forms. |
| G29 | Resubmit an unchanged successful form without creating another case or requiring a new anti-bot token. | New G29; updated `submission-retry.test.tsx`. | DOM PASS after retaining the last successful logical fingerprint and receipt. Materially changed content starts a new submission. |
| G41 | Lost response after possible storage, retry with the same logical payload, changed values, fresh challenge token, empty file metadata. | `submission-retry.test.tsx`; backend idempotency scenarios. | DOM PASS for current mounted form; TEST EVIDENCE for server deduplication. A full reload loses client memory; no guarantee of cross-reload duplicate recognition is claimed. |
| G42 | Service options bulky/septic/water/other, price guidance, optional preferred date, remembered execution address, no false booking/payment promise. | ServicesPage/ServicePriceGuide source; new G17; route and pricing tests. | DOM PASS subset / SOURCE. Actual service execution, tariff ownership, and scheduling are operational dependencies. |
| G43 | Market explicitly published dates only, empty list and future-date exhaustion disable registration, past/closed/unlisted date rejection, admin availability change, stall-category prices. | New G24; `market-and-contact.test.tsx`; backend `production-reliability.test.mjs`; MarketPage source. | DOM PASS / TEST EVIDENCE. Owner confirmed that an empty list permits no registrations; arbitrary date entry and invented Saturdays were removed. Prices apply to the stated Saturday outdoor stall; other circumstances are by agreement. |
| G44 | Public form required values/consent, maximum sizes, invalid dates/email/category, storage failure, private attachments, bot rejection, cross-origin rejection. | Existing `server/backend.test.mjs`, shared validation tests; DOM form attributes. | TEST EVIDENCE / SOURCE. BotProtection is mocked in the new guest scenarios; those scenarios do not certify real Turnstile. |

## Calculator, cemetery, informational pages, and access

| ID | Guest action and states examined | Evidence | Result and remaining limits |
| --- | --- | --- | --- |
| G19 | Waste-only calculator without water fields; result table; invalid people count removes a plausible total. | New G19. | DOM PASS. |
| G20 | Populated cemetery: search a surname, show multiple people, unknown dates, unconfirmed position, close detail. | New G20. | DOM PASS with synthetic isolated fixtures. No real deceased-person data was created or changed. |
| G21 | Render a custom page with published content; unsupported page displays return-home action. | New G21; existing route tests. | DOM PASS. HTTP 404/SEO behavior is a separate server concern and must not be inferred from this rendered-state test. |
| G27 | Populated cemetery: arrow-key selection between confirmed plots; selected state; zoom and reset controls. | New G27. | DOM PASS for events/state. Drag geometry, touch pan, legibility, actual clipboard and real-world plot correctness remain open. |
| G45 | Calculator municipality/scope changes, sewer versus septic/MKČN, water-only, zero water use, DN, BIO, deductions, invalid/future tariffs, rounding and print action. | Existing `workflows.test.tsx`, `usability-regressions.test.tsx`, `shared/utility-pricing.test.mjs`; UtilityCalculator source. | TEST EVIDENCE / SOURCE. Local A4 print preview passed for the documented typical scenario; physical printer output and other configurations remain open (see the main browser matrix). Estimates do not replace issued bills; official tariff verification remains necessary. |
| G46 | Cemetery without records: useful contact and visiting page, no empty search/filter/count promises. | `content-publication.test.tsx`; CemeteryPage empty branch. | DOM PASS in the earlier focused audit. Actual evidence and permission to publish a register are operational dependencies. |
| G47 | Cemetery copied-link success/fallback, URL search/sector/plot parameters, result pagination, map/list synchronization. | CemeteryPage source; existing route/domain tests. | SOURCE / TEST EVIDENCE subset. Clipboard, touch, physical plan alignment, and an external recipient opening a shared link are not certified here. |
| G48 | Category pages, company/About, DEPO, contact details/hours, privacy, external source documents, maps and existing customer-portal links. | Existing 21-route render/link contract; page sources. | TEST EVIDENCE / SOURCE. External websites/documents, business contact correctness, image rights, and institutional privacy text need owner verification. No legal compliance certification is claimed. |
| G49 | Keyboard focus, skip-to-main, menu/search/calendar dismissal, reduced-motion handling, input labels, error/status announcements, text alternative to map content. | New G01–G03/G16/G27; CalendarDialog/PageMotion/AnimatedDisclosure/ScrollManager source. | DOM PASS subset / SOURCE. Screen-reader speech, mobile focus geometry, contrast, touch targets, zoom/reflow and motion appearance need actual accessibility/browser review. |
| G50 | First content load, API failure, retry, previous-publication warning, no bundled operational fallback, admin availability during public content outage. | `content-publication.test.tsx`; SiteContentProvider. | DOM PASS in earlier focused audit. Live outage timing/network and browser cache behavior are separate checks. |

## Defects discovered and repaired during the guest pass

1. **Wrong homepage category:** general announcements inherited the waste label/icon. G04 now covers the correct category.
2. **Misleading address persistence:** MyHome swallowed failed writes/deletes. G06/G23 cover honest feedback. Homepage navigation also discarded an entered address when storage failed; G22 covers transient continuation.
3. **Wrong waste recovery source:** the no-result action queried bundled items rather than the published dictionary. G14 covers an editor-added item in another category.
4. **Stale success receipt:** editing a form after success kept the previous receipt visible. G28 covers clearing it for a new unsent intent.
5. **Duplicate completed submissions:** an unchanged second click after success previously generated a new logical ID. G29 and the retry tests now retain/reuse the successful result before asking for another security token.
6. **Subscription navigation wording:** the personal subscription route now uses “E-obvestila” for its client title and breadcrumb. Subscription emails label unsubscribe links “Odjava e-obvestil”; confirmation and management link labels are preserved. These are wording corrections found by the main browser audit, without a new external delivery claim.
7. **Calculator printing:** the main browser audit found unwanted site chrome, excessive pagination and repeating totals. The result now includes its relevant input/assumption summary. Calculator-scoped print rules compact the result, retain warnings/header repetition and prevent repeating totals. `calculator-print.test.tsx` checks changing scopes/inputs and the print action.

   The final actual local browser preview confirmed **one A4 page** for Vrhnika / 12 m³ / three people, including all 14 rows, six input assumptions, one final total after the rows, tariff dates and warnings. Site navigation/footer were absent. Table text remains 9 pt and warnings remain 8.5 pt. No physical print job was made; other printer settings and arbitrary editorial text can paginate differently. See the [main browser matrix](FUNCTIONAL-REVIEW-2026-11-01.md).

These repairs preserve existing CMS field/section IDs and frozen legacy aliases. No published content or infrastructure was changed by these local source edits.

## Open handoff items

- Complete the main audit's actual browser matrix at desktop and mobile sizes. jsdom state assertions are not visual or touch tests.
- Complete a controlled protected submission through the deployed/staging Worker, inspect its private case and attachment, and verify the expected recipient inbox without sending public campaigns. This requires explicit isolated test recipients/data.
- Confirm Google, Apple and personal/work Outlook acceptance in real accounts; link construction alone is insufficient.
- Verify physical GPS/camera behavior, rejected location permissions, slow/offline map tiles, touch pan/zoom, clipboard restrictions, print output and assistive technology behavior.
- Owner confirmation remains necessary for official schedules/tariffs/contact data, cemetery register/plan, asset rights and institutional privacy/retention wording.
- Search now covers the task index, published notices and custom-page block/card text. Full-text indexing of every hardcoded built-in paragraph, hierarchical custom navigation and server-backed guest draft persistence are not provided; they should not be described as working features.

Final product-purpose review and nine additional address/search/calendar scenarios: [guest product ledger · 2 November](PRODUCT-UX-2026-11-02.md). Main-audit live/browser results must be recorded separately from those component checks.
