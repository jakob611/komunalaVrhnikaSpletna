import { CmsText } from "../content/ContentFields";
import { CmsLayout, nativeSection, cmsNative, CmsLink as Link, CmsAnchor } from "../content/PageComposer";
import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import { useLocation } from "react-router-dom";
import { addressFromNavigation, readSavedAddress as storedAddress, saveHomeAddress } from "../data/saved-address";
import { isCollectionSchedule, type CollectionSchedule } from "../data/collection-response";
import {
  ArrowRight,
  CalendarDays,
  Check,
  ChevronRight,
  Download,
  ExternalLink,
  Info,
  Leaf,
  LocateFixed,
  MapPin,
  Navigation,
  Package,
  Recycle,
  Search,
  Trash2,
  X,
} from "lucide-react";
import {
  CircleMarker,
  MapContainer,
  Popup,
  TileLayer,
  useMap,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import {
  findWasteItems,
  normalizeWaste,
  pointTypes,
  wasteSources,
} from "../data/waste";
import type { CollectionPoint, WasteCategory } from "../data/waste";
import { CalendarDialog } from "../components/CalendarDialog";
import { useSiteContent } from "../content/SiteContent";
import VerifiedAddressPicker, { type VerifiedAddress } from "../components/VerifiedAddressPicker";
import "./waste.css";

function Intro({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children: React.ReactNode;
}) {
  const { pathname } = useLocation();
  return (
    <div className="page-intro waste-intro">
      <span className="eyebrow">{eyebrow}</span>
      <h1><CmsText id={`intro:${pathname}:title`}>{title}</CmsText></h1>
      <p>{typeof children === "string" ? <CmsText id={`intro:${pathname}:description`}>{children}</CmsText> : children}</p>
    </div>
  );
}
function TileBase() {
  const [unavailable, setUnavailable] = useState(false);
  return (
    <>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        eventHandlers={{
          tileerror: () => setUnavailable(true),
          tileload: () => setUnavailable(false),
        }}
      />
      {unavailable && (
        <div className="waste-tile-error" role="status">
          Zemljevida ni mogoče naložiti. Uporabite seznam lokacij ali vnos
          naslova.
        </div>
      )}
    </>
  );
}
function FocusMap({ position }: { position: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (!position) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches)
      map.setView(position, 14, { animate: false });
    else map.flyTo(position, 14, { duration: 0.8 });
  }, [map, position]);
  return null;
}
const directions = (point: CollectionPoint) =>
  `https://www.google.com/maps/dir/?api=1&destination=${point.lat},${point.lng}`;

export function WasteMapPage() {
  const { wastePoints: collectionPoints } = useSiteContent();
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<number | null>(null);
  const [position, setPosition] = useState<[number, number] | null>(null);
  const [userPosition, setUserPosition] = useState<[number, number] | null>(
    null,
  );
  const [gpsMessage, setGpsMessage] = useState("");
  const points = collectionPoints.filter(
    (p) =>
      (filter === "all" || p.types.includes(filter)) &&
      normalizeWaste(`${p.name} ${p.address} ${p.area}`).includes(
        normalizeWaste(search),
      ),
  );
  function locate() {
    if (!navigator.geolocation) {
      setGpsMessage(
        "Vaš brskalnik ne podpira določanja lokacije. Poiščite kraj v seznamu.",
      );
      return;
    }
    setGpsMessage("Pridobivamo vašo lokacijo …");
    navigator.geolocation.getCurrentPosition(
      (p) => {
        const coordinates: [number, number] = [
          p.coords.latitude,
          p.coords.longitude,
        ];
        setPosition(coordinates);
        setUserPosition(coordinates);
        setGpsMessage(
          "Vaša lokacija je označena z modro točko.",
        );
      },
      () =>
        setGpsMessage(
          "Lokacije ni bilo mogoče pridobiti. Dovolite dostop v brskalniku ali izberite lokacijo s seznama.",
        ),
      { timeout: 10000, maximumAge: 60000 },
    );
  }
  return (
    <div className="waste-page">
      <CmsLayout>
        <Intro key={nativeSection("WasteMapPage.introduction")}
          eyebrow="ODPADKI · ZBIRNA MESTA"
          title="Zbirna mesta za odpadke"
        >
          Poiščite zbirno mesto, preverite sprejete vrste odpadkov in odprite
          navodila za pot.
        </Intro>
        <div key={nativeSection("WasteMapPage.notice")} className="notice waste-demo">
          <Info size={18} />
          <span>
            <strong><CmsText id="WasteMapPage.strong-1">{"Zbirni center Tojnice."}</CmsText></strong> Pred oddajo preverite delovni čas in pogoje za vrsto odpadka pri{" "}
            <CmsAnchor
              href="https://www.kpv.si/"
              target="_blank"
              rel="noreferrer"
            >
              KPV
            </CmsAnchor>
            .
          </span>
        </div>
        <div key={nativeSection("WasteMapPage.waste-map-toolbar")} className="waste-map-toolbar">
          <label className="waste-search">
            <Search size={20} />
            <input
              aria-label="Iščite kraj ali zbirno mesto"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Poiščite kraj ali zbirno mesto …"
            />
          </label>
          <button className="button secondary" onClick={locate}>
            <LocateFixed size={17} /> Moja lokacija
          </button>
        </div>
        <div key={nativeSection("WasteMapPage.waste-filters")} className="waste-filters" role="group" aria-label="Vrsta odpadka">
          {pointTypes.map((t) => (
            <button
              key={t.id}
              onClick={() => setFilter(t.id)}
              aria-pressed={filter === t.id}
              className={filter === t.id ? "active" : ""}
            >
              {t.label}
            </button>
          ))}
        </div>
        {cmsNative(nativeSection("WasteMapPage.location-status"), (gpsMessage && (
          <p className="waste-gps-message" role="status">
            {gpsMessage}
          </p>
        )))}
        <div key={nativeSection("WasteMapPage.waste-map-layout")} className="waste-map-layout">
          <aside className="waste-location-list">
            <div className="waste-list-heading">
              <strong>
                {points.length} {points.length === 1 ? "lokacija" : "lokacij"}
              </strong>
              <span>Zbirna mesta</span>
            </div>
            {points.length === 0 ? (
              <div className="empty-state">
                <Search />
                {collectionPoints.length ? <>
                <h3><CmsText id="WasteMapPage.h3-1">{"Ni najdenih lokacij"}</CmsText></h3>
                <p><CmsText id="WasteMapPage.p-1">{"Poskusite drug kraj ali vrsto odpadka."}</CmsText></p>
                <button
                  className="button secondary"
                  onClick={() => {
                    setSearch("");
                    setFilter("all");
                  }}
                >
                  Počisti filtre
                </button>
                </> : <>
                  <h3><CmsText id="WasteMapPage.empty-title">{"Zbirna mesta trenutno niso objavljena."}</CmsText></h3>
                  <p><CmsText id="WasteMapPage.empty-description">{"Za najbližje zbirno mesto in pogoje oddaje odpadkov se obrnite na KPV."}</CmsText></p>
                  <Link to="/kontakt" className="button secondary">Kontakti KPV <ArrowRight size={16}/></Link>
                </>}
              </div>
            ) : (
              points.map((point) => (
                <article
                  key={point.id}
                  className={`waste-point ${selected === point.id ? "selected" : ""}`}
                >
                  <button
                    className="waste-point-select"
                    aria-pressed={selected === point.id}
                    aria-label={`Prikaži ${point.name} na zemljevidu`}
                    onClick={() => {
                      setSelected(point.id);
                      setPosition([point.lat, point.lng]);
                    }}
                  >
                    <span className="waste-point-icon">
                      {point.center ? (
                        <Recycle size={22} />
                      ) : (
                        <MapPin size={22} />
                      )}
                    </span>
                    <span>
                      <small>
                        {point.center
                          ? "ZBIRNI CENTER"
                          : point.types.includes("public")
                            ? "JAVNI KOŠ"
                            : "ZBIRALNICA"}
                      </small>
                      <h3>{point.name}</h3>
                      <p>{point.address}</p>
                    </span>
                    <ChevronRight size={18} />
                  </button>
                  <div className="waste-point-tags">
                    {point.types.slice(0, 5).map((type) => (
                      <span key={type}>
                        {pointTypes.find((t) => t.id === type)?.label}
                      </span>
                    ))}
                    {point.types.length > 5 && (
                      <span>+{point.types.length - 5}</span>
                    )}
                  </div>
                  <CmsAnchor
                    className="waste-directions"
                    aria-label={`Pot do prikazane točke ${point.name} v Google Zemljevidih`}
                    href={directions(point)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <Navigation size={14} /> Pot do prikazane točke{" "}
                    <ExternalLink size={13} />
                  </CmsAnchor>
                </article>
              ))
            )}
          </aside>
          <div
            className="waste-map"
            role="region"
            aria-label="Zemljevid zbirnih mest. Lokacije lahko izberete tudi v besedilnem seznamu."
          >
            <MapContainer
              center={[45.969, 14.326]}
              zoom={11}
              scrollWheelZoom={false}
              style={{ height: "100%", width: "100%" }}
            >
              <TileBase />
              <FocusMap position={position} />
              {points.map((point) => (
                <CircleMarker
                  key={point.id}
                  center={[point.lat, point.lng]}
                  radius={point.center ? 13 : 9}
                  pathOptions={{
                    color: "#fff",
                    weight: 3,
                    fillColor: selected === point.id ? "#d7aa4c" : "#22765d",
                    fillOpacity: 1,
                  }}
                  eventHandlers={{ click: () => setSelected(point.id) }}
                >
                  <Popup>
                    <strong>{point.name}</strong>
                    <p>{point.address}</p>
                    <p><CmsText id="WasteMapPage.p-2">{"Točka na zemljevidu je orientacijska. Za prihod sledite naslovu."}</CmsText></p>
                    <CmsAnchor
                      href={directions(point)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Odpri pot v Google Zemljevidih
                    </CmsAnchor>
                  </Popup>
                </CircleMarker>
              ))}
              {userPosition && (
                <CircleMarker
                  center={userPosition}
                  radius={6}
                  pathOptions={{
                    color: "white",
                    fillColor: "#4683b1",
                    fillOpacity: 1,
                  }}
                />
              )}
            </MapContainer>
            <div className="waste-map-label">
              <span /> Zemljevid zbirnih mest
            </div>
          </div>
        </div>
        <div key={nativeSection("WasteMapPage.waste-bottom-help")} className="waste-bottom-help">
          <div>
            <Recycle size={24} />
            <span>
              <strong><CmsText id="WasteMapPage.strong-2">{"Niste prepričani, kam odložiti predmet?"}</CmsText></strong>
              <p><CmsText id="WasteMapPage.p-3">{"V iskalniku odpadkov preverite, v kateri zabojnik sodi predmet oziroma kje ga lahko oddate."}</CmsText></p>
            </span>
          </div>
          <Link className="button secondary" to="/odpadki/kam-z-odpadki">
            Odpri čarovnika <ArrowRight size={16} />
          </Link>
        </div>
      </CmsLayout>
    </div>
  );
}

export function WasteWizardPage() {
  const { wasteCategories: categories, wasteItems } = useSiteContent();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<WasteCategory | "all">("all");
  const normalized = normalizeWaste(query);
  const results = useMemo(
    () => findWasteItems(query, category, wasteItems),
    [query, category, wasteItems],
  );
  return (
    <div className="waste-page">
      <CmsLayout>
        <Intro key={nativeSection("WasteWizardPage.introduction")} eyebrow="ODPADKI · LOČEVANJE" title="Kam odložiti odpadek?">
          Vpišite ime predmeta in preverite navodila za ločevanje ali oddajo.
        </Intro>
        <section key={nativeSection("WasteWizardPage.waste-wizard-hero")} className="waste-wizard-hero">
          <div className="waste-wizard-symbol">
            <Recycle size={35} strokeWidth={1.5} />
          </div>
          <span className="eyebrow">ISKALNIK ODPADKOV</span>
          <h2><CmsText id="WasteWizardPage.h2-1">{"Poiščite predmet"}</CmsText></h2>
          <label className="waste-search large">
            <Search size={23} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Kaj želite odložiti? Npr. baterija …"
              aria-label="Poiščite odpadek"
            />
            {query && (
              <button onClick={() => setQuery("")} aria-label="Počisti iskanje">
                <X size={18} />
              </button>
            )}
          </label>
          <div className="waste-suggestions">
            <span>Primeri iskanja:</span>
            {["Tetrapak", "Baterija", "Peki papir", "Plastenka"].map((v) => (
              <button
                key={v}
                onClick={() => {
                  setQuery(v);
                  setCategory("all");
                }}
              >
                {v}
              </button>
            ))}
          </div>
        </section>
        <div key={nativeSection("WasteWizardPage.waste-filters")} className="waste-filters">
          <button
            onClick={() => setCategory("all")}
            aria-pressed={category === "all"}
            className={category === "all" ? "active" : ""}
          >
            Vsi odpadki
          </button>
          {Object.entries(categories).map(([id, c]) => (
            <button
              key={id}
              onClick={() => setCategory(id as WasteCategory)}
              aria-pressed={category === id}
              className={category === id ? "active" : ""}
            >
              <span
                className="waste-category-dot"
                style={{ background: c.color }}
              />
              {c.title}
            </button>
          ))}
        </div>
        <div key={nativeSection("WasteWizardPage.section-heading")} className="section-heading waste-results-heading">
          <h2>
            {normalized
              ? `Rezultati za »${query}«`
              : "Abecednik vsakdanjih odpadkov"}
          </h2>
          <span aria-live="polite">{results.length} zadetkov</span>
        </div>
        {cmsNative(nativeSection("WasteWizardPage.results"), (results.length === 0 ? (
          <div className="panel empty-state">
            <Search size={32} />
            {wasteItems.length ? <>
            <h3>
              {category !== "all" && findWasteItems(query, "all", wasteItems).length > 0
                ? "Predmet je v drugi skupini odpadkov."
                : "Za izbrane pogoje ni zadetkov."}
            </h3>
            <p>
              <CmsText id="WasteWizardPage.p-1">{"Poskusite drug izraz, npr. »embalaža« ali »telefon«. Če navodila niso dovolj jasna, vprašajte osebje zbirnega centra."}</CmsText></p>
            <button
              className="button secondary"
              onClick={() => {
                if (
                  category === "all" ||
                  findWasteItems(query, "all", wasteItems).length === 0
                )
                  setQuery("");
                setCategory("all");
              }}
            >
              {category !== "all" && findWasteItems(query, "all", wasteItems).length > 0
                ? "Išči v vseh skupinah"
                : "Pokaži vse predmete"}
            </button>
            </> : <>
              <h3><CmsText id="WasteWizardPage.empty-title">{"Seznam odpadkov trenutno ni objavljen."}</CmsText></h3>
              <p><CmsText id="WasteWizardPage.empty-description">{"Navodila poiščite v abecedniku odpadkov KPV ali vprašajte osebje zbirnega centra."}</CmsText></p>
              <CmsAnchor href={wasteSources[4].url} target="_blank" rel="noreferrer" className="button secondary">Odpri abecednik odpadkov KPV <ExternalLink size={16}/></CmsAnchor>
            </>}
          </div>
        ) : (
          <div className="waste-result-grid">
            {results.map((item) => {
              const c = categories[item.category];
              return (
                <article
                  key={item.name}
                  className="waste-result-card"
                  style={{ "--waste-color": c.color } as React.CSSProperties}
                >
                  <div className="waste-result-top">
                    <span className="waste-bin-icon">
                      {item.category === "bio" ? (
                        <Leaf size={23} />
                      ) : item.category === "embalaza" ? (
                        <Package size={23} />
                      ) : (
                        <Trash2 size={23} />
                      )}
                    </span>
                    <span>{c.title}</span>
                  </div>
                  <h3>{item.name}</h3>
                  <div className="waste-destination">
                    <Check size={17} />
                    <strong>{c.destination}</strong>
                  </div>
                  <p>{item.note || c.tip}</p>
                  <Link to="/odpadki/lokacije">
                    Poiščite zbirno mesto <ArrowRight size={15} />
                  </Link>
                </article>
              );
            })}
          </div>
        )))}
        <div key={nativeSection("WasteWizardPage.notice")} className="notice waste-sources">
          <Info size={18} />
          <div>
            <strong><CmsText id="WasteWizardPage.strong-1">{"Navodila za ločevanje"}</CmsText></strong>
            <p>
              <CmsText id="WasteWizardPage.p-2">{"Čarovnik išče po lokalnem seznamu izrazov. Pri sestavljenih, nevarnih ali nejasnih odpadkih preverite navodila osebja."}</CmsText>{" "}
              <CmsAnchor
                href={wasteSources[4].url}
                target="_blank"
                rel="noreferrer"
              >
                Uradni abecednik odpadkov <ExternalLink size={12} />
              </CmsAnchor>
            </p>
          </div>
        </div>
      </CmsLayout>
    </div>
  );
}

type CollectionEvent = CollectionSchedule["events"][number];
const collectionLabels: Record<string, string> = {
  packaging: "Mešana embalaža", bio: "Biološki odpadki", residual: "Mešani komunalni odpadki",
};
const officialScheduleUrl = "https://www.kpv.si/mDejavnosti/rzo/rzoUrnik.html";
const displayDate = (date: string, options: Intl.DateTimeFormatOptions) =>
  new Date(`${date}T12:00:00`).toLocaleDateString("sl-SI", options);
export function CollectionPage() {
  const location = useLocation();
  const initialAddress = addressFromNavigation(location.state) || storedAddress();
  const [address, setAddress] = useState(initialAddress);
  const [verifiedAddress, setVerifiedAddress] = useState<VerifiedAddress | null>(null);
  const autoLoadInitial = useRef(!!initialAddress.trim());
  const [schedule, setSchedule] = useState<CollectionSchedule | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [storageMessage, setStorageMessage] = useState("");
  const [calendarEvent, setCalendarEvent] = useState<CollectionEvent | null>(
    null,
  );
  const request = useRef<AbortController | null>(null);
  useEffect(() => {
    return () => request.current?.abort();
  }, []);
  useEffect(() => {
    if(verifiedAddress&&autoLoadInitial.current){autoLoadInitial.current=false;void loadSchedule(verifiedAddress.address);}
  },[verifiedAddress]);
  async function lookup(e: FormEvent) {
    e.preventDefault();
    if (loading) return;
    if(!verifiedAddress){setError("Izberite preverjen naslov iz seznama.");return;}
    await loadSchedule(verifiedAddress.address);
  }
  async function loadSchedule(requestedAddress: string) {
    setError("");
    setSchedule(null);
    setSaved(false);
    setStorageMessage("");
    setCalendarEvent(null);
    if (requestedAddress.length < 4) {
      setError("Vpišite kraj, ulico in hišno številko.");
      return;
    }
    const controller = new AbortController();
    request.current?.abort();
    request.current = controller;
    let timedOut = false;
    const timeout = window.setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, 12000);
    setLoading(true);
    try {
      const response = await fetch(
        `/api/collection?${new URLSearchParams({ address: requestedAddress })}`,
        { signal: controller.signal },
      );
      if (!response.ok) {
        const problem = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(
          problem.error ||
            "Urnika trenutno ni mogoče pridobiti. Poskusite znova čez trenutek.",
        );
      }
      const data: unknown = await response.json();
      if (!isCollectionSchedule(data))
        throw new Error("Prejeli smo neveljaven urnik. Poskusite znova.");
      if (controller.signal.aborted) return;
      setSchedule(data);
      if (saveHomeAddress(data.address || requestedAddress)) setSaved(true);
      else {
        setStorageMessage(
          "Brskalnik ne dovoljuje shranjevanja naslova. Urnik lahko vseeno uporabljate.",
        );
      }
    } catch (problem) {
      if (controller.signal.aborted && !timedOut) return;
      setError(
        timedOut
          ? "Iskanje traja predolgo. Preverite povezavo in poskusite znova."
          : problem instanceof Error && problem.message !== "Failed to fetch"
            ? problem.message
            : "Urnika trenutno ni mogoče pridobiti. Poskusite znova čez trenutek.",
      );
      setSchedule(null);
    } finally {
      window.clearTimeout(timeout);
      if (request.current === controller) setLoading(false);
    }
  }
  return (
    <div className="waste-page">
      <CmsLayout>
        <Intro key={nativeSection("CollectionPage.introduction")}
          eyebrow="ODPADKI · URNIK ODVOZA"
          title="Urnik odvoza odpadkov"
        >
          Izberite naslov iz uradnega registra za prikaz objavljenih datumov odvoza. Posamezne odvoze
          lahko dodate v koledar.
        </Intro>
        <div key={nativeSection("CollectionPage.notice")} className="notice">
          <Info size={18} />
          <span>Odvozna območja so lahko različna za embalažo, BIO in mešane odpadke.
            Če naslov ne določa enega območja, to jasno označimo. Preverite tudi{" "}
            <CmsAnchor href={officialScheduleUrl} target="_blank" rel="noreferrer">izvirne urnike KPV</CmsAnchor>
            {" "}ali pokličite <a href="tel:+38617502970">01 750 29 70</a>.
          </span>
        </div>
        <section key={nativeSection("CollectionPage.address-form")} className="panel waste-address-panel">
          <div className="waste-address-title">
            <span>
              <MapPin size={24} />
            </span>
            <div>
              <h2><CmsText id="CollectionPage.h2-1">{"Naslov za urnik odvoza"}</CmsText></h2>
              <p><CmsText id="CollectionPage.p-1">{"Vneseni naslov se shrani v ta brskalnik za naslednji obisk."}</CmsText></p>
            </div>
          </div>
          <form onSubmit={lookup} aria-busy={loading}>
            <div className="waste-address-row">
              <VerifiedAddressPicker id="collection-address" label="Ulica, hišna številka in kraj" disabled={loading} required value={address}
                onChange={(value,reason) => {
                  if(reason==='input')autoLoadInitial.current=false;
                  request.current?.abort();
                  setLoading(false);
                  setAddress(value);
                  setSaved(false);
                  setSchedule(null);
                  setError("");
                }}
                onSelect={setVerifiedAddress} describedBy="collection-address-help"/>
              <button className="button" type="submit" disabled={loading || !verifiedAddress}>
                {loading ? "Iščemo termine …" : "Prikaži urnik"}
                <ArrowRight size={18} />
              </button>
            </div>
            <p id="collection-address-help" className="waste-address-help">
              {schedule
                ? "Urnik je prikazan spodaj. Pri posameznem odvozu lahko izberete Dodaj v koledar."
                : address
                  ? "Izberite naslov med zadetki in pritisnite Prikaži urnik."
                  : "Začnite z ulico ali naseljem in hišno številko. Nato izberite naslov iz seznama."}
            </p>
          </form>
          <div className="waste-address-meta">
            {saved && (
              <span role="status">
                <Check size={15} />
                Naslov je shranjen v brskalniku
              </span>
            )}
          </div>
          {error && (
            <p role="alert" className="waste-error">
              {error}
            </p>
          )}
          {storageMessage && (
            <p role="status" className="waste-calendar-note">
              {storageMessage}
            </p>
          )}
        </section>
        {cmsNative(nativeSection("CollectionPage.schedule"), (schedule ? (
          <section className="waste-schedule">
            <div className="section-heading waste-results-heading">
              <div>
                <span className="eyebrow">OBJAVLJENI TERMINI ZA NASLOV</span>
                <h2>{schedule.address}</h2>
              </div>
              {schedule.events.length > 0 && <CmsAnchor
                href={`/api/calendar?${new URLSearchParams({ address: schedule.address })}`}
                className="button secondary"
              >
                <Download size={17} />
                Vsi prikazani termini (.ics)
              </CmsAnchor>}
            </div>
            <p className="waste-calendar-note">
              <CmsText id="CollectionPage.p-2">{"Z gumbom »Dodaj v koledar« izberete posamezni odvoz ali naročnino na objavljene odvoze iste vrste. Zgornja povezava prenese datoteko z vsemi prikazanimi potrjenimi datumi. Datoteka se po uvozu ne posodablja samodejno."}</CmsText></p>
            {(schedule.incompleteTypes?.length || schedule.expiredTypes?.length) ? (
              <div className="notice" role="alert" style={{borderColor:"#d3a24a", background:"#fff7e7", marginBottom:20}}>
                <Info size={22} />
                <div><strong><CmsText id="CollectionPage.strong-1">{"To je delni urnik. Za vse vrste odpadkov še ni potrjenih prihajajočih datumov."}</CmsText></strong>
                  <p><CmsText id="CollectionPage.p-3">{"Preverite: "}</CmsText>{[...new Set([...(schedule.incompleteTypes || []), ...(schedule.expiredTypes || [])])].map((type) => collectionLabels[type] || type).join(", ")}{"."}{" "}<CmsText id="CollectionPage.p-5">{"Za območja, razdeljena med običajno in malo vozilo, naslov brez hišnih razmejitev ne zadošča."}</CmsText>{" "}<CmsAnchor href={officialScheduleUrl} target="_blank" rel="noreferrer">Preverite izvirni urnik</CmsAnchor>
                    {" "}<CmsText id="CollectionPage.p-6">{"ali pokličite "}</CmsText><a href="tel:+38617502970">01 750 29 70</a>{"."}</p>
                </div>
              </div>
            ) : null}
            {schedule.routes && <div className="panel" style={{marginBottom:20}}>
              <h3><CmsText id="CollectionPage.h3-1">{"Preverjanje po vrstah odpadkov"}</CmsText></h3>
              {Object.entries(collectionLabels).map(([type,label]) => <p key={type}>
                <strong>{label}{":"}</strong>{" "}{schedule.routes?.[type]
                  ? `${schedule.routes[type].name} · objavljeno do ${displayDate(schedule.routes[type].lastDate,{day:"numeric",month:"long",year:"numeric"})}`
                  : "Območje ni enoznačno določeno – potrebna je potrditev pri KPV."}
              </p>)}
            </div>}
            <p className="waste-calendar-note"><CmsText id="CollectionPage.p-8">{"Spodaj so navedeni točni prihodnji datumi iz objavljenega urnika. Praznične spremembe veljajo samo, ko jih potrdi in objavi KPV. Po koncu objavljenega obdobja novih datumov ne dodajamo samodejno."}</CmsText></p>
            <div className="waste-timeline">
              {schedule.events.map((event, index) => (
                <article key={event.id} className="waste-event">
                  <div className="waste-event-date">
                    <strong>
                      {displayDate(event.date, { day: "2-digit" })}
                    </strong>
                    <span>{displayDate(event.date, { month: "short" })}</span>
                  </div>
                  <span
                    className="waste-event-icon"
                    style={{
                      background: `${event.color || "#22765d"}18`,
                      color: event.color || "#22765d",
                    }}
                  >
                    {event.type === "bio" ? (
                      <Leaf size={24} />
                    ) : event.type === "embalaza" ||
                      event.type === "packaging" ? (
                      <Package size={24} />
                    ) : (
                      <Trash2 size={24} />
                    )}
                  </span>
                  <div className="waste-event-info">
                    <div>
                      {index === 0 && (
                        <span className="waste-next-label">
                          Naslednji objavljeni odvoz
                        </span>
                      )}
                    </div>
                    <h3>{event.label}</h3>
                    <p>
                      {displayDate(event.date, {
                        weekday: "long",
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCalendarEvent(event)}
                    className="waste-calendar-link"
                    aria-label={`Dodaj odvoz ${event.label}, ${displayDate(event.date, { day: "numeric", month: "long" })} v koledar`}
                    aria-haspopup="dialog"
                  >
                    <CalendarDays size={17} />
                    <span>Dodaj v koledar</span>
                  </button>
                </article>
              ))}
            </div>
            {schedule.events.length === 0 && (
              <div className="panel empty-state">
                <CalendarDays />
                <h3><CmsText id="CollectionPage.h3-2">{"Za ta naslov ni terminov."}</CmsText></h3>
                <p><CmsText id="CollectionPage.p-9">{"Preverite vpisani naslov ali se obrnite na KPV."}</CmsText></p>
              </div>
            )}
          </section>
        ) : (
          <div className="waste-schedule-placeholder">
            <span>
              <CalendarDays size={38} strokeWidth={1.4} />
            </span>
            <h2><CmsText id="CollectionPage.h2-2">{"Vpišite naslov za prikaz urnika"}</CmsText></h2>
            <p>
              <CmsText id="CollectionPage.p-10">{"Po vnosu naslova se bodo tu prikazali objavljeni odvozi"}</CmsText><br />
              <CmsText id="CollectionPage.p-11">{"mešanih, bioloških odpadkov in embalaže."}</CmsText></p>
            <div>
              <span>
                <Check size={16} /> Pregleden seznam terminov
              </span>
              <span>
                <Check size={16} /> Izvoz v osebni koledar
              </span>
              <span>
                <Check size={16} /> Shranjen naslov
              </span>
            </div>
          </div>
        )))}
        {cmsNative(nativeSection("CollectionPage.calendar-dialog"), (calendarEvent && schedule && (
          <CalendarDialog
            event={calendarEvent}
            events={schedule.events}
            routeId={schedule.routes?.[calendarEvent.type]?.id}
            address={schedule.address}
            onClose={() => setCalendarEvent(null)}
          />
        )))}
        <div key={nativeSection("CollectionPage.waste-bottom-help")} className="waste-bottom-help">
          <div>
            <Info size={24} />
            <span>
              <strong><CmsText id="CollectionPage.strong-3">{"Kaj pa papir in steklo?"}</CmsText></strong>
              <p><CmsText id="CollectionPage.p-12">{"Oddate ju lahko v ustrezne zbiralnike na ekoloških otokih."}</CmsText></p>
            </span>
          </div>
          <Link className="button secondary" to="/odpadki/lokacije">
            Poišči zbirno mesto <ArrowRight size={16} />
          </Link>
        </div>
      </CmsLayout>
    </div>
  );
}
