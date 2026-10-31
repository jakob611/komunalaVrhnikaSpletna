import test from "node:test";
import assert from "node:assert/strict";
import { managedCollection } from "./managed-collection.js";
import official from "../shared/official-collection-2026.json" with {type:"json"};
import { validateSection } from "../shared/cms-validation.js";

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
    ["street-next", "area-a"],
  );
  assert.equal(result.events[0].color, "#c79813");
  assert.equal(managedCollection("Maribor", data), null);
});

test("managed public lookup never assigns a different house or an ambiguous district", () => {
  const routes = [
    {
      id: "house",
      name: "Hiša 1",
      addresses: ["Verd 1"],
      events: [{ id: "one", type: "bio", label: "BIO", date: "2027-01-01" }],
    },
  ];
  assert.equal(managedCollection("Verd 12", { routes }), null);
  assert.equal(managedCollection("Verd 1a", { routes }), null);
  const ambiguous = managedCollection("Verd 1", {
      routes: [...routes, { ...routes[0], id: "conflict" }],
    });
  assert.deepEqual(ambiguous.events, []);
  assert.deepEqual(ambiguous.ambiguousTypes, ["bio"]);
  assert.equal(ambiguous.complete, false);
});

test("official import validates and combines the three independently published Verd routes", () => {
  const data = validateSection("collection", {routes:official.routes});
  const result=managedCollection("Verd 12, Vrhnika",data,new Date("2026-10-30T12:00:00Z"));
  assert.equal(result.demo,false);
  assert.equal(result.complete,true);
  assert.equal(result.events.find((event)=>event.type==="packaging").date,"2026-11-04");
  assert.equal(result.events.find((event)=>event.type==="bio").date,"2026-11-03");
  assert.equal(result.events.find((event)=>event.type==="residual").date,"2026-11-05");
});

test("official small-vehicle ambiguity returns a clearly incomplete schedule without guessing MKO dates", () => {
  const result=managedCollection("Dragomer 12",{routes:official.routes},new Date("2026-10-30T12:00:00Z"));
  assert.equal(result.complete,false);
  assert.deepEqual(result.ambiguousTypes,["residual"]);
  assert.equal(result.events.some((event)=>event.type==="residual"),false);
  assert.equal(result.events.some((event)=>event.type==="bio"),true);
  assert.equal(result.events.find((event)=>event.type==="packaging" && event.date>="2026-12-25").date,"2026-12-26");
});

test("official schedules expire instead of being silently extrapolated", () => {
  const result=managedCollection("Verd 12, Vrhnika",{routes:official.routes},new Date("2027-01-02T12:00:00Z"));
  assert.equal(result.complete,false);
  assert.deepEqual(result.expiredTypes,["packaging"]);
  assert.equal(result.events.some((event)=>event.type==="packaging"),false);
});

test("partial and odd-house source rules never become whole-street assignments", () => {
  const result=managedCollection("Gradišnikova ulica 2, Borovnica",{routes:official.routes},new Date("2026-10-30T12:00:00Z"));
  assert.equal(result.events.some((event)=>event.type==="packaging"),false);
  const lavrovec=managedCollection("Lavrovec 1",{routes:official.routes},new Date("2026-10-30T12:00:00Z"));
  assert.equal(lavrovec,null);
});

test("official Log address keeps Log routes when the compound municipality is present", () => {
  for (const address of ["Log 12, občina Log - Dragomer","Log 12, Log - Dragomer","Log pri Brezovici 12, občina Log - Dragomer"]) {
    const result=managedCollection(address,{routes:official.routes},new Date("2026-10-30T12:00:00Z"));
    assert.equal(result.complete,true,address);
    assert.equal(result.routes.packaging.id,"official-emb-log-g5",address);
    assert.equal(result.routes.bio.id,"official-bio-a",address);
    assert.equal(result.routes.residual.id,"official-mko-log-g",address);
  }
});

test("official short street names and homonymous settlements cannot match outside their geography", () => {
  for (const address of ["Barjanska cesta 1, Ljubljana","Robova cesta 1, Ljubljana","Pod Hruševco 1, Ljubljana","Mokrice 1, Ljubljana","Tankovska cesta 1, Ljubljana","Trojica 1, Ljubljana","Star maln 1, Ljubljana","Pot na mah 1, Ljubljana","Pot na Plešivico 1, Ljubljana","Cesta na breg 1, Ljubljana","Pot na Ferjanko 1, Ljubljana","Partizanski tabor 1, Ljubljana","Delavsko naselje 1, Ljubljana","Verd 12, Ljubljana","Lukovica pri Domžalah 1"]) {
    assert.equal(managedCollection(address,{routes:official.routes},new Date("2026-10-30T12:00:00Z")),null,address);
  }
  const barjanska=managedCollection("Barjanska cesta 1, občina Log - Dragomer",{routes:official.routes},new Date("2026-10-30T12:00:00Z"));
  assert.equal(barjanska.routes.residual.id,"official-mko-log-g");
  const lukovica=managedCollection("Lukovica pri Brezovici 1, občina Log - Dragomer",{routes:official.routes},new Date("2026-10-30T12:00:00Z"));
  assert.equal(lukovica.routes.residual.id,"official-mko-log-j");
});
