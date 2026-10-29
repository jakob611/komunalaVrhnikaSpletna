import { normalize, ljubljanaDate } from "./seed.js";

export function managedCollection(address, configured, now = new Date()) {
  const normalized = normalize(address);
  const match = configured.routes
    .flatMap((route) =>
      route.addresses
        .filter((pattern) => normalized.includes(normalize(pattern)))
        .map((pattern) => ({ route, specificity: normalize(pattern).length })),
    )
    .sort((a, b) => b.specificity - a.specificity)[0];
  if (!match) return null;
  const colors = { packaging: "#c79813", bio: "#688c39", residual: "#617067" };
  return {
    address,
    demo: true,
    message: `Uredniško vnesen urnik · ${match.route.name}. Portal ostaja predstavitveni.`,
    events: match.route.events
      .filter((event) => event.date >= ljubljanaDate(now))
      .map((event) => ({
        ...event,
        id: `${match.route.id}-${event.id}`,
        color: colors[event.type],
      }))
      .sort((a, b) => a.date.localeCompare(b.date)),
  };
}
