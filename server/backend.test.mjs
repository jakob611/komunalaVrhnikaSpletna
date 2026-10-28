import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { handleRequest, calendar } from "./worker.js";
import { createFileStorage } from "./storage.mjs";
import { getCollection, ljubljanaDate } from "./seed.js";

const url = (route) => `https://kpv.example${route}`;
const post = (route, body, extraHeaders = {}) =>
  new Request(url(route), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "https://kpv.example",
      ...extraHeaders,
    },
    body: JSON.stringify(body),
  });
const person = {
  name: "Ana Novak",
  email: "ana@example.test",
  address: "Tržaška cesta 1, Vrhnika",
  consent: true,
};
const form = () => {
  const data = new FormData();
  for (const [key, value] of Object.entries({
    ...person,
    category: "roads",
    description: "Na vozišču je poškodovana asfaltna površina.",
    latitude: "45.963",
    longitude: "14.294",
  }))
    data.set(key, String(value));
  return data;
};

test("local storage persists parallel submissions and survives a new adapter instance", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "kpv-test-"));
  try {
    const env = { LOCAL_STORAGE: createFileStorage(directory) };
    const responses = await Promise.all(
      Array.from({ length: 12 }, () =>
        handleRequest(
          post("/api/subscriptions", { ...person, topics: ["water", "roads"] }),
          env,
        ),
      ),
    );
    assert.ok(responses.every((response) => response.status === 201));
    const rows = JSON.parse(
      await readFile(path.join(directory, "records.json"), "utf8"),
    );
    assert.equal(rows.length, 12);
    assert.equal(new Set(rows.map((row) => row.id)).size, 12);
    assert.equal(rows[0].payload.email, person.email);
    await createFileStorage(directory).save({
      id: "extra",
      kind: "test",
      payload: {},
    });
    assert.equal(
      JSON.parse(await readFile(path.join(directory, "records.json"), "utf8"))
        .length,
      13,
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("missing storage never returns a false success", async () => {
  const response = await handleRequest(
    post("/api/subscriptions", { ...person, topics: ["water"] }),
  );
  assert.equal(response.status, 503);
  assert.match((await response.json()).error, /ni shranjena/);
});

test("consent, allowed topics, dates and email are validated before saving", async () => {
  let saves = 0;
  const env = {
    LOCAL_STORAGE: {
      save: async () => {
        saves++;
      },
    },
  };
  const requests = [
    post("/api/subscriptions", {
      ...person,
      consent: false,
      topics: ["water"],
    }),
    post("/api/subscriptions", {
      ...person,
      email: "invalid",
      topics: ["water"],
    }),
    post("/api/subscriptions", { ...person, topics: ["anything"] }),
    post("/api/market", {
      ...person,
      date: "2027-99-99",
      products: "Zelenjava",
      stallType: "standard",
    }),
    post("/api/market", {
      ...person,
      date: "2027-02-30",
      products: "Zelenjava",
      stallType: "standard",
    }),
    post("/api/requests", {
      ...person,
      service: "admin",
      message: "To je preskusno povpraševanje.",
    }),
  ];
  for (const request of requests)
    assert.equal((await handleRequest(request, env)).status, 400);
  assert.equal(saves, 0);
});

test("cross-site submission and oversized JSON are rejected", async () => {
  const env = {
    LOCAL_STORAGE: { save: async () => assert.fail("must not save") },
  };
  assert.equal(
    (
      await handleRequest(
        post(
          "/api/subscriptions",
          { ...person, topics: ["water"] },
          { Origin: "https://attacker.example" },
        ),
        env,
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await handleRequest(
        post("/api/subscriptions", {
          ...person,
          name: "x".repeat(40_000),
          topics: ["water"],
        }),
        env,
      )
    ).status,
    413,
  );
});

test("calendar is future-facing, valid UTF-8 folded ICS, and resists property injection", async () => {
  const today = "2026-10-28";
  const schedule = getCollection(
    "Tržaška cesta 1, Vrhnika",
    new Date(`${today}T12:00:00Z`),
  );
  assert.equal(schedule.demo, true);
  assert.ok(schedule.events.every((event) => event.date > today));
  const tomorrow = getCollection(
    "Tržaška cesta 1, Vrhnika",
    new Date("2026-10-29T12:00:00Z"),
  );
  for (const event of schedule.events.filter(
    (event) => event.date > "2026-10-29",
  )) {
    assert.ok(
      tomorrow.events.some((next) => next.id === event.id),
      "Future collections keep stable dates and calendar identifiers",
    );
  }
  assert.equal(getCollection("Ljubljana"), null);
  assert.equal(ljubljanaDate(new Date("2026-10-28T23:30:00Z")), "2026-10-29");
  const output = calendar({
    ...schedule,
    address: "Vrhnika\r\nATTENDEE:injected@example.test;test,other\\",
  });
  assert.match(output, /BEGIN:VCALENDAR\r\n/);
  assert.ok(!output.includes("\r\nATTENDEE:"));
  assert.ok(
    output
      .split("\r\n")
      .every((line) => new TextEncoder().encode(line).length <= 75),
  );
  assert.match(output, /SUMMARY:PRIMER/);
  const response = await handleRequest(
    new Request(url("/api/calendar?address=Vrhnika")),
  );
  assert.equal(response.status, 200);
  assert.match(response.headers.get("Content-Type"), /text\/calendar/);
});

test("private submissions and photos are not publicly exposed", async () => {
  for (const route of [
    "/api/submissions",
    "/api/reports",
    "/api/photos/secret.png",
  ]) {
    assert.equal((await handleRequest(new Request(url(route)))).status, 404);
  }
});

test("report saves real attachment bytes and rejects disguised files", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "kpv-photo-"));
  try {
    const env = { LOCAL_STORAGE: createFileStorage(directory) };
    const bad = form();
    bad.set(
      "photo",
      new File(["<script>fake</script>"], "fake.png", { type: "image/png" }),
    );
    assert.equal(
      (
        await handleRequest(
          new Request(url("/api/reports"), { method: "POST", body: bad }),
          env,
        )
      ).status,
      400,
    );
    const valid = form();
    const png = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13]);
    valid.set(
      "photo",
      new File([png], "../../test.png", { type: "image/png" }),
    );
    const response = await handleRequest(
      new Request(url("/api/reports"), { method: "POST", body: valid }),
      env,
    );
    assert.equal(response.status, 201);
    const [record] = JSON.parse(
      await readFile(path.join(directory, "records.json"), "utf8"),
    );
    assert.match(record.payload.photoKey, /^[\da-f-]+\.png$/);
    assert.deepEqual(
      new Uint8Array(
        await readFile(path.join(directory, "photos", record.payload.photoKey)),
      ),
      png,
    );
    assert.equal(record.payload.latitude, 45.963);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("report without cloud photo storage fails before database save", async () => {
  const data = form();
  data.set(
    "photo",
    new File([Uint8Array.from([255, 216, 255, 0])], "test.jpg", {
      type: "image/jpeg",
    }),
  );
  let saved = false;
  const env = {
    DB: {
      prepare: () => ({
        bind: () => ({
          run: async () => {
            saved = true;
          },
        }),
      }),
    },
  };
  const response = await handleRequest(
    new Request(url("/api/reports"), { method: "POST", body: data }),
    env,
  );
  assert.equal(response.status, 503);
  assert.equal(saved, false);
});
