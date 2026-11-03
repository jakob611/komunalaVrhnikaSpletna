# Address and published collection-rule integration check

The integration review found **no canonical-address, subscription-capability or mail-lease regression** in the exercised code. All 6,795 bundled GURS houses resolved back to their exact house ID. Focused UI checks passed 33 tests; focused auth/email/registry/house-targeting checks passed 31 tests. Those are existing coordinated suites, not additional newly invented function counts.

There is an important service-data limitation: the current published KPV rules produce an unambiguous future schedule for all three supported fractions at **1,924 of 6,795 registered physical addresses**. This is a local matching diagnostic, not an assertion that every house should receive every fraction or that those assignments are operationally correct. Vehicle allocation, BIO entitlement, service contracts and boundary correctness need authoritative KPV information.

## Reusable read-only diagnostic

Run from repository root:

```powershell
node scripts/audit-address-coverage.mjs
node scripts/audit-address-coverage.mjs --date 2026-11-03 --json .deploy/coverage-20261103.json --csv .deploy/coverage-20261103.csv
```

The script makes one unauthenticated GET to the public `https://kpv.jakobtominc.com/api/content` endpoint, validates the collection section and applies the actual shared route matcher locally to the bundled official addresses. It sends no address to an external geocoder, writes nothing remotely and does not read subscriber/session/private production records. Default console output contains only aggregates and source metadata. Optional local JSON/CSV outputs contain public house identifiers/addresses and diagnostic states, without resident names, owners or coordinates. Outputs are created only at explicitly supplied paths and existing files are not overwritten. CSV uses an `HS:` prefix to keep long house identifiers from being rounded by spreadsheet software; JSON retains the exact decimal string ID.

Optional `--url https://other-host/api/content` accepts only a public HTTPS content endpoint without credentials/query. `--input path/to/public-content.json` allows an explicitly supplied saved public content snapshot instead of networking. `--date YYYY-MM-DD` evaluates future-date availability at that date without changing published data. A canonical roundtrip failure sets a nonzero exit code; partial/ambiguous route coverage is reported rather than silently converted into a successful assignment.

The audit itself was run on 3 November 2026, diagnostic date `2026-11-03`, public collection revision 3, captured `2026-11-03T05:44:02.021Z`. Local exact-house details were saved under ignored `.deploy/launch-20261102/official-address-coverage-20261103.json` and `.csv`. That is public-reference data, not household subscription information. A small synthetic test in `server/address-coverage-audit.test.mjs` additionally verifies that the tool distinguishes ambiguity, missing fractions, expired dates and canonical failures instead of inventing service coverage.

## Actual published-rule results

Configuration: 32 routes, 428 address rules, 374 dated events; 152 events on or after the diagnostic date. The official address snapshot was captured `2026-11-03T05:29:11.740Z`; its provenance and hash are recorded in `shared/official-addresses-source.json`.

| Municipality | Official houses | Any route candidate | No candidate in any fraction | At least one ambiguous fraction | All three fractions unambiguous with future dates |
| --- | ---: | ---: | ---: | ---: | ---: |
| Vrhnika | 4,543 | 4,348 | 195 | 1,487 | 718 |
| Borovnica | 1,114 | 1,114 | 0 | 190 | 532 |
| Log-Dragomer | 1,138 | 1,138 | 0 | 464 | 674 |
| Total | 6,795 | 6,600 | 195 | 2,141 | 1,924 |

An ambiguous candidate counts in “any route candidate” because the code can see competing configured routes; it is not a confirmed assignment. The total of no-candidate and incomplete/ambiguous houses must not be described as proven unserved homes.

| Municipality | Fraction | Unambiguous assignment with future dates | Ambiguous assignment | No matching rule |
| --- | --- | ---: | ---: | ---: |
| Vrhnika | Packaging | 3,229 | 0 | 1,314 |
| Vrhnika | BIO | 2,345 | 0 | 2,198 |
| Vrhnika | Residual | 2,357 | 1,487 | 699 |
| Borovnica | Packaging | 727 | 0 | 387 |
| Borovnica | BIO | 1,114 | 0 | 0 |
| Borovnica | Residual | 558 | 190 | 366 |
| Log-Dragomer | Packaging | 1,138 | 0 | 0 |
| Log-Dragomer | BIO | 1,138 | 0 | 0 |
| Log-Dragomer | Residual | 674 | 464 | 0 |

At this diagnostic date, none of the unambiguous assignments lacked future dates. This can change as dates pass or editors change configuration. The table measures matcher behavior for the recorded version; it does not validate the geographic correctness of the 428 rules or infer which ordinary/small vehicle serves a house. The existing portal should continue to show partial/ambiguous guidance and an official KPV fallback, rather than guess a truck boundary.

## Subscription and compatibility conclusions

- Verified new signups and preference changes derive `vrhnika`, `borovnica` or `log-dragomer` from the official physical house, overriding a forged client district. Inactive municipality and topic restrictions still apply. All bundled canonical strings roundtrip; ID/address mismatches and contradictory/nonexistent addresses fail.
- Existing saved spellings are resolved only if they identify one registered physical house. Unsupported or ambiguous old text requires a fresh selection. Pending confirmations retain their existing saved-payload path; inspection and explicit unsubscribe do not depend on successful address re-verification. No residence or ownership verification is claimed by matching a public house.
- A notice still requires topic AND current active district AND any configured whole-house/street rules. `allDistricts` does not remove house/topic/status gates. House 1 does not include 12 or 1a. Signed capabilities, generation invalidation after address changes/unsubscribe, pending/suppressed exclusions and queue-time/delivery-time eligibility checks remain in the passing integration tests.
- Custom neighborhood IDs are still flat legacy memberships. The new signup form cannot enroll a household into a custom neighborhood ID; automatic municipality selection does not infer neighborhood ancestry. For new verified households, target the municipality plus explicit address rules to reach a house/street subset. The root review owns the admin wording/action decision for custom groups; this diagnostic does not implement a new group model or remove a function.
- The previous admin instruction that residents choose their own area is incompatible with automatic municipality selection. It was reported to the release owner for correction; this read-only integration pass did not edit admin UI files.
- The queue cancellation/lease and malformed-CSRF fixes remain present and pass their regressions. A send already dispatched after the final eligibility check cannot be recalled; the privacy scope warning remains necessary.

Only the newly authorized diagnostic script, its test and this report were added during this integration pass. No application code was edited, no production data/configuration was changed and no deployment was performed.
