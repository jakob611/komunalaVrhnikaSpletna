# Executed guest audit — 3–5 November 2026

This records the 3–5 November guest review and distinguishes isolated browser, controlled component and real HTTP checks. Production checks were read-only. External mail delivery and the production release are covered separately.

The local handler ran on 8789, Vite on 5175 and the fault proxy on 8799, with an independent SQLite database and private mail capture under `.deploy/exhaustive-20261103/guest`. The isolated browser used the public baseline plus synthetic notices, market dates, a custom page and cemetery records. The request journal and fixture files are local audit evidence. Browser control temporarily became unavailable under Work settings, then returned on 5 November for the additional actual browser checks recorded below.

## Confirmed defects and corrections

The report map's `aria-label` was passed to React Leaflet `MapContainer`, which did not render that attribute. A real browser query for the named map failed, and inspected HTML showed an unnamed `.leaflet-container`. The existing outer wrapper is now a named region; the ineffective prop was removed. Browser inspection then found exactly one named region. Actual map click, cancel, confirm, submission and removal worked afterward. This changes accessibility labeling, not map coordinates or business policy.

The collection page accepted any array in `events` and could show a schedule and calendar action for malformed event dates or route data. Three controlled browser-component reproductions failed before the repair: an impossible date, an invalid route expiry and a string in place of the missing-fractions list. The shared response guard now validates rendered dates, types and route metadata before the schedule can be displayed or saved. Valid partial and empty schedules still pass the focused suite.

The contact form allowed 200 characters in the subject. Actual isolated HTTP requests established that the server accepts 180 characters and rejects 181. The form now uses the server's 180-character limit.

The resumed browser pass found that calculating at 320 pixels widened the calculator grid beyond the screen. The CSS correction lets the grid tracks and panels shrink while the results table keeps its own horizontal scroll. The corrected local browser kept the page at 320 pixels after calculation, with a 242-pixel table wrapper containing its wider table. A long configured site name in the isolated fixture also pushed the header controls outside the screen. Bounding the brand and wrapping its text kept the header and page within 320 pixels.

## Executed function matrix

EXECUTED means the listed scenarios ran. PARTIAL marks a row with unverified variants. PREVIOUS BROWSER denotes a recorded observation from the earlier part of the same isolated guest pass. ROOT denotes calendar checks tracked in the separate calendar audit.

| ID | Status | Actual scenario/evidence and remaining coverage |
| --- | --- | --- |
| G01 | PREVIOUS BROWSER | Native keyboard submenu/focus opened and closed correctly. |
| G02 | PREVIOUS BROWSER | Custom-title and notice-content search, no-match recovery. |
| G03 | PARTIAL | Controlled React execution opened the mobile menu, followed About and verified the menu closed. Actual browser at 390 pixels opened the menu, reached its last contact link and navigated to the contact page with the menu closed. The header and page also fit at 320 pixels. Physical touch remains untested. |
| G04 | PREVIOUS BROWSER | General notice category and unpublished exclusion. |
| G05 | EXECUTED | Earlier browser pass saved a verified Home address and opened MyHome. Controlled execution saved, fetched events and forgot the address, clearing local storage and stale events. |
| G06 | EXECUTED | Controlled storage write refusal kept the current lookup usable and gave a storage warning. |
| G07 | PARTIAL | Previous MyHome unsaved replacement warning. Actual full collection browser lookup hit injected503 with no event cards, and retry restored the Verd schedule. MyHome retry is covered by controlled component execution. |
| G08 | PREVIOUS BROWSER | Combined text/category filters and no-match recovery. |
| G09 | PREVIOUS BROWSER | Fault proxy returned notice503, visible error and successful retry. |
| G10 | EXECUTED | Canonical Borovnica address selected; submit disabled before topic; consent and topic; real pending signup and confirmation instructions. |
| G11 | EXECUTED | Invalid token and a real signed confirmation with fixture expiry moved to past both showed actionable errors and no confirm action. |
| G12 | EXECUTED | Browser remembered Verd12, displayed three fractions and calendar controls after retry. Actual HTTP confirmed partial Tržaška48, and controlled React execution verified a partial warning and result removal while editing. |
| G13 | EXECUTED | Controlled React execution reproduces and rejects non-array events, impossible event dates, invalid route expiry and malformed fraction lists. |
| G14 | EXECUTED | Published-only QA item in center was found from paper through Išči v vseh skupinah; query was preserved. |
| G15 | PARTIAL | All nine collection filters, no-match/reset, selected Tojnice and exact directions coordinates executed in the browser. GPS refusal was injected in a controlled component check. |
| G16 | EXECUTED | Actual written-location report without photo/GPS saved with a reference. All four categories stored. Device GPS is tracked in G26. |
| G17 | EXECUTED | Preselected septic enquiry hit deliberate503; fields retained and retry stored selected service. |
| G18 | EXECUTED | Customized subject, real contact storage; response-loss retry returned same stored reference. |
| G19 | EXECUTED | Waste-only removed water inputs; BIO toggle changed estimate; zero people removed the old numeric total and displayed error. |
| G20 | EXECUTED | Browser searched spela→Špela; one grave held two people; neighbouring grave showed Ni podatka for missing dates; unpositioned grave had explicit guidance. |
| G21 | EXECUTED | Controlled custom page rendered its published block; an unsupported route showed a home link. Actual Worker execution covered a custom document, real 404, canonical, robots, sitemap and security headers. Public unknown custom path also returned HTTP 404. |
| G22 | EXECUTED | Controlled denied-storage write retained the selected verified address through the homepage handoff and showed a warning. |
| G23 | EXECUTED | Controlled denied-storage removal reported the failure and retained the saved address. |
| G24 | EXECUTED | All three market stall categories stored on published7November; each receipt explicitly requires operator availability/price confirmation. |
| G25 | EXECUTED | Real chooser: txt and6MiB rejected; valid1×1PNG decoded, removed, replaced and stored with photoKey. |
| G26 | PARTIAL | Actual manual map click/cancel/confirm/remove and matching Google coordinates. The resumed browser repeated selection, cancellation, confirmation and removal at 320 pixels without submitting a production report. Physical GPS callback/device remains untested. |
| G27 | EXECUTED | Actual SVG ArrowRight selected neighbouring grave and synchronized details; zoom in/out/reset returned100%. |
| G28 | EXECUTED | Editing successful report cleared receipt; changed contact messages/categories produced distinct intended records. |
| G29 | EXECUTED | Two unchanged report resubmits left exactly one original record; subsequent category changes produced four reports total. |
| G30 | PARTIAL | Earlier browser pass followed a homepage anchor. Controlled execution followed a configured flat menu and footer links and checked breadcrumb, logo, phone and mail destinations. Actual desktop browser activation of the skip link focused `main`. The emergency number is covered in the publication suite. External dial/mail handling remains unverified. |
| G31 | PREVIOUS BROWSER | Homepage anchored notice and published/private category behavior. |
| G32 | EXECUTED | Captured confirmation displayed canonical preferences without activating; explicit confirmation activated and opened fresh management. |
| G33 | EXECUTED | Empty topics disabled save; selected Verd14 changed municipality; injected503 preserved edits, retry saved, reload restored address/topic. |
| G34 | EXECUTED | Real signed unsubscribe-only fixture showed no household fields; explicit and repeated unsubscribe succeeded. Queue eligibility is independently owned by operations audit. |
| G35 | EXECUTED | Second signup kept active Verd14/roads while Borovnica/waste waited in pending_payload; confirming replaced them and revoked old management link with actionable recovery. |
| G36 | EXECUTED | Actual HTTP covered Verd 12 all fractions, diacritic-free Tržaška 48 partial, nonexistent house, wrong town, rejected house range, exact house precedence, tied residual routes and expired BIO. The Borovnica reconciliation below documents where a published route still lacks house-level evidence. |
| G37 | ROOT | The deployed Google single-date button opened the correct all-day event, which was saved and then undone. The deployed repeating button added the exact production feed and displayed the expected dates. Temporary KPV subscriptions were removed. Apple/Outlook account acceptance remains unavailable. See the separate calendar audit. |
| G38 | ROOT | Feed/date/identity/provider transport review belongs to root. |
| G39 | EXECUTED | All9dictionary groups, four suggestion buttons, plural synonym plastenke, unknown-item/reset and collection destination executed. |
| G40 | PARTIAL | Real tiles loaded; list focus, all filters, zoom and marker popup with orientation warning/directions executed. Hardware GPS, touch/pan and forced tile failure remain. |
| G41 | EXECUTED | Proxy deliberately stored contact then dropped response; browser retained values, retry succeeded, exactly one original contact row. |
| G42 | EXECUTED | All four service categories stored; blank optional phone/date and populated phone/date; receipts distinguish enquiry from booking. |
| G43 | EXECUTED | Only two open future fixture dates offered; closed14November absent; nonSaturday10November said Po dogovoru; empty market disabled form. Actual HTTP rejected closed, past and unpublished dates and an unknown stall type. |
| G44 | EXECUTED | Browser invalid email/consent and invalid/oversized photo checks. Real HTTP rejected wrong category/topic, spoofed PNG, malformed/past dates, oversized body, foreign origin and anonymous private-data access. Contact subject length was reconciled. Real provider Turnstile remains a separate environment. |
| G45 | PARTIAL | Browser executed all three municipalities and scopes, sewer/septic/MKČN/water-only, zero use, DN change, deduction, BIO and invalid people. The resumed 320-pixel browser found and verified the calculator overflow correction. A local admin-published water-rate increase changed the public example from 75.83 to 77.14 euros, then the original rate was restored. Fresh pricing tests covered the future tariff and controlled print checks verified the A4 stylesheet and invocation. Native print preview was checked on 2 November; fresh preview and physical output remain unverified. |
| G46 | EXECUTED | Isolated CMS grave array changed to empty; browser showed contact/visiting guidance with no search box or fictional records. |
| G47 | PARTIAL | More expanded results from eight to twelve. Sector B showed two. The selected unpositioned grave copied its URL to the actual clipboard and reopened the correct grave in a fresh tab. Clipboard refusal was unavailable in the actual browser. |
| G48 | PARTIAL | All 21 intended public URLs returned HTML 200 with expected titles. Controlled rendering covered their page content. The linked KPV contact and DEPO pages and the Komunala.info landing resolved. Login to the external customer account, individual legacy documents and the operator’s business details were outside this verification. |
| G49 | PARTIAL | Browser keyboard submenu, search and cemetery controls, named report region and text map results. The resumed desktop browser verified ArrowDown focus into the submenu, Escape focus back to its button, and calendar Escape focus back to the collection button. At 320 pixels, search results fit and Escape returned focus to the opener; the calendar dialog scrolled within the viewport and closed with Escape. Actual 390/320-pixel layouts covered the homepage, navigation, search, schedule, report map and calculator. Controlled checks covered labels and retry/validation announcements. Screen-reader speech, physical touch targets, contrast and reduced-motion appearance remain unverified. |
| G50 | EXECUTED | Controlled publication checks forced initial failure, verified absence of bundled operational content, recovered via retry, preserved previously loaded content with a stale warning and kept admin reachable. |

## Stored browser outcomes so far

Exactly four report rows cover lighting, roads, bins and other. Written location remained distinct from the household address. The bins/other records retain photo keys; the confirmed-map record stores the selected coordinates. The unchanged retries did not add report rows.

Exactly four service rows cover septic, bulky, water and other. The deliberate septic503 did not discard the description. The water case supplied optional date/phone; the other cases demonstrated their omission.

Exactly seven contact rows cover water, waste, roads, billing, market, DEPO and other. All dependent topic choices were selected, including every water topic. User-edited subjects stayed editable across topic/category changes. The first contact's deliberately dropped successful response retried to the same reference, with no duplicate row. Native consent rejection and email validity were inspected in the actual browser.

Exactly three market rows cover standard, food and craft. Only owner-published open dates were selectable. A later isolated fixture added a Tuesday to verify the by-agreement price; an empty fixture then verified disabled submission. These fixture changes are local only.

The canonical subscription completed confirmation, preference change with503/retry, reload, replacement signup requiring fresh confirmation, old-link revocation and explicit/repeated unsubscribe. During replacement, the actual database and old management page both retained active Verd14/roads until the new Borovnica/waste confirmation. The unsubscribe-only capability was produced by the actual application helper using the isolated signing key; its inspection exposed no household fields. No real provider inbox delivery is claimed.

The resumed root browser pass on 5 November exercised the deployed Google buttons, the actual clipboard fallback, emulated 390/320-pixel layouts and keyboard focus. Google's new production BIO subscription showed 10, 17 and 24 November and 1 December. The saved one-date test event was undone, its event form was cancelled, and the remaining Google calendar list was checked after removing all temporary KPV subscriptions. The production portal received no test submissions. At 320 pixels, the live report map selected a point, cancelled it, selected and confirmed another point, and removed it. Collection-point search and its exact directions destination were checked at that width. Device emulation does not certify physical touch, device location or native calendar applications.

## Verification totals and limits

The 23-request local HTTP matrix passed after aligning the closed-date fixture with the CMS invariant that a date cannot appear in both lists. Evidence is in `.deploy/exhaustive-20261103/guest/http-verdict.json`. Seven focused guest suites previously passed 87 checks and the shared calculator pricing suite passed eight. A later concurrent run under severe host load timed out in guest navigation and address-handoff checks and failed to start another worker. On 5 November, the three navigation cases G03, G04 and G30 passed unchanged with one worker in 5.50 seconds. The full current `guest-functional-audit.test.tsx` then passed all 41 checks unchanged in 7.51 seconds, including the additional G30 breadcrumb and footer navigation assertions. Evidence is in the ignored local `resumed-navigation.log` and `resumed-guest.log` files. The integrated suite result is recorded separately in the release report. The controlled results supplement the browser and HTTP observations above. Device, external account and provider limits are called out in the respective rows.

### Borovnica names in the published schedules

The verified address register spells out Breg pri Borovnici, Dol pri Borovnici and Laze pri Borovnici. The imported KPV schedules abbreviate them to Breg, Dol and Laze within Borovnica. The corrected shared matcher was executed against all 341 affected register entries and the unchanged imported schedules. Breg matched packaging route K2. Dol and Laze matched packaging route B7. The 83 Laze houses gained a complete three-fraction schedule. For 92 Breg houses and 166 Dol houses, the residual fraction stayed unresolved because the published schedule lists both ordinary and small vehicles without assigning individual houses. The shared matcher correction is limited to explicitly Borovnica-qualified routes. [Breg municipality profile](https://www.borovnica.si/objava/682240), [Dol municipality profile](https://www.borovnica.si/objava/682243), [Laze municipality profile](https://www.borovnica.si/objava/682246), [KPV residual collection schedule](https://www.kpv.si/mDejavnosti/rzoDatoteke/Urniki/2026_URNIK_BOROVNICAx.pdf), [KPV published collection calendars](https://www.kpv.si/mDejavnosti/rzo/rzoUrnik.html).
