import { CmsText } from "../content/ContentFields";
import SubscriptionForm from "../components/SubscriptionForm";
import UtilityCalculator from "../components/UtilityCalculator";
import ServicePriceGuide from "../components/ServicePriceGuide";
import MapPointLink from '../components/MapPointLink';
import {validCoordinates} from '../../shared/location.js';
import { CmsLayout, nativeSection, cmsNative, CmsLink as Link, CmsAnchor } from "../content/PageComposer";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Popup,
  useMap,
  useMapEvents,
} from "react-leaflet";
import {
  ArrowRight,
  Bell,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  Clock3,
  CreditCard,
  Droplets,
  ExternalLink,
  FileText,
  Flower2,
  Leaf,
  Lightbulb,
  LocateFixed,
  Mail,
  MapPin,
  Phone,
  Recycle,
  Route as Road,
  ShoppingBag,
  Sofa,
  Store,
  Trash2,
  Upload,
  Waves,
  Wrench,
  X,
  ChevronDown,
} from "lucide-react";
import "leaflet/dist/leaflet.css";
import BotProtection, { resetProtection } from "../components/BotProtection";
import AnimatedDisclosure from "../components/AnimatedDisclosure";
import { useSiteContent, telephone } from "../content/SiteContent";
import "./services.css";
import { submissionFingerprint } from "../content/submission-request";
import { readSavedAddress as rememberedAddress } from "../data/saved-address";

type Notice = {
  id: string;
  title: string;
  category: "water" | "roads" | "waste" | "general";
  area: string;
  date: string;
  summary: string;
  status: string;
  latitude: number | null;
  longitude: number | null;
};
type Receipt = {
  id: string;
  message?: string;
  emailStatus?: "queued" | "disabled";
  previousInput?: boolean;
};
const categories = {
  water: "Voda in kanalizacija",
  roads: "Ceste in javne površine",
  waste: "Odpadki",
  general: "Splošno",
};
const statusLabels: Record<string, string> = {
  planned: "Načrtovano",
  info: "Informacija",
  active: "V teku",
  resolved: "Zaključeno",
};
const euro = (value: number) =>
  new Intl.NumberFormat("sl-SI", { style: "currency", currency: "EUR" }).format(
    value,
  );
const dateLabel = (date: string) =>
  new Intl.DateTimeFormat("sl-SI", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(date.slice(0, 10) + "T12:00:00"));
const today = () =>
  new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Ljubljana" });

function Intro({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children: ReactNode;
}) {
  const { pathname } = useLocation();
  return (
    <header className="page-intro">
      <div className="eyebrow">{eyebrow}</div>
      <h1><CmsText id={`intro:${pathname}:title`}>{title}</CmsText></h1>
      <p>{typeof children === "string" ? <CmsText id={`intro:${pathname}:description`}>{children}</CmsText> : children}</p>
    </header>
  );
}
function Demo({ children }: { children?: ReactNode }) {
  if (!children) return null;
  return <div className="svc-demo"><CircleAlert size={18}/><span>{children}</span></div>;
}
function Consent({
  text = "Strinjam se z obdelavo vnesenih podatkov za obravnavo te oddaje.",
}: {
  text?: string;
}) {
  return (
    <label className="svc-consent">
      <input type="checkbox" name="consent" required />
      <span>{text}</span>
    </label>
  );
}
function Result({
  receipt,
  error,
}: {
  receipt: Receipt | null;
  error: string;
}) {
  const result = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (receipt || error)
      result.current?.scrollIntoView({
        block: "nearest",
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "auto"
          : "smooth",
      });
  }, [receipt, error]);
  if (receipt)
    return (
      <div className="svc-success" role="status" ref={result}>
        <CheckCircle2 size={23} />
        <div>
          <strong>{receipt.previousInput ? "Prejšnja oddaja je shranjena." : "Vaša oddaja je shranjena."}</strong>
          {receipt.previousInput && <p>Potrditev velja za podatke ob oddaji. Spremembe, ki ste jih vnesli med čakanjem, še niso oddane.</p>}
          <p>
            Referenca: {receipt.id}.{" "}
            {receipt.message ||
              "Podatki so shranjeni. Izvedba oziroma termin se potrdita po obravnavi."}
          </p>
        </div>
      </div>
    );
  if (error)
    return (
      <div className="svc-error" role="alert" ref={result}>
        <CircleAlert size={18} />
        {error}
      </div>
    );
  return null;
}
function useSubmission() {
  const [busy, setBusy] = useState(false);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [error, setError] = useState("");
  const pending = useRef<{ fingerprint: string; id: string } | null>(null);
  const completed = useRef<{ fingerprint: string; receipt: Receipt } | null>(null);
  const sending = useRef(false);
  const generation = useRef(0);
  async function submit(endpoint: string, payload: object | FormData) {
    if (sending.current) return false;
    const submittedGeneration = generation.current;
    const fingerprint = submissionFingerprint(endpoint, payload);
    if (completed.current?.fingerprint === fingerprint) {
      setError("");
      setReceipt(completed.current.receipt);
      return true;
    }
    setError("");
    setReceipt(null);
    const action = endpoint.replace("/api/", "");
    const surface = document.querySelector<HTMLElement>(
      `[data-bot-action="${action}"]`,
    );
    const token =
      payload instanceof FormData
        ? payload.get("cf-turnstile-response")
        : (payload as Record<string, unknown>)["cf-turnstile-response"];
    if (
      surface?.dataset.botMode === "protected" &&
      (typeof token !== "string" || !token)
    ) {
      setError(
        "Počakajte na varnostno preverjanje. Če se pokaže potrditveno polje, ga označite, nato znova oddajte obrazec.",
      );
      return false;
    }
    if (pending.current?.fingerprint !== fingerprint)
      pending.current = { fingerprint, id: crypto.randomUUID() };
    const requestId = pending.current.id;
    const body = payload instanceof FormData ? payload : { ...payload, requestId };
    if (body instanceof FormData) body.set("requestId", requestId);
    sending.current = true;
    setBusy(true);
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 20000);
    try {
      const isForm = payload instanceof FormData;
      const response = await fetch(endpoint, {
        method: "POST",
        signal: controller.signal,
        headers: isForm ? undefined : { "Content-Type": "application/json" },
        body: isForm ? body as FormData : JSON.stringify(body),
      });
      let data;
      try {
        data = await response.json();
      } catch {
        throw new Error(
          "Strežnik trenutno ni dosegljiv. Podatke smo ohranili v obrazcu; poskusite znova.",
        );
      }
      if (!response.ok)
        throw new Error(
          data.error ||
            data.message ||
            "Shranjevanje ni uspelo. Preverite vnos in poskusite znova.",
        );
      if (!data || typeof data.id !== "string")
        throw new Error(
          "Potrditve shranjevanja nismo prejeli. Preverite povezavo in poskusite znova.",
        );
      setReceipt({ ...data, previousInput: generation.current !== submittedGeneration });
      completed.current = { fingerprint, receipt: data };
      pending.current = null;
      return true;
    } catch (cause) {
      const failure =
        cause instanceof Error && cause.name === "AbortError"
          ? "Strežnik se ni pravočasno odzval. Podatki ostajajo v obrazcu; poskusite znova."
          : cause instanceof TypeError
            ? "Povezava s strežnikom ni uspela. Preverite internetno povezavo in poskusite znova."
            : cause instanceof Error
              ? cause.message
              : "Povezava ni uspela. Poskusite znova.";
      setError(generation.current === submittedGeneration ? failure : `Prejšnje oddaje nismo mogli potrditi. Spremenjeni podatki še niso oddani. ${failure}`);
      return false;
    } finally {
      window.clearTimeout(timeout);
      setBusy(false);
      sending.current = false;
      resetProtection(action);
    }
  }
  return {
    busy,
    receipt,
    error,
    submit,
    clearResult: () => {
      generation.current += 1;
      setReceipt(null);
      setError("");
    },
  };
}
function Values(event: FormEvent<HTMLFormElement>) {
  event.preventDefault();
  return Object.fromEntries(new FormData(event.currentTarget));
}
function Field({
  label,
  children,
  wide = false,
}: {
  label: string;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <label className={`field${wide ? " svc-wide" : ""}`}>
      <span>{label}</span>
      {children}
    </label>
  );
}
function Source({
  href = "https://www.kpv.si/",
  children = "Uradna spletna stran KPV",
}: {
  href?: string;
  children?: ReactNode;
}) {
  return (
    <CmsAnchor
      className="svc-source"
      href={href}
      target="_blank"
      rel="noreferrer"
    >
      {children}
      <ExternalLink size={14} />
    </CmsAnchor>
  );
}

function useNotices() {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const abort = new AbortController();
    let active = true;
    const timeout = window.setTimeout(() => abort.abort(), 15000);
    setLoading(true);
    setError("");
    fetch("/api/notices", { signal: abort.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error();
        const data = await response.json();
        if (
          !Array.isArray(data.notices) ||
          !data.notices.every(
            (notice: Notice) =>
              notice &&
              typeof notice.id === "string" &&
              typeof notice.title === "string" &&
              typeof notice.summary === "string" &&
              typeof notice.area === "string" &&
              notice.category in categories &&
              typeof notice.date === "string" &&
              Number.isFinite(Date.parse(notice.date)),
          )
        )
          throw new Error();
        return data.notices as Notice[];
      })
      .then((data) => {
        if (active) setNotices(data);
      })
      .catch(() => {
        if (active)
          setError(
            "Obvestil trenutno ni mogoče naložiti. Preverite povezavo ali poskusite znova. Za uradne informacije obiščite kpv.si.",
          );
      })
      .finally(() => {
        window.clearTimeout(timeout);
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      window.clearTimeout(timeout);
      abort.abort();
    };
  }, [attempt]);
  return {
    notices,
    loading,
    error,
    retry: () => setAttempt((value) => value + 1),
  };
}
function NoticeError({ error, retry }: { error: string; retry: () => void }) {
  return (
    <div className="svc-load-error">
      <p className="svc-error" role="alert">
        <CircleAlert size={18} />
        {error}
      </p>
      <button className="button secondary" type="button" onClick={retry}>
        Poskusi znova
        <ArrowRight size={16} />
      </button>
      <Source />
    </div>
  );
}
function NoticeCards({ notices }: { notices: Notice[] }) {
  return (
    <div className="svc-notices">
      {notices.map((notice) => (
        <article key={notice.id} id={notice.id} className="panel svc-notice">
          <div className={`svc-notice-symbol ${notice.category}`}>
            {notice.category === "water" ? (
              <Droplets size={23} />
            ) : notice.category === "roads" ? (
              <Road size={23} />
            ) : (
              <Recycle size={23} />
            )}
          </div>
          <div>
            <div className="svc-meta">
              <span className={`tag ${notice.category}`}>
                {categories[notice.category]}
              </span>
              <span>{dateLabel(notice.date)}</span>
              <span className="svc-status">
                {statusLabels[notice.status] || notice.status}
              </span>
            </div>
            <h3>{notice.title}</h3>
            <p>{notice.summary}</p>
            <div className="svc-notice-bottom">
              <span>
                <MapPin size={15} />
                {notice.area}
              </span>
              <MapPointLink latitude={notice.latitude} longitude={notice.longitude} label="Lokacija na zemljevidu"/>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}
export function NoticesPage() {
  const { notices, loading, error, retry } = useNotices();
  const [params] = useSearchParams();
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  useEffect(() => {
    const category = params.get("category");
    setFilter(category && category in categories ? category : "all");
  }, [params]);
  const normalize = (value: string) =>
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  const shown = notices.filter(
    (n) =>
      (filter === "all" || n.category === filter) &&
      normalize(`${n.title} ${n.area} ${n.summary}`).includes(
        normalize(search),
      ),
  );
  return (
    <CmsLayout>
      <Intro key={nativeSection("NoticesPage.introduction")} eyebrow="AKTUALNO V VAŠEM KRAJU" title="Vedno dobro obveščeni.">
        Vzdrževalna dela, spremembe odvozov in druge informacije za lažji
        vsakdan. Vse na enem mestu.
      </Intro>
      <p key={nativeSection("NoticesPage.subscription-link")}><Link className="text-link" to="/obvestila#narocilo"><Bell size={17}/>Prejemajte obvestila za svoj naslov po e-pošti<ArrowRight size={16}/></Link></p>
      <Demo key={nativeSection("NoticesPage.guidance")} />
      <div key={nativeSection("NoticesPage.svc-filter-row")} className="svc-filter-row">
        <div className="svc-tabs" aria-label="Vrsta obvestil">
          <button
            aria-pressed={filter === "all"}
            onClick={() => setFilter("all")}
          >
            Vsa obvestila
          </button>
          {Object.entries(categories).map(([key, name]) => (
            <button
              key={key}
              aria-pressed={filter === key}
              onClick={() => setFilter(key)}
            >
              {name}
            </button>
          ))}
        </div>
        <input
          className="svc-search"
          aria-label="Poišči kraj ali obvestilo"
          placeholder="Poiščite kraj ali obvestilo …"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      {cmsNative(nativeSection("NoticesPage.results"), (loading ? (
        <p role="status"><CmsText id="NoticesPage.p-1">{"Nalagamo obvestila …"}</CmsText></p>
      ) : error ? (
        <NoticeError error={error} retry={retry} />
      ) : shown.length ? (
        <NoticeCards notices={shown} />
      ) : (
        <div className="empty-state">
          <Bell />
          <h3><CmsText id="NoticesPage.h3-1">{"Ni obvestil za izbrani filter."}</CmsText></h3>
          <p><CmsText id="NoticesPage.p-2">{"Poskusite drug kraj ali izberite vse teme."}</CmsText></p>
        </div>
      )))}
      <SubscriptionForm key={nativeSection("NoticesPage.SubscriptionForm")} />
    </CmsLayout>
  );
}
export function RoadsPage() {
  const { notices, loading, error, retry } = useNotices();
  const roads = notices.filter((n) => n.category === "roads");
  return (
    <CmsLayout>
      <Intro key={nativeSection("RoadsPage.introduction")} eyebrow="JAVNE POVRŠINE" title="Varno po naših poteh.">
        Pregled del na cestah in javnih površinah. Ste opazili poškodbo ali
        nedelujočo svetilko? Sporočite nam lokacijo.
      </Intro>
      <p key={nativeSection("RoadsPage.subscription-link")}><Link className="text-link" to="/obvestila#narocilo"><Bell size={17}/>Prejemajte obvestila o cestah in zaporah po e-pošti<ArrowRight size={16}/></Link></p>
      <Demo key={nativeSection("RoadsPage.guidance")} />
      <section key={nativeSection("RoadsPage.svc-road-layout")} className="svc-road-layout">
        <div className="svc-map-wrap">
          <MapContainer
            center={[45.945, 14.325]}
            zoom={12}
            scrollWheelZoom={false}
            className="svc-map"
            aria-label="Zemljevid cestnih del"
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {roads
              .filter(
                (n) =>
                  validCoordinates(n.latitude,n.longitude),
              )
              .map((n) => (
                <CircleMarker
                  key={n.id}
                  center={[n.latitude!, n.longitude!]}
                  radius={11}
                  pathOptions={{
                    color: "#ffffff",
                    fillColor: "#d18a39",
                    fillOpacity: 1,
                    weight: 3,
                  }}
                >
                  <Popup>
                    <strong>{n.title}</strong>
                    <p>{n.area}</p>
                    <MapPointLink latitude={n.latitude} longitude={n.longitude} label="Odpri točko v Google Zemljevidih"/>
                  </Popup>
                </CircleMarker>
              ))}
          </MapContainer>
          <span className="svc-map-caption">
            <span />
            Lokacije objavljenih del · premikajte in povečajte zemljevid
          </span>
        </div>
        <aside className="svc-road-aside">
          <div className="svc-icon">
            <Wrench size={24} />
          </div>
          <h2>
            <CmsText id="RoadsPage.h2-1">{"Majhna prijava."}</CmsText><br />
            <CmsText id="RoadsPage.h2-2">{"Velika sprememba."}</CmsText></h2>
          <p>
            <CmsText id="RoadsPage.p-1">{"Poškodovan pločnik, ulična svetilka ali zabojnik? Dodajte fotografijo in lokacijo v nekaj korakih."}</CmsText></p>
          <Link className="button" to="/prijavi">
            Prijavi težavo
            <ArrowRight size={17} />
          </Link>
          <p className="svc-small">
            <CmsText id="RoadsPage.p-2">{"V nujnih primerih pokličite dežurno službo."}</CmsText></p>
        </aside>
      </section>
      <div key={nativeSection("RoadsPage.section-heading")} className="section-heading">
        <div>
          <div className="eyebrow">PREGLED PO LOKACIJAH</div>
          <h2><CmsText id="RoadsPage.h2-3">{"Dela in zapore"}</CmsText></h2>
        </div>
        <Link to="/obvestila">
          Vsa obvestila
          <ArrowRight size={16} />
        </Link>
      </div>
      {cmsNative(nativeSection("RoadsPage.results"), (loading ? (
        <p><CmsText id="RoadsPage.p-3">{"Nalagamo pregled …"}</CmsText></p>
      ) : error ? (
        <NoticeError error={error} retry={retry} />
      ) : roads.length ? (
        <NoticeCards notices={roads} />
      ) : (
        <p className="empty-state"><CmsText id="RoadsPage.p-4">{"Ni objavljenih cestnih del."}</CmsText></p>
      )))}
      <SubscriptionForm key={nativeSection("RoadsPage.SubscriptionForm")} />
    </CmsLayout>
  );
}
function MapPosition({
  position,
  onChange,
}: {
  position: [number, number] | null;
  onChange: (value: [number, number]) => void;
}) {
  const map = useMap();
  useMapEvents({
    click: (event) => onChange([event.latlng.lat, event.latlng.lng]),
  });
  useEffect(() => {
    if (position) map.setView(position, 15);
  }, [position, map]);
  return position ? (
    <CircleMarker
      center={position}
      radius={10}
      pathOptions={{
        color: "#fff",
        fillColor: "#258467",
        fillOpacity: 1,
        weight: 3,
      }}
    >
      <Popup>Izbrana lokacija prijave</Popup>
    </CircleMarker>
  ) : null;
}
function MapNavigation({ enabled }: { enabled: boolean }) {
  const map = useMap();
  useEffect(() => {
    if (enabled) {
      map.dragging.enable();
      map.touchZoom.enable();
      map.keyboard.enable();
    } else {
      map.dragging.disable();
      map.touchZoom.disable();
      map.keyboard.disable();
    }
  }, [enabled, map]);
  return null;
}
export function ReportPage() {
  const { settings } = useSiteContent();
  const [params] = useSearchParams();
  const [category, setCategory] = useState("roads");
  const [address, setAddress] = useState("");
  const [position, setPosition] = useState<[number, number] | null>(null);
  const [draftPosition, setDraftPosition] = useState<[number, number] | null>(
    null,
  );
  const [mapOpen, setMapOpen] = useState(false);
  const [mapInteractive, setMapInteractive] = useState(false);
  const [locating, setLocating] = useState(false);
  const [geoError, setGeoError] = useState("");
  const [positionSource, setPositionSource] = useState("zemljevid");
  const [fileName, setFileName] = useState("");
  const [preview, setPreview] = useState("");
  const [photoError, setPhotoError] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const locationRequest = useRef(0);
  const submission = useSubmission();
  useEffect(() => {
    const value = params.get("category");
    setCategory(
      value && ["roads", "lighting", "bins", "other"].includes(value)
        ? value
        : "roads",
    );
  }, [params]);
  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );
  useEffect(
    () => () => {
      locationRequest.current += 1;
    },
    [],
  );
  function openMap() {
    locationRequest.current += 1;
    setLocating(false);
    setDraftPosition(position);
    setPositionSource("zemljevid");
    setMapOpen(true);
    setMapInteractive(false);
    setGeoError("");
  }
  function locate() {
    setGeoError("");
    if (!navigator.geolocation) {
      setGeoError(
        "Vaš brskalnik ne podpira lokacije. Vpišite opis ali označite točko na zemljevidu.",
      );
      return;
    }
    const request = ++locationRequest.current;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (value) => {
        if (request !== locationRequest.current) return;
        setDraftPosition([value.coords.latitude, value.coords.longitude]);
        setPositionSource("telefon");
        setMapOpen(true);
        setMapInteractive(false);
        setLocating(false);
      },
      (error) => {
        if (request !== locationRequest.current) return;
        setLocating(false);
        setGeoError(
          error.code === 1
            ? "Dostop do lokacije je zavrnjen. Naslov lahko vpišete ročno ali sami označite točko na zemljevidu."
            : "Lokacije ni bilo mogoče pridobiti. Vpišite naslov ali označite točko na zemljevidu.",
        );
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  }
  function removePhoto() {
    submission.clearResult();
    if (fileInput.current) fileInput.current.value = "";
    setPreview("");
    setFileName("");
    setPhotoError("");
  }
  const reportOptions = [
    {
      value: "roads",
      title: "Cesta ali pločnik",
      icon: Road,
      example:
        "Npr. udarna jama na cesti, poškodovan pločnik ali odmaknjen pokrov jaška …",
    },
    {
      value: "lighting",
      title: "Javna razsvetljava",
      icon: Lightbulb,
      example:
        "Npr. svetilka pri hiši št. 12 ne sveti. Če je vidna, dodajte številko droga …",
    },
    {
      value: "bins",
      title: "Poškodovan zabojnik",
      icon: Trash2,
      example:
        "Npr. poškodovan pokrov zabojnika za steklo na ekološkem otoku …",
    },
    {
      value: "other",
      title: "Druga težava",
      icon: Wrench,
      example: "Opišite, kaj ste opazili in kako težavo prepoznamo …",
    },
  ];
  return (
    <CmsLayout>
      <Intro key={nativeSection("ReportPage.introduction")}
        eyebrow="SKUPAJ ZA UREJEN KRAJ"
        title="Opazite. Sporočite. Uredimo."
      >
        Izberite težavo, opišite lokacijo in po želji dodajte fotografijo. Za
        prijavo zadošča tudi opis lokacije brez GPS.
      </Intro>
      <Demo key={nativeSection("ReportPage.guidance")}>Prijavo obravnava skrbnik portala. Za nujne okvare pokličite dežurno službo.</Demo>
      <nav key={nativeSection("ReportPage.svc-report-steps")} className="svc-report-steps" aria-label="Koraki prijave">
        {[
          ["1", "Težava", "tezava"],
          ["2", "Lokacija", "lokacija"],
          ["3", "Fotografija", "fotografija"],
          ["4", "Kontakt", "kontakt-prijave"],
        ].map(([n, label, id]) => (
          <CmsAnchor key={id} href={`#${id}`}>
            <span>{n}</span>
            {label}
          </CmsAnchor>
        ))}
      </nav>
      <form key={nativeSection("ReportPage.report-form")}
        onChange={submission.clearResult}
        className="svc-report-layout"
        onSubmit={async (event) => {
          event.preventDefault();
          if (photoError) return;
          const data = new FormData(event.currentTarget);
          data.set("category", category);
          data.set("consent", "true");
          if (position) {
            data.set("latitude", String(position[0]));
            data.set("longitude", String(position[1]));
          }
          await submission.submit("/api/reports", data);
        }}
      >
        <div className="panel">
          <section id="tezava" className="svc-report-step">
            <div className="svc-step">
              <span>01</span>
              <h2><CmsText id="ReportPage.h2-1">{"Kaj ste opazili?"}</CmsText></h2>
            </div>
            <div className="svc-type-grid">
              {reportOptions.map((item) => (
                <button
                  type="button"
                  key={item.value}
                  className={category === item.value ? "selected" : ""}
                  aria-pressed={category === item.value}
                  onClick={() => { setCategory(item.value); submission.clearResult(); }}
                >
                  <item.icon size={23} />
                  <span>{item.title}</span>
                  {category === item.value && <Check size={15} />}
                </button>
              ))}
            </div>
            <Field label="Opis težave · obvezno">
              <textarea
                name="description"
                required
                minLength={10}
                maxLength={2000}
                rows={4}
                placeholder={
                  reportOptions.find((item) => item.value === category)?.example
                }
              />
            </Field>
          </section>
          <section id="lokacija" className="svc-report-step">
            <div className="svc-step">
              <span>02</span>
              <h2><CmsText id="ReportPage.h2-2">{"Kje je težava?"}</CmsText></h2>
            </div>
            <p className="svc-step-explanation">
              <CmsText id="ReportPage.p-1">{"Vpišite naslov ali opis, po katerem bomo našli težavo."}</CmsText>{" "}
              <strong><CmsText id="ReportPage.strong-1">{"To ni nujno vaš domači naslov."}</CmsText></strong>
            </p>
            <Field label="Naslov ali opis mesta težave · obvezno">
              <input
                name="address"
                required
                minLength={4}
                maxLength={200}
                value={address}
                onChange={(event) => setAddress(event.target.value)}
                placeholder="Npr. pri hiši Verd 12, nasproti avtobusne postaje"
                aria-describedby="report-address-help"
              />
            </Field>
            <p className="svc-small" id="report-address-help">
              <CmsText id="ReportPage.p-2">{"Hišne številke ne poznate? Navedite kraj, ulico in bližnji objekt. Domačega naslova sem ne prepišemo samodejno."}</CmsText></p>
            <div className="svc-location-optional">
              <strong><CmsText id="ReportPage.strong-2">{"Natančna točka · neobvezno"}</CmsText></strong>
              <p>
                <CmsText id="ReportPage.p-3">{"Ste ob težavi? Uporabite lokacijo telefona. Sicer jo sami označite na zemljevidu."}</CmsText></p>
              <div className="svc-location-actions">
                <button
                  className="button secondary"
                  type="button"
                  disabled={locating}
                  onClick={locate}
                  aria-busy={locating}
                >
                  <LocateFixed size={17} />
                  {locating
                    ? "Pridobivam lokacijo …"
                    : "Uporabi lokacijo telefona"}
                </button>
                <button
                  className="button secondary"
                  type="button"
                  onClick={openMap}
                  aria-expanded={mapOpen}
                  aria-controls="report-map"
                >
                  <MapPin size={17} />
                  {position
                    ? "Popravi točko na zemljevidu"
                    : "Označi na zemljevidu"}
                </button>
              </div>
              {locating && (
                <p className="svc-small" role="status">
                  <CmsText id="ReportPage.p-4">{"Brskalnik vas lahko vpraša za dovoljenje. Naslova s tem še ne določimo."}</CmsText></p>
              )}
              {geoError && (
                <p className="svc-error" role="alert">
                  <CircleAlert size={17} />
                  {geoError}
                </p>
              )}
              {position && (
                <div className="svc-location-confirmed" role="status">
                  <CheckCircle2 size={20} />
                  <div>
                    <strong><CmsText id="ReportPage.strong-3">{"Natančna točka je dodana."}</CmsText></strong>
                    <MapPointLink latitude={position[0]} longitude={position[1]} label="Preveri točko v Google Zemljevidih"/>
                  </div>
                  <button
                    type="button"
                    aria-label="Odstrani dodano točko"
                    onClick={() => {
                      locationRequest.current += 1;
                      setLocating(false);
                      setPosition(null);
                      submission.clearResult();
                      setDraftPosition(null);
                      setMapOpen(false);
                    }}
                  >
                    <X size={18} />
                    <span>Odstrani</span>
                  </button>
                </div>
              )}
              <AnimatedDisclosure open={mapOpen}>
                <div id="report-map" className="svc-report-map-picker">
                  <div className="svc-map-picker-heading">
                    <strong><CmsText id="ReportPage.strong-4">{"Izberite mesto težave"}</CmsText></strong>
                    <p>
                      {positionSource === "telefon" && draftPosition
                        ? "Preverite predlagano lokacijo telefona. Ta ni nujno točno mesto težave."
                        : "Tapnite ali kliknite na mesto težave. Ko ste zadovoljni s točko, jo potrdite."}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="svc-map-mode"
                    aria-pressed={mapInteractive}
                    onClick={() => setMapInteractive((v) => !v)}
                  >
                    {mapInteractive
                      ? "Končaj premikanje zemljevida"
                      : "Omogoči premikanje zemljevida"}
                    <MapPin size={16} />
                  </button>
                  <div className="svc-map-wrap">
                    <MapContainer
                      center={draftPosition || [45.964, 14.298]}
                      zoom={draftPosition ? 15 : 13}
                      scrollWheelZoom={false}
                      dragging={false}
                      touchZoom={false}
                      keyboard={false}
                      className="svc-map"
                      aria-label="Izberite mesto težave na zemljevidu"
                    >
                      <TileLayer
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                      />
                      <MapNavigation enabled={mapInteractive} />
                      <MapPosition
                        position={draftPosition}
                        onChange={(value) => {
                          setDraftPosition(value);
                          setPositionSource("zemljevid");
                        }}
                      />
                    </MapContainer>
                    <div className="svc-map-caption">
                      {draftPosition
                        ? <MapPointLink latitude={draftPosition[0]} longitude={draftPosition[1]} label="Preveri izbrano točko v Google Zemljevidih"/>
                        : "Točka še ni izbrana. Za izbiro tapnite zemljevid."}
                    </div>
                  </div>
                  <div className="svc-map-picker-actions">
                    <button
                      type="button"
                      className="button"
                      disabled={!draftPosition}
                      onClick={() => {
                        setPosition(draftPosition);
                        submission.clearResult();
                        setMapOpen(false);
                      }}
                    >
                      <Check size={17} />
                      Potrdi točko
                    </button>
                    <button
                      type="button"
                      className="button secondary"
                      onClick={() => {
                        setMapOpen(false);
                        setDraftPosition(position);
                      }}
                    >
                      Prekliči
                    </button>
                  </div>
                  <p className="svc-small">
                    <CmsText id="ReportPage.p-5">{"Zemljevid dopolnjuje opis lokacije. Če zemljevid ne deluje, lahko prijavo oddate samo z opisom."}</CmsText></p>
                </div>
              </AnimatedDisclosure>
            </div>
          </section>
          <section id="fotografija" className="svc-report-step">
            <div className="svc-step">
              <span>03</span>
              <h2>
                <CmsText id="ReportPage.h2-3">{"Dodajte fotografijo "}</CmsText><small><CmsText id="ReportPage.small-1">{"neobvezno"}</CmsText></small>
              </h2>
            </div>
            <p className="svc-step-explanation">
              <CmsText id="ReportPage.p-6">{"Fotografija pomaga razumeti težavo. Če je nimate, nadaljujte na kontakt."}</CmsText></p>
            <div className="svc-photo">
              <label>
                <Upload size={22} />
                <strong>{fileName || "Izberite fotografijo"}</strong>
                <span>JPG, PNG ali WebP · največ 5 MB</span>
                <input
                  ref={fileInput}
                  name="photo"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(event) => {
                    setPhotoError("");
                    const file = event.target.files?.[0];
                    if (!file) {
                      setFileName("");
                      setPreview("");
                      return;
                    }
                    if (
                      file.size > 5 * 1024 * 1024 ||
                      !["image/jpeg", "image/png", "image/webp"].includes(
                        file.type,
                      )
                    ) {
                      setPhotoError(
                        "Izberite fotografijo JPG, PNG ali WebP do 5 MB. Na iPhonu izberite združljiv zapis JPG ali oddajte brez fotografije.",
                      );
                      event.target.value = "";
                      setFileName("");
                      setPreview("");
                      return;
                    }
                    setFileName(file.name);
                    setPreview(URL.createObjectURL(file));
                  }}
                />
              </label>
              {preview && (
                <div className="svc-photo-preview">
                  <img
                    src={preview}
                    alt="Predogled fotografije prijavljene težave"
                  />
                  <button
                    type="button"
                    className="button secondary"
                    onClick={removePhoto}
                  >
                    <X size={17} />
                    Odstrani fotografijo
                  </button>
                </div>
              )}
            </div>
            {photoError && (
              <>
                <p className="svc-error" role="alert">
                  {photoError}
                </p>
                <button
                  type="button"
                  className="button secondary"
                  onClick={removePhoto}
                >
                  Nadaljuj brez fotografije
                  <ArrowRight size={16} />
                </button>
              </>
            )}
          </section>
          <section id="kontakt-prijave" className="svc-report-step">
            <div className="svc-step">
              <span>04</span>
              <h2><CmsText id="ReportPage.h2-4">{"Vaš kontakt"}</CmsText></h2>
            </div>
            <p className="svc-step-explanation">
              <CmsText id="ReportPage.p-7">{"Kontakt uporabimo za obravnavo vaše prijave. Samodejnega odgovora po e-pošti ne pošiljamo."}</CmsText></p>
            <div className="form-grid">
              <Field label="Ime in priimek · obvezno">
                <input
                  name="name"
                  minLength={2}
                  required
                  autoComplete="name"
                  maxLength={100}
                  placeholder="Janez Novak"
                />
              </Field>
              <Field label="E-poštni naslov · obvezno">
                <input
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="janez@primer.si"
                />
              </Field>
            </div>
            <Consent />
            {mapOpen && (
              <p className="svc-small">
                <CmsText id="ReportPage.p-8">{"Odprto točko potrdite, če jo želite dodati. Ob oddaji se pošlje samo že potrjena točka."}</CmsText></p>
            )}
            <BotProtection action="reports" />
            <button
              className="button svc-report-submit"
              disabled={submission.busy || !!photoError}
            >
              {submission.busy ? "Shranjujemo …" : "Oddaj prijavo"}
              <ArrowRight size={17} />
            </button>
            <Result receipt={submission.receipt} error={submission.error} />
          </section>
        </div>
        <aside className="svc-report-guidance">
          <div className="svc-help">
            <Lightbulb size={24} />
            <h3><CmsText id="ReportPage.h3-1">{"Da bomo težavo lažje našli."}</CmsText></h3>
            <ul>
              <li>Pri svetilki dodajte številko droga, če je vidna.</li>
              <li>Pri cesti navedite smer vožnje in bližnji objekt.</li>
              <li>Pri zabojniku opišite vrsto odpadkov in zbirno mesto.</li>
            </ul>
            <p><CmsText id="ReportPage.p-9">{"Za oddajo natančna GPS-točka in fotografija nista obvezni."}</CmsText></p>
          </div>
          <div className="svc-report-emergency">
            <Phone size={20} />
            <strong><CmsText id="ReportPage.strong-5">{"Potrebujete nujno pomoč?"}</CmsText></strong>
            <p>
              <CmsText id="ReportPage.p-10">{"Za nujne težave z javno infrastrukturo uporabite uradno dežurno številko. Spletna prijava ni primerna za nujne primere."}</CmsText></p>
            <CmsAnchor href={`tel:${telephone(settings.emergencyPhone)}`}>
              {settings.emergencyPhone}
              <ArrowRight size={17} />
            </CmsAnchor>
          </div>
        </aside>
      </form>
    </CmsLayout>
  );
}
export function ServicesPage() {
  const cms = useSiteContent();
  const icons = { bulky: Sofa, septic: Waves, water: Droplets, other: Wrench };
  const serviceOptions = cms.services.map((item) => ({
    ...item,
    icon: icons[item.value as keyof typeof icons] || Wrench,
  }));
  const [params] = useSearchParams();
  const [service, setService] = useState("bulky");
  const savedExecutionAddress = rememberedAddress();
  const [executionAddress, setExecutionAddress] = useState(rememberedAddress);
  useEffect(() => {
    const value = params.get("service");
    setService(
      serviceOptions.some((option) => option.value === value)
        ? value!
        : "bulky",
    );
  }, [params]);
  const submission = useSubmission();
  const selectedService = serviceOptions.find(
    (item) => item.value === service,
  )!;
  const guide = selectedService;
  return (
    <CmsLayout>
      <Intro key={nativeSection("ServicesPage.introduction")} eyebrow="STORITVE ZA VAŠ DOM" title="Uredite kar od doma.">
        Od odsluženega kavča do praznjenja greznice. Izberite storitev in nam
        zaupajte, kaj potrebujete.
      </Intro>
      <div key={nativeSection("ServicesPage.svc-service-tools")} className="svc-service-tools">
        <span>Iščete kaj drugega?</span>
        <Link to="/trznica">
          Tržnica
          <Store size={16} />
        </Link>
        <Link to="/kalkulator">
          Izračun stroškov
          <FileText size={16} />
        </Link>
        <Link to="/depo">
          DEPO
          <Recycle size={16} />
        </Link>
        <Link to="/pokopalisce">
          Pokopališče
          <Flower2 size={16} />
        </Link>
      </div>
      <div key={nativeSection("ServicesPage.svc-service-choice-heading")} className="svc-service-choice-heading">
        <span className="eyebrow">01 · IZBIRA STORITVE</span>
        <h2><CmsText id="ServicesPage.h2-1">{"Kaj želite urediti?"}</CmsText></h2>
        <p><CmsText id="ServicesPage.p-1">{"Izbira spodaj prilagodi navodila in povpraševanje."}</CmsText></p>
      </div>
      <div key={nativeSection("ServicesPage.svc-service-grid")}
        className="svc-service-grid"
        role="group"
        aria-label="Izberite storitev"
      >
        {serviceOptions.map((item) => (
          <button
            key={item.value}
            className={`panel svc-service-card${service === item.value ? " selected" : ""}`}
            type="button"
            aria-pressed={service === item.value}
            disabled={submission.busy}
            onClick={() => {
              if (service !== item.value) submission.clearResult();
              setService(item.value);
            }}
          >
            <span className="svc-icon">
              <item.icon size={27} />
            </span>
            <h3>{item.title}</h3>
            <p>{item.desc}</p>
            <span className="svc-select-label">
              {service === item.value ? "Izbrana storitev" : "Izberi storitev"}
              {service === item.value ? (
                <CheckCircle2 size={18} />
              ) : (
                <ArrowRight size={18} />
              )}
            </span>
          </button>
        ))}
      </div>
      <section className="svc-service-guide" key={nativeSection("ServicesPage.svc-service-guide")}>
        <div className="svc-service-guide-intro">
          <div>
            <span className="eyebrow">IZBRANA STORITEV</span>
            <h2>{selectedService.title}</h2>
          </div>
        </div>
        <p>{guide.intro}</p>
        <ServicePriceGuide service={service}/>
        <details>
          <summary>
            <CmsText id="ServicesPage.summary-1">{"Kaj pripraviti pred oddajo?"}</CmsText><ChevronDown size={18} />
          </summary>
          <ul>
            {guide.prepare.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <p>{guide.note}</p>
        </details>
        {service === "other" && (
          <Link className="svc-inline-link" to="/prijavi">
            Želim prijaviti poškodbo ali okvaro
            <ArrowRight size={16} />
          </Link>
        )}
        {service === "water" && (
          <Link className="svc-inline-link" to="/obvestila?category=water">
            Preveri obvestila o oskrbi
            <ArrowRight size={16} />
          </Link>
        )}
      </section>
      <div key={nativeSection("ServicesPage.svc-two-column")} className="svc-two-column">
        <section className="panel" id="povprasevanje">
          <div className="eyebrow">02 · OPIS IN KONTAKT</div>
          <h2>{serviceOptions.find((s) => s.value === service)?.title}</h2>
          <p>
            <CmsText id="ServicesPage.p-2">{"Izpolnite kontakt, naslov izvedbe in opis. Želeni datum je neobvezen in še ni potrjen termin."}</CmsText></p>
          <p className="svc-small">
            <CmsText id="ServicesPage.p-3">{"Vsa polja razen telefona in želenega datuma so obvezna."}</CmsText></p>
          <Demo>Oddaja povpraševanja še ne potrjuje naročila ali termina. Po obravnavi se dogovorimo o izvedbi.</Demo>
          <form
            onChange={submission.clearResult}
            onSubmit={async (event) => {
              const values = Values(event);
              await submission.submit("/api/requests", {
                ...values,
                service,
                consent: true,
              });
            }}
          >
            <div className="form-grid">
              <Field label="Ime in priimek">
                <input
                  name="name"
                  minLength={2}
                  required
                  maxLength={100}
                  autoComplete="name"
                  placeholder="Janez Novak"
                />
              </Field>
              <Field label="E-poštni naslov">
                <input
                  name="email"
                  required
                  type="email"
                  autoComplete="email"
                  placeholder="janez@primer.si"
                />
              </Field>
              <Field label="Telefon · neobvezno">
                <input
                  name="phone"
                  type="tel"
                  autoComplete="tel"
                  maxLength={40}
                  placeholder="041 000 000"
                />
              </Field>
              <Field label="Želeni datum (neobvezno)">
                <input name="preferredDate" type="date" min={today()} />
              </Field>
              <Field label="Naslov izvedbe" wide>
                <input
                  name="address"
                  required
                  minLength={4}
                  maxLength={200}
                  autoComplete="street-address"
                  value={executionAddress}
                  onChange={event => setExecutionAddress(event.target.value)}
                  placeholder="Ulica, hišna številka, kraj"
                />
              </Field>
              {savedExecutionAddress && executionAddress !== savedExecutionAddress && <div className="svc-wide"><button type="button" className="text-link" onClick={() => { setExecutionAddress(savedExecutionAddress); submission.clearResult(); }}>Uporabi shranjeni naslov: {savedExecutionAddress}</button></div>}
              <Field
                label={
                  service === "bulky"
                    ? "Katere predmete želite oddati?"
                    : "Opis storitve"
                }
                wide
              >
                <textarea
                  name="message"
                  required
                  minLength={10}
                  maxLength={2000}
                  rows={5}
                  placeholder={guide.placeholder}
                />
              </Field>
            </div>
            <Consent />
            <BotProtection action="requests" />
            <button className="button" disabled={submission.busy}>
              {submission.busy
                ? "Shranjujemo …"
                : "Oddaj povpraševanje"}
              <ArrowRight size={17} />
            </button>
            <Result receipt={submission.receipt} error={submission.error} />
          </form>
        </section>
        <aside className="svc-help svc-service-help">
          <div className="eyebrow">KAKO POTEKA</div>
          <h2><CmsText id="ServicesPage.h2-2">{"Trije koraki do urejenega doma."}</CmsText></h2>
          {[
            "Izberete ustrezno storitev in opišete potrebe.",
            "Izvajalec preveri podatke, pogoje in ceno.",
            "Skupaj potrdite termin in izvedbo.",
          ].map((text, i) => (
            <div className="svc-process" key={text}>
              <span>{i + 1}</span>
              <p>{text}</p>
            </div>
          ))}
          <p className="svc-small">
            <CmsText id="ServicesPage.p-4">{"Za izvedbo je potreben dogovor o terminu, obsegu in ceni storitve."}</CmsText></p>
          <Link to="/kontakt" className="svc-inline-link">
            Potrebujem pomoč
            <ArrowRight size={17} />
          </Link>
          <hr />
          <h3><CmsText id="ServicesPage.h3-1">{"Bi predmet lahko živel naprej?"}</CmsText></h3>
          <p>
            <CmsText id="ServicesPage.p-5">{"Če je kavč, stol ali drug predmet še uporaben, najprej preverite možnosti ponovne uporabe pri Depoju."}</CmsText></p>
          <Link to="/depo" className="svc-inline-link">
            Spoznajte Depo
            <ArrowRight size={17} />
          </Link>
        </aside>
      </div>
    </CmsLayout>
  );
}

export function MarketPage() {
  const { rates, market } = useSiteContent();
  const [date, setDate] = useState("");
  const [dateError,setDateError] = useState('');
  const [stallType, setStallType] = useState("standard");
  const submission = useSubmission();
  const rate =
    stallType === "food"
      ? rates.marketFood
      : stallType === "craft"
        ? rates.marketCraft
        : rates.marketStandard;
  const dateOptions = useMemo(() => {
    return market.dates
        .filter((date) => date >= today() && !market.closedDates.includes(date))
        .sort();
  }, [market]);
  const noUpcomingDates=!dateOptions.length;
  function chooseDate(value:string){setDate(value);setDateError('');submission.clearResult();}
  useEffect(()=>{
    if(date&&!dateOptions.includes(date)) {
      setDate('');setDateError('Termini so bili posodobljeni. Izberite nov datum prijave.');submission.clearResult();
    }
  },[market,dateOptions]);
  return (
    <CmsLayout>
      <Intro key={nativeSection("MarketPage.introduction")} eyebrow="LOKALNO JE LEPŠE" title="Vaša ponudba. Naša tržnica.">
        Predstavite svoje pridelke in izdelke. Oddajte povpraševanje za prodajno mesto.
      </Intro>
      <Demo key={nativeSection("MarketPage.guidance")}>
        Izberite želeni datum. Razpoložljivost in končno ceno potrdi upravljavec tržnice po prejemu prijave. Plačilo na spletu ni omogočeno.
      </Demo>
      <div key={nativeSection("MarketPage.svc-two-column")} className="svc-two-column">
        <section className="panel">
          <div className="svc-step">
            <span>01</span>
            <h2><CmsText id="MarketPage.h2-1">{"Izberite želeni datum"}</CmsText></h2>
          </div>
          <div className="svc-date-options">
            {dateOptions.map((day) => (
              <button
                type="button"
                key={day}
                className={date === day ? "selected" : ""}
                aria-pressed={date === day}
                disabled={submission.busy}
                onClick={() => chooseDate(day)}
              >
                <span>{new Intl.DateTimeFormat("sl-SI", { weekday: "long" }).format(new Date(day + "T12:00:00"))}</span>
                <strong>{new Date(day + "T12:00:00").getDate()}{"."}</strong>
                <span>
                  {new Intl.DateTimeFormat("sl-SI", { month: "long" }).format(
                    new Date(day + "T12:00:00"),
                  )}
                </span>
                <small><CmsText id="MarketPage.small-1">{"Želeni datum"}</CmsText></small>
              </button>
            ))}
          </div>
          {noUpcomingDates&&<p className="notice" role="status"><CmsText id="MarketPage.p-1">{"Trenutno ni objavljenih prihodnjih terminov za prijavo. Za nov termin se obrnite na upravljavca tržnice."}</CmsText></p>}
          <form
            onChange={submission.clearResult}
            onSubmit={async (event) => {
              const values = Values(event);
              const selected=String(values.date||'');
              if(!/^\d{4}-\d{2}-\d{2}$/.test(selected)||!Number.isFinite(Date.parse(selected+'T12:00:00Z'))||new Date(selected+'T12:00:00Z').toISOString().slice(0,10)!==selected) {setDateError('Izberite veljaven datum prijave.');return;}
              if(selected<today()){setDateError('Izbrani datum je že pretekel. Izberite prihodnji termin.');return;}
              if(!dateOptions.includes(selected)){setDateError('Izbrani termin ni na voljo. Izberite drug objavljen datum ali se obrnite na upravljavca.');return;}
              setDateError('');
              await submission.submit("/api/market", {
                ...values,
                stallType,
                consent: true,
              });
            }}
          >
            <fieldset disabled={submission.busy||noUpcomingDates} style={{border:0,padding:0,minWidth:0}}>
            <Field label="Datum prijave">
              <select name="date" required value={date} onChange={event=>chooseDate(event.target.value)} aria-describedby="market-date-help"><option value="" disabled>Izberite objavljen datum</option>{dateOptions.map(day=><option key={day} value={day}>{dateLabel(day)}</option>)}</select>
            </Field>
            <p id="market-date-help" className="svc-small">Izberete lahko samo objavljene prihodnje termine. Izbira še ne potrdi razpoložljivosti stojnice.</p>
            {dateError&&<p className="svc-error" role="alert">{dateError}</p>}
            <div className="svc-step">
              <span>02</span>
              <h2><CmsText id="MarketPage.h2-2">{"Podatki o ponudniku"}</CmsText></h2>
            </div>
            <div className="form-grid">
              <Field label="Ime ponudnika ali podjetja">
                <input
                  name="name"
                  minLength={2}
                  required
                  maxLength={100}
                  placeholder="Ime kmetije, podjetja ali ustvarjalca"
                />
              </Field>
              <Field label="E-poštni naslov">
                <input
                  name="email"
                  required
                  type="email"
                  autoComplete="email"
                  placeholder="ponudnik@primer.si"
                />
              </Field>
              <Field label="Telefon · neobvezno">
                <input
                  name="phone"
                  type="tel"
                  autoComplete="tel"
                  maxLength={40}
                  placeholder="041 000 000"
                />
              </Field>
              <Field label="Prodajno mesto">
                <select
                  name="stallType"
                  value={stallType}
                  onChange={(event) => setStallType(event.target.value)}
                >
                  <option value="standard">
                    Ostali izdelki
                  </option>
                  <option value="food">
                    Prehrambeni izdelki
                  </option>
                  <option value="craft">
                    Rokodelski izdelki
                  </option>
                </select>
              </Field>
              <Field label="Kaj boste ponujali?" wide>
                <textarea
                  name="products"
                  required
                  minLength={5}
                  maxLength={1000}
                  rows={4}
                  placeholder="Npr. sezonska zelenjava, med, domača keramika …"
                />
              </Field>
            </div>
            <Consent />
            <BotProtection action="market" />
            <button className="button" disabled={submission.busy}>
              {submission.busy ? "Shranjujemo …" : "Oddaj prijavo"}
              <ArrowRight size={17} />
            </button>
            </fieldset>
            <Result receipt={submission.receipt} error={submission.error} />
          </form>
        </section>
        <aside>
          <div className="svc-market-summary">
            <Store size={34} />
            <div className="eyebrow">POVZETEK PRIJAVE</div>
            <h2><CmsText id="MarketPage.h2-3">{"Vaša prijava."}</CmsText></h2>
            <div>
              <span>Datum</span>
              <strong>{date ? dateLabel(date) : "Izberite datum"}</strong>
            </div>
            <div>
              <span>Število mest</span>
              <strong>{"1"}</strong>
            </div>
            <div>
              <span>Najem zunanje stojnice</span>
              <strong>{date && new Date(date + "T12:00:00").getDay() === 6 ? euro(rate) : "Po dogovoru"}</strong>
            </div>
            <p>
              <CreditCard size={18} />
              <CmsText id="MarketPage.p-2">{"Cena za sobotno zunanjo stojnico na Sodnijskem trgu, z DDV. Druge lokacije in dodatne storitve imajo ločen cenik. Plačilo uredite po dogovoru."}</CmsText></p>
            <MapPointLink address="Sodnijski trg, Vrhnika" label="Pot do tržnice na Sodnijskem trgu"/>
          </div>
          <div className="svc-help">
            <Leaf size={23} />
            <h3><CmsText id="MarketPage.h3-1">{"Dobrodošli lokalni ponudniki."}</CmsText></h3>
            <p>
              <CmsText id="MarketPage.p-3">{"Za pogoje prodaje, dovoljenja in dejanske termine preverite uradne informacije pri KPV."}</CmsText></p>
            <Link to="/kontakt" className="svc-inline-link">
              Vprašajte nas
              <ArrowRight size={17} />
            </Link>
          </div>
        </aside>
      </div>
    </CmsLayout>
  );
}

export function CalculatorPage() {
  return <UtilityCalculator/>;
}

export function DepoPage() {
  const { settings } = useSiteContent();
  return (
    <CmsLayout>
      <Intro key={nativeSection("DepoPage.introduction")} eyebrow="PONOVNA UPORABA" title="Staro za nekoga. Novo za vas.">
        Predmeti s preteklostjo si zaslužijo prihodnost. Odkrijte Depo, trgovino
        z rabljenimi in preoblikovanimi predmeti na Vrhniki.
      </Intro>
      <section key={nativeSection("DepoPage.svc-depo-hero")} className="svc-depo-hero">
        <div>
          <div className="eyebrow">DEPO VRHNIKA</div>
          <h2>
            <CmsText id="DepoPage.h2-1">{"Dobre stvari"}</CmsText><br />
            <CmsText id="DepoPage.h2-2">{"dobijo drugo priložnost."}</CmsText></h2>
          <p>
            <CmsText id="DepoPage.p-1">{"Od pohištva do drobnih najdb za dom. Aktualni izdelki vas čakajo v uradnem spletnem katalogu, še več pa v trgovini."}</CmsText></p>
          <CmsAnchor
            className="button"
            href={settings.depoUrl}
            target="_blank"
            rel="noreferrer"
          >
            Raziščite uradno ponudbo
            <ExternalLink size={17} />
          </CmsAnchor>
        </div>
        <div className="svc-depo-art" aria-hidden="true">
          <div className="svc-depo-orbit" />
          <Sofa size={138} strokeWidth={1.1} />
          <span className="svc-depo-stamp">
            MANJ ODPADKOV
            <br />
            <Recycle size={21} />
            VEČ ŽIVLJENJA
          </span>
          <div className="svc-depo-label">
            depo<span>staro za noro.</span>
          </div>
        </div>
      </section>
      <div key={nativeSection("DepoPage.svc-depo-grid")} className="svc-depo-grid">
        <article className="panel">
          <MapPin size={25} />
          <h3><CmsText id="DepoPage.h3-1">{"Obiščite trgovino"}</CmsText></h3>
          <p>
            <CmsText id="DepoPage.p-2">{"Cankarjev trg 6a"}</CmsText><br />
            <CmsText id="DepoPage.p-3">{"1360 Vrhnika"}</CmsText></p>
          <CmsAnchor
            className="svc-inline-link"
            href="https://www.google.com/maps/search/?api=1&query=Depo+Cankarjev+trg+6a+Vrhnika"
            target="_blank"
            rel="noreferrer"
          >
            Načrtujte pot
            <ArrowRight size={17} />
          </CmsAnchor>
        </article>
        <article className="panel">
          <Clock3 size={25} />
          <h3><CmsText id="DepoPage.h3-2">{"Pred obiskom preverite"}</CmsText></h3>
          <p>
            <CmsText id="DepoPage.p-4">{"Ponudba se spreminja. Delovni čas in razpoložljivost predmetov preverite na uradni strani ali po telefonu."}</CmsText></p>
          <CmsAnchor className="svc-inline-link" href="tel:+38641777385">
            041 777 385
            <Phone size={17} />
          </CmsAnchor>
        </article>
        <article className="panel">
          <ShoppingBag size={25} />
          <h3><CmsText id="DepoPage.h3-3">{"Imate še uporaben predmet?"}</CmsText></h3>
          <p>
            <CmsText id="DepoPage.p-5">{"Pred oddajo se z Depojem dogovorite o primernosti in načinu prevzema."}</CmsText></p>
          <CmsAnchor className="svc-inline-link" href="mailto:depo@kpv.si">
            depo@kpv.si
            <Mail size={17} />
          </CmsAnchor>
        </article>
      </div>
      <p key={nativeSection("DepoPage.svc-small")} className="svc-small">
        <CmsText id="DepoPage.p-6">{"Kontaktni podatki in povezava:"}</CmsText>{" "}
        <Source href="https://www.kpv.si/depoVrhnika/trgovina.html">
          Uradna stran Depo Vrhnika
        </Source>
        <CmsText id="DepoPage.p-7">{". Ta portal ne prikazuje lastne zaloge in ne sprejema naročil za izdelke."}</CmsText></p>
    </CmsLayout>
  );
}
const contactAreas = [
  {
    value: "water",
    label: "Voda in kanalizacija",
    topics: [
      { value: "supply", label: "Oskrba s pitno vodo" },
      { value: "septic", label: "Greznica ali mala čistilna naprava" },
      { value: "connection", label: "Priključek in druga vprašanja" },
    ],
  },
  {
    value: "waste",
    label: "Odpadki in ločevanje",
    topics: [
      { value: "collection", label: "Odvoz odpadkov in urnik" },
      { value: "sorting", label: "Ločevanje in zbirna mesta" },
      { value: "bulky", label: "Kosovni odpadki" },
    ],
  },
  {
    value: "roads",
    label: "Ceste in javni prostor",
    topics: [
      { value: "road", label: "Cesta ali pločnik" },
      { value: "lighting", label: "Javna razsvetljava" },
      { value: "public", label: "Druge javne površine" },
    ],
  },
  {
    value: "billing",
    label: "Računi in obračun",
    topics: [
      { value: "invoice", label: "Vprašanje o računu" },
      { value: "meter", label: "Vodomer in poraba" },
      { value: "payment", label: "Plačilo ali e-račun" },
    ],
  },
  {
    value: "market",
    label: "Tržnica",
    topics: [
      { value: "booking", label: "Prijava prodajnega mesta" },
      { value: "conditions", label: "Pogoji in druga vprašanja" },
    ],
  },
  {
    value: "depo",
    label: "DEPO in ponovna uporaba",
    topics: [
      { value: "donation", label: "Oddaja uporabnih predmetov" },
      { value: "purchase", label: "Ponudba in nakup predmetov" },
    ],
  },
  { value: "other", label: "Drugo vprašanje", topics: [] },
];
const contactSuggestions: Record<
  string,
  { text: string; label: string; to: string }
> = {
  "water:supply": {
    text: "Iščete informacije o trenutni motnji oskrbe?",
    label: "Preverite obvestila",
    to: "/obvestila?category=water",
  },
  "water:septic": {
    text: "Želite oddati povpraševanje za praznjenje?",
    label: "Odprite obrazec za storitev",
    to: "/storitve?service=septic",
  },
  "water:connection": {
    text: "Za načrtovan poseg lahko oddate tudi podrobnejše povpraševanje.",
    label: "Vodovodne storitve",
    to: "/storitve?service=water",
  },
  "waste:collection": {
    text: "Datum odvoza lahko preverite tudi sami.",
    label: "Poiščite urnik",
    to: "/odpadki/urnik",
  },
  "waste:sorting": {
    text: "Za vsakdanje predmete vam pomaga čarovnik za ločevanje.",
    label: "Kam z odpadkom?",
    to: "/odpadki/kam-z-odpadki",
  },
  "waste:bulky": {
    text: "Za seznam predmetov in predlog termina uporabite namenski obrazec.",
    label: "Povpraševanje za kosovni odvoz",
    to: "/storitve?service=bulky",
  },
  "roads:road": {
    text: "Prijavljate poškodbo ceste? V namenskem obrazcu lahko dodate fotografijo in lokacijo.",
    label: "Prijavite poškodbo",
    to: "/prijavi?category=roads",
  },
  "roads:lighting": {
    text: "Za nedelujočo svetilko je na voljo prijava s točno lokacijo.",
    label: "Prijavite težavo s svetilko",
    to: "/prijavi?category=lighting",
  },
  "roads:public": {
    text: "Poškodbo ali drugo težavo v javnem prostoru lahko opišete s fotografijo in lokacijo.",
    label: "Prijavite težavo",
    to: "/prijavi?category=other",
  },
  "market:booking": {
    text: "Izberite želeni datum in vrsto prodajnega mesta.",
    label: "Prijava na tržnico",
    to: "/trznica",
  },
  "depo:donation": {
    text: "Še uporabnim predmetom lahko podarite novo priložnost.",
    label: "Spoznajte DEPO",
    to: "/depo",
  },
  "depo:purchase": {
    text: "Aktualna ponudba je povezana na spletni strani DEPO.",
    label: "Odprite DEPO",
    to: "/depo",
  },
};
function ContactForm() {
  const [params] = useSearchParams();
  const [category, setCategory] = useState("");
  const [subcategory, setSubcategory] = useState("");
  const [subject, setSubject] = useState("");
  const suggestedSubject=useRef('');
  const [message, setMessage] = useState("");
  const submission = useSubmission();
  const receiptElement = useRef<HTMLDivElement>(null);
  const area = contactAreas.find((item) => item.value === category);
  const suggestion = contactSuggestions[`${category}:${subcategory}`];
  function suggestSubject(next:string) {
    const previousSuggestion=suggestedSubject.current;
    suggestedSubject.current=next;
    setSubject(previous=>!previous.trim()||previous===previousSuggestion?next:previous);
  }
  useEffect(()=>{
    const selected=contactAreas.find(item=>item.value===params.get('category'));
    const topic=selected?.topics.find(item=>item.value===params.get('subcategory'));
    setCategory(selected?.value||'');
    setSubcategory(topic?.value||'');
    suggestSubject(selected&&selected.value!=='other'?`${selected.label} – ${topic?.label||'vprašanje'}`:'');
  },[params]);
  useEffect(() => {
    if (submission.receipt)
      receiptElement.current?.scrollIntoView({
        block: "nearest",
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "auto"
          : "smooth",
      });
  }, [submission.receipt]);
  function chooseCategory(value: string) {
    const selected = contactAreas.find((item) => item.value === value);
    setCategory(value);
    setSubcategory("");
    suggestSubject(
      value === "other" || !selected ? "" : `${selected.label} – vprašanje`,
    );
  }
  function chooseSubcategory(value: string) {
    setSubcategory(value);
    const topic = area?.topics.find((item) => item.value === value);
    if (area)
      suggestSubject(
        topic ? `${area.label} – ${topic.label}` : `${area.label} – vprašanje`,
      );
  }
  return (
    <section
      className="panel svc-contact-form"
      id="kontakt-obrazec"
      aria-labelledby="contact-form-title"
    >
      <div className="svc-contact-form-heading">
        <span className="svc-icon">
          <Mail size={25} />
        </span>
        <div>
          <span className="eyebrow">SPOROČILO ZA PRAVO PODROČJE</span>
          <h2 id="contact-form-title"><CmsText id="ContactForm.h2-1">{"Pišite nam."}</CmsText></h2>
        </div>
      </div>
      <p>
        <CmsText id="ContactForm.p-1">{"Izberite področje in opišite vprašanje. Predlagano zadevo lahko uredite po svoje."}</CmsText></p>
      <Demo>Sporočilo se shrani in posreduje skrbniku portala. Za nujne zadeve uporabite dežurni telefon.</Demo>
      <form
        onChange={submission.clearResult}
        onSubmit={async (event) => {
          const values = Values(event);
          await submission.submit("/api/contact", {
            ...values,
            category,
            subcategory: category === "other" ? "" : subcategory,
            subject,
            message,
            consent: true,
          });
        }}
      >
        <div className="svc-contact-form-step">
          <span>01</span>
          <h3><CmsText id="ContactForm.h3-1">{"O čem nam pišete?"}</CmsText></h3>
        </div>
        <div className="form-grid">
          <Field label="Področje · obvezno">
            <select
              name="category"
              required
              value={category}
              onChange={(event) => chooseCategory(event.target.value)}
            >
              <option value="" disabled>
                Izberite področje
              </option>
              {contactAreas.map((item) => (
                <option value={item.value} key={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </Field>
          {area && category !== "other" && (
            <div className="svc-contact-subcategory">
              <Field label="Kaj vas zanima? · obvezno">
                <select
                  name="subcategory"
                  required
                  value={subcategory}
                  onChange={(event) => chooseSubcategory(event.target.value)}
                >
                  <option value="" disabled>
                    Izberite temo
                  </option>
                  {area.topics.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          )}
        </div>
        {category === "other" && (
          <p className="svc-contact-topic-help">
            <CmsText id="ContactForm.p-2">{"Teme ni na seznamu? V zadevo vpišite kratek naslov svojega vprašanja."}</CmsText></p>
        )}
        {suggestion && (
          <div className="svc-contact-suggestion">
            <CircleAlert size={18} />
            <div>
              <p>{suggestion.text}</p>
              <Link to={suggestion.to}>
                {suggestion.label}
                <ArrowRight size={16} />
              </Link>
              <span>
                Za splošno vprašanje lahko nadaljujete s tem sporočilom.
              </span>
            </div>
          </div>
        )}
        <div className="svc-contact-subject">
          <Field label="Zadeva sporočila · obvezno">
            <input
              name="subject"
              required
              minLength={3}
              maxLength={200}
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              placeholder={
                category === "other"
                  ? "Npr. vprašanje o urejanju javne površine"
                  : "Kratek naslov vašega vprašanja"
              }
              aria-describedby="contact-subject-help"
            />
          </Field>
          <p id="contact-subject-help" className="svc-small">
            <CmsText id="ContactForm.p-3">{"Zadeva naj v enem stavku povzame, pri čem potrebujete pomoč."}</CmsText></p>
        </div>
        <Field label="Vaše sporočilo · obvezno">
          <textarea
            name="message"
            required
            minLength={10}
            maxLength={4000}
            rows={6}
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            aria-describedby="contact-message-help"
            placeholder="Opišite vprašanje in dodajte podatke, ki pomagajo razumeti primer. …"
          />
        </Field>
        <div className="svc-contact-message-help">
          <span id="contact-message-help">
            Najmanj 10 znakov. Osebnih dokumentov in podatkov o plačilni kartici
            ne vključujte.
          </span>
          <span aria-label={`Vnesenih ${message.length} od 4000 znakov`}>
            {message.length.toLocaleString("sl-SI")} / 4.000
          </span>
        </div>
        <div className="svc-contact-form-step">
          <span>02</span>
          <h3><CmsText id="ContactForm.h3-2">{"Kako vas lahko dosežemo?"}</CmsText></h3>
        </div>
        <div className="form-grid">
          <Field label="Ime in priimek · obvezno">
            <input
              name="name"
              required
              minLength={2}
              maxLength={120}
              autoComplete="name"
              placeholder="Janez Novak"
            />
          </Field>
          <Field label="E-poštni naslov · obvezno">
            <input
              name="email"
              required
              type="email"
              maxLength={254}
              autoComplete="email"
              placeholder="janez@primer.si"
            />
          </Field>
          <Field label="Telefon · neobvezno" wide>
            <input
              name="phone"
              type="tel"
              maxLength={40}
              autoComplete="tel"
              placeholder="040 000 000"
            />
          </Field>
        </div>
        <Consent />
        <BotProtection action="contact" />
        <button
          className="button svc-contact-submit"
          disabled={submission.busy}
          aria-busy={submission.busy}
        >
          {submission.busy
            ? "Shranjujemo sporočilo …"
            : "Pošlji sporočilo"}
          <ArrowRight size={18} />
        </button>
        {submission.receipt ? (
          <div className="svc-success" role="status" ref={receiptElement}>
            <CheckCircle2 size={23} />
            <div>
              <strong>{submission.receipt.previousInput ? "Prejšnje sporočilo je shranjeno." : <CmsText id="ContactForm.strong-1">{"Sporočilo je shranjeno."}</CmsText>}</strong>
              {submission.receipt.previousInput && <p>Potrditev velja za podatke ob oddaji. Spremembe, ki ste jih vnesli med čakanjem, še niso oddane.</p>}
              <p>
                <CmsText id="ContactForm.p-4">{"Referenca: "}</CmsText>{submission.receipt.id}{"."}{" "}
                {submission.receipt.message ||
                  "Sporočilo je shranjeno za obravnavo. Za nujne zadeve uporabite telefonske kontakte na tej strani."}
              </p>
            </div>
          </div>
        ) : (
          <Result receipt={null} error={submission.error} />
        )}
      </form>
    </section>
  );
}
function ContactHours() {
  const { hours, _revisions } = useSiteContent();
  const contactHours = hours.map((place) => ({
    ...place,
    icon:
      place.tone === "collection"
        ? Recycle
        : place.tone === "depo"
          ? ShoppingBag
          : Phone,
  }));
  return (
    <section
      className="svc-contact-hours"
      id="delovni-cas"
      aria-labelledby="contact-hours-title"
    >
      <div className="svc-contact-hours-heading">
        <div>
          <span className="eyebrow">PREDEN SE ODPRAVITE NA POT</span>
          <h2 id="contact-hours-title"><CmsText id="ContactHours.h2-1">{"Kdaj nas lahko obiščete?"}</CmsText></h2>
        </div>
        <span className="svc-hours-label">
          <Clock3 size={17} /> Redni delovni čas
        </span>
      </div>
      <div className="svc-hours-grid">
        {contactHours.map((place) => (
          <article
            className={`svc-hours-card svc-hours-${place.tone}`}
            key={place.name}
          >
            <div className="svc-hours-card-heading">
              <span className="svc-hours-icon">
                <place.icon size={23} />
              </span>
              <div>
                <h3>{place.name}</h3>
                <p>{place.description}</p>
              </div>
            </div>
            <table>
              <caption className="sr-only">
                Redni delovni čas: {place.name}
              </caption>
              <tbody>
                {place.rows.map(([day, time]) => (
                  <tr key={day}>
                    <th scope="row">{day}</th>
                    <td
                      className={
                        time === "Zaprto" ? "svc-hours-closed" : undefined
                      }
                    >
                      {time}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="svc-hours-contact">
              <CmsAnchor href={`tel:${place.telephone}`}>
                <Phone size={16} />
                {place.phone}
              </CmsAnchor>
              <CmsAnchor href={`mailto:${place.email}`}>
                <Mail size={16} />
                {place.email}
              </CmsAnchor>
            </div>
          </article>
        ))}
      </div>
      <p className="svc-hours-note">
        <CmsText id="ContactHours.p-1">{"Ob praznikih in izrednih spremembah pred obiskom preverite urnik pri izbrani službi."}</CmsText></p>
      <Source href="https://www.kpv.si/">
        {_revisions?.hours
          ? "Urnik je uredil skrbnik portala. Uradni podatki so na strani KPV."
          : "Vir urnikov: uradna stran KPV · preverjeno 29. oktobra 2026"}
      </Source>
    </section>
  );
}

export function ContactPage() {
  const { settings } = useSiteContent();
  return (
    <CmsLayout>
      <Intro key={nativeSection("ContactPage.introduction")}
        eyebrow="TUKAJ SMO ZA VAS"
        title="Pravi odgovor se začne s stikom."
      >
        Za vprašanje izberite področje v obrazcu ali uporabite uradne kontakte
        podjetja. Sporočilo oddate v spodnjem obrazcu.
      </Intro>
      <div key={nativeSection("ContactPage.svc-contact-quick-paths")} className="svc-contact-quick-paths">
        <CmsAnchor href="#kontakt-obrazec">
          <Mail size={18} />
          Pišite nam
          <ArrowRight size={16} />
        </CmsAnchor>
        <CmsAnchor href="#uradni-kontakti">
          <Phone size={18} />
          Uradni kontakti
          <ArrowRight size={16} />
        </CmsAnchor>
        <CmsAnchor href="#delovni-cas">
          <Clock3 size={18} />
          Delovni čas
          <ArrowRight size={16} />
        </CmsAnchor>
      </div>
      <div key={nativeSection("ContactPage.svc-contact-emergency-note")} className="svc-contact-emergency-note">
        <Phone size={20} />
        <span>
          <strong><CmsText id="ContactPage.strong-1">{"Nujna komunalna težava?"}</CmsText></strong> Za nujno pomoč uporabite
          dežurno službo, in ne obrazca.
        </span>
        <CmsAnchor href={`tel:${telephone(settings.emergencyPhone)}`}>
          {settings.emergencyPhone}
          <ArrowRight size={17} />
        </CmsAnchor>
      </div>
      <div key={nativeSection("ContactPage.svc-contact-layout")} className="svc-contact-layout">
        <ContactForm />
        <aside className="svc-contact-sidebar" id="uradni-kontakti">
          <section className="panel svc-contact-main">
            <div className="svc-icon">
              <Phone size={25} />
            </div>
            <h2><CmsText id="ContactPage.h2-1">{"Komunalno podjetje Vrhnika"}</CmsText></h2>
            <p><CmsText id="ContactPage.p-1">{"Javno podjetje Komunalno podjetje Vrhnika, d. o. o."}</CmsText></p>
            <CmsAnchor
              href={`tel:${telephone(settings.phone)}`}
              className="svc-contact-number"
            >
              {settings.phone}
            </CmsAnchor>
            <CmsAnchor
              href={`mailto:${settings.email}`}
              className="svc-inline-link"
            >
              {settings.email}
              <Mail size={18} />
            </CmsAnchor>
            <div className="svc-address">
              <MapPin size={21} />
              <span>{settings.address}</span>
            </div>
            <CmsAnchor
              className="button secondary"
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(settings.siteName + " " + settings.address)}`}
              target="_blank"
              rel="noreferrer"
            >
              Kako do nas
              <ExternalLink size={16} />
            </CmsAnchor>
          </section>
          <section className="panel svc-contact-small">
            <h3><CmsText id="ContactPage.h3-1">{"Za vsakodnevna opravila"}</CmsText></h3>
            <Link to="/prijavi">
              <Wrench size={20} />
              <span>
                Prijava težave
                <small>
                  <CmsText id="ContactPage.small-1">{"Poškodba ceste, svetilka ali zabojnik; fotografija in lokacija"}</CmsText></small>
              </span>
              <ChevronRight size={18} />
            </Link>
            <Link to="/storitve">
              <FileText size={20} />
              <span>
                Povpraševanje za storitev
                <small><CmsText id="ContactPage.small-2">{"Kosovni odvoz, praznjenje greznice in drugo"}</CmsText></small>
              </span>
              <ChevronRight size={18} />
            </Link>
            <Link to="/obvestila#narocilo">
              <Bell size={20} />
              <span>
                Obvestila za moj dom
                <small><CmsText id="ContactPage.small-3">{"Želja za obveščanje o lokalnih informacijah"}</CmsText></small>
              </span>
              <ChevronRight size={18} />
            </Link>
          </section>
          <div className="svc-contact-real-help">
            <CheckCircle2 size={20} />
            <h3><CmsText id="ContactPage.h3-2">{"Potrebujete hiter odgovor?"}</CmsText></h3>
            <p>
              <CmsText id="ContactPage.p-2">{"Pokličite uradno številko ali napišite e-pošto na"}</CmsText>{" "}
              <CmsAnchor href={`mailto:${settings.email}`}>
                info@kpv.si
              </CmsAnchor>
              <CmsText id="ContactPage.p-3">{". Za nujne zadeve ne čakajte na odgovor prek obrazca."}</CmsText></p>
          </div>
        </aside>
      </div>
      <ContactHours key={nativeSection("ContactPage.ContactHours")} />
      <div key={nativeSection("ContactPage.svc-contact-foot")} className="svc-contact-foot">
        <Source href="https://www.kpv.si/mPodjetje/mPkont.html">
          Vir kontaktov: uradna spletna stran KPV
        </Source>
        <span>
          Preverjeno 29. oktobra 2026.
        </span>
      </div>
    </CmsLayout>
  );
}
export function AboutPage() {
  return (
    <CmsLayout>
      <Intro key={nativeSection("AboutPage.introduction")}
        eyebrow="O PODJETJU IN PORTALU"
        title="Za okolje, v katerem radi živimo."
      >
        Pitna voda, urejeno okolje in zanesljive komunalne storitve so del
        vsakdana. Ta portal jih povezuje v preproste poti za občane.
      </Intro>
      <section key={nativeSection("AboutPage.svc-about-band")} className="svc-about-band">
        <Leaf size={48} strokeWidth={1.4} />
        <h2>
          <CmsText id="AboutPage.h2-1">{"Vsakdanja skrb."}</CmsText><br />
          <CmsText id="AboutPage.h2-2">{"Skupna prihodnost."}</CmsText></h2>
        <p>
          <CmsText id="AboutPage.p-1">{"Komunalno podjetje Vrhnika izvaja komunalne dejavnosti na območju občin Vrhnika, Borovnica in Log - Dragomer."}</CmsText></p>
      </section>
      <div key={nativeSection("AboutPage.svc-service-grid")} className="svc-service-grid">
        {[
          {
            icon: Droplets,
            title: "Voda in odpadna voda",
            text: "Oskrba s pitno vodo ter odvajanje in čiščenje odpadne vode.",
            to: "/storitve",
          },
          {
            icon: Recycle,
            title: "Odpadki in ponovna uporaba",
            text: "Odgovorno ločevanje, zbiranje odpadkov in povezava do Depoja.",
            to: "/depo",
          },
          {
            icon: Lightbulb,
            title: "Javne površine",
            text: "Vzdrževanje javnih površin in javne razsvetljave.",
            to: "/ceste",
          },
          {
            icon: Flower2,
            title: "Pokopališka dejavnost",
            text: "Informacije o pokopališču, najemu groba in ustreznih kontaktih.",
            to: "/pokopalisce",
          },
        ].map((item) => (
          <Link
            key={item.title}
            className="panel svc-service-card"
            to={item.to}
          >
            <span className="svc-icon">
              <item.icon size={25} />
            </span>
            <h3>{item.title}</h3>
            <p>{item.text}</p>
            <ArrowRight size={19} />
          </Link>
        ))}
      </div>
      <section key={nativeSection("AboutPage.service-information")} className="panel svc-about-note">
        <h2><CmsText id="AboutPage.h2-3">{"Storitve na enem mestu"}</CmsText></h2><p><CmsText id="AboutPage.p-2">{"Na portalu najdete informacije o dejavnostih, urnike odvoza, objavljena obvestila in obrazce za vprašanja ter prijave. Povpraševanja in želene termine obravnava skrbnik; izvedba zahteva potrditev."}</CmsText></p>
        <p>
          <CmsText id="AboutPage.p-3">{"Naslov se lahko shrani v vaš brskalnik za hitrejši ponovni obisk. Odstranite ga lahko z izbrisom podatkov te spletne strani v nastavitvah brskalnika."}</CmsText></p>
        <Source href="https://kpv.si/mPodjetje/mPred.html">
          Uradna predstavitev podjetja
        </Source>
      </section>
    </CmsLayout>
  );
}
