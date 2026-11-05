import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { CMS_SECTIONS, validateSection } from "./cms-validation.js";

const defaults = JSON.parse(
  await readFile(new URL("./site-defaults.json", import.meta.url), "utf8"),
);
const clone = (value) => structuredClone(value);
const noticeFixture = {
  id: "notice-test", title: "Testno obvestilo", category: "water", area: "Testno območje",
  date: "2026-10-30", summary: "Obvestilo za preverjanje validacije.", status: "info", latitude: null, longitude: null,
};
const graveFixture = {
  id: "A-01", section: "A", row: 1, number: 1, x: 10, y: 10,
  people: [{ name: "Testna oseba", born: "1900-01-01", died: "2000-01-01" }],
};
function rejected(section, value) {
  assert.throws(
    () => validateSection(section, value),
    (error) => error.status === 400 && /Preverite vsebino/.test(error.message),
  );
}

test("every shipped CMS section has a valid schema and validation detaches nested data", () => {
  assert.deepEqual(Object.keys(defaults), CMS_SECTIONS);
  for (const section of CMS_SECTIONS)
    assert.deepEqual(
      validateSection(section, defaults[section]),
      defaults[section],
      section,
    );
  const source = { ...clone(defaults.cemetery), graves: [clone(graveFixture)] };
  const result = validateSection("cemetery", source);
  result.graves[0].people[0].name = "Spremenjeno";
  assert.notEqual(
    result.graves[0].people[0].name,
    source.graves[0].people[0].name,
  );
});

test("unknown sections, hidden fields, prototype pollution and HTML are rejected", () => {
  rejected("__proto__", {});
  rejected("unknown", {});
  rejected("settings", {
    ...defaults.settings,
    apiKey: "must-not-be-published",
  });
  rejected("settings", {
    ...defaults.settings,
    siteName: "<script>alert(1)</script>",
  });
  rejected("rates", JSON.parse(' {"__proto__":{"polluted":true}} '));
  rejected(
    "settings",
    Object.assign(Object.create({ inherited: true }), defaults.settings),
  );
  const accessor = { ...defaults.settings };
  Object.defineProperty(accessor, "siteName", {
    enumerable: true,
    get() {
      throw Error("must not be executed");
    },
  });
  rejected("settings", accessor);
  assert.equal({}.polluted, undefined);
});

test("operational records enforce IDs, enums, coordinates, numeric prices and real calendar dates", () => {
  rejected("notices", [noticeFixture, noticeFixture]);
  rejected("notices", [{ ...noticeFixture, latitude: 91 }]);
  rejected("notices", [{ ...noticeFixture, date: "2027-02-29" }]);
  rejected("notices", [{ ...noticeFixture, status: "published" }]);
  rejected("wastePoints", [
    { ...defaults.wastePoints[0], types: ["unrecognized"] },
  ]);
  rejected("wasteItems", [{ ...defaults.wasteItems[0], category: "plastic" }]);
  rejected("wasteCategories", {
    ...defaults.wasteCategories,
    bio: { ...defaults.wasteCategories.bio, color: "url(javascript:alert(1))" },
  });
  rejected("services", [
    ...defaults.services.slice(0, 3),
    defaults.services[0],
  ]);
  rejected("rates", { ...defaults.rates, waterBase: -1 });
  rejected("rates", { ...defaults.rates, bio: "4.2" });
  rejected("rates", { ...defaults.rates, bio: Infinity });
  rejected("market", { dates: ["2028-02-29"], closedDates: ["2028-02-29"] });
  assert.deepEqual(
    validateSection("market", { dates: ["2028-02-29"], closedDates: [] }),
    { dates: ["2028-02-29"], closedDates: [] },
  );
});

test("manual collection routes preserve exact dates, optional bin labels and supported fractions", () => {
  const route = {
    id: "vrhnika-center",
    name: "Vrhnika – center",
    addresses: ["Tržaška cesta 1, Vrhnika"],
    events: [
      {
        id: "2027-bio",
        type: "bio",
        label: "Biološki odpadki",
        date: "2027-02-28",
        bin: "Zeleni zabojnik",
      },
    ],
  };
  assert.deepEqual(validateSection("collection", { routes: [route] }), {
    routes: [route],
  });
  rejected("collection", {
    routes: [{ ...route, events: [{ ...route.events[0], type: "mixed" }] }],
  });
  rejected("collection", {
    routes: [
      { ...route, events: [{ ...route.events[0], rrule: "FREQ=DAILY" }] },
    ],
  });
  rejected("collection", {
    routes: [
      { ...route, events: [{ ...route.events[0], date: "2027-02-30" }] },
    ],
  });
  rejected("collection", {
    routes: [{ ...route, events: [route.events[0], route.events[0]] }],
  });
});

test("cemetery enforces plan bounds, chronology, unique plots and bounded people", () => {
  const plan = { width: 1000, height: 760, imageUrl: "/api/media/plan-123" };
  const grave = {
    id: "A-01",
    section: "A",
    row: 1,
    number: 1,
    x: 10,
    y: 10,
    people: [{ name: "Testna oseba", born: "1900-01-01", died: "2000-01-01" }],
  };
  assert.deepEqual(validateSection("cemetery", { plan, graves: [grave] }), {
    plan,
    graves: [grave],
  });
  rejected("cemetery", { plan, graves: [{ ...grave, x: 1001 }] });
  rejected("cemetery", {
    plan,
    graves: [
      { ...grave, people: [{ ...grave.people[0], born: "2001-01-01" }] },
    ],
  });
  rejected("cemetery", {
    plan,
    graves: [
      { ...grave, people: [{ ...grave.people[0], died: "9999-01-01" }] },
    ],
  });
  rejected("cemetery", {
    plan,
    graves: [{ ...grave, people: Array(11).fill(grave.people[0]) }],
  });
  rejected("cemetery", {
    plan,
    graves: [grave, { ...grave, id: "different-id" }],
  });
});

test("page overrides accept plain text and safe images while blocking routes and unsafe URL schemes", () => {
  const item = {
    page: "/",
    key: "a".repeat(64),
    original: "Čisto okolje.",
    value: "Skupaj za naš kraj.",
  };
  assert.deepEqual(validateSection("copy", [item]), [item]);
  rejected("copy", [{ ...item, page: "/admin" }]);
  rejected("copy", [{ ...item, key: "__proto__" }]);
  rejected("copy", [item, item]);
  rejected("copy", [{ ...item, extra: "hidden" }]);
  const image = {
    page: "/",
    key: "b".repeat(64),
    original: "/images/ljubljanica.webp",
    url: "/api/media/upload-123",
    alt: "Naš kraj",
  };
  assert.deepEqual(validateSection("images", [image]), [image]);
  for (const url of [
    "javascript:alert(1)",
    "data:image/svg+xml,<svg/>",
    "//evil.example/image.png",
    "/api/reports/private-photo",
    "/admin/photo.png",
    "/images/../photo.png",
    "/images/%2e%2e/photo.png",
    "https://example.com/unsafe.svg",
    "https://127.0.0.1/photo.png",
    "https://localhost/photo.png",
    "https://example.com/api/reports/private-photo",
  ])
    rejected("images", [{ ...image, url }]);
  assert.equal(validateSection("images", [{ ...image, url: "" }])[0].url, "");
});

test("featured image slot accepts its exact synthetic original without allowing custom schemes", () => {
  const image = {
    page: "/storitve",
    key: "c".repeat(64),
    original: "cms:featured",
    url: "/api/media/featured-123",
    alt: "Predstavitev storitve",
  };
  assert.deepEqual(validateSection("images", [image]), [image]);
  rejected("images", [{ ...image, original: "cms:private" }]);
  rejected("images", [{ ...image, url: "cms:featured" }]);
  rejected("images", [{ ...image, url: "javascript:alert(1)" }]);
});

test("sections exceeding the full serialized byte budget are rejected", () => {
  const large = Array.from({ length: 60 }, (_, i) => ({
    page: "/",
    key: i.toString(16).padStart(64, "0"),
    original: "Vir " + i,
    value: "ž".repeat(10_000),
  }));
  rejected("copy", large);
});
