# Official address snapshot and verification — 3 November 2026

New subscription signup/preferences and address-based collection/calendar lookup now verify the physical house against a bundled GURS address-register snapshot. Municipality membership comes from that record, not a client-supplied district. Reports and service/contact locations remain free text. Collection route boundaries and dates still come exclusively from published KPV configuration; a registered address alone does not establish a collection schedule.

## Data source and completeness

Source: [GURS Register naslovov, OPSI resource and CC BY 4.0 attribution](https://podatki.gov.si/dataset/register-naslovov/resource/85e6e060-9c44-4a03-85af-b89c27d11a38), using the official [OGC Features service](https://ipi.eprostor.gov.si/wfs-si-gurs-rn/ogc/features?f=json), collection `SI.GURS.RN:REGISTER_NASLOVOV`. The service description advertises CQL-text filters and pagination. Import requests filter exact official municipality names and additionally validate municipality code/name on every returned record.

| Municipality | GURS code | Existing portal district ID | Source rows including apartments | Physical houses |
| --- | --- | --- | --- | --- |
| Vrhnika | 140 | `vrhnika` | 7,687 | 4,543 |
| Borovnica | 5 | `borovnica` | 1,847 | 1,114 |
| Log-Dragomer | 208 | `log-dragomer` | 1,472 | 1,138 |
| Total | | | 11,006 | 6,795 |

The completed import consumed 12 pages, at most 1,000 source rows each. Apartments are deduplicated by exact string `EID_HISNA_STEVILKA`; exact string `EID_NASLOV` identifies source-row duplicates during pagination. Numeric `FEATUREID` is deliberately ignored because these identifiers exceed JavaScript's safe integer range. Repeated/inconsistent EIDs, municipality mismatch, changed totals, incomplete counts, missing/unexpected pagination, response/page bounds or invalid required properties abort import before snapshot files are written.

The 1,524,504-byte JSON snapshot retains only house ID, canonical address, municipality name/ID, street, settlement, house-number/suffix and postal locality/code. No apartment numbers, people, owners or coordinates are retained. Postal locality is needed to resolve older saved postal-address spellings; it does not determine municipality. For example, an official Bevke address can use postal locality Log pri Brezovici while its municipality remains Vrhnika.

`shared/official-addresses-source.json` records attribution/license, service, retrieval timestamp, SHA-256 and per-municipality source/physical counts. **`updatedAt` means this snapshot's retrieval time, not an asserted GURS last-change time.** This is a local snapshot; newly registered/changed houses require a reviewed reimport. The importer validates bounded pagination of a live service; it does not claim a government-wide transactional snapshot or prove residence/ownership of a house.

Reimport from repository root with `node scripts/import-official-addresses.mjs`, review the data/count/hash diff and run the address/server tests before release. No provider request occurs during user typing or signup.

## API and validation contract

- `GET /api/addresses?q=...&limit=20`: at least three normalized search characters; shorter queries return an empty result. Limit defaults 20 and is bounded 1–20. Input is bounded 250 characters. Repeated/incompatible parameters or malformed limits return 400. Results support accents/case differences and remain bounded.
- `GET /api/addresses?address=...`: exact canonical/recognized spelling resolution. Exactly one matching physical house returns one record; unknown or ambiguous input returns an empty result 200. No fuzzy house-number correction or municipality guess occurs.
- Both return `{addresses:[{id,address,municipality,municipalityId}],source:{name,url,updatedAt},more:boolean}`. Search does not expose internal postal fields or the full snapshot in its response. Source attribution stays available to the UI.
- Signup and management accept `address` and optional **string** `addressId`. If an ID is provided, it must correspond to that exact registered address/spelling. Unknown/ambiguous addresses or mismatched IDs return 422. Recognized old clients may omit the ID; their address still has to resolve uniquely. Canonical value and municipality ID replace client claims, then existing active-district and topic checks apply.
- Collection and downloadable address calendar accept the same address, plus optional query `addressId`, and then run the existing published route matcher. An unknown house returns 422; a real house with no safely matching published route also returns 422 with the existing KPV schedule guidance. Route-based subscribed calendar feeds remain based on their explicit published route ID.

Recognized spelling resolution includes accent/case/spacing, `c.`/`ul.` abbreviations, a uniquely identifying omitted street kind, postal-code locality forms, suffix variants such as `12 a`/`12-a`, and explicitly comma-separated `stanovanje N`/`stan. N`. Apartment text is discarded when canonicalizing to a physical house. `Verd 12` already identifies a house and settlement and resolves if unique; town-only `Vrhnika` does not. Contradictory localities, nonexistent suffixes/houses and ambiguous aliases are rejected. A slash/range is not interpreted as an apartment or a choice of houses.

Existing pending confirmation links still validate their previously saved payload and remain usable. Existing management inspection and unsubscribe are unchanged; a new address/preferences update must use the register. Legacy custom-district membership is not silently rewritten en masse. Newly created subscriptions use the verified municipality, so custom neighborhood targeting should not be described as automatic hierarchy inference.

## Validation

- Seven new registry/import/API tests cover snapshot/hash/field integrity, bounded local search, exact/ambiguous aliases, forged ID pairs, official municipality overriding client claims, inactive district/topic gates, missing KPV routes, calendar output, legacy confirmation/unsubscribe and incomplete/numeric-EID importer failures.
- Updated subscription and empty-route fixtures to real registered houses while retaining exact-house exclusions, topic/status gates, confirmation timing, capability revocation, erasure concurrency and queued delivery protection.
- The final house-subset integration now explicitly seeds labelled local legacy confirmed memberships for custom/wrong/retired districts; it does not claim those memberships can be created through the new signup API. New verified opt-ins and forged municipality claims exercise the actual API. Its exact narrow/all-district recipient sets remain asserted, including post-queue unsubscribe/address-change protection.
- Full server/shared run: **195 passed** at handoff. No production write, live signup/campaign, commit or deployment was performed. Frontend picker behavior and release build/deployment are the release owner's separately coordinated checks.
