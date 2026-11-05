const DAY = 86_400_000;
const weekdayCodes = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];
const timestamp = (date) => Date.parse(`${date}T12:00:00Z`);
const compact = (date) => date.replaceAll("-", "");

/** A recurrence is a finite set of published dates, never an assumed interval. */
export function publishedCalendarSeries(events, selectedId) {
  const selected = events.find((event) => event.id === selectedId);
  if (!selected) return [];
  return [
    ...new Map(
      events
        .filter(
          (event) =>
            event.type === selected.type && event.date >= selected.date,
        )
        .sort((a, b) => a.date.localeCompare(b.date))
        .map((event) => [event.date, event]),
    ).values(),
  ];
}

/** RRULE + EXDATE works in calendar apps that do not import RDATE reliably.
 * Every possible date in the bounded rule is either published or excluded.
 */
export function publishedRecurrence(dates) {
  const ordered = [...new Set(dates)].sort();
  if (ordered.length < 2) return [];
  const first = timestamp(ordered[0]),
    last = timestamp(ordered.at(-1));
  if (
    !Number.isFinite(first) ||
    !Number.isFinite(last) ||
    last - first > 3660 * DAY
  )
    throw Error("Obdobje koledarja ni veljavno.");
  const included = new Set(ordered);
  const weekdays = [
    ...new Set(ordered.map((date) => new Date(timestamp(date)).getUTCDay())),
  ].sort();
  const excluded = [];
  for (let day = first; day <= last; day += DAY) {
    const date = new Date(day);
    const value = date.toISOString().slice(0, 10);
    if (weekdays.includes(date.getUTCDay()) && !included.has(value))
      excluded.push(compact(value));
  }
  return [
    `RRULE:FREQ=WEEKLY;BYDAY=${weekdays.map((day) => weekdayCodes[day]).join(",")};UNTIL=${compact(ordered.at(-1))}`,
    ...(excluded.length ? [`EXDATE;VALUE=DATE:${excluded.join(",")}`] : []),
  ];
}
