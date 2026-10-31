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
      // A house suffix is often entered with a space: 12 a and 12a are one house.
      .replace(/\b(\d+)\s+([a-z])\b/g, "$1$2")
      .match(/[a-z0-9]+/g) || []
  );
}
export function normalizedAddress(value) {
  return addressTokens(value).join(" ");
}
const houseNumber = /^\d+[a-z]?$/;
const roadDesignators = new Set(["cesta", "ulica", "pot", "trg", "naselje", "gric"]);
function addressComponents(value) {
  return String(value || "").split(/,|(?=\bob[cč]ina\b)/i).map((part) => {
    const tokens = addressTokens(part);
    const municipality = tokens[0] === "obcina";
    return { tokens: municipality ? tokens.slice(1) : tokens, municipality };
  }).filter((part) => part.tokens.length);
}
function groupMatchesComponent(group, tokens) {
  return tokens.some((_, start) => {
    // A place name inside another locality/municipality is not an address:
    // Dragomer cannot match Log - Dragomer, nor Vas match Janezova vas.
    if (start && !houseNumber.test(tokens[start - 1])) return false;
    if (!group.every((token, offset) => tokens[start + offset] === token)) return false;
    const next = tokens[start + group.length];
    // Keep documented short street stems ("Idrijska" -> "Idrijska cesta")
    // and house/post codes, but do not truncate compound settlement names.
    return next === undefined || houseNumber.test(next) || roadDesignators.has(next);
  });
}
function addressRuleMatch(address, pattern) {
  const components = addressComponents(address);
  const groups = addressComponents(pattern).map((part) => part.tokens);
  if (!components.length || !groups.length) return { matches: false, primary: false };
  const numbered = components.findIndex((part) => !part.municipality && part.tokens.some((token, index) => index > 0 && houseNumber.test(token)));
  const primaryIndex = numbered >= 0 ? numbered : Math.max(0, components.findIndex((part) => !part.municipality));
  const matching = groups.map((group) => components.map((part,index) => groupMatchesComponent(group, part.tokens) ? index : -1).filter((index) => index >= 0));
  return { matches: matching.every((indices) => indices.length > 0), primary: matching.some((indices) => indices.includes(primaryIndex)) };
}
export function addressRuleMatches(address, pattern) {
  return addressRuleMatch(address, pattern).matches;
}
/** Refuse equally-specific matches from different districts rather than choose array order. */
export function matchCollectionRoute(address, routes) {
  const components = addressComponents(address);
  const hasLocalityContext = components.length > 1 || components.some(({tokens}) => {
    const number = tokens.findIndex((token, index) => index > 0 && houseNumber.test(token));
    return number >= 0 && tokens.slice(number + 1).some((token) => !houseNumber.test(token));
  });
  const matches = routes.flatMap((route) => {
    const qualifiedRules = new Map();
    for (const pattern of route.addresses) {
      const groups = addressComponents(pattern);
      if (groups.length > 1) {
        const key = groups[0].tokens.join(" ");
        qualifiedRules.set(key, [...(qualifiedRules.get(key) || []), pattern]);
      }
    }
    return route.addresses.flatMap((pattern) => {
        const { matches, primary } = addressRuleMatch(address, pattern);
        if (!matches) return [];
        const groups = addressComponents(pattern);
        const qualified = groups.length === 1 ? qualifiedRules.get(groups[0].tokens.join(" ")) : null;
        // A bare settlement alias is useful for "Verd 12". When a municipality
        // is supplied, use its declared qualified variants instead of accepting
        // a contradictory address such as "Verd 12, Ljubljana".
        if (hasLocalityContext && qualified?.length && !qualified.some((rule) => addressRuleMatches(address, rule))) return [];
        const firstPart = addressTokens(pattern.split(",")[0]);
        const house = firstPart.length > 1 && houseNumber.test(firstPart.at(-1));
        return [{
          route,
          pattern,
          specificity:
            (house ? 1_000_000_000 : 0) +
            (primary ? 1_000_000 : 0) +
            addressTokens(pattern).length * 1000,
        }];
      });
  });
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
/** Fractions can use different routes. Never let a BIO route hide an MKO route. */
export function matchCollectionSchedule(address, routes) {
  const matches = Object.fromEntries(
    Object.keys(COLLECTION_TYPES).map((type) => [
      type,
      matchCollectionRoute(
        address,
        routes.filter((route) => route.events.some((event) => event.type === type)),
      ),
    ]),
  );
  return {
    matches,
    incompleteTypes: Object.keys(COLLECTION_TYPES).filter((type) => !matches[type].route),
    ambiguousTypes: Object.keys(COLLECTION_TYPES).filter((type) => matches[type].ambiguous),
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
