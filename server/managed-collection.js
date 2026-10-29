import { ljubljanaDate } from "./seed.js";
import { matchCollectionRoute } from "../shared/collection-utils.js";

export function managedCollection(address, configured, now = new Date()) {
  const { route } = matchCollectionRoute(address, configured.routes);
  if (!route) return null;
  const colors = { packaging: "#c79813", bio: "#688c39", residual: "#617067" };
  return {
    address,
    demo: true,
    message: `Uredniško vnesen urnik · ${route.name}. Portal ostaja predstavitveni.`,
    events: route.events
      .filter((event) => event.date >= ljubljanaDate(now))
      .map((event) => ({
        ...event,
        id: `${route.id}-${event.id}`,
        color: colors[event.type],
      }))
      .sort((a, b) => a.date.localeCompare(b.date)),
  };
}
