import test from "node:test";
import assert from "node:assert/strict";
import { managedCollection } from "./managed-collection.js";

test("managed schedules select the most specific address, preserve IDs and omit past dates", () => {
  const data = {
    routes: [
      {
        id: "area",
        name: "Vrhnika",
        addresses: ["Vrhnika"],
        events: [{ id: "a", type: "bio", label: "BIO", date: "2026-11-02" }],
      },
      {
        id: "street",
        name: "Tržaška",
        addresses: ["Tržaška cesta"],
        events: [
          { id: "past", type: "residual", label: "Mešani", date: "2026-10-01" },
          {
            id: "next",
            type: "packaging",
            label: "Embalaža",
            date: "2026-11-01",
          },
        ],
      },
    ],
  };
  const result = managedCollection(
    "Trzaska cesta 1, Vrhnika",
    data,
    new Date("2026-10-29T12:00:00Z"),
  );
  assert.deepEqual(
    result.events.map((event) => event.id),
    ["street-next"],
  );
  assert.equal(result.events[0].color, "#c79813");
  assert.equal(managedCollection("Maribor", data), null);
});
