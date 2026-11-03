import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "../App";
import { ServicesPage } from "../pages/ServicePages";
import SubscriptionForm from "../components/SubscriptionForm";
import { CollectionPage } from "../pages/WastePages";
import { CalendarDialog } from "../components/CalendarDialog";
import { SiteContentProvider } from "../content/SiteContent";
import defaults from "../../shared/site-defaults.json";
import { addressApiResponse } from "./address-fixtures";

vi.mock("../components/BotProtection", () => ({ default: () => null, resetProtection: vi.fn() }));
const address = "Verd 12, Vrhnika";
const event = { id: "handoff-bio", date: "2090-11-03", type: "bio", label: "BIO handoff", color: "#123456" };
function Location() { const { pathname, search } = useLocation(); return <output data-testid="public-location">{pathname + search}</output>; }
beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    const addressResponse = addressApiResponse(url); if (addressResponse) return addressResponse;
    if (url === "/api/notices") return Response.json({ notices: [] });
    return Response.json({ address, events: [event], complete: true, routes: { bio: { id: "verified-bio-route", name: "Verd", lastDate: "2090-11-03" } } });
  }));
});

describe("address continuity without unnecessary repeated entry", () => {
  it.each(["/", "/moj-dom"])("rejects a whitespace-only personal address on %s before persisting or looking it up", async route => {
    render(<MemoryRouter initialEntries={[route]}><App/></MemoryRouter>);
    const field = screen.getByLabelText(route === "/" ? "Vaš naslov" : "Naslov vašega doma");
    fireEvent.change(field, { target: { value: "      " } });
    fireEvent.submit(field.closest("form")!);
    await screen.findByRole("alert");
    expect(localStorage.getItem("kpv-address")).toBeNull();
    expect(vi.mocked(fetch).mock.calls.some(([url]) => String(url).startsWith("/api/collection"))).toBe(false);
  });
  it("passes MyHome's address to the complete collection schedule when storage is blocked and opens it directly", async () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new DOMException("Denied", "SecurityError"); });
    render(<MemoryRouter initialEntries={[{ pathname: "/moj-dom", state: { initialAddress: address, storageUnavailable: true } }]}><App/><Location/></MemoryRouter>);
    await screen.findByText(event.label);
    fireEvent.click(screen.getByRole("link", { name: "Celoten urnik" }));
    await screen.findByRole("heading", { name: address });
    expect((screen.getByLabelText("Ulica, hišna številka in kraj") as HTMLInputElement).value).toBe(address);
    expect(screen.getByTestId("public-location").textContent).toBe("/odpadki/urnik");
    expect(screen.getByText(event.label)).toBeTruthy();
    expect(vi.mocked(fetch).mock.calls.filter(([url]) => String(url).startsWith("/api/collection"))).toHaveLength(2);
  });
  it("opens a previously remembered collection address on entry without another submit click", async () => {
    localStorage.setItem("kpv-address", address);
    render(<MemoryRouter initialEntries={["/odpadki/urnik"]}><CollectionPage/></MemoryRouter>);
    await screen.findByText(event.label);
    expect(vi.mocked(fetch).mock.calls.filter(([url]) => String(url).startsWith("/api/collection"))).toHaveLength(1);
    expect(vi.mocked(fetch).mock.calls.some(([url]) => String(url).startsWith("/api/addresses?address="))).toBe(true);
  });
  it("clearly distinguishes an edited personal address from the still displayed saved-address schedule", async () => {
    localStorage.setItem("kpv-address", address);
    render(<MemoryRouter initialEntries={["/moj-dom"]}><App/></MemoryRouter>);
    await screen.findByText(event.label);
    fireEvent.change(screen.getByLabelText("Naslov vašega doma"), { target: { value: "Borovnica 1, Borovnica" } });
    expect(screen.getByText(/Prikazani odvozi še veljajo za Verd 12/)).toBeTruthy();
    expect(vi.mocked(fetch).mock.calls.filter(([url]) => String(url).startsWith("/api/collection"))).toHaveLength(1);
  });
  it("reuses a subscription address only on request and derives its municipality after verification", async () => {
    localStorage.setItem("kpv-address", address);
    render(<MemoryRouter><SubscriptionForm/></MemoryRouter>);
    const field = screen.getByLabelText(/Ulica ali naselje, hišna številka in kraj/) as HTMLInputElement;
    expect(field.value).toBe("");
    fireEvent.click(screen.getByRole("button", { name: `Uporabi shranjeni naslov: ${address}` }));
    expect(field.value).toBe(address);
    expect(screen.getByText("Določena bo po izbiri naslova.")).toBeTruthy();
    await screen.findByText("Občina Vrhnika");
    expect(vi.mocked(fetch).mock.calls[0][0]).toBe(`/api/addresses?address=${encodeURIComponent(address).replace(/%20/g, "+")}`);
    expect(screen.queryByRole("combobox", {name: "Območje obveščanja"})).toBeNull();
  });
  it("restores the remembered service execution address without erasing the inquiry details", () => {
    localStorage.setItem("kpv-address", address);
    render(<MemoryRouter><ServicesPage/></MemoryRouter>);
    const field = screen.getByLabelText("Naslov izvedbe") as HTMLInputElement;
    const message = screen.getByLabelText("Katere predmete želite oddati?") as HTMLTextAreaElement;
    fireEvent.change(field, { target: { value: "Druga lokacija" } });
    fireEvent.change(message, { target: { value: "Kavč in dva stola za odvoz." } });
    fireEvent.click(screen.getByRole("button", { name: `Uporabi shranjeni naslov: ${address}` }));
    expect(field.value).toBe(address);
    expect(message.value).toBe("Kavč in dva stola za odvoz.");
  });
});

it("searches published notice text and custom page bodies rather than only route names", async () => {
  const sections = structuredClone(defaults);
  sections.notices = [{ id: "water-closure", title: "Dela v Verdu", summary: "Začasna prekinitev zaradi menjave ventila", area: "Verd", category: "water", date: "2026-11-02", status: "active", published: true, latitude: null, longitude: null }] as never;
  sections.layout.pages = [{ path: "/strani/priprava", title: "Pred obiskom", blocks: [{ id: "directions", type: "text", title: "Priprava materiala", text: "Odstranite baterije iz naprave", hidden: false, tone: "plain", align: "left", width: "wide", links: [] }] }] as never;
  vi.stubGlobal("fetch", vi.fn(async (url: string) => url === "/api/content" ? Response.json({ sections, revisions: {} }) : Response.json({ notices: [] })));
  render(<MemoryRouter><SiteContentProvider><App/></SiteContentProvider></MemoryRouter>);
  fireEvent.click(await screen.findByRole("button", { name: "Išči po portalu" }));
  fireEvent.change(screen.getByLabelText("Iskalni niz"), { target: { value: "menjave ventila" } });
  expect(screen.getByRole("link", { name: /Dela v Verdu/ }).getAttribute("href")).toBe("/obvestila#water-closure");
  fireEvent.change(screen.getByLabelText("Iskalni niz"), { target: { value: "odstranite baterije" } });
  expect(screen.getByRole("link", { name: /Pred obiskom/ }).getAttribute("href")).toBe("/strani/priprava");
});

it("explains why future-calendar subscription is unavailable when the collection route is not confirmed", () => {
  render(<CalendarDialog event={event} events={[event]} address={address} onClose={()=>{}}/>);
  expect((screen.getByLabelText(/Vključi tudi prihodnje odvoze/) as HTMLInputElement).disabled).toBe(true);
  expect(screen.getByText(/Naročnina na prihodnje termine je na voljo, ko je potrjeno odvozno območje/)).toBeTruthy();
  expect(screen.getByRole("link", { name: /^Odpri Google/ })).toBeTruthy();
});
