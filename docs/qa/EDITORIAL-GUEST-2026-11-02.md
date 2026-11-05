# Guest editorial and UX pass · 2 November 2026

The public text in the eight assigned source files was reviewed as municipal-service information: page headings, introductory text, form instructions, shortcuts, result messages, loading/errors, empty states and external-service handoffs. The edits use direct Slovenian instructions and name the task instead of promising a feeling or an outcome the website cannot guarantee. App-level navigation/home/footer/default content and all administration text belong to the primary reviewer and administration reviewer; they are not claimed as changes by this pass.

## Meaningful examples

| Area | Before | After |
| --- | --- | --- |
| Notices | »Vedno dobro obveščeni.« | »Obvestila o komunalnih storitvah« |
| Road-report shortcut | »Majhna prijava. Velika sprememba.« | »Prijavite poškodbo ali okvaro«; the instructions explicitly keep photographs optional. |
| Report | »Opazite. Sporočite. Uredimo.« | »Prijava poškodbe ali okvare«; no promise that submitting immediately resolves the issue. |
| Services | »Uredite kar od doma.« / »Trije koraki do urejenega doma.« | »Povpraševanje za storitev« / »Kako poteka povpraševanje« |
| Market | »Vaša ponudba. Naša tržnica.« | »Prijava za prodajo na tržnici«; published availability and later confirmation remain explicit. |
| DEPO | »Staro za nekoga. Novo za vas.« / »Dobre stvari dobijo drugo priložnost.« | »Trgovina DEPO Vrhnika« / »Ponudba rabljenih predmetov«; a direct catalogue action replaces promotional exploration. |
| Collection | »Vaš naslednji odvoz. Brez ugibanja.« | Default heading »Urnik odvoza odpadkov«; partial/unresolved schedules remain clearly qualified. |
| Waste dictionary | »Kam gre pa to?« / »Majhna odločitev. Velika razlika.« | »Kam odložiti odpadek?« / »Iskalnik odpadkov«; »Primeri iskanja« makes no unsupported popularity claim. |
| Cemetery | »Spomin ostane. Pot naj bo preprosta.« | »Pokopališče Vrhnika / Iskanje grobov«; the empty register instead leads with services, contacts and visiting information. |
| Calculator | »Izračunajte strošek za svoj dom.« | »Informativni izračun komunalnih storitev«; clearer meter explanation, »Vključen DDV« and »Vneseno znižanje«. |
| Contact/about | »Pravi odgovor se začne s stikom.« / »Vsakdanja skrb. Skupna prihodnost.« | »Kontakti in uradne ure« / »Komunalne dejavnosti na območju treh občin« |
| Subscriptions/calendar | »Pravo obvestilo za vaš naslov.« / »Koledar bo spremljal …« | »Naročite se na obvestila po e-pošti« / »Dodana bo naročnina na objavljeni urnik odvozov.« Confirmation, management and unsubscribe pages have distinct task headings. |

## Functional families covered

- **Notices and roads:** search/filter instructions, map/list recovery, whole-list versus filtered emptiness, report and subscription shortcuts.
- **Reporting and contact:** category/location/photo/contact instructions, optional GPS/photo, confirmation of a selected point, emergency alternative, stored references and late-response warnings. Correct existing validation/error wording was retained.
- **Service enquiries and market:** preparation, selected service, execution address, price scope, unconfirmed requested date, published-date availability, seller details and next action.
- **Waste and collection:** point list/map/GPS/directions, dictionary/category recovery, address persistence, fraction-specific partial schedules, source links, calendar subscription versus downloaded file.
- **Cemetery:** empty and populated register, name/plot search, unverified positions, shared-grave details, map controls, sharing, contact and visiting information. Unknown data does not become availability or a fictitious record.
- **Calculator/prices:** scope and inputs, meter/help text, assumptions, VAT/deduction, limits, source dates, print and service-price conditions. Calculation rules, prices and official conditions were preserved.
- **Subscriptions/calendar:** signup and saved-address reuse without district guessing, one-email/one-address rule, consent, confirmation, management, unsubscribe, transient-inspection retry and explicit calendar-provider confirmation.
- **DEPO/about/opening hours:** actual catalogue/donation/contact routes, service descriptions, browser address removal and source attribution. No invented inventory, booking, payment, automatic reply or staff response deadline was added.

## Three small UX corrections approved by the primary reviewer

1. **No published notices:** show »Trenutno ni objavljenih obvestil.« and subscription/revisit guidance. With published notices but no filter match, show »Za izbrane pogoje ni obvestil.« and filter/search recovery. An empty publication is not presented as a bad search or as proof that no service disruption exists.
2. **No published waste points:** show »Zbirna mesta trenutno niso objavljena.« and a contact link to `/kontakt`. Do not show the futile »Počisti filtre« action. When points exist but filters exclude them, the existing reset action remains. Existing KPV source guidance is retained.
3. **No published waste dictionary:** show »Seznam odpadkov trenutno ni objavljen.« and link to the existing KPV waste alphabet source. Do not offer »Pokaži vse predmete« when there are none. A populated dictionary retains unknown-expression and wrong-category recovery.

These three cases change presentation of empty data only. They do not fill the publication with bundled substitutes or manufacture operational records. The primary reviewer owns the new regression cases and existing exact-text test updates; this reviewer changed no tests.

## Preservation, checks and limits

All existing `CmsText` IDs and native-section IDs were preserved. Six explicit IDs were added for the new empty-data headings/descriptions; no frozen `legacy-fields.ts` aliases were changed. An independent comparison found no removed field/section identities. Existing price, quantity and date constants were preserved; new empty-state links use the existing icon-size convention. TypeScript and `git diff --check` pass. Pricing, availability rules, address matching, provider URLs, authentication/capability behavior and form submission semantics were not changed.

Explicit published CMS edits still take precedence over source defaults. The primary reviewer reports one existing live collection-heading override, »Vaš naslednji odvoz.«; it must remain the owner's edit. This pass did not rewrite production content, modify defaults/CMS overrides, commit or deploy.

Known exact-text test handoff: the empty cemetery H1 becomes »Pokopališke storitve in obisk pokopališča«; About H1 becomes »O podjetju in spletni strani«; filtered-notice heading becomes »Za izbrane pogoje ni obvestil.«. Other changed text is documented above and remains discoverable in the source diff. The primary reviewer is checking the integrated test suite and final rendering. This is not a new browser, screen-reader, physical-print, official-data or external-provider certification.
