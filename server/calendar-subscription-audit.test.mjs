import test from "node:test";
import assert from "node:assert/strict";
import { handleRequest } from "./worker.js";
import { addDays, ljubljanaDate } from "./seed.js";

test("calendar subscription stays exact and usable when the first date moves, dates are removed, or the route ends", async () => {
  const today = ljubljanaDate();
  const early = addDays(today, 7),
    next = addDays(today, 22),
    moved = addDays(today, 4);
  let configured = {
    routes: [
      {
        id: "audit-route",
        name: "Pot za biološke odpadke",
        addresses: ["Verd, Vrhnika"],
        events: [
          { id: "first", type: "bio", label: "Biološki odpadki", date: early },
          { id: "next", type: "bio", label: "Biološki odpadki", date: next },
          {
            id: "packaging",
            type: "packaging",
            label: "Embalaža",
            date: addDays(today, 8),
          },
        ],
      },
    ],
  };
  const env = {
    DB: {
      prepare() {
        return {
          bind() {
            return this;
          },
          first: async () => ({ value: JSON.stringify(configured) }),
        };
      },
    },
  };
  const request = (change = {}) =>
    handleRequest(
      new Request(
        "https://kpv.example/api/calendar/feed?" +
          new URLSearchParams({
            route: "audit-route",
            type: "bio",
            from: today,
            ...change,
          }),
      ),
      env,
    );
  const initial = await request();
  assert.equal(initial.status, 200);
  assert.match(initial.headers.get("content-type"), /^text\/calendar/);
  assert.match(initial.headers.get("content-disposition"), /^inline/);
  const first = await initial.text();
  assert.equal((first.match(/BEGIN:VEVENT/g) || []).length, 2);
  assert.match(first, /UID:audit-route-first@kpv\.jakobtominc\.com/);
  assert.ok(
    first.includes(early.replaceAll("-", "")) &&
      first.includes(next.replaceAll("-", "")),
  );
  assert.ok(!first.includes("SUMMARY:Embalaža") && !first.includes("RRULE:"));
  assert.match(first, /X-WR-CALNAME:.*Biološki odpadki/);
  configured.routes[0].events[0].date = moved;
  const updated = await (await request()).text();
  assert.match(updated, /UID:audit-route-first@kpv\.jakobtominc\.com/);
  assert.ok(
    updated.includes("DTSTART;VALUE=DATE:" + moved.replaceAll("-", "")),
  );
  assert.ok(
    !updated.includes("DTSTART;VALUE=DATE:" + early.replaceAll("-", "")),
  );
  configured.routes[0].events = configured.routes[0].events.filter(
    (e) => e.id !== "next",
  );
  assert.ok(
    !(await (await request()).text()).includes("UID:audit-route-next@"),
  );
  configured.routes[0].events = [];
  const empty = await request();
  assert.equal(empty.status, 200);
  assert.ok(!(await empty.text()).includes("BEGIN:VEVENT"));
  configured.routes = [];
  const removed = await request();
  assert.equal(removed.status, 200);
  assert.ok(!(await removed.text()).includes("BEGIN:VEVENT"));
  assert.equal((await request({ type: "unknown" })).status, 400);
  assert.equal((await request({ from: "2026-02-30" })).status, 400);
});
