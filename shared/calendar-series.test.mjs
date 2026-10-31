import test from "node:test";
import assert from "node:assert/strict";
import {
  publishedCalendarSeries,
  publishedRecurrence,
} from "./calendar-series.js";

// Expand the standard output as a receiving calendar does, independently from
// the helper's excluded-date calculation. Includes both endpoints and DTSTART.
function expand(start, lines) {
  if (!lines.length) return [start];
  const rule = Object.fromEntries(
    lines[0]
      .slice(6)
      .split(";")
      .map((item) => item.split("=")),
  );
  const codes = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];
  const exceptions = new Set(
    (lines.find((line) => line.startsWith("EXDATE")) || ":")
      .split(":")[1]
      .split(","),
  );
  const result = [];
  for (let stamp = Date.parse(start + "T12:00:00Z"); ; stamp += 86400000) {
    const date = new Date(stamp),
      iso = date.toISOString().slice(0, 10),
      compact = iso.replaceAll("-", "");
    if (compact > rule.UNTIL) break;
    if (
      rule.BYDAY.split(",").includes(codes[date.getUTCDay()]) &&
      !exceptions.has(compact)
    )
      result.push(iso);
  }
  return result;
}

test("published recurrence preserves holidays, changing intervals, moved weekdays and DST", () => {
  for (const dates of [
    ["2027-03-15", "2027-03-22", "2027-04-06", "2027-04-19", "2027-05-03"],
    ["2026-12-04", "2027-01-04", "2027-01-15"],
    ["2027-10-18", "2027-11-01", "2027-11-15"],
    ["2028-02-28", "2028-02-29", "2028-03-06"],
  ])
    assert.deepEqual(expand(dates[0], publishedRecurrence(dates)), dates);
  assert.deepEqual(publishedRecurrence(["2027-03-15"]), []);
});

test("series includes only selected type and dates on or after the selected occurrence", () => {
  const events = [
    { id: "old", type: "bio", date: "2027-03-01" },
    { id: "first", type: "bio", date: "2027-03-15" },
    { id: "other", type: "packaging", date: "2027-03-22" },
    { id: "last", type: "bio", date: "2027-04-06" },
    { id: "duplicate", type: "bio", date: "2027-04-06" },
  ];
  assert.deepEqual(
    publishedCalendarSeries(events, "first").map((e) => e.date),
    ["2027-03-15", "2027-04-06"],
  );
  assert.deepEqual(
    publishedCalendarSeries(events, "last").map((e) => e.date),
    ["2027-04-06"],
  );
  assert.deepEqual(publishedCalendarSeries(events, "missing"), []);
});
