# Verified household-address UI · 3 November 2026

The owner approved selecting official addresses and deriving the municipality automatically for subscriptions and collection lookup. This pass implements the public UI contract; the primary reviewer owns Home/MyHome, production cleanup and combined release verification, and the backend reviewer owns the official snapshot and server-side validation.

## Implemented flows

- `VerifiedAddressPicker` queries the site's `/api/addresses` endpoint. User typing searches after 250 ms; an incoming remembered address uses the exact-resolution endpoint. It does not send typing to an outside geocoder. Official source attribution is visible.
- Typed text remains unverified until a listed record is explicitly selected. A uniquely resolved saved value can be restored automatically. Every subsequent edit clears verification immediately. Empty results, connection/response errors and retry are explicit; a missing remembered address is not silently accepted.
- Keyboard ArrowUp/ArrowDown, Enter and Escape operate the combobox/listbox. Active options scroll into view, selection retains input focus, and obsolete responses cannot replace a later query. The options anchor follows the input even when a label wraps.
- Subscription signup removes manual municipality choice. The selected record supplies canonical address, `addressId` and municipality ID; the active published municipality still gates signup. Saved-address reuse resolves through the registry first. Topics, consent and email confirmation remain explicit.
- Subscription management resolves the displayed household address and requires a verified address before saving preferences. Resolution updates municipality without overwriting topics edited during the wait. Picker instances are keyed to capability token/action. Confirmation and explicit unsubscribe remain usable independently of address selection, including an old unverified address.
- Collection lookup resolves a remembered address before loading its schedule automatically once. A newly edited address needs selection before lookup, and old results clear on edit. Storage failure, fraction-specific partial results and calendar actions remain supported.
- Reports and service-execution address fields were not changed by this pass. Existing CMS text/native-section identities and frozen legacy aliases were retained.

## Evidence

`src/test/verified-address-picker.test.tsx`: **9/9 PASS**, using controlled API responses. Cases cover explicit keyboard selection, edit invalidation, stale-response ordering, exact saved-value canonicalization and retry, returning to a previously selected external value, missing saved addresses, canonical signup/automatic municipality, one automatic collection lookup, unsubscribe despite unverifiable legacy data, and preservation of edited topics during delayed management resolution. The integrated UI suite passed **24 files / 193 tests**, including all prior address handoff, guest audit, subscription-context and security cases. TypeScript and owned-file diff checks passed.

These are component/transport tests. They do not prove physical keyboard/screen-reader speech/touch behavior, real GURS data completeness, the backend's canonical verification or live email delivery. The combined review must verify the actual packaged registry/API, existing callers and browser geometry. Older UI fixtures now use a finite set of known canonical records for `/api/addresses`, independently routed before subscription or collection responses. Tests explicitly choose search results, wait for saved-address verification and retain denied-storage, partial-calendar, mutation-race, capability-privacy, topic, consent and old-unsubscribe coverage. Unknown text does not become verified through the fixture. No production bypass was introduced.

The municipality is a broad notification grouping. This UI does not invent district nesting, service boundaries or house-level collection routes; narrower notices still depend on their explicit affected-address rules and verified operational input.


## Integrated regression adjustments

The old district-edit scenario now selects a known house in another municipality and asserts automatic derivation. Capability security tests allow public registry queries while proving that the personal token never appears in a request URL and is sent only to the subscription endpoint in a POST body. Inspection retry tests keep their endpoint-specific failure sequences and wait for management address verification before asserting recovery. Malformed collection responses are tested only after valid address selection, so an unrelated registry validation error cannot accidentally satisfy the test.

Final local checks: `npm run test:ui` (24 files, 193 tests), `npx tsc --noEmit`, and scoped `git diff --check`. The UI source timestamp is described as the date the register copy was captured, rather than as GURS's official last update. Existing broader calculator, calendar, market/contact and admin workflow suites required no fixture changes and passed unchanged.
