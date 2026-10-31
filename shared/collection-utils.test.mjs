import test from "node:test";
import assert from "node:assert/strict";
import {
  addressRuleMatches,
  matchCollectionRoute,
  matchCollectionSchedule,
  generateCollectionEvents,
  mergeCollectionEvents,
  moveCollectionEvents,
  shiftCollectionDate,
} from "./collection-utils.js";
import { validateSection } from "./cms-validation.js";
const event = (date, type = "bio", id = `${type}-${date}`) => ({
  id,
  date,
  type,
  label: "Preizkus",
});
const route = (id, addresses, events = [event("2027-01-01")]) => ({
  id,
  name: id,
  addresses,
  events,
});

test("district rules use whole words and house numbers, normalize diacritics and allow qualified streets", () => {
  assert.equal(
    addressRuleMatches(
      "Trzaska cesta 1, 1360 Vrhnika",
      "Tržaška cesta, Vrhnika",
    ),
    true,
  );
  assert.equal(
    addressRuleMatches("Tržaška cesta 1, Vrhnika", "Tržaška cesta 1"),
    true,
  );
  assert.equal(
    addressRuleMatches("Tržaška cesta 12, Vrhnika", "Tržaška cesta 1"),
    false,
  );
  assert.equal(
    addressRuleMatches("Tržaška cesta 1a, Vrhnika", "Tržaška cesta 1"),
    false,
  );
  assert.equal(addressRuleMatches("Tržaška cesta 1 a, Vrhnika", "Tržaška cesta 1"), false);
  assert.equal(addressRuleMatches("Tržaška cesta 1 a, Vrhnika", "Tržaška cesta 1a"), true);
  assert.equal(addressRuleMatches("Podvrhnika 1", "Vrhnika"), false);
  assert.equal(addressRuleMatches("Verd 1, Vrhnika", ""), false);
  assert.equal(
    addressRuleMatches("Tržaška cesta 1, Ljubljana", "Tržaška cesta, Vrhnika"),
    false,
  );
  assert.equal(
    addressRuleMatches("Vrhnika, Tržaška cesta 1", "Tržaška cesta, Vrhnika"),
    true,
  );
});

test("house-specific routes beat qualified streets and identical best matches fail safely", () => {
  const routes = [
    route("town", ["Vrhnika"]),
    route("street", ["Tržaška cesta, Vrhnika"]),
    route("house", ["Tržaška cesta 1"]),
  ];
  assert.equal(
    matchCollectionRoute("Tržaška cesta 1, Vrhnika", routes).route.id,
    "house",
  );
  assert.equal(
    matchCollectionRoute("Tržaška cesta 12, Vrhnika", routes).route.id,
    "street",
  );
  assert.equal(matchCollectionRoute("Vrhnika", routes).route.id, "town");
  assert.equal(matchCollectionRoute("Maribor", routes).route, null);
  const conflict = matchCollectionRoute("Verd 1", [
    route("one", ["Verd"]),
    route("two", ["Verd"]),
  ]);
  assert.equal(conflict.route, null);
  assert.equal(conflict.ambiguous, true);
});

test("compound municipality names cannot override the primary settlement", () => {
  const routes=[route("log",["Log"]),route("dragomer",["Dragomer"])];
  for (const address of ["Log 12, občina Log - Dragomer","Log 12, Log - Dragomer","Log 12 občina Log - Dragomer"])
    assert.equal(matchCollectionRoute(address,routes).route.id,"log");
  assert.equal(addressRuleMatches("Log 12, občina Log - Dragomer","Dragomer"),false);
  assert.equal(addressRuleMatches("Lukovica pri Domžalah 12","Lukovica"),false);
  assert.equal(addressRuleMatches("Janezova vas 12, Vrhnika","Vas, Vrhnika"),false);
  assert.equal(matchCollectionRoute("Verd 12, Vrhnika",[route("verd",["Verd"]),route("vrhnika",["Vrhnika"])]).route.id,"verd");
});

test("declared municipality qualifiers prevent bare aliases accepting contradictory addresses", () => {
  const routes=[route("verd",["Verd","Verd, Vrhnika"])];
  assert.equal(matchCollectionRoute("Verd 12",routes).route.id,"verd");
  assert.equal(matchCollectionRoute("Verd 12, Vrhnika",routes).route.id,"verd");
  assert.equal(matchCollectionRoute("Verd 12 Vrhnika",routes).route.id,"verd");
  assert.equal(matchCollectionRoute("Verd 12, Ljubljana",routes).route,null);
  assert.equal(matchCollectionRoute("Verd 12 Ljubljana",routes).route,null);
});

test("recurrences generate inclusive date-only schedules across DST and leap years", () => {
  assert.deepEqual(
    generateCollectionEvents({
      type: "bio",
      start: "2026-03-22",
      end: "2026-04-05",
      weekday: 0,
      interval: 1,
    }).map((x) => x.date),
    ["2026-03-22", "2026-03-29", "2026-04-05"],
  );
  assert.deepEqual(
    generateCollectionEvents({
      type: "packaging",
      start: "2028-02-22",
      end: "2028-03-14",
      weekday: 2,
      interval: 2,
    }).map((x) => x.date),
    ["2028-02-22", "2028-03-07"],
  );
  assert.equal(shiftCollectionDate("2028-02-28", 1), "2028-02-29");
  assert.equal(shiftCollectionDate("2026-03-29", 1), "2026-03-30");
  assert.equal(shiftCollectionDate("2026-10-25", -1), "2026-10-24");
  assert.deepEqual(
    generateCollectionEvents({
      type: "bio",
      start: "2027-01-01",
      end: "2027-01-01",
      weekday: 1,
      interval: 1,
    }),
    [],
  );
  for (const patch of [
    { start: "2027-02-29" },
    { end: "2026-01-01" },
    { weekday: 7 },
    { interval: 0 },
    { end: "2031-01-01" },
    { type: "glass" },
  ])
    assert.throws(() =>
      generateCollectionEvents({
        type: "bio",
        start: "2027-01-01",
        end: "2027-02-01",
        weekday: 1,
        interval: 1,
        ...patch,
      }),
    );
});

test("adding generated dates skips duplicates while stable existing IDs and exceptions remain", () => {
  const existing = [event("2027-01-04", "bio", "stable-id")];
  const incoming = generateCollectionEvents({
    type: "bio",
    start: "2027-01-04",
    end: "2027-01-11",
    weekday: 1,
    interval: 1,
  });
  const result = mergeCollectionEvents(existing, incoming);
  assert.equal(result.skipped, 1);
  assert.equal(result.added, 1);
  assert.equal(result.events[0].id, "stable-id");
  assert.equal(existing.length, 1);
  const collision = mergeCollectionEvents(existing, [
    event("2027-01-05", "bio", "stable-id"),
  ]);
  assert.notEqual(collision.events[1].id, "stable-id");
  assert.equal(
    mergeCollectionEvents(existing, [event("2027-01-04", "residual")]).added,
    1,
  );
});

test("holiday changes are atomic, retain calendar IDs and reject same-fraction collisions", () => {
  const existing = [
    event("2027-01-04", "bio", "one"),
    event("2027-01-05", "bio", "two"),
    event("2027-01-05", "residual", "three"),
  ];
  assert.throws(() => moveCollectionEvents(existing, ["one"], 1));
  assert.equal(existing[0].date, "2027-01-04");
  const moved = moveCollectionEvents(existing, ["one", "two"], 1);
  assert.equal(moved.find((x) => x.id === "one").date, "2027-01-05");
  assert.equal(moved.find((x) => x.id === "two").date, "2027-01-06");
  assert.equal(moved.find((x) => x.id === "three").date, "2027-01-05");
});

test("publishing rejects duplicate dates and invalid rules, but permits independent fractions and vehicle splits", () => {
  assert.throws(() =>
    validateSection("collection", { routes: [route("one", [])] }),
  );
  assert.throws(() =>
    validateSection("collection", { routes: [route("one", ["---"])] }),
  );
  assert.throws(() =>
    validateSection("collection", {
      routes: [
        route(
          "one",
          ["Vrhnika"],
          [
            event("2027-01-01", "bio", "one"),
            event("2027-01-01", "bio", "two"),
          ],
        ),
      ],
    }),
  );
  assert.doesNotThrow(() =>
    validateSection("collection", {
      routes: [
        route("one", ["Tržaška cesta"]),
        route("two", ["trzaska, cesta"]),
      ],
    }),
  );
  assert.equal(
    validateSection("collection", {
      routes: [
        route("town", ["Vrhnika"]),
        route("street", ["Tržaška cesta, Vrhnika"]),
      ],
    }).routes.length,
    2,
  );
});

test("schedule matching considers each fraction independently and retains vehicle ambiguity", () => {
  const routes = [route("bio",["Verd"],[event("2027-01-05","bio")]),
    route("emb",["Verd"],[event("2027-01-06","packaging")]),
    route("mko",["Verd"],[event("2027-01-07","residual")])];
  const match = matchCollectionSchedule("Verd 12", routes);
  assert.equal(match.matches.bio.route.id,"bio");
  assert.equal(match.matches.packaging.route.id,"emb");
  assert.equal(match.matches.residual.route.id,"mko");
  assert.deepEqual(match.incompleteTypes,[]);
  const split = matchCollectionSchedule("Verd 12", [...routes,route("small",["Verd"],[event("2027-01-08","residual")])]);
  assert.deepEqual(split.incompleteTypes,["residual"]);
  assert.deepEqual(split.ambiguousTypes,["residual"]);
  assert.equal(split.matches.bio.route.id,"bio");
});
