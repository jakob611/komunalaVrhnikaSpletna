import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CalendarDialog } from "../components/CalendarDialog";

const events = [
  {
    id: "first",
    date: "2090-11-03",
    type: "bio",
    label: "Biološki odpadki",
    color: "#234",
  },
  {
    id: "second",
    date: "2090-11-17",
    type: "bio",
    label: "Biološki odpadki",
    color: "#234",
  },
  {
    id: "other",
    date: "2090-11-10",
    type: "packaging",
    label: "Embalaža",
    color: "#432",
  },
];
function show() {
  return render(
    <CalendarDialog
      event={events[1]}
      events={events}
      address="Zasebni naslov 1, Vrhnika"
      routeId="audit-route"
      onClose={() => {}}
    />,
  );
}
const urlFor = (name: RegExp) =>
  new URL(screen.getByRole("link", { name }).getAttribute("href")!);
describe("calendar provider shortcuts preserve the easy path", () => {
  it("keeps Google creation direct and repeats through provider subscription without file import", () => {
    show();
    const once = urlFor(/^Odpri Google/);
    expect(once.hostname).toBe("calendar.google.com");
    expect(once.searchParams.get("action")).toBe("TEMPLATE");
    expect(once.searchParams.get("dates")).toBe("20901117/20901118");
    fireEvent.click(screen.getByLabelText(/Vključi tudi prihodnje/));
    const repeat = urlFor(/^Odpri Google/),
      feed = new URL(repeat.searchParams.get("cid")!);
    expect(repeat.hostname).toBe("calendar.google.com");
    expect(feed.pathname).toBe("/api/calendar/feed");
    expect(feed.searchParams.get("route")).toBe("audit-route");
    expect(feed.searchParams.get("type")).toBe("bio");
    expect(feed.searchParams.get("address")).toBeNull();
    expect(feed.searchParams.get("eventId")).toBeNull();
    expect(repeat.href).not.toContain("Zasebni");
    expect(feed.searchParams.get("from")).not.toBe(events[1].date);
    fireEvent.click(screen.getByText(/Trenutno objavljeni datumi/));
    expect(screen.getAllByText(/3\. november 2090/)).toHaveLength(1);
    expect(screen.queryByText("Embalaža")).toBeNull();
    expect(screen.queryByText(/Nastavitve → Uvoz/)).toBeNull();
  });
  it("opens the right Outlook account and Apple native subscription rather than presenting download as the primary action", () => {
    show();
    fireEvent.click(screen.getByLabelText(/^Outlook/));
    const once = urlFor(/^Odpri Outlook$/);
    expect(once.pathname).toContain("/deeplink/compose");
    expect(once.searchParams.get("allday")).toBe("true");
    fireEvent.click(screen.getByLabelText(/Službeni ali šolski/));
    expect(urlFor(/^Odpri Outlook$/).hostname).toBe("outlook.office.com");
    fireEvent.click(screen.getByLabelText(/Vključi tudi prihodnje/));
    const repeat = urlFor(/^Odpri Outlook$/);
    expect(repeat.pathname).toContain("/addfromweb/");
    expect(
      new URL(repeat.searchParams.get("url")!).searchParams.get("route"),
    ).toBe("audit-route");
    fireEvent.click(screen.getByLabelText(/^Apple Koledar/));
    expect(urlFor(/^Odpri Apple/).protocol).toBe("webcal:");
    fireEvent.click(screen.getByLabelText(/Vključi tudi prihodnje/));
    expect(urlFor(/^Odpri Apple/).pathname).toBe("/api/calendar");
    expect(screen.getByLabelText(/^Drug koledar/)).toBeTruthy();
  });
});
