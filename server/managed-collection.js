import { ljubljanaDate } from "./seed.js";
import { COLLECTION_TYPES, matchCollectionSchedule } from "../shared/collection-utils.js";

export function managedCollection(address, configured, now = new Date()) {
  const { matches, incompleteTypes, ambiguousTypes } = matchCollectionSchedule(address, configured.routes);
  if (!Object.values(matches).some((match) => match.route || match.ambiguous)) return null;
  const colors = { packaging: "#c79813", bio: "#688c39", residual: "#617067" };
  const events = Object.entries(matches).flatMap(([type, { route }]) =>
    (route?.events || []).filter((event) => event.type === type && event.date >= ljubljanaDate(now))
      .map((event) => ({ ...event, id: `${route.id}-${event.id}`, color: colors[event.type] })),
  ).sort((a, b) => a.date.localeCompare(b.date) || a.type.localeCompare(b.type));
  const expiredTypes = Object.entries(matches).filter(([type, { route }]) => route && !events.some((event) => event.type === type)).map(([type]) => type);
  return {
    address,
    demo: false,
    incompleteTypes,
    ambiguousTypes,
    expiredTypes,
    complete: incompleteTypes.length === 0 && expiredTypes.length === 0,
    routes: Object.fromEntries(Object.entries(matches).filter(([, match]) => match.route).map(([type, { route }]) => [type, { id: route.id, name: route.name, lastDate: route.events.filter((event) => event.type === type).map((event) => event.date).sort().at(-1) }])),
    message: incompleteTypes.length || expiredTypes.length
      ? `Urnik je delno določen. Preverite: ${[...new Set([...incompleteTypes, ...expiredTypes])].map((type) => COLLECTION_TYPES[type]).join(", ")}.`
      : "Prikazani so objavljeni datumi za vaš naslov.",
    events,
  };
}
