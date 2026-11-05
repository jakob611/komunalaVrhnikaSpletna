# KPV function acceptance audit, 3–4 November 2026

The Google Calendar failure was reproduced with the original production link. The corrected direct link imported a real calendar and showed the published packaging dates in Google Calendar. The HTTPS feed also imported through Google’s From URL form. The updated portal includes both paths and explains the first-import delay. See the [calendar acceptance matrix](EXHAUSTIVE-CALENDAR-2026-11-04.md) for the provider outcomes and unavailable device/account checks.

The audit follows all 164 action groups from the earlier inventory. The reports record each group, the actual result, the environment and any outstanding browser or device variant. A successful request, a rendered component and a completed browser journey are recorded separately.

| Area | Evidence |
| --- | --- |
| 50 guest groups | Browser journeys for notices, saved addresses, all report and service categories, contact categories, market stall types, subscription confirmation and replacement, collection, waste guide, maps, calculator and cemetery. Isolated handler and rendered checks cover additional validation and failure variants. [Guest matrix](EXHAUSTIVE-GUEST-2026-11-03.md) |
| 63 editor groups | 333 isolated HTTP requests, including all 17 CMS sections, drafts, revision conflicts, grouped publication, history, scheduling, media and public projections. Browser checks include iframe edits, actual image upload and a website JSON download/import above 2 MiB. The matrix distinguishes rendered controls from remaining native/browser checks. [Editor matrix](EXHAUSTIVE-EDITOR-2026-11-03.md) |
| 51 operational admin groups | 184 isolated HTTP requests across 47 groups, plus browser, rendered and editor-overlap evidence. Genuine local password and OTP, permissions, work queue, campaigns with captured mail, case history, subscriber pagination, recipient conflicts and erasure with storage failure were exercised. [Operations matrix](EXHAUSTIVE-OPERATIONS-2026-11-03.md) |
| Calendar transport | 113 read-only requests to an isolated Cloudflare Worker, including all 96 route/fraction combinations, three single-event downloads, exact dates, malformed parameters, removed routes and HEAD. An independent parser checks dates, all-day events and encoding. |

| Confirmed finding | Correction and verification |
| --- | --- |
| Google’s old shortcut sent an HTTPS `cid` that Google rejected. A first import could also look empty while Google fetched the dates. | Use the verified `webcal:` shortcut and give the resident a copyable HTTPS URL and From URL fallback. Actual provider calendars displayed expected dated events. |
| Calendar HEAD requests returned 405, and subscribed events claimed they never updated. | Return the GET metadata for HEAD and give subscribed events accurate refresh wording. Independent parser and HTTP checks passed. |
| Breg, Dol and Laze were abbreviated in KPV’s Borovnica schedules. | Match the three qualified settlement aliases. A comparison across all 6,795 registered houses found changes only in these settlements. Packaging was restored for 341 addresses. Complete matches increased from 1,924 to 2,007. The two vehicle assignments remained explicitly ambiguous for 258 houses in Breg and Dol. [KPV schedules](https://www.kpv.si/mDejavnosti/rzo/rzoUrnik.html) · [Official settlement names](https://www.gov.si/drzavni-organi/upravne-enote/vrhnika/o-upravni-enoti-vrhnika/nov-stobcine-in-naselja-upravne-neote-vrhnika/) |
| A malformed collection response could render an impossible date or expose calendar controls for invalid route data. | Validate the response on both the collection and My Home pages. Regressions cover impossible dates, invalid route expiry, malformed fraction lists and retry. |
| Contact allowed 200 subject characters, while the server allowed 180. | The field uses 180. The real isolated server accepted 180 and rejected 181. |
| The report map’s accessibility name was absent from the rendered DOM. | Name the map region. The browser found it by its accessible name and completed manual position selection, cancellation and removal. |
| Image alt text reverted in the live editor preview, and changing the source could retain an old override. | Track React’s base alt text separately from the applied override. Regressions and a real iframe check verified the corrected alt after another preview edit. |
| Replayed effects could overwrite recovered case and recipient edits after sign-in. | Preserve the recovered draft until an explicit reload or navigation away. A genuine browser OTP round trip recovered and saved notes, assignee and deadline. The recipient regression also verifies preservation of its original revision. |
| A failed case detail load lacked an inline retry. An abandoned request could affect the active session. | Keep the dialog open with a retry and ignore aborted results before handling authentication or conflict. Real HTTP failure/recovery and rendered controls were exercised. |
| The admin collection preview could show routes for a fictional house that the public endpoint rejected. | The draft preview uses the same verified address picker as the public lookup. Existing route rules and published dates remain editable. The regression rejects the fictional address and keeps the exact-house preview. |

Synthetic records, uploads, mail and destructive operations ran on isolated storage. Production smoke uses read-only requests and verifies that unverified submissions are rejected. The remaining manual checks are identified in the matrices. Work settings disabled browser control during the final pass. Apple Calendar and Outlook account/device acceptance are unavailable, and physical GPS, screen reader speech and printer output require the corresponding environments.

## Release verification on 5 November

The clean integrated run passed 201 server/shared tests and 208 UI tests. The production build, TypeScript check and Wrangler deployment dry run passed. Earlier concurrent runs exceeded test time limits under heavy host load. The affected guest cases then passed unchanged in isolation and in the full suite. Four additional editor control tests also passed. Browser access was restored on 5 November. Final deployment and browser results are recorded below once observed.

