import test from "node:test";
import assert from "node:assert/strict";
import tariffs from "./official-tariffs-2026.json" with { type: "json" };
import {
  calculateHousehold,
  validateTariffs,
  tariffDate,
} from "./utility-pricing.js";
const input = {
  municipalityId: "vrhnika",
  scope: "all",
  consumptionM3: 12,
  meterBand: 0,
  wastewater: "sewer",
  people: 3,
  bio: true,
};

test("tariffs become effective on the Ljubljana date across winter and summer midnight", () => {
  assert.equal(tariffDate(new Date("2026-06-30T22:30:00Z")), "2026-07-01");
  assert.equal(tariffDate(new Date("2026-12-31T23:30:00Z")), "2027-01-01");
  assert.ok(
    calculateHousehold(
      tariffs,
      input,
      tariffDate(new Date("2026-06-30T22:30:00Z")),
    ).totalCents > 0,
  );
  assert.throws(
    () =>
      calculateHousehold(
        tariffs,
        input,
        tariffDate(new Date("2026-06-30T21:30:00Z")),
      ),
    /še ne velja/,
  );
});

test("official tariff data validate and reject unsafe metadata, invalid dates and duplicate municipalities", () => {
  assert.deepEqual(validateTariffs(tariffs), tariffs);
  for (const mutate of [
    (t) => (t.municipalities[0].waterM3 = -1),
    (t) => (t.municipalities[0].sourceUrl = "javascript:alert(1)"),
    (t) => (t.municipalities[0].effectiveFrom = "2026-02-30"),
    (t) => (t.municipalities[1].id = "vrhnika"),
    (t) => (t.servicePrices[0].unit = "neznano"),
    (t) => (t.waste.extra = 42),
    (t) => (t.servicePrices[0].vatPercent = 200),
  ]) {
    const t = structuredClone(tariffs);
    mutate(t);
    assert.throws(
      () => validateTariffs(t),
      (e) => e.status === 400,
    );
  }
});

test("monthly household calculation distinguishes all three real municipalities with fixed network charges", () => {
  const expected = {
    vrhnika: { water: 1397, network: 541, drainage: 789, cleaning: 1038 },
    borovnica: { water: 1375, network: 536, drainage: 629, cleaning: 1517 },
    "log-dragomer": {
      water: 1544,
      network: 754,
      drainage: 1307,
      cleaning: 1571,
    },
  };
  for (const [municipalityId, values] of Object.entries(expected)) {
    const result = calculateHousehold(tariffs, { ...input, municipalityId });
    const line = (key) => result.rows.find((row) => row.key === key);
    assert.equal(line("water").netCents, values.water);
    assert.equal(line("water-network").netCents, values.network);
    assert.equal(line("drainage").netCents, values.drainage);
    assert.equal(line("cleaning").netCents, values.cleaning);
    assert.equal(line("levy").vatCents, 0);
    assert.equal(line("levy").grossCents, 63);
    assert.equal(
      result.totalCents,
      result.rows.reduce((sum, row) => sum + row.grossCents, 0),
    );
  }
  assert.notEqual(
    calculateHousehold(tariffs, input).totalCents,
    calculateHousehold(tariffs, { ...input, municipalityId: "borovnica" })
      .totalCents,
  );
});

test("sewer and septic charges are exclusive, MKČN only changes levy, no double VAT", () => {
  const septic = calculateHousehold(tariffs, {
    ...input,
    scope: "water",
    wastewater: "septic",
  });
  assert.equal(
    septic.rows.some((r) => r.key === "drainage"),
    false,
  );
  assert.equal(
    septic.rows.some((r) => r.key === "cleaning"),
    false,
  );
  assert.equal(septic.rows.find((r) => r.key === "septic").netCents, 789);
  assert.equal(septic.rows.find((r) => r.key === "levy").grossCents, 634);
  const mkcn = calculateHousehold(tariffs, {
    ...input,
    scope: "water",
    wastewater: "mkcn",
  });
  assert.equal(mkcn.rows.find((r) => r.key === "levy").grossCents, 63);
  const only = calculateHousehold(tariffs, {
    ...input,
    scope: "water",
    wastewater: "water-only",
  });
  assert.deepEqual(
    only.rows.map((r) => r.key),
    ["water", "water-network"],
  );
  assert.equal(only.rows[0].grossCents, 1397 + 133); // net subtotal plus VAT, not gross rate taxed again
});

test("zero consumption retains monthly network charges and higher DN applies only to fixed lines", () => {
  const zero = calculateHousehold(tariffs, {
    ...input,
    scope: "water",
    consumptionM3: 0,
  });
  assert.ok(zero.totalCents > 0);
  assert.equal(zero.rows.find((r) => r.key === "water").grossCents, 0);
  const large = calculateHousehold(tariffs, {
    ...input,
    scope: "water",
    meterBand: 1,
  });
  assert.equal(
    large.rows.find((r) => r.key === "water-network").netCents,
    1623,
  );
  assert.equal(large.rows.find((r) => r.key === "water").netCents, 1397);
});

test("waste uses verified household allocation masses, optional BIO and people scaling before rounding", () => {
  const single = calculateHousehold(tariffs, {
    ...input,
    scope: "waste",
    people: 1,
    bio: false,
  });
  assert.equal(single.rows.length, 6);
  assert.equal(
    single.rows.find((r) => r.key === "collection").quantity,
    15.0478,
  );
  assert.equal(single.rows.find((r) => r.key === "treatment").quantity, 4.5169);
  assert.equal(single.rows.find((r) => r.key === "disposal").quantity, 0.4517);
  assert.equal(single.totalCents, 425);
  const bio = calculateHousehold(tariffs, {
    ...input,
    scope: "waste",
    people: 1,
    bio: true,
  });
  assert.equal(bio.rows.find((r) => r.key === "bio").quantity, 12.6954);
  assert.equal(bio.rows.find((r) => r.key === "bio").grossCents, 324);
  assert.equal(bio.totalCents, 749);
  const three = calculateHousehold(tariffs, {
    ...input,
    scope: "waste",
    people: 3,
    bio: true,
  });
  assert.equal(three.rows.find((r) => r.key === "bio").quantity, 12.6954 * 3);
});

test("invalid inputs, unavailable future tariffs and impossible deductions never return a plausible total", () => {
  for (const change of [
    { municipalityId: "" },
    { people: 0 },
    { people: 1.5 },
    { consumptionM3: NaN },
    { consumptionM3: -1 },
    { meterBand: 8 },
    { wastewater: "unknown" },
    { scope: "unknown" },
    { monthlyDeduction: -1 },
    { monthlyDeduction: 100000 },
  ])
    assert.throws(
      () => calculateHousehold(tariffs, { ...input, ...change }),
      (e) => e.status === 400,
    );
  assert.throws(
    () => calculateHousehold(tariffs, input, "2026-06-01"),
    /še ne velja/,
  );
  const full = calculateHousehold(tariffs, input),
    reduced = calculateHousehold(tariffs, { ...input, monthlyDeduction: 5 });
  assert.equal(reduced.totalCents, full.totalCents - 500);
  assert.equal(reduced.vatCents, full.vatCents);
});

test("admin changes feed public calculations and services keep verified units and VAT rates", () => {
  const updated = structuredClone(tariffs);
  updated.municipalities[0].waterM3 = 2;
  assert.equal(
    calculateHousehold(validateTariffs(updated), input).rows.find(
      (row) => row.key === "water",
    ).netCents,
    2400,
  );
  assert.equal(
    tariffs.servicePrices.find((p) => p.id === "container-rental").vatPercent,
    22,
  );
  assert.equal(
    tariffs.servicePrices.find((p) => p.id === "container-transport").unit,
    "ura",
  );
  assert.equal(
    tariffs.servicePrices.find((p) => p.id === "septic-extra").unit,
    "m³",
  );
});
