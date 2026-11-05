import test from "node:test";
import assert from "node:assert/strict";
import { calendarLinks } from "./calendar-links.js";

const options = {
  event: { id: "bio-1", label: "Biološki odpadki", type: "bio", date: "2026-11-03" },
  address: "Private address 12, Vrhnika", routeId: "published-route", today: "2026-11-01",
};
test("calendar providers use the actual published origin after a domain change", () => {
  const links = calendarLinks({ ...options, origin: "https://portal.example.si/" });
  assert.equal(new URL(links.once.apple).origin, "https://portal.example.si");
  const google = new URL(links.once.google);
  assert.match(google.searchParams.get("details"), /https:\/\/portal\.example\.si\/odpadki\/urnik/);
  const googleSubscription=new URL(links.upcoming.google);
  assert.equal(googleSubscription.pathname, "/calendar/render");
  assert.equal(new URL(googleSubscription.searchParams.get('cid')).protocol,'webcal:');
  assert.equal(new URL(googleSubscription.searchParams.get('cid')).host,'portal.example.si');
  assert.equal(new URL(links.googleFromUrl).pathname,'/calendar/r/settings/addbyurl');
  const subscription = new URL(links.feed);
  assert.equal(subscription.origin, "https://portal.example.si");
  assert.equal(subscription.searchParams.get("route"), "published-route");
  assert.equal(subscription.searchParams.get("type"), "bio");
  assert.equal(new URL(new URL(links.upcoming.outlook).searchParams.get("url")).origin, "https://portal.example.si");
  assert.match(links.upcoming.apple, /^webcal:\/\/portal\.example\.si\//);
  assert.equal(new URL(links.feed).searchParams.get("address"), null);
});
test("local previews retain local calendar endpoints and invalid explicit origins are rejected", () => {
  assert.equal(new URL(calendarLinks({ ...options, origin: "http://127.0.0.1:5173" }).feed).origin, "http://127.0.0.1:5173");
  assert.throws(() => calendarLinks({ ...options, origin: "javascript:alert(1)" }));
  assert.throws(() => calendarLinks({ ...options, origin: "http://public.example" }));
  assert.throws(() => calendarLinks({ ...options, origin: "https://user:password@public.example" }));
});
