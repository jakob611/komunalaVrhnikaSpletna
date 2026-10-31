const ORIGIN = "https://kpv.jakobtominc.com";
const nextDay = (date) =>
  new Date(Date.parse(date + "T12:00:00Z") + 86400000)
    .toISOString()
    .slice(0, 10);
/** Provider links keep event creation and calendar subscription distinct. */
export function calendarLinks({
  event,
  address,
  routeId,
  outlookWork = false,
  today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Ljubljana",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date()),
}) {
  const title = `Odvoz: ${event.label}`;
  const description =
    "Objavljeni termin odvoza KPV. Spremembe preverite na " +
    ORIGIN +
    "/odpadki/urnik.";
  const google = new URLSearchParams({
    action: "TEMPLATE",
    text: title,
    dates:
      event.date.replaceAll("-", "") +
      "/" +
      nextDay(event.date).replaceAll("-", ""),
    details: description,
    location: address,
  });
  const microsoftHost = outlookWork ? "outlook.office.com" : "outlook.live.com";
  const outlook = new URLSearchParams({
    path: "/calendar/action/compose",
    rru: "addevent",
    subject: title,
    startdt: event.date + "T00:00:00",
    enddt: nextDay(event.date) + "T00:00:00",
    allday: "true",
    body: description,
    location: address,
  });
  const once =
    ORIGIN +
    "/api/calendar?" +
    new URLSearchParams({
      address,
      eventId: event.id,
      date: event.date,
      repeat: "once",
    });
  const feed = routeId
    ? ORIGIN +
      "/api/calendar/feed?" +
      new URLSearchParams({ route: routeId, type: event.type, from: today })
    : null;
  return {
    once: {
      google: "https://calendar.google.com/calendar/render?" + google,
      apple: once,
      outlook: `https://${microsoftHost}/calendar/0/deeplink/compose?${outlook}`,
      other: once,
    },
    upcoming: feed
      ? {
          google:
            "https://calendar.google.com/calendar/u/0/r?" +
            new URLSearchParams({ cid: feed }),
          apple: feed.replace(/^https:/, "webcal:"),
          outlook:
            `https://${microsoftHost}/calendar/0/addfromweb/?` +
            new URLSearchParams({ url: feed, name: `KPV – ${event.label}` }),
          other: feed.replace(/^https:/, "webcal:"),
        }
      : null,
    feed,
  };
}
