import { describe, it, expect, vi } from "vitest";
import { act, render, screen, fireEvent } from "@testing-library/react";
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
function show(routeId: string | undefined = "audit-route", onClose = () => {}) {
  return render(
    <CalendarDialog
      event={events[1]}
      events={events}
      address="Zasebni naslov 1, Vrhnika"
      routeId={routeId || undefined}
      onClose={onClose}
    />,
  );
}
const urlFor = (name: RegExp) =>
  new URL(screen.getByRole("link", { name }).getAttribute("href")!);
describe("calendar provider shortcuts preserve the easy path", () => {
  it("keeps Google single-event creation direct and subscribes with its provider-verified webcal shortcut", () => {
    show();
    const once = urlFor(/^Odpri Google/);
    expect(once.hostname).toBe("calendar.google.com");
    expect(once.searchParams.get("action")).toBe("TEMPLATE");
    expect(once.searchParams.get("dates")).toBe("20901117/20901118");
    fireEvent.click(screen.getByLabelText(/Vključi tudi prihodnje/));
    const repeat = urlFor(/^Odpri Google/),
      feed = new URL(repeat.searchParams.get('cid')!);
    expect(repeat.hostname).toBe("calendar.google.com");
    expect(repeat.pathname).toBe('/calendar/render');
    expect(feed.protocol).toBe('webcal:');
    expect(feed.host).toBe(window.location.host);
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
  it('copies the exact route feed for Google and recovers when browser clipboard access fails',async()=>{
    const writeText=vi.fn().mockRejectedValueOnce(Error('Permission denied')).mockResolvedValue(undefined);
    vi.stubGlobal('navigator',{userAgent:'QA desktop',clipboard:{writeText}});
    show();fireEvent.click(screen.getByLabelText(/Vključi tudi prihodnje/));
    fireEvent.click(screen.getByText('Če Google ne doda koledarja'));
    const field=screen.getByLabelText('Povezava do urnika') as HTMLInputElement;
    expect(field.readOnly).toBe(true);
    fireEvent.click(screen.getByRole('button',{name:'Kopiraj povezavo'}));
    expect(await screen.findByRole('alert')).toHaveProperty('textContent',expect.stringContaining('Samodejno kopiranje ni uspelo'));
    expect(urlFor(/^Odpri dodajanje/).pathname).toBe('/calendar/r/settings/addbyurl');
    fireEvent.click(screen.getByRole('button',{name:'Kopiraj povezavo'}));
    await screen.findByText(/Povezava je kopirana/);
    expect(writeText).toHaveBeenLastCalledWith(field.value);
    expect(field.value).not.toContain('Zasebni');
    expect(screen.queryByRole('alert')).toBeNull();
  });
  it('does not show a late copy result after switching calendar providers',async()=>{
    let complete!:()=>void;
    vi.stubGlobal('navigator',{userAgent:'QA desktop',clipboard:{writeText:vi.fn(()=>new Promise<void>(resolve=>{complete=resolve;}))}});
    show();fireEvent.click(screen.getByLabelText(/Vključi tudi prihodnje/));
    fireEvent.click(screen.getByText('Če Google ne doda koledarja'));
    fireEvent.click(screen.getByRole('button',{name:'Kopiraj povezavo'}));
    fireEvent.click(screen.getByLabelText(/^Outlook/));
    await act(async () => complete());
    expect(screen.queryByText(/Povezava je kopirana/)).toBeNull();
    fireEvent.click(screen.getByLabelText(/^Google Koledar/));
    expect(screen.queryByText(/Povezava je kopirana/)).toBeNull();
  });
  it("opens the right Outlook account and Apple native subscription rather than presenting download as the primary action", () => {
    show();
    fireEvent.click(screen.getByLabelText(/^Outlook/));
    const once = urlFor(/^Odpri Outlook$/);
    expect(once.hostname).toBe("outlook.live.com");
    expect(once.pathname).toContain("/deeplink/compose");
    expect(once.searchParams.get("allday")).toBe("true");
    expect(once.searchParams.get("startdt")).toBe("2090-11-17T00:00:00");
    expect(once.searchParams.get("enddt")).toBe("2090-11-18T00:00:00");
    fireEvent.click(screen.getByLabelText(/Vključi tudi prihodnje/));
    expect(urlFor(/^Odpri Outlook$/).hostname).toBe("outlook.live.com");
    fireEvent.click(screen.getByLabelText(/Službeni ali šolski/));
    expect(urlFor(/^Odpri Outlook$/).hostname).toBe("outlook.office.com");
    const repeat = urlFor(/^Odpri Outlook$/);
    expect(repeat.pathname).toContain("/addfromweb/");
    expect(
      new URL(repeat.searchParams.get("url")!).searchParams.get("route"),
    ).toBe("audit-route");
    fireEvent.click(screen.getByLabelText(/^Apple Koledar/));
    expect(urlFor(/^Odpri Apple/).protocol).toBe("webcal:");
    fireEvent.click(screen.getByLabelText(/Vključi tudi prihodnje/));
    expect(urlFor(/^Odpri Apple/).pathname).toBe("/api/calendar");
    fireEvent.click(screen.getByLabelText(/^Drug koledar/));
    expect(urlFor(/^Odpri izbrani koledar/).searchParams.get("eventId")).toBe("second");
    fireEvent.click(screen.getByLabelText(/Vključi tudi prihodnje/));
    expect(urlFor(/^Odpri izbrani koledar/).protocol).toBe("webcal:");
    fireEvent.click(screen.getByText("Prenos datoteke za koledar"));
    const download = urlFor(/^Prenesi datoteko za koledar$/);
    expect(download.origin).toBe(window.location.origin);
    expect(download.pathname).toBe("/api/calendar/feed");
    expect(download.searchParams.has("address")).toBe(false);
  });
  it("offers a single date if no route is confirmed and closes with Escape", () => {
    const close = vi.fn();
    show("", close);
    expect((screen.getByLabelText(/Vključi tudi prihodnje/) as HTMLInputElement).disabled).toBe(true);
    expect(urlFor(/^Odpri Google/).searchParams.get("action")).toBe("TEMPLATE");
    fireEvent.keyDown(document, { key: "Escape" });
    expect(close).toHaveBeenCalledOnce();
  });
});
