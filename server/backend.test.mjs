import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { handleRequest, calendar } from "./worker.js";
import { createFileStorage } from "./storage.mjs";
import { getCollection, ljubljanaDate } from "./seed.js";
import { managedCollection } from "./managed-collection.js";
import { verifyBot } from "./bot-protection.js";

test("contact stores categorized messages and rejects incompatible subcategories", async () => {
  const rows = [];
  const env = { LOCAL_STORAGE: { save: async (record) => rows.push(record) } };
  const body = {
    ...person,
    category: "waste",
    subcategory: "sorting",
    subject: "Vprašanje o ločevanju",
    message: "Kam lahko oddam večje plastične predmete?",
  };
  const response = await handleRequest(post("/api/contact", body), env);
  assert.equal(response.status, 201);
  assert.equal(rows[0].kind, "contact");
  assert.equal(rows[0].payload.subcategory, "sorting");
  assert.equal(rows[0].payload.email, person.email);
  for (const invalid of [
    { ...body, subcategory: "invoice" },
    { ...body, category: "other" },
    { ...body, subject: "" },
    { ...body, message: "kratko" },
  ])
    assert.equal(
      (await handleRequest(post("/api/contact", invalid), env)).status,
      400,
    );
  assert.equal(rows.length, 1);
  assert.equal(
    (
      await handleRequest(
        post("/api/contact", {
          ...body,
          category: "other",
          subcategory: "",
          subject: "Drugo vprašanje",
        }),
        env,
      )
    ).status,
    201,
  );
});

test("production write APIs require bot verification before saving", async () => {
  const env = {
    DB: { prepare: () => assert.fail("unverified record must not be saved") },
    TURNSTILE_SECRET: "test-secret",
    TURNSTILE_HOSTNAMES: "kpv.example",
  };
  const response = await handleRequest(
    post("/api/subscriptions", { ...person, topics: ["water"] }),
    env,
  );
  assert.equal(response.status, 403);
  const reportRequest = new Request(url("/api/reports"), {
    method: "POST",
    headers: { Origin: "https://kpv.example" },
    body: form(),
  });
  assert.equal((await handleRequest(reportRequest, env)).status, 403);
  assert.equal(
    (
      await handleRequest(
        post("/api/contact", {
          ...person,
          category: "other",
          subcategory: "",
          subject: "Vprašanje",
          message: "To je dovolj dolgo testno sporočilo.",
        }),
        env,
      )
    ).status,
    403,
  );
});

test("Turnstile validates success, exact hostname, action, failures and replay", async () => {
  const env = {
    TURNSTILE_SECRET: "test-secret",
    TURNSTILE_HOSTNAMES: "kpv.example",
  };
  const request = new Request(url("/api/contact"));
  for (const result of [
    { success: false, action: "contact", hostname: "kpv.example" },
    { success: true, action: "reports", hostname: "kpv.example" },
    { success: true, action: "contact", hostname: "localhost" },
  ])
    await assert.rejects(
      verifyBot(request, env, "token", "contact", "", async () =>
        Response.json(result),
      ),
      (error) => error.status === 403,
    );
  await assert.rejects(
    verifyBot(request, env, "token", "contact", "", async () => {
      throw Error("offline");
    }),
    (error) => error.status === 503,
  );
  await assert.rejects(
    verifyBot(request, env, "token", "contact", "bot-filled-field"),
    (error) => error.status === 400,
  );
  await assert.rejects(
    verifyBot(
      request,
      { ...env, TURNSTILE_HOSTNAMES: "localhost" },
      "token",
      "contact",
      "",
    ),
    (error) => error.status === 503,
  );
  const redeemed = new Set();
  const siteverify = async (_url, options) => {
    const token = options.body.get("response");
    const success = !redeemed.has(token);
    redeemed.add(token);
    assert.equal(options.body.get("secret"), "test-secret");
    return Response.json({
      success,
      action: "contact",
      hostname: "kpv.example",
    });
  };
  await verifyBot(request, env, "single-use", "contact", "", siteverify);
  await assert.rejects(
    verifyBot(request, env, "single-use", "contact", "", siteverify),
    (error) => error.status === 403,
  );
});

test("public bot configuration never exposes a secret", async () => {
  const response = await handleRequest(new Request(url("/api/config")), {
    TURNSTILE_SITE_KEY: "public-key",
    TURNSTILE_SECRET: "never-public",
  });
  const body = await response.text();
  assert.ok(body.includes("public-key"));
  assert.ok(!body.includes("never-public"));
});

function calendarFixture(address = "Tržaška cesta 1, Vrhnika") {
  const source = getCollection(address);
  const configured = { routes: [{ id: "test-route", name: "Testna odvozna pot", addresses: [address, "Vrhnika"], events: source.events.map(({color,...event}) => event) }] };
  const env = { DB: { prepare: () => ({ bind() { return this; }, first: async () => ({value: JSON.stringify(configured)}) }) } };
  return { env, schedule: managedCollection(address, configured) };
}

test("selected calendar event exports one occurrence without recurrence", async () => {
  const { schedule, env } = calendarFixture(person.address);
  const event = schedule.events[0];
  const params = new URLSearchParams({
    address: person.address,
    eventId: event.id,
    repeat: "once",
  });
  const response = await handleRequest(
    new Request(url(`/api/calendar?${params}`)), env,
  );
  assert.equal(response.status, 200);
  const ics = (await response.text()).replace(/\r\n /g, "");
  assert.equal((ics.match(/BEGIN:VEVENT/g) || []).length, 1);
  assert.ok(ics.includes(`DTSTART;VALUE=DATE:${event.date.replace(/-/g, "")}`));
  assert.ok(!ics.includes("RRULE"));
});

test("calendar repeat choices produce a bounded weekly series", async () => {
  const { schedule, env } = calendarFixture(person.address);
  const event = schedule.events.find((event) => event.type === "packaging");
  const params = new URLSearchParams({
    address: person.address,
    eventId: event.id,
    repeat: "weekly",
    interval: "2",
    count: "7",
  });
  const response = await handleRequest(
    new Request(url(`/api/calendar?${params}`)), env,
  );
  const ics = (await response.text()).replace(/\r\n /g, "");
  assert.equal(response.status, 200);
  assert.equal((ics.match(/BEGIN:VEVENT/g) || []).length, 1);
  assert.ok(ics.includes("RRULE:FREQ=WEEKLY;INTERVAL=2;COUNT=7\r\n"));
  assert.ok(ics.includes("Ponavljanje ste izbrali sami"));
  assert.ok(ics.includes("SUMMARY:") && !ics.includes("PRIMER"));
});

test("calendar rejects stale events and invalid or unbounded repeat rules", async () => {
  const { schedule, env } = calendarFixture(person.address);
  const event = schedule.events[0];
  for (const extra of [
    { repeat: "daily" },
    { repeat: "weekly" },
    { eventId: "unknown" },
    { eventId: event.id, repeat: "weekly", interval: "0", count: "4" },
    { eventId: event.id, repeat: "weekly", interval: "2", count: "999" },
    { eventId: event.id, repeat: "weekly", interval: "2", count: "0" },
    {
      eventId: event.id,
      repeat: "weekly",
      interval: "1\r\nATTENDEE:bad",
      count: "4",
    },
  ]) {
    const response = await handleRequest(
      new Request(
        url(
          `/api/calendar?${new URLSearchParams({ address: person.address, ...extra })}`,
        ),
      ),
      env,
    );
    assert.ok([400, 404].includes(response.status));
  }
  const all = await handleRequest(
    new Request(url(`/api/calendar?address=${encodeURIComponent(person.address)}`)), env,
  );
  assert.equal((await all.text()).match(/BEGIN:VEVENT/g).length, 12);
});

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
  assert.match(output, /SUMMARY:/);
  assert.ok(!output.includes("PRIMER"));
  const response = await handleRequest(
    new Request(url("/api/calendar?address=Tr%C5%BEa%C5%A1ka%20cesta%201%2C%20Vrhnika")), calendarFixture().env,
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

test("empty configured routes never generate invented public collection dates", async () => {
 const env={DB:{prepare:()=>({bind(){return this;},first:async()=>({value:'{"routes":[]}'})})}};
 for(const route of ["collection","calendar"]) {
 const response=await handleRequest(new Request(url('/api/'+route+'?address=Vrhnika')),env);
 assert.equal(response.status,422);
 assert.ok((await response.json()).error.includes('zanesljivo'));
 }
});

test("calendar event UID stays stable when an editor reschedules an existing event", () => {
 const original={address:"Verd 12, Vrhnika",events:[{id:"route-event-1",date:"2026-11-03",label:"Odvoz BIO"}]};
 const shifted={...original,events:[{...original.events[0],date:"2026-11-04"}]};
 const uid=value=>calendar(value).split("\r\n").find(line=>line.startsWith("UID:"));
 assert.equal(uid(original),uid(shifted));
 assert.notEqual(calendar(original).match(/DTSTART[^\r]+/)[0],calendar(shifted).match(/DTSTART[^\r]+/)[0]);
});
