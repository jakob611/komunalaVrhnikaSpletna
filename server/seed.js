// Demonstration content only. Replace with the official operational feed before launch.
export const notices = [
  {
    id: "demo-water",
    title: "Vzdrževalna dela na vodovodnem omrežju",
    category: "water",
    area: "Vrhnika · Verd",
    date: "2026-10-30",
    summary:
      "Primer obvestila: med 8. in 12. uro je predvidena začasna prekinitev oskrbe s pitno vodo. To ni uradno obvestilo KPV.",
    status: "planned",
    latitude: 45.9602,
    longitude: 14.301,
  },
  {
    id: "demo-roads",
    title: "Obnova vozišča na lokalni cesti",
    category: "roads",
    area: "Borovnica",
    date: "2026-11-02",
    summary:
      "Primer obvestila: zaradi obnove je predvidena delna zapora ceste. Upoštevajte prometno signalizacijo. Podatki so prikazni.",
    status: "planned",
    latitude: 45.9203,
    longitude: 14.3625,
  },
  {
    id: "demo-waste",
    title: "Jesensko zbiranje nevarnih odpadkov",
    category: "waste",
    area: "Vrhnika · Log - Dragomer · Borovnica",
    date: "2026-11-07",
    summary:
      "Primer obvestila: odpadne baterije, barve in druga nevarna sredstva oddajte ločeno. Za dejanski termin preverite uradno stran KPV.",
    status: "planned",
    latitude: 45.9722,
    longitude: 14.3021,
  },
  {
    id: "demo-general",
    title: "Predmetom podarimo novo življenje",
    category: "general",
    area: "DEPO · Vrhnika",
    date: "2026-10-28",
    summary:
      "Dobro ohranjeno pohištvo, oprema in drugi uporabni predmeti lahko zaživijo ponovno. Obiščite uradno stran DEPO.",
    status: "info",
    latitude: 45.9631,
    longitude: 14.2937,
  },
];

export function normalize(value) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function ljubljanaDate(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Ljubljana",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const read = (type) => parts.find((part) => part.type === type).value;
  return `${read("year")}-${read("month")}-${read("day")}`;
}

export function addDays(date, days) {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

export function getCollection(address, now = new Date()) {
  const normalized = normalize(address);
  const supported =
    /\b(vrhnika|verd|borovnica|dragomer|log pri brezovici|log - dragomer|log-dragomer|drenov gric|sinja gorica|stara vrhnika)\b/.test(
      normalized,
    );
  if (!supported) return null;
  const offset =
    [...normalized].reduce((sum, char) => sum + char.charCodeAt(0), 0) % 5;
  const addressHash = [...normalized]
    .reduce(
      (hash, char) => Math.imul(hash ^ char.charCodeAt(0), 16777619) >>> 0,
      2166136261,
    )
    .toString(36);
  const today = ljubljanaDate(now);
  const elapsed = Math.round(
    (Date.parse(`${today}T12:00:00Z`) - Date.parse("2026-01-01T12:00:00Z")) /
      86_400_000,
  );
  const fractions = [
    {
      type: "packaging",
      label: "Mešana embalaža",
      color: "#d4a638",
      step: 14,
      first: 1,
    },
    {
      type: "bio",
      label: "Biološko razgradljivi odpadki",
      color: "#6d8d4d",
      step: 7,
      first: 2,
    },
    {
      type: "residual",
      label: "Mešani komunalni odpadki",
      color: "#617067",
      step: 21,
      first: 4,
    },
  ];
  const events = fractions
    .flatMap((fraction) => {
      // Anchor the demonstration route so revisiting tomorrow does not move all future collections.
      const first =
        fraction.step -
        ((((elapsed - offset - fraction.first) % fraction.step) +
          fraction.step) %
          fraction.step);
      return Array.from({ length: 4 }, (_, index) => {
        const date = addDays(today, first + index * fraction.step);
        return {
          id: `${fraction.type}-${addressHash}-${date}`,
          date,
          type: fraction.type,
          label: fraction.label,
          color: fraction.color,
        };
      });
    })
    .sort((a, b) => a.date.localeCompare(b.date));
  return {
    address,
    demo: true,
    message:
      "Prikazni urnik ni uradni urnik odvoza. Za dejanske termine preverite kpv.si.",
    events,
  };
}
