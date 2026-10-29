// Calendar arithmetic uses UTC noon and date-only values; DST cannot move an event.
const DAY = 86_400_000;
export const COLLECTION_TYPES = Object.freeze({
  packaging: "Mešana embalaža",
  bio: "Biološki odpadki",
  residual: "Mešani komunalni odpadki",
});
export function addressTokens(value) {
  return (
    String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .match(/[a-z0-9]+/g) || []
  );
}
export function normalizedAddress(value) {
  return addressTokens(value).join(" ");
}
export function addressRuleMatches(address, pattern) {
  const actual = addressTokens(address),
    groups = String(pattern || "")
      .split(",")
      .map(addressTokens)
      .filter((group) => group.length);
  if (!groups.length || !actual.length) return false;
  // Comma-separated street/locality constraints permit intervening house numbers,
  // postcodes, and locality-first input while keeping each phrase and number exact.
  return groups.every((group) =>
    actual.some((_, start) =>
      group.every((token, offset) => actual[start + offset] === token),
    ),
  );
}
/** Refuse equally-specific matches from different districts rather than choose array order. */
export function matchCollectionRoute(address, routes) {
  const matches = routes.flatMap((route) =>
    route.addresses
      .filter((pattern) => addressRuleMatches(address, pattern))
      .map((pattern) => {
        const firstPart = addressTokens(pattern.split(",")[0]);
        const house =
          firstPart.length > 1 && /^\d{1,3}[a-z]?$/.test(firstPart.at(-1));
        return {
          route,
          pattern,
          specificity:
            (house ? 100000 : 0) +
            addressTokens(pattern).length * 1000 +
            normalizedAddress(pattern).length,
        };
      }),
  );
  matches.sort((a, b) => b.specificity - a.specificity);
  if (!matches.length) return { route: null, ambiguous: false, candidates: [] };
  const best = matches.filter(
    (match) => match.specificity === matches[0].specificity,
  );
  const candidates = [
    ...new Map(best.map((match) => [match.route.id, match.route])).values(),
  ];
  return {
    route: candidates.length === 1 ? candidates[0] : null,
    ambiguous: candidates.length > 1,
    candidates,
  };
}
function timestamp(value) {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    value.startsWith("0000")
  )
    throw Error("Vnesite veljaven datum.");
  const time = Date.parse(`${value}T12:00:00Z`);
  if (
    !Number.isFinite(time) ||
    new Date(time).toISOString().slice(0, 10) !== value
  )
    throw Error("Vnesite veljaven datum.");
  return time;
}
export function shiftCollectionDate(value, days) {
  if (!Number.isInteger(days) || Math.abs(days) > 366)
    throw Error("Premik naj bo med −366 in 366 dnevi.");
  return new Date(timestamp(value) + days * DAY).toISOString().slice(0, 10);
}
export function generateCollectionEvents({
  type,
  start,
  end,
  weekday,
  interval = 1,
}) {
  if (!Object.hasOwn(COLLECTION_TYPES, type))
    throw Error("Izberite vrsto odpadkov.");
  if (
    !Number.isInteger(weekday) ||
    weekday < 0 ||
    weekday > 6 ||
    !Number.isInteger(interval) ||
    interval < 1 ||
    interval > 8
  )
    throw Error("Izberite dan in ponavljanje na 1–8 tednov.");
  const first = timestamp(start),
    last = timestamp(end);
  if (last < first || last - first > 1096 * DAY)
    throw Error("Obdobje naj bo pravilno razvrščeno in dolgo največ tri leta.");
  const offset = (weekday - new Date(first).getUTCDay() + 7) % 7;
  const events = [];
  for (
    let date = first + offset * DAY;
    date <= last;
    date += interval * 7 * DAY
  ) {
    const value = new Date(date).toISOString().slice(0, 10);
    events.push({
      id: `event-${type}-${value}`,
      type,
      label: COLLECTION_TYPES[type],
      date: value,
    });
  }
  return events;
}
export function mergeCollectionEvents(existing, incoming) {
  const result = [...existing],
    keys = new Set(existing.map((event) => `${event.type}:${event.date}`)),
    ids = new Set(existing.map((event) => event.id));
  let skipped = 0;
  for (const event of incoming) {
    const key = `${event.type}:${event.date}`;
    if (keys.has(key)) {
      skipped++;
      continue;
    }
    let id = event.id,
      suffix = 2;
    while (ids.has(id)) id = `${event.id}-${suffix++}`;
    result.push({ ...event, id });
    keys.add(key);
    ids.add(id);
  }
  if (result.length > 500)
    throw Error(
      "Eno območje lahko vsebuje največ 500 terminov. Skrajšajte obdobje ali odstranite stare termine.",
    );
  return {
    events: result.sort(
      (a, b) => a.date.localeCompare(b.date) || a.type.localeCompare(b.type),
    ),
    added: result.length - existing.length,
    skipped,
  };
}
/** Move a group atomically in the draft; conflicting dates keep the original data intact. */
export function moveCollectionEvents(events, ids, days) {
  const selected = new Set(ids);
  const moved = events.map((event) =>
    selected.has(event.id)
      ? { ...event, date: shiftCollectionDate(event.date, days) }
      : event,
  );
  const keys = new Set();
  for (const event of moved) {
    const key = `${event.type}:${event.date}`;
    if (keys.has(key))
      throw Error(
        "Premik bi podvojil termin za isto vrsto odpadkov. Najprej odstranite ali premaknite obstoječi termin.",
      );
    keys.add(key);
  }
  return moved.sort(
    (a, b) => a.date.localeCompare(b.date) || a.type.localeCompare(b.type),
  );
}
