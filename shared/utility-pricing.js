// Monetary inputs are official NET tariffs; VAT is applied once per line.
// Quantities are monthly household billing quantities, never a guessed bin weight.
export const METER_BANDS = Object.freeze([
  { label: "DN 15 ali 20", factor: 1 },
  { label: "Nad DN 20 do manj kot DN 40", factor: 3 },
  { label: "DN 40 do manj kot DN 50", factor: 10 },
  { label: "DN 50 do manj kot DN 65", factor: 15 },
  { label: "DN 65 do manj kot DN 80", factor: 30 },
  { label: "DN 80 do manj kot DN 100", factor: 50 },
  { label: "DN 100 do manj kot DN 150", factor: 100 },
  { label: "DN 150 in več", factor: 200 },
]);
const invalid = (message) => {
  throw Object.assign(Error(message), { status: 400 });
};
function record(value, keys, label) {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    ![Object.prototype, null].includes(Object.getPrototypeOf(value)) ||
    Object.keys(value).some((k) => !keys.includes(k)) ||
    keys.some((k) => !Object.hasOwn(value, k))
  )
    invalid(`Preverite polja cenika: ${label}.`);
}
function text(value, label, max = 600) {
  if (
    typeof value !== "string" ||
    !value.trim() ||
    value.length > max ||
    /[<>\u0000-\u001f]/.test(value)
  )
    invalid(`Preverite besedilo: ${label}.`);
  return value.trim();
}
function date(value) {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    !Number.isFinite(Date.parse(value + "T12:00:00Z")) ||
    new Date(value + "T12:00:00Z").toISOString().slice(0, 10) !== value ||
    value.startsWith("0000")
  )
    invalid("Vnesite veljaven datum cenika.");
  return value;
}
function amount(value, label, max = 100000) {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < 0 ||
    value > max
  )
    invalid(`Preverite znesek ali količino: ${label}.`);
  return value;
}
function source(value) {
  try {
    const u = new URL(value);
    if (
      u.protocol !== "https:" ||
      u.username ||
      u.password ||
      value.length > 1000
    )
      throw Error();
    return value;
  } catch {
    invalid("Vir cenika mora biti veljavna povezava https.");
  }
}
const municipalityKeys = [
  "id",
  "name",
  "effectiveFrom",
  "sourceUrl",
  "waterM3",
  "waterNetwork",
  "drainageM3",
  "drainageNetwork",
  "cleaningM3",
  "cleaningNetwork",
];
const wasteNumbers = [
  "collectionKgPerPerson",
  "treatmentKgPerPerson",
  "disposalKgPerPerson",
  "bioKgPerPerson",
  "collectionKg",
  "collectionInfrastructureKg",
  "treatmentKg",
  "treatmentInfrastructureKg",
  "disposalKg",
  "disposalInfrastructureKg",
  "bioKg",
];
export function validateTariffs(value) {
  record(
    value,
    [
      "checkedOn",
      "vatPercent",
      "municipalities",
      "septic",
      "waste",
      "servicePrices",
    ],
    "cenik",
  );
  date(value.checkedOn);
  amount(value.vatPercent, "DDV", 30);
  if (!Array.isArray(value.municipalities) || value.municipalities.length !== 3)
    invalid("Cenik mora vsebovati vse tri občine.");
  const ids = new Set();
  for (const m of value.municipalities) {
    record(m, municipalityKeys, "občina");
    if (
      !["vrhnika", "borovnica", "log-dragomer"].includes(m.id) ||
      ids.has(m.id)
    )
      invalid("Preverite občine cenika.");
    ids.add(m.id);
    text(m.name, "občina", 100);
    date(m.effectiveFrom);
    source(m.sourceUrl);
    for (const key of municipalityKeys.slice(4)) amount(m[key], key);
  }
  const septicKeys = ["serviceM3", "network", "levySepticM3", "levyTreatedM3"];
  record(value.septic, septicKeys, "greznice");
  for (const key of septicKeys) amount(value.septic[key], key);
  record(
    value.waste,
    ["effectiveFrom", "sourceUrl", "annexUrl", ...wasteNumbers],
    "odpadki",
  );
  date(value.waste.effectiveFrom);
  source(value.waste.sourceUrl);
  source(value.waste.annexUrl);
  for (const key of wasteNumbers) amount(value.waste[key], key);
  if (!Array.isArray(value.servicePrices) || value.servicePrices.length > 50)
    invalid("Dovoljenih je največ 50 cen posebnih storitev.");
  const priceIds = new Set();
  for (const p of value.servicePrices) {
    record(
      p,
      [
        "id",
        "category",
        "name",
        "unit",
        "priceWithVat",
        "vatPercent",
        "effectiveFrom",
        "sourceUrl",
        "note",
      ],
      "posebne storitve",
    );
    if (
      typeof p.id !== "string" ||
      !/^[a-z0-9][a-z0-9-]{0,79}$/.test(p.id) ||
      priceIds.has(p.id)
    )
      invalid("Oznake cen storitev morajo biti enolične.");
    priceIds.add(p.id);
    if (
      !["bulky", "septic", "water", "other"].includes(p.category) ||
      !["kg", "m³", "ura", "dan", "kos", "storitev"].includes(p.unit)
    )
      invalid("Preverite vrsto in enoto storitve.");
    text(p.name, "storitev", 200);
    text(p.note, "opomba");
    amount(p.priceWithVat, p.name);
    amount(p.vatPercent, "DDV", 30);
    date(p.effectiveFrom);
    source(p.sourceUrl);
  }
  return JSON.parse(JSON.stringify(value));
}
const cents = (value) => Math.round((value + Number.EPSILON) * 100);
export function tariffDate(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Ljubljana",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  return ["year", "month", "day"]
    .map((type) => parts.find((part) => part.type === type).value)
    .join("-");
}
export function calculateHousehold(tariffs, input, today = tariffDate()) {
  const m = tariffs.municipalities.find(
    (item) => item.id === input.municipalityId,
  );
  if (!m) invalid("Izberite občino svojega odjemnega mesta.");
  if (!["water", "waste", "all"].includes(input.scope))
    invalid("Izberite vrsto izračuna.");
  const water = input.scope !== "waste",
    waste = input.scope !== "water";
  if (
    (water && today < m.effectiveFrom) ||
    (waste && today < tariffs.waste.effectiveFrom)
  )
    invalid("Vneseni cenik še ne velja. Obrnite se na informacijsko pisarno.");
  if (water) {
    amount(input.consumptionM3, "mesečna poraba vode", 10000);
    if (!Number.isInteger(input.meterBand) || !METER_BANDS[input.meterBand])
      invalid("Preverite premer vodomera.");
    if (!["sewer", "septic", "mkcn", "water-only"].includes(input.wastewater))
      invalid("Izberite način odvajanja odpadne vode.");
  }
  if (
    waste &&
    (!Number.isInteger(input.people) ||
      input.people < 1 ||
      input.people > 50 ||
      typeof input.bio !== "boolean")
  )
    invalid(
      "Vnesite od 1 do 50 prijavljenih oseb in način ravnanja z BIO odpadki.",
    );
  amount(input.monthlyDeduction ?? 0, "mesečno znižanje", 100000);
  const rows = [];
  function add(key, label, quantity, unit, unitNet, tax = tariffs.vatPercent) {
    // Keep the tariff's four-decimal precision until the final line amount.
    // Rounding the net amount first can add an artificial cent to small lines.
    const netCents = cents(quantity * unitNet),
      grossCents = cents(quantity * unitNet * (1 + tax / 100)),
      vatCents = grossCents - netCents;
    rows.push({
      key,
      label,
      quantity,
      unit,
      unitNet,
      vatPercent: tax,
      netCents,
      vatCents,
      grossCents,
    });
  }
  if (water) {
    const q = input.consumptionM3,
      f = METER_BANDS[input.meterBand].factor;
    add("water", "Vodarina", q, "m³", m.waterM3);
    add(
      "water-network",
      "Omrežnina – vodovod",
      f,
      "faktor/mesec",
      m.waterNetwork,
    );
    if (input.wastewater === "sewer") {
      add("drainage", "Odvajanje odpadne vode", q, "m³", m.drainageM3);
      add(
        "drainage-network",
        "Omrežnina – odvajanje",
        f,
        "faktor/mesec",
        m.drainageNetwork,
      );
      add("cleaning", "Čiščenje odpadne vode", q, "m³", m.cleaningM3);
      add(
        "cleaning-network",
        "Omrežnina – čiščenje",
        f,
        "faktor/mesec",
        m.cleaningNetwork,
      );
      add(
        "levy",
        "Okoljska dajatev – čistilna naprava",
        q,
        "m³",
        tariffs.septic.levyTreatedM3,
        0,
      );
    } else if (input.wastewater !== "water-only") {
      add(
        "septic",
        "Storitve greznice in MKČN",
        q,
        "m³",
        tariffs.septic.serviceM3,
      );
      add(
        "septic-network",
        "Omrežnina – greznice/MKČN",
        f,
        "faktor/mesec",
        tariffs.septic.network,
      );
      add(
        "levy",
        input.wastewater === "mkcn"
          ? "Okoljska dajatev – ustrezna MKČN"
          : "Okoljska dajatev – greznica",
        q,
        "m³",
        input.wastewater === "mkcn"
          ? tariffs.septic.levyTreatedM3
          : tariffs.septic.levySepticM3,
        0,
      );
    }
  }
  if (waste) {
    const w = tariffs.waste,
      n = input.people;
    add(
      "collection",
      "Zbiranje komunalnih odpadkov",
      n * w.collectionKgPerPerson,
      "kg",
      w.collectionKg,
    );
    add(
      "collection-infrastructure",
      "Infrastruktura – zbiranje",
      n * w.collectionKgPerPerson,
      "kg",
      w.collectionInfrastructureKg,
    );
    add(
      "treatment",
      "Obdelava odpadkov",
      n * w.treatmentKgPerPerson,
      "kg",
      w.treatmentKg,
    );
    add(
      "treatment-infrastructure",
      "Infrastruktura – obdelava",
      n * w.treatmentKgPerPerson,
      "kg",
      w.treatmentInfrastructureKg,
    );
    add(
      "disposal",
      "Odlaganje odpadkov",
      n * w.disposalKgPerPerson,
      "kg",
      w.disposalKg,
    );
    add(
      "disposal-infrastructure",
      "Infrastruktura – odlaganje",
      n * w.disposalKgPerPerson,
      "kg",
      w.disposalInfrastructureKg,
    );
    if (input.bio)
      add(
        "bio",
        "Zbiranje bioloških odpadkov",
        n * w.bioKgPerPerson,
        "kg",
        w.bioKg,
      );
  }
  const beforeDeductionCents = rows.reduce(
      (sum, row) => sum + row.grossCents,
      0,
    ),
    deductionCents = cents(input.monthlyDeduction || 0);
  if (deductionCents > beforeDeductionCents)
    invalid("Znižanje ne sme presegati izračunanega zneska.");
  return {
    municipality: m,
    rows,
    beforeDeductionCents,
    deductionCents,
    totalCents: beforeDeductionCents - deductionCents,
    vatCents: rows.reduce((sum, row) => sum + row.vatCents, 0),
  };
}
