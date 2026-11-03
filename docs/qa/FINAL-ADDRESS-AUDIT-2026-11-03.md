# Final address and house-targeting audit — 3 November 2026

The owner approved official-address selection and automatic municipality assignment. This replaces unverified household text and manually chosen municipality in subscription and collection journeys. Problem locations in reports remain independent free descriptions/map points. The [registry report](OFFICIAL-ADDRESSES-2026-11-03.md) documents the public source, import and server contract; the [UI report](VERIFIED-ADDRESS-UI-2026-11-03.md) documents selection and compatibility.

## House-level notifications

`shared/final-address-audit.test.mjs` and `server/final-address-audit.test.mjs` test a list of affected houses as alternatives, combined with the selected municipality, topic and confirmed/active subscription. A notice for Tržaška cesta 48 and 50a does not include 480, 48a, 50b or the same street in another town. Recognized accents/abbreviations and explicit comma-separated apartment descriptions retain physical-house matching. Slash/range notation is rejected with guidance rather than interpreted as an apartment or silently widened.

Choosing all active areas does not remove the house restriction, topic or subscription-status gate. The integration test asserts exact recipient identities for narrow/all-area audiences and checks unsubscribe/address changes after queueing. Legacy custom-area memberships are explicitly seeded local fixtures; the test does not pretend new signup can create those memberships. New signup uses the actual registry-backed API and derives its municipality server-side, including rejection of forged address/ID combinations.

The editor test in `src/test/final-address-editor-audit.test.tsx` exercises preserving a two-house list while selecting all areas, and collection preview excluding an unlisted house between two listed houses. Publishing a notice remains separate from previewing/queueing email. Displayed affected-area prose remains separate from delivery rules.

## Collection boundaries

Collection matching chooses routes independently for packaging, BIO and residual waste. Specific house rules outrank broader matching rules; conflicting equal-best routes remain unresolved. A complete official address cannot identify which truck serves a house when KPV configuration only says that two routes cover parts of the same street. Unknown addresses are rejected by the registry; known houses with missing/ambiguous/expired route information receive explicit guidance, with safely resolved fractions still available.

The domain tests cover exact houses, suffixes, contradictory towns, explicit apartments, missing routes and equal-score ambiguity. They also record that collection and notification spelling rules are not identical; registry canonicalization now precedes both new subscription and collection workflows. The lower-level preference-format validator intentionally remains compatible with old pending confirmation records; it is not the public API's only validation.

Area IDs remain flat. A legacy `verd` membership does not automatically imply `vrhnika`. New residents are assigned the verified municipality; operators use municipality plus affected-street/house rules for narrower notices. No hierarchical area membership, invented utility service boundary or automatic resident ownership proof was introduced.

## Browser and combined evidence

The final combined check passed **196 server/shared and 193 UI tests**, TypeScript and production build. A local real-browser pass using the packaged registry and genuine local server verified keyboard selection on the homepage, canonical saved-address handoff to MyHome and the full schedule, a partial Tržaška cesta 48 schedule, a complete Verd 12 schedule, and automatic Borovnica selection for Ljubljanska cesta 9. Synthetic signup, captured confirmation, management to Verd 14 with automatic municipality change, reload persistence and explicit unsubscribe completed against the actual local server. No external test email was sent. The mobile subscription picker and empty admin queue fit a 390 px viewport without horizontal overflow. These are desktop-browser responsive checks, not physical-device or screen-reader certification.

Local owner password/captured-OTP sign-in succeeded. The cleaned configuration showed an empty work queue; saving a private settings draft with padded portal name returned a normalized value without an unsaved-change claim. History named the correct settings section and contained only the current revision for that clean section. These local checks supplement the new controlled admin draft/history race regressions, rather than claiming a fresh authenticated production session.

The independent full-register coverage diagnostic is a configuration completeness check, not proof of physical collection assignments. KPV must validate the route-to-house boundaries and published dates before the portal can promise complete collection coverage. Real inbox delivery, native calendar-account acceptance, physical GPS/camera/printing, tariff approval and official register ownership remain separate operational checks.
