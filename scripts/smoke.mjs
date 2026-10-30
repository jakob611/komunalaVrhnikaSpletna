// Creates explicitly marked demonstration records; never sends email or charges money.
import assert from "node:assert/strict";
const base = (process.argv[2] || "http://127.0.0.1:5173").replace(/\/$/, "");
const person = {
  name: "Test portala",
  email: "portal-test@example.com",
  address: "Verd 12, Vrhnika",
  phone: "040000000",
  consent: true,
};
const testDate = new Date();
testDate.setUTCDate(testDate.getUTCDate() + 30);
const health = await fetch(`${base}/api/health`).then((r) => r.json());
assert.equal(health.ok, true);
assert.notEqual(health.storage, "unavailable");
const schedule = await fetch(
  `${base}/api/collection?address=${encodeURIComponent(person.address)}`,
).then((r) => r.json());
assert.equal(schedule.demo, false);
assert.equal(schedule.complete, true);
assert.ok(schedule.events.length > 0);
const calendar = await fetch(`${base}/api/calendar?address=${encodeURIComponent(person.address)}`).then((r) =>
  r.text(),
);
assert.ok(calendar.includes("BEGIN:VCALENDAR") && calendar.includes("BEGIN:VEVENT") && !calendar.includes("PRIMER"));
const checks = [
  ["/api/subscriptions", { ...person, topics: ["water", "roads"], districtId: "vrhnika" }],
  [
    "/api/requests",
    {
      ...person,
      service: "bulky",
      message: "Preizkus oddaje ob vzpostavitvi portala.",
      preferredDate: "",
    },
  ],
  [
    "/api/contact",
    {
      ...person,
      category: "other",
      subcategory: "",
      subject: "Test kontaktnega obrazca",
      message: "Predstavitveno sporočilo za preverjanje shranjevanja.",
    },
  ],
  [
    "/api/market",
    {
      ...person,
      date: testDate.toISOString().slice(0, 10),
      stallType: "standard",
      products: "Predstavitveni izdelki za preizkus prijave.",
    },
  ],
];
for (const [route, body] of checks) {
  const response = await fetch(base + route, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: base },
    body: JSON.stringify(body),
  });
  const result = await response.json();
  if (health.botProtection === "turnstile") {
    assert.equal(response.status, 403, JSON.stringify(result));
    console.log(
      `PASS ${route} · blocks requests without a browser verification token`,
    );
  } else {
    assert.equal(response.status, 201, JSON.stringify(result));
    assert.equal(result.status, route === "/api/subscriptions" ? "confirmation-required" : "demo-saved");
    assert.ok(result.id.startsWith("KPV-"));
    console.log(`PASS ${route} · stored local demo receipt`);
  }
}
const form = new FormData();
for (const [key, value] of Object.entries(person)) form.set(key, String(value));
form.set("category", "lighting");
form.set("description", "Predstavitvena prijava luči s testno fotografijo.");
form.set("latitude", "45.963");
form.set("longitude", "14.298");
form.set(
  "photo",
  new Blob(
    [
      Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jS1kAAAAASUVORK5CYII=",
        "base64",
      ),
    ],
    { type: "image/png" },
  ),
  "test.png",
);
const report = await fetch(`${base}/api/reports`, {
  method: "POST",
  headers: { Origin: base },
  body: form,
});
assert.equal(
  report.status,
  health.botProtection === "turnstile" ? 403 : 201,
  await report.text(),
);
const blocked = await fetch(`${base}/api/subscriptions`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Origin: "https://example.org",
  },
  body: JSON.stringify({ ...person, topics: ["water"] }),
});
assert.equal(blocked.status, 403);
console.log(
  health.botProtection === "turnstile"
    ? "PASS photo upload requires browser verification"
    : "PASS photo attachment · local private storage",
);
console.log("PASS cross-origin protection, collection and calendar");
console.log(`Verified ${base} · ${health.storage}`);
