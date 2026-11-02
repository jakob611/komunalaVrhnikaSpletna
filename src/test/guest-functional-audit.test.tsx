import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import defaults from "../../shared/site-defaults.json";
import App from "../App";
import { CollectionPage, WasteMapPage, WasteWizardPage } from "../pages/WastePages";
import { ContactPage, MarketPage, NoticesPage, ReportPage, ServicesPage } from "../pages/ServicePages";
import SubscriptionForm from "../components/SubscriptionForm";
import SubscriptionPage from "../pages/SubscriptionPage";
import CemeteryPage from "../pages/CemeteryPage";
import UtilityCalculator from "../components/UtilityCalculator";
import type { SiteData } from "../content/SiteContent";

const state = vi.hoisted(() => ({ sections: {} as SiteData }));
vi.mock("../content/SiteContent", async () => {
  const actual = await vi.importActual<typeof import("../content/SiteContent")>("../content/SiteContent");
  return { ...actual, useSiteContent: () => state.sections };
});
// These tests exercise guest application flows with controlled API responses. They do not
// represent Turnstile, map tile delivery, physical GPS, email inbox, or provider-account QA.
vi.mock("../components/BotProtection", () => ({ default: () => null, resetProtection: vi.fn() }));

const notices = [
  { id: "water-one", title: "Water works", summary: "Water supply interruption", category: "water", area: "Verd", date: "2026-11-01", status: "active", latitude: null, longitude: null },
  { id: "general-one", title: "Office opening announcement", summary: "Changed office opening hours", category: "general", area: "Vrhnika", date: "2026-11-01", status: "info", latitude: null, longitude: null },
];
const event = { id: "bio-one", date: "2090-11-03", type: "bio", label: "BIO guest audit", color: "#123456" };
const response = (body: unknown, status = 200) => Response.json(body, { status });
function Location() { return <output data-testid="guest-location">{JSON.stringify(useLocation())}</output>; }
function show(node: React.ReactNode, route = "/") {
  return render(<MemoryRouter initialEntries={[route]}>{node}<Location/></MemoryRouter>);
}
beforeEach(() => {
  state.sections = structuredClone(defaults) as unknown as SiteData;
  localStorage.clear();
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    if (url.startsWith("/api/notices")) return response({ notices });
    if (url.startsWith("/api/collection")) return response({ address: "Verd 12, Vrhnika", events: [event], complete: true });
    return response({ id: "audit-receipt", message: "Submission saved for handling" });
  }));
});

describe("guest navigation and personal starting point", () => {
  it("G01 opens/closes a native submenu with keyboard and restores its trigger focus", async () => {
    show(<App/>);
    const button = screen.getByRole("button", { name: "Možnosti: Odpadki" });
    fireEvent.keyDown(button, { key: "ArrowDown" });
    await waitFor(() => expect(button.getAttribute("aria-expanded")).toBe("true"));
    const submenu = document.getElementById(button.getAttribute("aria-controls")!)!;
    await waitFor(() => expect(submenu.contains(document.activeElement)).toBe(true));
    fireEvent.keyDown(document.activeElement!, { key: "Escape" });
    expect(button.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(button);
  });
  it("G02 searches diacritic-insensitively, includes custom titles, handles no result and restores focus on Escape", async () => {
    state.sections.layout.pages = [{ path: "/strani/ciscenje", title: "Čiščenje posebnih površin", blocks: [] }];
    show(<App/>);
    const opener = screen.getByRole("button", { name: "Išči po portalu" });
    opener.focus(); fireEvent.click(opener);
    const search = screen.getByRole("textbox", { name: "Iskalni niz" });
    fireEvent.change(search, { target: { value: "ciscenje povrsin" } });
    expect(screen.getByRole("link", { name: /Čiščenje posebnih površin/ }).getAttribute("href")).toBe("/strani/ciscenje");
    fireEvent.change(search, { target: { value: "not-a-real-result-938" } });
    expect(screen.getByText(/Ni zadetkov. Poskusite/)).toBeTruthy();
    fireEvent.keyDown(search, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(opener);
  });
  it("G03 mobile menu control toggles state and navigation closes it (DOM state only)", async () => {
    show(<App/>);
    fireEvent.click(screen.getByRole("button", { name: "Odpri meni" }));
    expect(screen.getByRole("button", { name: "Zapri meni" }).getAttribute("aria-expanded")).toBe("true");
    fireEvent.click(within(screen.getByRole("navigation", { name: "Glavna navigacija" })).getByRole("link", { name: /^O podjetju$/ }));
    await screen.findByRole("heading", { level: 1, name: /Za okolje/ });
    await waitFor(() => expect(document.querySelector(".menu-toggle")?.getAttribute("aria-expanded")).toBe("false"));
  });
  it("G04 general homepage announcements must not be labeled as waste notices", async () => {
    show(<App/>);
    const card = await screen.findByRole("link", { name: /Office opening announcement/ });
    expect(card.textContent).toContain("SPLOŠNO");
    expect(card.textContent).not.toContain("ODPADKI");
  });
  it("G05 saves a personal address, shows its fetched events and forgets the address", async () => {
    show(<App/>, "/moj-dom");
    expect(screen.queryByText(event.label)).toBeNull();
    fireEvent.change(screen.getByLabelText("Naslov vašega doma"), { target: { value: "Verd 12, Vrhnika" } });
    fireEvent.click(screen.getByRole("button", { name: "Shrani naslov" }));
    await screen.findByText(event.label);
    expect(localStorage.getItem("kpv-address")).toBe("Verd 12, Vrhnika");
    fireEvent.click(screen.getByRole("button", { name: "Pozabi naslov" }));
    expect(localStorage.getItem("kpv-address")).toBeNull();
    expect(screen.queryByText(event.label)).toBeNull();
  });
  it("G06 MyHome must explain when the browser refuses to remember an address", async () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new DOMException("Denied", "SecurityError"); });
    show(<App/>, "/moj-dom");
    fireEvent.change(screen.getByLabelText("Naslov vašega doma"), { target: { value: "Verd 12, Vrhnika" } });
    fireEvent.click(screen.getByRole("button", { name: "Shrani naslov" }));
    await screen.findByText(event.label);
    expect(screen.getByText(/Brskalnik.*shranjevan/)).toBeTruthy();
  });
  it("G07 personal schedule failures offer retry without keeping old events", async () => {
    localStorage.setItem("kpv-address", "Verd 12, Vrhnika");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(response({ error: "Schedule unavailable" }, 503))
      .mockResolvedValueOnce(response({ events: [event], complete: false, message: "Only BIO is confirmed" })));
    show(<App/>, "/moj-dom");
    await screen.findByText("Schedule unavailable");
    expect(screen.queryByText(event.label)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Poskusi znova" }));
    await screen.findByText(event.label);
    expect(screen.getByText("Only BIO is confirmed")).toBeTruthy();
  });
});

describe("published information and self-service", () => {
  it("G08 notice category and text filters produce a useful empty state and recover", async () => {
    show(<NoticesPage/>, "/obvestila?category=water");
    await screen.findByRole("heading", { name: "Water works" });
    expect(screen.queryByRole("heading", { name: "Office opening announcement" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Vsa obvestila" }));
    await screen.findByRole("heading", { name: "Office opening announcement" });
    fireEvent.change(screen.getByLabelText("Poišči kraj ali obvestilo"), { target: { value: "no-matching-town" } });
    expect(screen.getByText("Ni obvestil za izbrani filter.")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Poišči kraj ali obvestilo"), { target: { value: "VERD" } });
    expect(screen.getByRole("heading", { name: "Water works" })).toBeTruthy();
  });
  it("G09 notice API failure is explicit and retry loads real content", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValueOnce(new TypeError("offline")).mockResolvedValueOnce(response({ notices })));
    show(<NoticesPage/>, "/obvestila");
    await screen.findByRole("alert");
    expect(screen.queryByRole("heading", { name: "Water works" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Poskusi znova" }));
    await screen.findByRole("heading", { name: "Water works" });
  });
  it("G10 subscription signup explains confirmation and submits chosen topics/address only after choices", async () => {
    show(<SubscriptionForm/>, "/obvestila");
    const button = screen.getByRole("button", { name: "Pošlji potrditveno povezavo" });
    expect(button.matches(":disabled")).toBe(true);
    fireEvent.change(screen.getByLabelText("Ime in priimek"), { target: { value: "Audit Visitor" } });
    fireEvent.change(screen.getByLabelText("E-poštni naslov"), { target: { value: "audit@example.invalid" } });
    fireEvent.change(screen.getByLabelText("Območje obveščanja"), { target: { value: "vrhnika" } });
    fireEvent.change(screen.getByLabelText(/Ulica ali naselje, hišna številka in kraj/), { target: { value: "Verd 12, Vrhnika" } });
    fireEvent.click(screen.getByLabelText(/Voda/));
    fireEvent.click(screen.getByLabelText(/Želim prejemati izbrana/));
    vi.stubGlobal("fetch", vi.fn(async () => response({ message: "Confirm the link in your email" })));
    fireEvent.click(button);
    await screen.findByText("Confirm the link in your email");
    const init = vi.mocked(fetch).mock.calls[0][1]!;
    expect(JSON.parse(String(init.body))).toMatchObject({ address: "Verd 12, Vrhnika", districtId: "vrhnika", topics: ["water"], consent: true });
  });
  it("G11 invalid subscription capabilities show an error and a route to a new confirmation", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => response({ error: "Confirmation expired" }, 410)));
    show(<SubscriptionPage/>, "/obvestila/narocnina#action=confirm&token=expired");
    await screen.findByText("Confirmation expired");
    expect(screen.queryByRole("button", { name: "Potrdi naročnino" })).toBeNull();
    expect(screen.getByRole("link", { name: /Nova prijava/ }).getAttribute("href")).toBe("/obvestila#narocilo");
  });
  it("G12 collection marks a partial schedule and clears it when the address changes", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => response({ address: "Verd 12, Vrhnika", events: [event], complete: false, incompleteTypes: ["residual"] })));
    show(<CollectionPage/>, "/odpadki/urnik");
    fireEvent.change(screen.getByLabelText("Ulica, hišna številka in kraj"), { target: { value: "Verd 12, Vrhnika" } });
    fireEvent.click(screen.getByRole("button", { name: "Prikaži urnik" }));
    await screen.findByText(event.label);
    expect(screen.getByRole("alert").textContent).toContain("delni urnik");
    expect(screen.getByRole("button", { name: /Dodaj odvoz.*v koledar/ })).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Ulica, hišna številka in kraj"), { target: { value: "Borovnica 1" } });
    expect(screen.queryByText(event.label)).toBeNull();
  });
  it("G13 malformed collection responses cannot produce a plausible schedule", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => response({ events: "not-an-array" })));
    show(<CollectionPage/>, "/odpadki/urnik");
    fireEvent.change(screen.getByLabelText("Ulica, hišna številka in kraj"), { target: { value: "Verd 12, Vrhnika" } });
    fireEvent.click(screen.getByRole("button", { name: "Prikaži urnik" }));
    await screen.findByRole("alert");
    expect(screen.queryByRole("link", { name: /Vsi prikazani termini/ })).toBeNull();
  });
  it("G14 waste wizard recovery must use the published item list when an item is in another group", () => {
    state.sections.wasteItems = [{ name: "Posebni auditni predmet", keywords: ["auditni"], category: "center", note: "Published custom guidance" }];
    show(<WasteWizardPage/>, "/odpadki/kam-z-odpadki");
    fireEvent.change(screen.getByRole("textbox", { name: "Poiščite odpadek" }), { target: { value: "auditni" } });
    fireEvent.click(screen.getByRole("button", { name: "Papir in karton" }));
    expect(screen.getByRole("heading", { name: "Predmet je v drugi skupini odpadkov." })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Išči v vseh skupinah" }));
    expect(screen.getByRole("heading", { name: "Posebni auditni predmet" })).toBeTruthy();
  });
  it("G15 collection-point filters reset and GPS refusal explains the manual alternative", async () => {
    Object.defineProperty(navigator, "geolocation", { configurable: true, value: { getCurrentPosition: (_ok: unknown, fail: (error: object) => void) => fail({ code: 1 }) } });
    show(<WasteMapPage/>, "/odpadki/lokacije");
    fireEvent.change(screen.getByRole("textbox", { name: "Iščite kraj ali zbirno mesto" }), { target: { value: "unknown-place" } });
    expect(screen.getByRole("heading", { name: "Ni najdenih lokacij" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Počisti filtre" }));
    expect(screen.queryByRole("heading", { name: "Ni najdenih lokacij" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Moja lokacija" }));
    expect(screen.getByText(/Lokacije ni bilo mogoče pridobiti/)).toBeTruthy();
    const directions = screen.getAllByRole("link", { name: /Pot do prikazane točke/ });
    expect(new URL(directions[0].getAttribute("href")!).searchParams.get("destination")).toBe(`${defaults.wastePoints[0].lat},${defaults.wastePoints[0].lng}`);
  });
});

describe("guest forms and remaining interactive pages", () => {
  it("G16 an invalid report photo is removable and GPS refusal does not require coordinates", async () => {
    Object.defineProperty(navigator, "geolocation", { configurable: true, value: { getCurrentPosition: (_ok: unknown, fail: (error: object) => void) => fail({ code: 1 }) } });
    show(<ReportPage/>, "/prijavi?category=lighting");
    const file = document.querySelector<HTMLInputElement>('input[type="file"]')!;
    fireEvent.change(file, { target: { files: [new File(["bad"], "photo.heic", { type: "image/heic" })] } });
    expect(screen.getByRole("button", { name: "Oddaj prijavo" }).matches(":disabled")).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Nadaljuj brez fotografije" }));
    expect(screen.getByRole("button", { name: "Oddaj prijavo" }).matches(":disabled")).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Uporabi lokacijo telefona" }));
    expect(screen.getByRole("alert").textContent).toContain("Dostop do lokacije je zavrnjen");
    fireEvent.change(screen.getByLabelText("Naslov ali opis mesta težave · obvezno"), { target: { value: "Svetilka pri Verd 12" } });
    fireEvent.change(document.querySelector<HTMLTextAreaElement>('textarea[name="description"]')!, { target: { value: "Svetilka ne sveti že več dni." } });
    fireEvent.change(screen.getByLabelText("Ime in priimek · obvezno"), { target: { value: "Audit Visitor" } });
    fireEvent.change(screen.getByLabelText("E-poštni naslov · obvezno"), { target: { value: "audit@example.invalid" } });
    fireEvent.click(screen.getByRole("checkbox", { name: /Strinjam se z obdelavo/ }));
    fireEvent.click(screen.getByRole("button", { name: "Oddaj prijavo" }));
    await screen.findByText("Vaša oddaja je shranjena.");
    const form = vi.mocked(fetch).mock.calls[0][1]!.body as FormData;
    expect(form.get("category")).toBe("lighting");
    expect(form.get("latitude")).toBeNull();
    expect(form.get("address")).toBe("Svetilka pri Verd 12");
  });
  it("G17 service requests retain entered information after a server error and identify the selected service", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => response({ error: "Please retry later" }, 503)));
    show(<ServicesPage/>, "/storitve?service=septic");
    fireEvent.change(screen.getByLabelText("Ime in priimek"), { target: { value: "Audit Visitor" } });
    fireEvent.change(screen.getByLabelText("E-poštni naslov"), { target: { value: "audit@example.invalid" } });
    fireEvent.change(screen.getByLabelText("Naslov izvedbe"), { target: { value: "Verd 12, Vrhnika" } });
    fireEvent.change(screen.getByLabelText("Opis storitve"), { target: { value: "Prosim za izredni odvoz vsebine greznice." } });
    fireEvent.click(screen.getByRole("checkbox", { name: /Strinjam se z obdelavo/ }));
    const form = screen.getByLabelText("Opis storitve").closest("form")!;
    fireEvent.submit(form);
    await screen.findByText("Please retry later");
    expect((screen.getByLabelText("Naslov izvedbe") as HTMLInputElement).value).toBe("Verd 12, Vrhnika");
    expect(JSON.parse(String(vi.mocked(fetch).mock.calls[0][1]!.body)).service).toBe("septic");
  });
  it("G18 contact shortcuts can be edited and a saved receipt does not claim inbox delivery", async () => {
    show(<ContactPage/>, "/kontakt?category=billing&subcategory=invoice");
    const subject = screen.getByLabelText("Zadeva sporočila · obvezno");
    fireEvent.change(subject, { target: { value: "My own precise subject" } });
    fireEvent.submit(subject.closest("form")!);
    await screen.findByText("Sporočilo je shranjeno.");
    expect(JSON.parse(String(vi.mocked(fetch).mock.calls[0][1]!.body)).subject).toBe("My own precise subject");
    expect(screen.queryByText(/Sporočilo je dostavljeno/)).toBeNull();
  });
  it("G19 the calculator supports waste-only input without water and removes results for invalid people counts", () => {
    show(<UtilityCalculator/>, "/kalkulator");
    fireEvent.change(screen.getByLabelText("Občina odjemnega mesta"), { target: { value: "vrhnika" } });
    fireEvent.change(screen.getByLabelText("Kaj želite izračunati?"), { target: { value: "waste" } });
    expect(screen.queryByLabelText("Mesečna poraba vode v m³")).toBeNull();
    fireEvent.change(screen.getByLabelText(/Število oseb za obračun odpadkov/), { target: { value: "3" } });
    fireEvent.click(screen.getByRole("button", { name: /Izračunaj mesečni/ }));
    expect(screen.getByRole("table", { name: "Razčlenitev mesečnega stroška" })).toBeTruthy();
    expect(screen.queryByText("Vodarina")).toBeNull();
    fireEvent.change(screen.getByLabelText(/Število oseb za obračun odpadkov/), { target: { value: "0" } });
    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.getByRole("alert")).toBeTruthy();
  });
  it("G20 populated cemetery search handles multiple people and unconfirmed positions without fabricating a point", async () => {
    state.sections.cemetery.graves = [{ id: "A-1-1", section: "A", row: 1, number: 1, x: 100, y: 100, positioned: false, people: [{ name: "Ana Novak", born: "", died: "" }, { name: "Janez Novak", born: "", died: "" }] }] as never;
    show(<CemeteryPage/>, "/pokopalisce");
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "NOVAK" } });
    fireEvent.click(screen.getByRole("button", { name: /Ana Novak · Janez Novak/ }));
    expect(screen.getByRole("heading", { name: "Ana Novak" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Janez Novak" })).toBeTruthy();
    expect(screen.getAllByText("Ni podatka")).toHaveLength(4);
    expect(screen.getByText(/Položaj tega groba na načrtu še ni potrjen/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Povečaj izbrani grob/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Zapri podatke groba" }));
    expect(screen.queryByRole("heading", { name: "Ana Novak" })).toBeNull();
  });
  it("G21 custom CMS pages render real content and unsupported routes show a return path", async () => {
    state.sections.layout.pages = [{ path: "/strani/prihod", title: "Prihod v zbirni center", blocks: [{ id: "intro", type: "text", title: "Navodila za prihod", text: "Published directions", tone: "plain", width: "wide", align: "left", hidden: false, links: [] }] }] as never;
    const view = show(<App/>, "/strani/prihod");
    expect(screen.getByRole("heading", { level: 1, name: "Prihod v zbirni center" })).toBeTruthy();
    expect(screen.getByText("Published directions")).toBeTruthy();
    view.unmount();
    show(<App/>, "/not-a-real-public-page");
    expect(screen.getByRole("heading", { name: "Te strani nismo našli." })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Na začetno stran" }).getAttribute("href")).toBe("/");
  });
  it("G22 the homepage preserves the entered address if browser persistence is blocked", async () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new DOMException("Denied", "SecurityError"); });
    show(<App/>);
    fireEvent.change(screen.getByLabelText("Vaš naslov"), { target: { value: "Verd 12, Vrhnika" } });
    fireEvent.click(screen.getByRole("button", { name: "Prikaži podatke za naslov" }));
    await screen.findByText(event.label);
    expect((screen.getByLabelText("Naslov vašega doma") as HTMLInputElement).value).toBe("Verd 12, Vrhnika");
    expect(screen.getByText(/Brskalnik.*shranjevan/)).toBeTruthy();
  });
  it("G23 a refused forget action cannot falsely report the persisted address as deleted", async () => {
    localStorage.setItem("kpv-address", "Verd 12, Vrhnika");
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => { throw new DOMException("Denied", "SecurityError"); });
    show(<App/>, "/moj-dom");
    await screen.findByText(event.label);
    fireEvent.click(screen.getByRole("button", { name: "Pozabi naslov" }));
    expect(screen.getByText(/Brskalnik ni dovolil izbrisa/)).toBeTruthy();
    expect(localStorage.getItem("kpv-address")).toBe("Verd 12, Vrhnika");
  });
  it("G24 a market submission sends the selected published date and stall category without claiming a reservation", async () => {
    state.sections.market = { dates: ["2090-11-04"], closedDates: [] };
    show(<MarketPage/>, "/trznica");
    fireEvent.change(screen.getByLabelText("Datum prijave"), { target: { value: "2090-11-04" } });
    fireEvent.change(screen.getByLabelText("Ime ponudnika ali podjetja"), { target: { value: "Audit Farm" } });
    fireEvent.change(screen.getByLabelText("E-poštni naslov"), { target: { value: "audit@example.invalid" } });
    fireEvent.change(screen.getByLabelText("Prodajno mesto"), { target: { value: "food" } });
    fireEvent.change(screen.getByLabelText("Kaj boste ponujali?"), { target: { value: "Sezonska zelenjava" } });
    fireEvent.click(screen.getByRole("checkbox", { name: /Strinjam se z obdelavo/ }));
    fireEvent.click(screen.getByRole("button", { name: "Oddaj prijavo" }));
    await screen.findByText("Vaša oddaja je shranjena.");
    expect(JSON.parse(String(vi.mocked(fetch).mock.calls[0][1]!.body))).toMatchObject({ date: "2090-11-04", stallType: "food" });
    expect(screen.getByText(/Razpoložljivost in končno ceno potrdi upravljavec/)).toBeTruthy();
    expect(screen.queryByText(/Rezervacija je potrjena/)).toBeNull();
  });
  it("G25 a valid report photo can be previewed and removed before sending", () => {
    const create = vi.fn(() => "blob:audit-photo"), revoke = vi.fn();
    vi.stubGlobal("URL", Object.assign(URL, { createObjectURL: create, revokeObjectURL: revoke }));
    show(<ReportPage/>, "/prijavi");
    fireEvent.change(document.querySelector('input[type="file"]')!, { target: { files: [new File(["jpeg bytes"], "photo.jpg", { type: "image/jpeg" })] } });
    expect(screen.getByRole("img", { name: "Predogled fotografije prijavljene težave" }).getAttribute("src")).toBe("blob:audit-photo");
    fireEvent.click(screen.getByRole("button", { name: "Odstrani fotografijo" }));
    expect(screen.queryByRole("img", { name: "Predogled fotografije prijavljene težave" })).toBeNull();
    expect(revoke).toHaveBeenCalledWith("blob:audit-photo");
  });
  it("G26 GPS suggestions are not presented as confirmed points until the guest confirms them", async () => {
    Object.defineProperty(navigator, "geolocation", { configurable: true, value: { getCurrentPosition: (ok: (p: object) => void) => ok({ coords: { latitude: 45.98, longitude: 14.3 } }) } });
    show(<ReportPage/>, "/prijavi");
    fireEvent.click(screen.getByRole("button", { name: "Uporabi lokacijo telefona" }));
    await screen.findByText(/Preverite predlagano lokacijo telefona/);
    expect(screen.queryByText("Natančna točka je dodana.")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Potrdi točko" }));
    expect(screen.getByText("Natančna točka je dodana.")).toBeTruthy();
    expect(new URL(screen.getByRole("link", { name: "Preveri točko v Google Zemljevidih" }).getAttribute("href")!).searchParams.get("query")).toBe("45.98,14.3");
  });
  it("G27 the populated cemetery map supports keyboard selection and zoom controls", () => {
    state.sections.cemetery.graves = [1, 2].map(number => ({ id: `A-1-${number}`, section: "A", row: 1, number, x: number * 100, y: 100, positioned: true, people: [{ name: `Audit Person ${number}`, born: "1950-01-01", died: "2020-01-01" }] }));
    show(<CemeteryPage/>, "/pokopalisce");
    const first = screen.getByRole("button", { name: /^Grob A-1-1:/ });
    first.focus(); fireEvent.keyDown(first, { key: "ArrowRight" });
    expect(screen.getByRole("heading", { name: "Audit Person 2" })).toBeTruthy();
    expect(screen.getByRole("button", { name: /^Grob A-1-2:/ }).getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "Povečaj načrt" }));
    expect(screen.getByText("150 %")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Ponastavi pogled načrta" }));
    expect(screen.getByText("100 %")).toBeTruthy();
  });
  it("G28 editing a contact form after success must remove the old receipt from the unsent new intent", async () => {
    show(<ContactPage/>, "/kontakt");
    const subject = screen.getByLabelText("Zadeva sporočila · obvezno");
    fireEvent.submit(subject.closest("form")!);
    await screen.findByText("Sporočilo je shranjeno.");
    fireEvent.change(subject, { target: { value: "A second unsent question" } });
    expect(screen.queryByText("Sporočilo je shranjeno.")).toBeNull();
  });
  it("G29 an unchanged completed contact submission reuses its receipt without demanding a new security token", async () => {
    show(<ContactPage/>, "/kontakt");
    const form = screen.getByLabelText("Zadeva sporočila · obvezno").closest("form")!;
    const guard = document.createElement("div");
    guard.dataset.botAction = "contact"; guard.dataset.botMode = "protected";
    const token = document.createElement("input"); token.type = "hidden"; token.name = "cf-turnstile-response"; token.value = "first-valid-token";
    guard.append(token); form.append(guard);
    fireEvent.submit(form);
    await screen.findByText("Sporočilo je shranjeno.");
    token.value = "";
    fireEvent.submit(form);
    await screen.findByText("Sporočilo je shranjeno.");
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
