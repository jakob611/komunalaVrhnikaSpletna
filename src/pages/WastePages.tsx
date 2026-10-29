import { CmsLayout, CmsLink as Link, CmsAnchor } from "../content/PageComposer";
import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import {} from "react-router-dom";
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
  useMapEvents,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import {
  categories,
  collectionPoints,
  findWasteItems,
  normalizeWaste,
  pointTypes,
  wasteSources,
} from "../data/waste";
import type { CollectionPoint, WasteCategory } from "../data/waste";
import { CalendarDialog } from "../components/CalendarDialog";
import AnimatedDisclosure from "../components/AnimatedDisclosure";
import { useSiteContent } from "../content/SiteContent";
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
  return (
    <div className="page-intro waste-intro">
      <span className="eyebrow">{eyebrow}</span>
      <h1>{title}</h1>
      <p>{children}</p>
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
          "Vaša lokacija je označena z modro točko. Prikazane zbiralnice so vzorčne.",
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
        <Intro
          eyebrow="ODPADKI · ZBIRNA MESTA"
          title="Pravo mesto za vsak odpadek."
        >
          Poiščite ekološki otok ali zbirni center in preverite, kaj lahko
          oddate. Manj iskanja, več pravilnega ločevanja.
        </Intro>
        <div className="notice waste-demo">
          <Info size={18} />
          <span>
            <strong>Demonstracijski zemljevid.</strong> Tojnice so prikazane
            približno, druge točke so primeri. Koordinate in vrste zbiralnikov
            še niso potrjen uradni register. Pred odhodom preverite podatke pri{" "}
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
        <div className="waste-map-toolbar">
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
        <div className="waste-filters" role="group" aria-label="Vrsta odpadka">
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
        {gpsMessage && (
          <p className="waste-gps-message" role="status">
            {gpsMessage}
          </p>
        )}
        <div className="waste-map-layout">
          <aside className="waste-location-list">
            <div className="waste-list-heading">
              <strong>
                {points.length} {points.length === 1 ? "lokacija" : "lokacij"}
              </strong>
              <span>Prikazni podatki</span>
            </div>
            {points.length === 0 ? (
              <div className="empty-state">
                <Search />
                <h3>Ni najdenih lokacij</h3>
                <p>Poskusite drug kraj ali vrsto odpadka.</p>
                <button
                  className="button secondary"
                  onClick={() => {
                    setSearch("");
                    setFilter("all");
                  }}
                >
                  Počisti filtre
                </button>
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
                            ? "VZORČNI JAVNI KOŠ"
                            : "VZORČNA ZBIRALNICA"}
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
            aria-label="Prikazni zemljevid zbirnih mest. Lokacije lahko izberete tudi v besedilnem seznamu."
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
                    <p>Prikazna, nepotrjena lokacija.</p>
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
              <span /> Zemljevid zbirnih mest · primer
            </div>
          </div>
        </div>
        <div className="waste-bottom-help">
          <div>
            <Recycle size={24} />
            <span>
              <strong>Niste prepričani, kam odložiti predmet?</strong>
              <p>Čarovnik za odpadke vam pomaga najti pravo frakcijo.</p>
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
        <Intro eyebrow="ODPADKI · ČAROVNIK ZA LOČEVANJE" title="Kam gre pa to?">
          Tetrapak, baterija ali stara igrača? Vpišite predmet in skupaj bomo
          našli pravo mesto zanj.
        </Intro>
        <section className="waste-wizard-hero">
          <div className="waste-wizard-symbol">
            <Recycle size={35} strokeWidth={1.5} />
          </div>
          <span className="eyebrow">MAJHNA ODLOČITEV. VELIKA RAZLIKA.</span>
          <h2>Vsak odpadek ima svoje mesto.</h2>
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
            <span>Pogosto iščemo:</span>
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
        <div className="waste-filters">
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
        <div className="section-heading waste-results-heading">
          <h2>
            {normalized
              ? `Rezultati za »${query}«`
              : "Abecednik vsakdanjih odpadkov"}
          </h2>
          <span aria-live="polite">{results.length} zadetkov</span>
        </div>
        {results.length === 0 ? (
          <div className="panel empty-state">
            <Search size={32} />
            <h3>
              {category !== "all" && findWasteItems(query, "all").length > 0
                ? "Predmet je v drugi skupini odpadkov."
                : "Tega predmeta še ne poznamo."}
            </h3>
            <p>
              Poskusite drug izraz, npr. »embalaža« ali »telefon«. Če še vedno
              niste prepričani, preverite pri osebju zbirnega centra.
            </p>
            <button
              className="button secondary"
              onClick={() => {
                if (
                  category === "all" ||
                  findWasteItems(query, "all").length === 0
                )
                  setQuery("");
                setCategory("all");
              }}
            >
              {category !== "all" && findWasteItems(query, "all").length > 0
                ? "Išči v vseh skupinah"
                : "Pokaži vse predmete"}
            </button>
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
        )}
        <div className="notice waste-sources">
          <Info size={18} />
          <div>
            <strong>Ločevanje po navodilih KPV.</strong>
            <p>
              Čarovnik išče po lokalnem seznamu izrazov. Pri sestavljenih,
              nevarnih ali nejasnih odpadkih preverite navodila osebja.{" "}
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

type CollectionEvent = {
  id: string;
  date: string;
  type: string;
  label: string;
  color: string;
};
type Schedule = { address: string; demo: boolean; events: CollectionEvent[] };
const displayDate = (date: string, options: Intl.DateTimeFormatOptions) =>
  new Date(`${date}T12:00:00`).toLocaleDateString("sl-SI", options);
function LocationPicker({
  onPick,
}: {
  onPick: (lat: number, lng: number) => void;
}) {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}
function storedAddress() {
  try {
    return localStorage.getItem("kpv-address") || "";
  } catch {
    return "";
  }
}

export function CollectionPage() {
  const { wastePoints: collectionPoints } = useSiteContent();
  const [address, setAddress] = useState(storedAddress);
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showMap, setShowMap] = useState(false);
  const [picked, setPicked] = useState<[number, number] | null>(null);
  const [saved, setSaved] = useState(false);
  const [storageMessage, setStorageMessage] = useState("");
  const [calendarEvent, setCalendarEvent] = useState<CollectionEvent | null>(
    null,
  );
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);
  async function lookup(e: FormEvent) {
    e.preventDefault();
    if (loading) return;
    setError("");
    setSchedule(null);
    setSaved(false);
    setStorageMessage("");
    if (address.trim().length < 4) {
      setError("Vpišite kraj, ulico in hišno številko.");
      return;
    }
    const requestedAddress = address.trim();
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
      const data = (await response.json()) as Schedule;
      if (!Array.isArray(data.events))
        throw new Error("Prejeli smo neveljaven urnik. Poskusite znova.");
      if (controller.signal.aborted) return;
      setSchedule(data);
      try {
        localStorage.setItem("kpv-address", requestedAddress);
        setSaved(true);
      } catch {
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
  function pickLocation(lat: number, lng: number) {
    if (lat < 45.88 || lat > 46.08 || lng < 14.2 || lng > 14.48) {
      setError(
        "Izberite prikazno lokacijo na območju Vrhnike, Borovnice ali Loga - Dragomerja.",
      );
      return;
    }
    request.current?.abort();
    request.current = null;
    setLoading(false);
    setError("");
    setStorageMessage("");
    setPicked([lat, lng]);
    const closest = [...collectionPoints].sort(
      (a, b) =>
        Math.hypot(a.lat - lat, a.lng - lng) -
        Math.hypot(b.lat - lat, b.lng - lng),
    )[0];
    setAddress(
      `${closest.area} · prikazna lokacija ${lat.toFixed(4)}, ${lng.toFixed(4)}`,
    );
    setSchedule(null);
    setSaved(false);
  }
  return (
    <div className="waste-page">
      <CmsLayout>
        <Intro
          eyebrow="ODPADKI · URNIK ODVOZA"
          title="Vaš naslednji odvoz. Brez ugibanja."
        >
          Vpišite domači naslov, poglejte prihajajoče termine in jih dodajte v
          svoj koledar.
        </Intro>
        <div className="notice waste-demo">
          <Info size={18} />
          <span>
            <strong>Preizkus z vzorčnimi termini.</strong> Naslov ustvari prikaz
            delovanja, ne preverjenega urnika za vaš dom. Za dejanske odvoze
            uporabite{" "}
            <CmsAnchor
              href="https://www.kpv.si/"
              target="_blank"
              rel="noreferrer"
            >
              uradni urnik KPV
            </CmsAnchor>
            . Steklo in papir se praviloma zbirata na ekoloških otokih.
          </span>
        </div>
        <section className="panel waste-address-panel">
          <div className="waste-address-title">
            <span>
              <MapPin size={24} />
            </span>
            <div>
              <h2>Kje odlagate odpadke?</h2>
              <p>Naslov si zapomnimo samo v tem brskalniku.</p>
            </div>
          </div>
          <form onSubmit={lookup} aria-busy={loading}>
            <label className="field" htmlFor="collection-address">
              Ulica, hišna številka in kraj
            </label>
            <div className="waste-address-row">
              <input
                id="collection-address"
                disabled={loading}
                required
                maxLength={180}
                value={address}
                onChange={(e) => {
                  setAddress(e.target.value);
                  setSaved(false);
                  setSchedule(null);
                  setError("");
                }}
                placeholder="Npr. Tržaška cesta 1, Vrhnika"
                autoComplete="street-address"
                aria-describedby="collection-address-help"
              />
              <button className="button" type="submit" disabled={loading}>
                {loading ? "Iščemo termine …" : "Prikaži urnik"}
                <ArrowRight size={18} />
              </button>
            </div>
            <p id="collection-address-help" className="waste-address-help">
              {schedule
                ? "Urnik je prikazan spodaj. Pri posameznem odvozu lahko izberete Dodaj v koledar."
                : address
                  ? "Preverite vneseni naslov in pritisnite Prikaži urnik. Prikazali se bodo vzorčni termini za ta naslov."
                  : "Vnesite tudi kraj: Vrhnika, Borovnica ali Log – Dragomer. Nato pritisnite Prikaži urnik."}
            </p>
          </form>
          <div className="waste-address-meta">
            <button
              className="waste-text-button"
              aria-expanded={showMap}
              aria-controls="collection-location-picker"
              onClick={() => setShowMap(!showMap)}
            >
              <MapPin size={15} />
              {showMap
                ? "Skrij zemljevid"
                : "Izberite prikazno lokacijo na zemljevidu"}
            </button>
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
          <AnimatedDisclosure open={showMap}>
            <div className="waste-picker" id="collection-location-picker">
              <p>
                Izberite točko na zemljevidu, nato pritisnite Prikaži urnik.
                Izbira služi preizkusu in ne določi uradnega odvoznega območja.
              </p>
              <MapContainer
                center={[45.969, 14.326]}
                zoom={11}
                style={{ height: 260 }}
                scrollWheelZoom={false}
              >
                <TileBase />
                <LocationPicker onPick={pickLocation} />
                {picked && (
                  <CircleMarker
                    center={picked}
                    radius={8}
                    pathOptions={{ fillColor: "#22765d", fillOpacity: 1 }}
                  />
                )}
              </MapContainer>
              {picked && (
                <p className="waste-picker-confirmation" role="status">
                  <Check size={16} />
                  Lokacija je izbrana. Za vzorčne termine pritisnite Prikaži
                  urnik nad zemljevidom.
                </p>
              )}
            </div>
          </AnimatedDisclosure>
        </section>
        {schedule ? (
          <section className="waste-schedule">
            <div className="section-heading waste-results-heading">
              <div>
                <span className="eyebrow">VAŠ PRIKAZNI URNIK</span>
                <h2>{schedule.address}</h2>
              </div>
              <CmsAnchor
                href={`/api/calendar?${new URLSearchParams({ address: schedule.address })}`}
                className="button secondary"
              >
                <Download size={17} />
                Vsi prikazani termini (.ics)
              </CmsAnchor>
            </div>
            <p className="waste-calendar-note">
              Pri posameznem odvozu izberite »Dodaj v koledar«: določite lahko
              en termin ali ponavljanje ter izberete koledar svoje naprave.
              Povezava zgoraj prenese vse prikazane termine brez dodatnega
              ponavljanja.
            </p>
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
                          Naslednji prikazni odvoz
                        </span>
                      )}
                      <span className="waste-demo-label">PRIMER</span>
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
                    aria-label={`Dodaj prikazni odvoz ${event.label}, ${displayDate(event.date, { day: "numeric", month: "long" })} v koledar in izberi ponavljanje`}
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
                <h3>Za ta naslov ni terminov.</h3>
                <p>Preverite vpisani naslov ali se obrnite na KPV.</p>
              </div>
            )}
          </section>
        ) : (
          <div className="waste-schedule-placeholder">
            <span>
              <CalendarDays size={38} strokeWidth={1.4} />
            </span>
            <h2>Urnik po meri vašega doma.</h2>
            <p>
              Po vnosu naslova se bodo tu prikazali vzorčni odvozi
              <br />
              mešanih, bioloških odpadkov in embalaže.
            </p>
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
        )}
        {calendarEvent && schedule && (
          <CalendarDialog
            event={calendarEvent}
            address={schedule.address}
            onClose={() => setCalendarEvent(null)}
          />
        )}
        <div className="waste-bottom-help">
          <div>
            <Info size={24} />
            <span>
              <strong>Kaj pa papir in steklo?</strong>
              <p>Oddate ju lahko v ustrezne zbiralnike na ekoloških otokih.</p>
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
