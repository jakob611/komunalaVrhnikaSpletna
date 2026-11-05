# Content-editor acceptance audit — 3–5 November 2026

The editor audit used an isolated copy of the published content, a synthetic owner account and a local mail capture. It exercised 333 loopback HTTP requests, browser workflows and focused component and server tests. Production content and real account data were outside this run.

Work browser control was temporarily disabled. It returned on 5 November and the root agent verified the corrected address preview after a genuine local owner password/OTP login. Browser control then stopped at a native confirmation because the safety check could not establish the current URL. Its cancel/accept outcome remains unverified. The table distinguishes observed browser actions, real API and scheduled-worker outcomes, controlled tests, and the browser interactions that could not be repeated. The earlier [editor action inventory](ADMIN-EDITOR-2026-11-01.md) defines the 63 entries.

## Defects fixed

- **Image descriptions reverted in the live preview.** A custom image alt edit was visible in the control but the iframe could restore the old description when another part of the preview changed. The bridge now tracks source and alt independently. After the fix an actual iframe retained the edited alt through an unrelated title change. Three focused tests also cover native overrides, restoration to a newly edited base value, and replacement of the source without carrying the old override’s alt. See `src/test/content-image-alt-regression.test.tsx`.
- **Draft collection preview matched nonexistent houses.** The shared matcher assigned a broad Verd route to the typed nonexistent house number `Verd 999999`, while the public endpoint rejected it. The admin preview now uses the same official-register picker as residents and waits for an explicit selection before matching the draft. Existing free-text rules still support settlements, streets and individual houses. Component tests cover empty and ambiguous registry responses, exact-house inclusion and exclusion, and invalidation on input change. Loopback registry requests confirmed the canonical house records used in these tests.

## Evidence

- **303 HTTP checks** covered all 17 sections through private drafts, public isolation, stale writes, invalid publication, publication, independent reads, history, restoration and private draft deletion. They also covered five-section publication and stale transaction rejection, immutable scheduled snapshots, filtering and cancellation, PNG/WebP byte roundtrips, disguised and oversized uploads, and invalid media cursors.
- **30 additional HTTP checks** covered equal-timestamp media pagination with 107 records, exact-house public collection for full, partial, ambiguous and unserved addresses, invalid address-rule publication, pre-effective tariff rejection and activation through the scheduled worker, and private-to-active notice publication with coordinate clearing. The same simulated clock was supplied to activation and tariff validation. The public calculator formula was run against the resulting tariff payload.
- **Observed browser actions** included local password and captured OTP, selection and immediate copy/layout updates in the actual iframe, native upload, failed upload and same-file retry, large JSON import/export, reloading the private draft, and an isolated successful history restore observed in the earlier browser pass. The JSON roundtrip used the same downloaded file. The prior upload failure was injected into the local database and produced no orphaned media metadata or object.
- Reproducible private fixture harnesses and raw evidence are under ignored `.deploy/exhaustive-20261103/editor/` in `http-{check.mjs,evidence.json}` and `secondary-{check.mjs,evidence.json}`. The component and integration runs are recorded there in `editor-current-{component,integration}.log`. The [operations audit](EXHAUSTIVE-OPERATIONS-2026-11-03.md) supplies additional schedule, notification and recovery checks.
- Four additional rendered-control tests passed on 5 November in `remaining-controls.test.tsx`, recorded in `remaining-controls.log` in the same private fixture directory. They exercise cross-page collection bulk operations, secondary-occupant selection and confirmed deletion, transformed SVG placement and cancellation, and independent municipality tariff edits. These tests simulate native confirmation and SVG coordinates. They do not certify the corresponding browser dialogs or pointer behavior.

## Per-action results

| ID | Exercised outcome and remaining browser scope |
|---|---|
| AE01 | HTTP custom-page persistence and component reset preserve page identity, title and menu destination. Native browser reset remains unverified. |
| AE02 | Browser edited text, duplicated, moved and hid only the duplicate, with corresponding iframe changes. Removal with confirmation passed in the component. Native confirmation remains unverified. |
| AE03 | HTTP notice targets persisted. Component external import refreshes the same notice’s rules while preserving trailing lines during typing. Browser same-ID import remains unverified. |
| AE04 | Browser selected the correct native text field, edited it live and retained the edit when switching to logo. Restore-to-inherited passed in the component. |
| AE05 | HTTP collection data persisted. Component created an empty area, added recurrence and rejected a conflicting change atomically. Browser sequence remains unverified. |
| AE06 | HTTP populated sectors, rows and multiple people. Component empty cemetery onboarding, bulk plot insertion and duplicate rejection passed. Browser structure controls remain unverified. |
| AE07 | HTTP menu persisted. Component rename/link edit, reorder, add/remove and reset passed. Browser menu controls remain unverified. |
| AE08 | HTTP images and links persisted. Browser edited custom image alt; iframe retained the corrected alt after another mutation. Native image/link selection and independent overrides passed in the component. Browser native selection and link restore remain unverified. |
| AE09 | HTTP private/public transition passed. Component create, title/area search, published filter, toggle and cancel-delete passed. Browser notice controls remain unverified. |
| AE10 | HTTP custom page persisted and component creation continued into the correct new page across tools. Browser new-page workflow remains unverified. |
| AE11 | Component rejected blank title, invalid slug and duplicate slug, then accepted a valid retry. Browser invalid submissions remain unverified. |
| AE12 | HTTP roundtripped image, button, card, callout and spacer payloads. Browser edited image alt, button label/URL/variant, card fields, callout title/body/tone and spacer height. Component exercised adding each type. A fresh browser add/render cycle for every type remains unverified. |
| AE13 | Browser observed dark, centered, narrow layout classes in the actual iframe. Component checked additional variants. Browser rendering of the remaining combinations is unverified. |
| AE14 | Browser added, edited, reordered and removed button/card entries, observed disabled add at 12 buttons and duplicated a card block. Component checked distinct child identities. Browser validation of every link edge case and the card limit is unverified. |
| AE15 | Component and shared rules preserved native section identity under reorder/hide and new sections. Actual iframe native-section reorder remains unverified. |
| AE16 | Browser tool switch retained pending copy. Component page switch cleared selection and retained earlier edits. Browser page switch remains unverified. |
| AE17 | Two real HTTP pages returned all 107 tied-timestamp IDs once. Component opened and selected older media. Browser older-media selection remains unverified. |
| AE18 | Browser PNG chooser, upload and application passed. HTTP PNG/WebP retrieval verified exact bytes; disguised and over-limit content rejected. Existing server test covers JPEG signature acceptance. Browser chooser cancellation remains unverified. |
| AE19 | Browser forced upload failure, preserved source and alt edit, then retried the same PNG successfully. No orphaned metadata or stored object remained. Component covered late responses, removed targets, superseded plans and unmounts. |
| AE20 | Browser applied a new logo and exposed the clear control. HTTP branding data persisted. Browser clear and header/footer projection remain unverified. |
| AE21 | HTTP verified authenticated reads of all 17 sections. Component opened the navigation areas. The browser opened a subset of editorial areas. |
| AE22 | HTTP settings mutations, private save, publish, fresh read and restore passed. Component saved and recovered settings through publication. Browser settings draft and successful history restore were observed earlier. Browser discard remains unverified. |
| AE23 | HTTP office order, identity, contact, tone and nested pairs persisted. Component edited and reordered phones/pairs/offices. Browser add/remove and contact-page projection remain unverified. |
| AE24 | HTTP waste point types and coordinates published and read. Validation rejects missing coordinates. Browser map placement and clearing remain unverified. |
| AE25 | HTTP waste aliases, categories and service preparation/order persisted. Component exercised item add/edit/remove, category edit and protected service identities. Browser public search/form projection remains unverified. |
| AE26 | Browser malformed JSON retained the previous 2,325,254-character textarea. HTTP invalid publication retained existing public content. |
| AE27 | Browser downloaded the native website JSON and reimported that same file, retaining the data counts. |
| AE28 | Browser imported over 2 MiB, applied, saved privately, exported and reimported 40 copy, 200 image and 70 layout records. The private server rows totaled 2,303,007 bytes. The 7 MiB input was rejected and the existing textarea was preserved. |
| AE29 | HTTP five-section publication and stale unchanged/changed request conflicts passed. Integration injected a later child failure and verified rollback. Browser full website publication remains unverified. |
| AE30 | Browser reloaded, recovered the private website draft and verified its 70 blocks. HTTP owner read/save/delete and no public leak passed. Integration covers cross-account isolation. |
| AE31 | HTTP stale draft write rejected. Integration covered normalized child write rollback and stale replacement/deletion. |
| AE32 | Component recovered expired-session editorial state only for the same account with original revisions. Browser expiry cycle remains unverified. |
| AE33 | HTTP history, attribution, restore as a new revision and missing-history rejection passed for every section. Earlier browser restore succeeded. Native cancellation remains unverified. |
| AE34 | HTTP scheduled an immutable five-section snapshot and verified subsequent draft edits did not alter it. Workerd test activated a large normalized snapshot. |
| AE35 | Scheduled worker activated through the explicit due clock. Controlled integration verified Ljubljana winter/summer boundaries and concurrent cron. See operations AO47. |
| AE36 | Controlled runtime verified publication conflict, author revocation and crash/lease recovery. See operations AO47–48. Browser presentation of those statuses remains unverified. |
| AE37 | HTTP filtered pending and cancelled schedules. Integration retained older active schedules amid newer entries. Browser list refresh/context remains unverified. |
| AE38 | HTTP accepted authorized pending cancellation and rejected repetition; operations separately checked author/owner/other-editor boundaries. Prior browser scheduled and cancelled settings. Native dialog branches were not repeated in this run. |
| AE39 | HTTP confirmed private notice absence, then public active publication, followed by restoration. Browser toggle/public projection remains unverified. |
| AE40 | HTTP notice title, category, area, status, date, map and rules persisted. Component cancel-delete retained the notice. Browser accepted delete remains unverified. |
| AE41 | HTTP retained exact-house rules. Rules/component covered topics, area plus house matching and stale delivery preview. Operations exercised preview and queue with isolated recipients. |
| AE42 | HTTP published coordinates and cleared them, then rejected a single remaining coordinate. Rules covered location links. Browser map click/clear remains unverified. |
| AE43 | Component copied dates without addresses, edited independently, then exercised delete cancellation and acceptance. Browser native confirmation remains unverified. |
| AE44 | HTTP published 30 dates per fraction. Component/rules exercised recurrence, interval, inclusive bounds and deduplication. Browser generator remains unverified. |
| AE45 | Shared rules and rendered controls exercised selection across pages, atomic collision rejection, a successful bulk move with preserved event IDs, and both cancellation and acceptance of bulk deletion. Browser multi-page bulk move/delete and native confirmation remain unverified. |
| AE46 | HTTP fixture contained 90 events. Component paginated over 25, retained selection across pages, cleared it on filter and returned to page one. Browser controls remain unverified. |
| AE47 | HTTP exact houses produced full, BIO-only, ambiguity and no-route outcomes; invalid slash rules left publication unchanged. The fixed component requires official selection, rejects bogus queries and uses the selected canonical address for independent fractions. Actual browser retest on 5 November rejected `Verd 99999`, then selected the exact registered `Verd 12, Vrhnika` option and displayed all three expected routes and upcoming dates. |
| AE48 | HTTP published and read cemetery structure and multiple people with unknown dates. Component created an empty cemetery and populated it. Browser onboarding remains unverified. |
| AE49 | Component sector rename preserved identity and duplicate bulk insertion was atomic. Browser duplicate sector/row and cancel controls remain unverified. |
| AE50 | Server lookup covered secondary occupants and diacritics. A rendered search for the secondary occupant selected the matching grave in another sector and updated both sector and row controls. Browser selecting that result remains unverified. |
| AE51 | Component accepted intermediate edits to grave ID, with uniqueness enforced on commit. Browser edit sequence remains unverified. |
| AE52 | HTTP read back two people and unknown dates. Component covered creation and both cancellation and acceptance of individual-person and whole-grave deletion, retaining unrelated records. Rules covered chronology and capacity. Browser native confirmations remain unverified. |
| AE53 | Server/domain geometry checked spacing, coordinates and bounds. Rendered SVG handlers exercised an inverted-coordinate transform, single-grave placement, cancellation between row endpoints, and positioning only the selected row. Browser pointer transform, row endpoint placement and cancellation remain unverified. |
| AE54 | Component plan replacement covered cancellation, preserved data and withdrawal of verified positions; geometry covered out-of-bounds plans. Browser uploaded plan comparison remains unverified. |
| AE55 | Component blocked occupied row/sector removal and exercised empty row/sector removal after explicit grave removal. Browser deletion remains unverified. |
| AE56 | HTTP tariff values changed and were restored. Component covered clearing a numeric input without accidental zero and switching municipalities while preserving independent amounts and resetting a transient blank edit. Browser switching municipality while editing remains unverified. |
| AE57 | HTTP and validation covered tariff date, VAT, units and pricing structures. Browser every-field traversal remains unverified. |
| AE58 | HTTP rejected direct future tariffs and scheduling before effective date. Real scheduled-worker activation changed the published rate only on the eligible simulated day. |
| AE59 | HTTP retained special-price notes. Component edited category/unit/VAT/scope, added/removed items and disabled add at 50. Browser guide/print projection remains unverified. |
| AE60 | Component and shared calculator rules covered household inputs, rates and rounding. Admin preview browser controls remain unverified. |
| AE61 | Fresh HTTP returned the activated tariff; the formula total increased using the new data. Full admin-to-public browser projection remains unverified. |
| AE62 | Earlier browser preview showed the selected Vrhnika assumptions, 14 rows and total on one A4 page. Fresh browser and physical printer checks remain unverified. |
| AE63 | Browser iframe selection and native import/upload worked. Keyboard-only traversal, phone reflow, zoom, touch placement and chooser cancellation remain unverified. |
