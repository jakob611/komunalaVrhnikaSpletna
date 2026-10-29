import { CmsLayout, CmsLink as Link, CmsAnchor } from "../content/PageComposer";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { useSearchParams } from "react-router-dom";
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

type Notice = {
  id: string;
  title: string;
  category: "water" | "roads" | "waste" | "general";
  area: string;
  date: string;
  summary: string;
  status: string;
  latitude: number;
  longitude: number;
};
type Receipt = {
  id: string;
  message?: string;
  emailStatus?: "queued" | "disabled";
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
const rememberedAddress = () => {
  try {
    return localStorage.getItem("kpv-address") || "";
  } catch {
    return "";
  }
};

function Intro({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <header className="page-intro">
      <div className="eyebrow">{eyebrow}</div>
      <h1>{title}</h1>
      <p>{children}</p>
    </header>
  );
}
function Demo({ children }: { children?: ReactNode }) {
  return (
    <div className="svc-demo">
      <CircleAlert size={18} />
      <span>
        {children ||
          "Predstavitvena različica. Prikazani primeri niso uradna obvestila Komunalnega podjetja Vrhnika."}
      </span>
    </div>
  );
}
function Consent({
  text = "Strinjam se s shranjevanjem podatkov in posredovanjem skrbniku predstavitve za preizkus obrazca.",
}: {
  text?: string;
}) {
  return (
    <label className="svc-consent">
      <input type="checkbox" name="consent" required />
      <span>{text} Uporabite izmišljene osebne podatke.</span>
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
          <strong>Vaš preizkusni obrazec je shranjen.</strong>
          <p>
            Referenca: {receipt.id}.{" "}
            {receipt.message ||
              "Podatki so shranjeni za preizkus. Storitev ni naročena in plačilo ni izvedeno."}
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
  async function submit(endpoint: string, payload: object | FormData) {
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
    setBusy(true);
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 20000);
    try {
      const isForm = payload instanceof FormData;
      const response = await fetch(endpoint, {
        method: "POST",
        signal: controller.signal,
        headers: isForm ? undefined : { "Content-Type": "application/json" },
        body: isForm ? payload : JSON.stringify(payload),
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
      setReceipt(data);
      return true;
    } catch (cause) {
      setError(
        cause instanceof Error && cause.name === "AbortError"
          ? "Strežnik se ni pravočasno odzval. Podatki ostajajo v obrazcu; poskusite znova."
          : cause instanceof TypeError
            ? "Povezava s strežnikom ni uspela. Preverite internetno povezavo in poskusite znova."
            : cause instanceof Error
              ? cause.message
              : "Povezava ni uspela. Poskusite znova.",
      );
      return false;
    } finally {
      window.clearTimeout(timeout);
      setBusy(false);
      resetProtection(action);
    }
  }
  return {
    busy,
    receipt,
    error,
    submit,
    clearResult: () => {
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

function SubscriptionForm() {
  const [address, setAddress] = useState(rememberedAddress);
  const [topics, setTopics] = useState(["water", "roads"]);
  const submission = useSubmission();
  return (
    <section className="panel svc-subscribe" id="narocilo">
      <div className="svc-icon">
        <Bell size={24} />
      </div>
      <div>
        <div className="eyebrow">OBVESTILA ZA MOJ DOM</div>
        <h2>Naj vas spremembe ne presenetijo.</h2>
        <p>
          Izberite območje in teme, ki vas zanimajo. Shranimo preizkusne
          nastavitve in o oddaji obvestimo skrbnika javne predstavitve.
          Samodejnih obvestil o motnjah na vaš naslov še ne pošiljamo.
        </p>
      </div>
      <form
        onSubmit={async (e) => {
          const values = Values(e);
          if (!topics.length) return;
          const okay = await submission.submit("/api/subscriptions", {
            ...values,
            address,
            topics,
            consent: true,
          });
          if (okay) {
            try {
              localStorage.setItem("kpv-address", address);
            } catch {
              /* address persistence is optional */
            }
          }
        }}
      >
        <div className="form-grid">
          <Field label="Ime in priimek">
            <input
              name="name"
              autoComplete="name"
              minLength={2}
              required
              maxLength={100}
              placeholder="Janez Novak"
            />
          </Field>
          <Field label="E-poštni naslov">
            <input
              name="email"
              type="email"
              autoComplete="email"
              required
              placeholder="janez@primer.si"
            />
          </Field>
          <Field label="Naslov, ki vas zanima" wide>
            <input
              name="address"
              required
              minLength={4}
              maxLength={200}
              autoComplete="street-address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Ulica in hišna številka, kraj"
            />
          </Field>
        </div>
        <fieldset className="svc-topics">
          <legend>O čem želite biti obveščeni?</legend>
          {Object.entries(categories).map(([key, name]) => (
            <label key={key}>
              <input
                type="checkbox"
                checked={topics.includes(key)}
                onChange={(e) =>
                  setTopics((previous) =>
                    e.target.checked
                      ? [...previous, key]
                      : previous.filter((v) => v !== key),
                  )
                }
              />
              {name}
            </label>
          ))}
        </fieldset>
        {!topics.length && <p className="svc-error">Izberite vsaj eno temo.</p>}
        <Consent />
        <BotProtection action="subscriptions" />
        <button className="button" disabled={submission.busy || !topics.length}>
          {submission.busy ? "Shranjujemo …" : "Shrani preizkusno naročilo"}
          <ArrowRight size={17} />
        </button>
        <Result receipt={submission.receipt} error={submission.error} />
      </form>
    </section>
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
              <Link to="/obvestila#narocilo">
                Obvestila za moj naslov
                <ArrowRight size={15} />
              </Link>
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
      <Intro eyebrow="AKTUALNO V VAŠEM KRAJU" title="Vedno dobro obveščeni.">
        Vzdrževalna dela, spremembe odvozov in druge informacije za lažji
        vsakdan. Vse na enem mestu.
      </Intro>
      <Demo />
      <div className="svc-filter-row">
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
      {loading ? (
        <p role="status">Nalagamo obvestila …</p>
      ) : error ? (
        <NoticeError error={error} retry={retry} />
      ) : shown.length ? (
        <NoticeCards notices={shown} />
      ) : (
        <div className="empty-state">
          <Bell />
          <h3>Ni obvestil za izbrani filter.</h3>
          <p>Poskusite drug kraj ali izberite vse teme.</p>
        </div>
      )}
      <SubscriptionForm />
    </CmsLayout>
  );
}
export function RoadsPage() {
  const { notices, loading, error, retry } = useNotices();
  const roads = notices.filter((n) => n.category === "roads");
  return (
    <CmsLayout>
      <Intro eyebrow="JAVNE POVRŠINE" title="Varno po naših poteh.">
        Pregled del na cestah in javnih površinah. Ste opazili poškodbo ali
        nedelujočo svetilko? Sporočite nam lokacijo.
      </Intro>
      <Demo />
      <section className="svc-road-layout">
        <div className="svc-map-wrap">
          <MapContainer
            center={[45.945, 14.325]}
            zoom={12}
            scrollWheelZoom={false}
            className="svc-map"
            aria-label="Zemljevid vzorčnih cestnih del"
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {roads
              .filter(
                (n) =>
                  Number.isFinite(n.latitude) && Number.isFinite(n.longitude),
              )
              .map((n) => (
                <CircleMarker
                  key={n.id}
                  center={[n.latitude, n.longitude]}
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
                    <p>Vzorčni prikaz</p>
                  </Popup>
                </CircleMarker>
              ))}
          </MapContainer>
          <span className="svc-map-caption">
            <span />
            Vzorčne lokacije del · premikajte in povečajte zemljevid
          </span>
        </div>
        <aside className="svc-road-aside">
          <div className="svc-icon">
            <Wrench size={24} />
          </div>
          <h2>
            Majhna prijava.
            <br />
            Velika sprememba.
          </h2>
          <p>
            Poškodovan pločnik, ulična svetilka ali zabojnik? Dodajte
            fotografijo in lokacijo v nekaj korakih.
          </p>
          <Link className="button" to="/prijavi">
            Prijavi težavo
            <ArrowRight size={17} />
          </Link>
          <p className="svc-small">
            V nujnih primerih uporabite uradne kontakte. Ta obrazec je
            predstavitveni.
          </p>
        </aside>
      </section>
      <div className="section-heading">
        <div>
          <div className="eyebrow">PREGLED PO LOKACIJAH</div>
          <h2>Dela in zapore</h2>
        </div>
        <Link to="/obvestila">
          Vsa obvestila
          <ArrowRight size={16} />
        </Link>
      </div>
      {loading ? (
        <p>Nalagamo pregled …</p>
      ) : error ? (
        <NoticeError error={error} retry={retry} />
      ) : roads.length ? (
        <NoticeCards notices={roads} />
      ) : (
        <p className="empty-state">Ni vzorčnih cestnih del.</p>
      )}
      <SubscriptionForm />
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
      <Intro
        eyebrow="SKUPAJ ZA UREJEN KRAJ"
        title="Opazite. Sporočite. Uredimo."
      >
        Izberite težavo, opišite lokacijo in po želji dodajte fotografijo. Za
        prijavo zadošča tudi opis lokacije brez GPS.
      </Intro>
      <Demo>
        Preizkusni obrazec. Prijava se shrani v predstavitveno zbirko in ni
        poslana dežurni službi. Za nujno pomoč pokličite{" "}
        <CmsAnchor href="tel:+38641364681">041 364 681</CmsAnchor>.
      </Demo>
      <nav className="svc-report-steps" aria-label="Koraki prijave">
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
      <form
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
              <h2>Kaj ste opazili?</h2>
            </div>
            <div className="svc-type-grid">
              {reportOptions.map((item) => (
                <button
                  type="button"
                  key={item.value}
                  className={category === item.value ? "selected" : ""}
                  aria-pressed={category === item.value}
                  onClick={() => setCategory(item.value)}
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
              <h2>Kje je težava?</h2>
            </div>
            <p className="svc-step-explanation">
              Vpišite naslov ali opis, po katerem bomo našli težavo.{" "}
              <strong>To ni nujno vaš domači naslov.</strong>
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
              Hišne številke ne poznate? Navedite kraj, ulico in bližnji objekt.
              Domačega naslova sem ne prepišemo samodejno.
            </p>
            <div className="svc-location-optional">
              <strong>Natančna točka · neobvezno</strong>
              <p>
                Ste ob težavi? Uporabite lokacijo telefona. Sicer jo sami
                označite na zemljevidu.
              </p>
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
                  Brskalnik vas lahko vpraša za dovoljenje. Naslova s tem še ne
                  določimo.
                </p>
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
                    <strong>Natančna točka je dodana.</strong>
                    <span>
                      {position[0].toFixed(5)}, {position[1].toFixed(5)}
                    </span>
                  </div>
                  <button
                    type="button"
                    aria-label="Odstrani dodano točko"
                    onClick={() => {
                      locationRequest.current += 1;
                      setLocating(false);
                      setPosition(null);
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
                    <strong>Izberite mesto težave</strong>
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
                        ? `Izbrana točka: ${draftPosition[0].toFixed(5)}, ${draftPosition[1].toFixed(5)}`
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
                    Zemljevid dopolnjuje opis lokacije. Če zemljevid ne deluje,
                    lahko prijavo oddate samo z opisom.
                  </p>
                </div>
              </AnimatedDisclosure>
            </div>
          </section>
          <section id="fotografija" className="svc-report-step">
            <div className="svc-step">
              <span>03</span>
              <h2>
                Dodajte fotografijo <small>neobvezno</small>
              </h2>
            </div>
            <p className="svc-step-explanation">
              Fotografija pomaga razumeti težavo. Če je nimate, nadaljujte na
              kontakt.
            </p>
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
              <h2>Vaš kontakt</h2>
            </div>
            <p className="svc-step-explanation">
              V preizkusu uporabite izmišljene podatke. Kontakt bo vključen v
              obvestilo skrbniku javne predstavitve; samodejnega odgovora ne
              pošiljamo.
            </p>
            <div className="form-grid">
              <Field label="Ime in priimek · obvezno">
                <input
                  name="name"
                  minLength={2}
                  required
                  autoComplete="name"
                  maxLength={100}
                  placeholder="Testna oseba"
                />
              </Field>
              <Field label="E-poštni naslov · obvezno">
                <input
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="test@primer.si"
                />
              </Field>
            </div>
            <Consent />
            {mapOpen && (
              <p className="svc-small">
                Odprto točko potrdite, če jo želite dodati. Ob oddaji se pošlje
                samo že potrjena točka.
              </p>
            )}
            <BotProtection action="reports" />
            <button
              className="button svc-report-submit"
              disabled={submission.busy || !!photoError}
            >
              {submission.busy ? "Shranjujemo …" : "Shrani preizkusno prijavo"}
              <ArrowRight size={17} />
            </button>
            <Result receipt={submission.receipt} error={submission.error} />
          </section>
        </div>
        <aside className="svc-report-guidance">
          <div className="svc-help">
            <Lightbulb size={24} />
            <h3>Da bomo težavo lažje našli.</h3>
            <ul>
              <li>Pri svetilki dodajte številko droga, če je vidna.</li>
              <li>Pri cesti navedite smer vožnje in bližnji objekt.</li>
              <li>Pri zabojniku opišite vrsto odpadkov in zbirno mesto.</li>
            </ul>
            <p>Za oddajo natančna GPS-točka in fotografija nista obvezni.</p>
          </div>
          <div className="svc-report-emergency">
            <Phone size={20} />
            <strong>Potrebujete nujno pomoč?</strong>
            <p>
              Za nujne težave z javno infrastrukturo uporabite uradno dežurno
              številko. Predstavitvena prijava se podjetju ne pošlje.
            </p>
            <CmsAnchor href="tel:+38641364681">
              041 364 681
              <ArrowRight size={17} />
            </CmsAnchor>
          </div>
        </aside>
      </form>
    </CmsLayout>
  );
}
const serviceOptions = [
  {
    value: "bulky",
    title: "Odvoz kosovnih odpadkov",
    desc: "Pohištvo, vzmetnice in drugi večji predmeti.",
    icon: Sofa,
  },
  {
    value: "septic",
    title: "Praznjenje greznice ali MKČN",
    desc: "Povpraševanje za prevzem in odvoz blata.",
    icon: Waves,
  },
  {
    value: "water",
    title: "Vodovod in kanalizacija",
    desc: "Priključki, vzdrževanje in druga vprašanja.",
    icon: Droplets,
  },
  {
    value: "other",
    title: "Druga komunalna storitev",
    desc: "Povejte, pri čem potrebujete pomoč.",
    icon: Wrench,
  },
];
const serviceGuides: Record<
  string,
  { intro: string; prepare: string[]; note: string; placeholder: string }
> = {
  bulky: {
    intro:
      "Za večje predmete, kot so kavč, omara ali vzmetnica. Povejte, kaj želite oddati in kako je mogoče priti do predmetov.",
    prepare: [
      "Seznam predmetov in približno število kosov.",
      "Naslov prevzema ter opis dostopa: dvorišče, stopnice ali ožja cesta.",
      "Podatek, ali je predmet še uporaben. Morda je primeren za DEPO.",
    ],
    note: "Za gradbene ali nevarne odpadke najprej preverite ustrezno pot oddaje. Želeni datum je predlog; izvajalec mora potrditi pogoje, ceno in termin.",
    placeholder:
      "Npr. 1 kavč in 2 stola, dostop z dvorišča. Kavč je še uporaben. Želeni prevzem v dopoldanskem času …",
  },
  septic: {
    intro:
      "Za praznjenje greznice ali prevzem blata iz male komunalne čistilne naprave (MKČN). Navedite vrsto naprave in dostop do mesta praznjenja.",
    prepare: [
      "Ali gre za greznico ali malo komunalno čistilno napravo.",
      "Približna prostornina, če jo poznate; če ne, to zapišite.",
      "Kje je pokrov in ali je do njega mogoč dostop za vozilo.",
    ],
    note: "Pred izvedbo je treba preveriti pogoje in uskladiti termin. V predstavitvi se shrani samo povpraševanje.",
    placeholder:
      "Npr. greznica približno 6 m³, pokrov na dvorišču, od ceste oddaljen okoli 10 m. Dostop za vozilo je mogoč …",
  },
  water: {
    intro:
      "Za vprašanja o priključku, vodomeru, kanalizaciji ali načrtovanem posegu. Pri nujni okvari uporabite dežurno številko 041 364 681.",
    prepare: [
      "Naslov objekta in kratek opis, kaj želite urediti.",
      "Ali gre za nov priključek, obstoječi priključek, vodomer ali drugo vprašanje.",
      "Številka odjemnega mesta, če jo poznate; za preizkus uporabite izmišljene podatke.",
    ],
    note: "Povpraševanje ni prijava nujne okvare. Za trenutno motnjo oskrbe najprej preverite obvestila ali pokličite dežurno službo.",
    placeholder:
      "Npr. zanima me ureditev priključka za obstoječi objekt. Naslov in trenutno stanje sta …",
  },
  other: {
    intro:
      "Niste našli ustrezne storitve? Opišite svoje vprašanje in lokacijo. Za prijavo poškodbe ceste, svetilke ali zabojnika uporabite obrazec Prijavite težavo.",
    prepare: [
      "Kaj želite urediti in na kateri lokaciji.",
      "Obseg dela ali druge okoliščine, ki jih poznate.",
      "Želeni termin, če je pomemben; vnos datuma ni obvezen.",
    ],
    note: "Najprej je treba preveriti, ali storitev sodi v dejavnost podjetja. Ta preizkus ne potrdi naročila.",
    placeholder:
      "Npr. potrebujem informacije o … Lokacija je … Urediti želim …",
  },
};
export function ServicesPage() {
  const cms = useSiteContent();
  const icons = { bulky: Sofa, septic: Waves, water: Droplets, other: Wrench };
  const serviceOptions = cms.services.map((item) => ({
    ...item,
    icon: icons[item.value as keyof typeof icons] || Wrench,
  }));
  const [params] = useSearchParams();
  const [service, setService] = useState("bulky");
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
      <Intro eyebrow="STORITVE ZA VAŠ DOM" title="Uredite kar od doma.">
        Od odsluženega kavča do praznjenja greznice. Izberite storitev in nam
        zaupajte, kaj potrebujete.
      </Intro>
      <div className="svc-service-tools">
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
      <div className="svc-service-choice-heading">
        <span className="eyebrow">01 · IZBIRA STORITVE</span>
        <h2>Kaj želite urediti?</h2>
        <p>Izbira spodaj prilagodi navodila in povpraševanje.</p>
      </div>
      <div
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
      <section className="svc-service-guide" key={service}>
        <div className="svc-service-guide-intro">
          <div>
            <span className="eyebrow">IZBRANA STORITEV</span>
            <h2>{selectedService.title}</h2>
          </div>
        </div>
        <p>{guide.intro}</p>
        <details>
          <summary>
            Kaj pripraviti pred oddajo?
            <ChevronDown size={18} />
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
      <div className="svc-two-column">
        <section className="panel" id="povprasevanje">
          <div className="eyebrow">02 · OPIS IN KONTAKT</div>
          <h2>{serviceOptions.find((s) => s.value === service)?.title}</h2>
          <p>
            Izpolnite kontakt, naslov izvedbe in opis. Želeni datum je neobvezen
            in še ni potrjen termin.
          </p>
          <p className="svc-small">
            Vsa polja razen telefona in želenega datuma so obvezna.
          </p>
          <Demo>
            Povpraševanje se shrani kot primer. Dejansko naročilo in potrditev
            termina v tej različici še nista omogočena.
          </Demo>
          <form
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
                  defaultValue={rememberedAddress()}
                  placeholder="Ulica, hišna številka, kraj"
                />
              </Field>
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
                : "Oddaj preizkusno povpraševanje"}
              <ArrowRight size={17} />
            </button>
            <Result receipt={submission.receipt} error={submission.error} />
          </form>
        </section>
        <aside className="svc-help svc-service-help">
          <div className="eyebrow">KAKO POTEKA</div>
          <h2>Trije koraki do urejenega doma.</h2>
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
            Prikazan je predvideni potek prihodnje storitve. Za dejansko
            naročilo se obrnite na KPV.
          </p>
          <Link to="/kontakt" className="svc-inline-link">
            Potrebujem pomoč
            <ArrowRight size={17} />
          </Link>
          <hr />
          <h3>Bi predmet lahko živel naprej?</h3>
          <p>
            Če je kavč, stol ali drug predmet še uporaben, najprej preverite
            možnosti ponovne uporabe pri Depoju.
          </p>
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
  const [stallType, setStallType] = useState("standard");
  const submission = useSubmission();
  const rate =
    stallType === "food"
      ? rates.marketFood
      : stallType === "craft"
        ? rates.marketCraft
        : rates.marketStandard;
  const dateOptions = useMemo(() => {
    if (market.dates.length)
      return market.dates
        .filter((date) => date >= today() && !market.closedDates.includes(date))
        .sort();
    const start = new Date();
    const result = [];
    for (let i = 1; i < 35 && result.length < 4; i++) {
      const day = new Date(start);
      day.setDate(start.getDate() + i);
      if (day.getDay() === 6)
        result.push(
          `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`,
        );
    }
    return result.filter((date) => !market.closedDates.includes(date));
  }, [market]);
  return (
    <CmsLayout>
      <Intro eyebrow="LOKALNO JE LEPŠE" title="Vaša ponudba. Naša tržnica.">
        Predstavite svoje pridelke, izdelke in zgodbe. Preizkusite preprosto
        prijavo za prodajno mesto.
      </Intro>
      <Demo>
        Termini, razpoložljivost in zneski so vzorčni. Prijava ni dejanska
        rezervacija, spletna plačila pa še niso vključena.
      </Demo>
      <div className="svc-two-column">
        <section className="panel">
          <div className="svc-step">
            <span>01</span>
            <h2>Izberite termin</h2>
          </div>
          <div className="svc-date-options">
            {dateOptions.map((day) => (
              <button
                type="button"
                key={day}
                className={date === day ? "selected" : ""}
                aria-pressed={date === day}
                onClick={() => setDate(day)}
              >
                <span>sobota</span>
                <strong>{new Date(day + "T12:00:00").getDate()}.</strong>
                <span>
                  {new Intl.DateTimeFormat("sl-SI", { month: "long" }).format(
                    new Date(day + "T12:00:00"),
                  )}
                </span>
                <small>Vzorčni termin</small>
              </button>
            ))}
          </div>
          <form
            onSubmit={async (event) => {
              const values = Values(event);
              await submission.submit("/api/market", {
                ...values,
                stallType,
                consent: true,
              });
            }}
          >
            <Field label="Datum prijave">
              <input
                name="date"
                required
                type="date"
                min={today()}
                value={date}
                onChange={(event) => setDate(event.target.value)}
              />
            </Field>
            <div className="svc-step">
              <span>02</span>
              <h2>Podatki o ponudniku</h2>
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
                    Standardno mesto · vzorec {euro(rates.marketStandard)}
                  </option>
                  <option value="food">
                    Živilska ponudba · vzorec {euro(rates.marketFood)}
                  </option>
                  <option value="craft">
                    Rokodelski izdelki · vzorec {euro(rates.marketCraft)}
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
              {submission.busy ? "Shranjujemo …" : "Oddaj preizkusno prijavo"}
              <ArrowRight size={17} />
            </button>
            <Result receipt={submission.receipt} error={submission.error} />
          </form>
        </section>
        <aside>
          <div className="svc-market-summary">
            <Store size={34} />
            <div className="eyebrow">POVZETEK PRIJAVE</div>
            <h2>Vaša preizkusna prijava.</h2>
            <div>
              <span>Datum</span>
              <strong>{date ? dateLabel(date) : "Izberite datum"}</strong>
            </div>
            <div>
              <span>Število mest</span>
              <strong>1</strong>
            </div>
            <div>
              <span>Vzorčni znesek</span>
              <strong>{euro(rate)}</strong>
            </div>
            <p>
              <CreditCard size={18} />
              Plačilo v tej različici ni omogočeno. Znesek je namenjen prikazu
              postopka in ni uradna cena.
            </p>
          </div>
          <div className="svc-help">
            <Leaf size={23} />
            <h3>Dobrodošli lokalni ponudniki.</h3>
            <p>
              Za pogoje prodaje, dovoljenja in dejanske termine preverite uradne
              informacije pri KPV.
            </p>
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
  const { rates } = useSiteContent();
  const [people, setPeople] = useState(3);
  const [water, setWater] = useState(12);
  const [volume, setVolume] = useState(120);
  const [bio, setBio] = useState(true);
  const [drainage, setDrainage] = useState(true);
  const lines = [
    {
      name: `Odpadki · ${volume} l zabojnik`,
      description: "Vzorčni mesečni pavšal + dodatek na osebo",
      value: (volume / 120) * rates.wasteBase + people * rates.wastePerson,
    },
    {
      name: "Biološki odpadki",
      description: "Vzorčni pavšal",
      value: bio ? rates.bio : 0,
    },
    {
      name: `Oskrba s pitno vodo · ${water} m³`,
      description: `Vzorčna omrežnina ${euro(rates.waterBase)} + ${euro(rates.waterPerM3)}/m³`,
      value: rates.waterBase + water * rates.waterPerM3,
    },
    {
      name: "Odvajanje in čiščenje",
      description: `Vzorčno ${euro(rates.drainagePerM3)}/m³`,
      value: drainage ? water * rates.drainagePerM3 : 0,
    },
  ];
  return (
    <CmsLayout>
      <Intro
        eyebrow="PREGLEDNO DO ZADNJEGA EVRA"
        title="Koliko približno nanese?"
      >
        Spreminjajte podatke in preverite, kako posamezne storitve vplivajo na
        okvirni mesečni znesek.
      </Intro>
      <Demo>
        Izračun uporablja izmišljene predstavitvene tarife. Ni uradni cenik,
        ponudba ali izračun položnice. Vsi prikazani zneski so zgolj primer.
      </Demo>
      <div className="svc-two-column">
        <section className="panel svc-calculator">
          <div className="eyebrow">VAŠE GOSPODINJSTVO</div>
          <h2>Vnesite svoje podatke</h2>
          <Field label={`Člani gospodinjstva: ${people}`}>
            <input
              type="range"
              min="1"
              max="10"
              value={people}
              onChange={(e) => setPeople(Number(e.target.value))}
            />
            <span className="svc-range-labels">
              <span>1 oseba</span>
              <span>10 oseb</span>
            </span>
          </Field>
          <Field label="Velikost zabojnika za mešane odpadke">
            <select
              value={volume}
              onChange={(e) => setVolume(Number(e.target.value))}
            >
              <option value={80}>80 litrov</option>
              <option value={120}>120 litrov</option>
              <option value={240}>240 litrov</option>
              <option value={1100}>1.100 litrov</option>
            </select>
          </Field>
          <Field label={`Mesečna poraba vode: ${water} m³`}>
            <input
              type="range"
              min="0"
              max="50"
              value={water}
              onChange={(e) => setWater(Number(e.target.value))}
            />
            <span className="svc-range-labels">
              <span>0 m³</span>
              <span>50 m³</span>
            </span>
          </Field>
          <label className="svc-toggle">
            <span>
              <strong>Odvoz bioloških odpadkov</strong>
              <small>Vključite vzorčni mesečni pavšal.</small>
            </span>
            <input
              type="checkbox"
              checked={bio}
              onChange={(e) => setBio(e.target.checked)}
            />
          </label>
          <label className="svc-toggle">
            <span>
              <strong>Odvajanje in čiščenje</strong>
              <small>Vključite obračun glede na porabo vode.</small>
            </span>
            <input
              type="checkbox"
              checked={drainage}
              onChange={(e) => setDrainage(e.target.checked)}
            />
          </label>
          <p className="svc-small">
            Za uradni obračun so potrebni veljaven cenik, velikost priključka,
            območje izvajanja in drugi podatki. Uporabljene formule so izpisane
            ob postavkah.
          </p>
        </section>
        <section className="svc-total" aria-live="polite">
          <div className="eyebrow">VZORČNI MESEČNI IZRAČUN</div>
          <div className="svc-total-value">
            {euro(lines.reduce((sum, line) => sum + line.value, 0))}
            <span>/ mesec</span>
          </div>
          <p>Informativni primer za vaše nastavitve</p>
          <div className="svc-cost-lines">
            {lines.map((line) => (
              <div key={line.name}>
                <span>
                  <strong>{line.name}</strong>
                  <small>{line.description}</small>
                </span>
                <strong>{euro(line.value)}</strong>
              </div>
            ))}
          </div>
          <p className="svc-small">
            Model ne vključuje vseh možnih postavk, davkov ali dejanskih pogojev
            obračuna.
          </p>
          <Source>Preverite veljavne cenike na kpv.si</Source>
          <Link to="/kontakt" className="button secondary">
            Vprašanje o obračunu
            <ArrowRight size={17} />
          </Link>
        </section>
      </div>
    </CmsLayout>
  );
}

export function DepoPage() {
  const { settings } = useSiteContent();
  return (
    <CmsLayout>
      <Intro eyebrow="PONOVNA UPORABA" title="Staro za nekoga. Novo za vas.">
        Predmeti s preteklostjo si zaslužijo prihodnost. Odkrijte Depo, trgovino
        z rabljenimi in preoblikovanimi predmeti na Vrhniki.
      </Intro>
      <section className="svc-depo-hero">
        <div>
          <div className="eyebrow">DEPO VRHNIKA</div>
          <h2>
            Dobre stvari
            <br />
            dobijo drugo priložnost.
          </h2>
          <p>
            Od pohištva do drobnih najdb za dom. Aktualni izdelki vas čakajo v
            uradnem spletnem katalogu, še več pa v trgovini.
          </p>
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
      <div className="svc-depo-grid">
        <article className="panel">
          <MapPin size={25} />
          <h3>Obiščite trgovino</h3>
          <p>
            Cankarjev trg 6a
            <br />
            1360 Vrhnika
          </p>
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
          <h3>Pred obiskom preverite</h3>
          <p>
            Ponudba se spreminja. Delovni čas in razpoložljivost predmetov
            preverite na uradni strani ali po telefonu.
          </p>
          <CmsAnchor className="svc-inline-link" href="tel:+38641777385">
            041 777 385
            <Phone size={17} />
          </CmsAnchor>
        </article>
        <article className="panel">
          <ShoppingBag size={25} />
          <h3>Imate še uporaben predmet?</h3>
          <p>
            Pred oddajo se z Depojem dogovorite o primernosti in načinu
            prevzema.
          </p>
          <CmsAnchor className="svc-inline-link" href="mailto:depo@kpv.si">
            depo@kpv.si
            <Mail size={17} />
          </CmsAnchor>
        </article>
      </div>
      <p className="svc-small">
        Kontaktni podatki in povezava:{" "}
        <Source href="https://www.kpv.si/depoVrhnika/trgovina.html">
          Uradna stran Depo Vrhnika
        </Source>
        . Ta portal ne prikazuje lastne zaloge in ne sprejema naročil za
        izdelke.
      </p>
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
    text: "Za preizkus prijave izberite termin in vrsto prodajnega mesta.",
    label: "Prijava na tržnico",
    to: "/trznica",
  },
  "depo:donation": {
    text: "Še uporabnim predmetom lahko podarite novo priložnost.",
    label: "Spoznajte DEPO",
    to: "/depo",
  },
  "depo:purchase": {
    text: "Aktualna ponudba je povezana na predstavitveni strani DEPO.",
    label: "Odprite DEPO",
    to: "/depo",
  },
};
function ContactForm() {
  const [category, setCategory] = useState("");
  const [subcategory, setSubcategory] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const submission = useSubmission();
  const receiptElement = useRef<HTMLDivElement>(null);
  const area = contactAreas.find((item) => item.value === category);
  const suggestion = contactSuggestions[`${category}:${subcategory}`];
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
    setSubject(
      value === "other" || !selected ? "" : `${selected.label} – vprašanje`,
    );
  }
  function chooseSubcategory(value: string) {
    setSubcategory(value);
    const topic = area?.topics.find((item) => item.value === value);
    if (area)
      setSubject(
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
          <h2 id="contact-form-title">Pišite nam.</h2>
        </div>
      </div>
      <p>
        Izberite področje in opišite vprašanje. Predlagano zadevo lahko uredite
        po svoje.
      </p>
      <Demo>
        Ta obrazec je preizkusni. Sporočilo shranimo in v javni predstavitvi
        pošljemo skrbniku tega portala. Uradno podjetje KPV ga ne prejme.
        Uporabite izmišljene osebne podatke.
      </Demo>
      <form
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
          <h3>O čem nam pišete?</h3>
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
            Teme ni na seznamu? V zadevo vpišite kratek naslov svojega
            vprašanja.
          </p>
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
            Zadeva naj v enem stavku povzame, pri čem potrebujete pomoč.
          </p>
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
            placeholder="Opišite vprašanje in dodajte podatke, ki pomagajo razumeti primer. V preizkusu uporabite izmišljene podatke …"
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
          <h3>Kako vas lahko dosežemo?</h3>
        </div>
        <div className="form-grid">
          <Field label="Ime in priimek · obvezno">
            <input
              name="name"
              required
              minLength={2}
              maxLength={120}
              autoComplete="name"
              placeholder="Testna oseba"
            />
          </Field>
          <Field label="E-poštni naslov · obvezno">
            <input
              name="email"
              required
              type="email"
              maxLength={254}
              autoComplete="email"
              placeholder="test@primer.si"
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
            : "Oddaj preizkusno sporočilo"}
          <ArrowRight size={18} />
        </button>
        {submission.receipt ? (
          <div className="svc-success" role="status" ref={receiptElement}>
            <CheckCircle2 size={23} />
            <div>
              <strong>Preizkusno sporočilo je shranjeno.</strong>
              <p>
                Referenca: {submission.receipt.id}.{" "}
                {submission.receipt.message ||
                  "Sporočilo je shranjeno za preizkus. Za dejanski stik s podjetjem KPV uporabite uradne kontakte na tej strani."}
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
const contactHours = [
  {
    name: "Informacijska pisarna",
    description: "Računi, vodomeri in informacije za občane.",
    icon: Phone,
    tone: "office",
    phone: "01 750 29 76",
    telephone: "+38617502976",
    email: "informacijska@kpv.si",
    rows: [["Ponedeljek–petek", "8.00–12.00"]],
  },
  {
    name: "Zbirni center Tojnice",
    description: "Oddaja odpadkov v zbirnem centru.",
    icon: Recycle,
    tone: "collection",
    phone: "031 686 121",
    telephone: "+38631686121",
    email: "tehtnica@kpv.si",
    rows: [
      ["Ponedeljek in petek", "8.00–14.00"],
      ["Torek–četrtek", "8.00–17.00"],
      ["Sobota", "8.00–12.00"],
    ],
  },
  {
    name: "Trgovina DEPO",
    description: "Rabljeni in preoblikovani predmeti.",
    icon: ShoppingBag,
    tone: "depo",
    phone: "041 777 385",
    telephone: "+38641777385",
    email: "depo@kpv.si",
    rows: [
      ["Ponedeljek", "Zaprto"],
      ["Torek–četrtek", "10.00–18.00"],
      ["Petek", "9.00–12.00"],
      ["Sobota", "9.00–12.30"],
    ],
  },
];

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
          <h2 id="contact-hours-title">Kdaj nas lahko obiščete?</h2>
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
        Ob praznikih in izrednih spremembah pred obiskom preverite urnik pri
        izbrani službi.
      </p>
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
      <Intro
        eyebrow="TUKAJ SMO ZA VAS"
        title="Pravi odgovor se začne s stikom."
      >
        Za vprašanje izberite področje v obrazcu ali uporabite uradne kontakte
        podjetja. Predstavitveni obrazec omogoča preizkus shranjevanja
        sporočila.
      </Intro>
      <div className="svc-contact-quick-paths">
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
      <div className="svc-contact-emergency-note">
        <Phone size={20} />
        <span>
          <strong>Nujna komunalna težava?</strong> Za nujno pomoč uporabite
          dežurno službo, ne predstavitvenega obrazca.
        </span>
        <CmsAnchor href={`tel:${telephone(settings.emergencyPhone)}`}>
          {settings.emergencyPhone}
          <ArrowRight size={17} />
        </CmsAnchor>
      </div>
      <div className="svc-contact-layout">
        <ContactForm />
        <aside className="svc-contact-sidebar" id="uradni-kontakti">
          <section className="panel svc-contact-main">
            <div className="svc-icon">
              <Phone size={25} />
            </div>
            <h2>Komunalno podjetje Vrhnika</h2>
            <p>Javno podjetje Komunalno podjetje Vrhnika, d. o. o.</p>
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
            <h3>Za vsakodnevna opravila</h3>
            <Link to="/prijavi">
              <Wrench size={20} />
              <span>
                Prijava težave
                <small>
                  Poškodba ceste, svetilka ali zabojnik; fotografija in lokacija
                </small>
              </span>
              <ChevronRight size={18} />
            </Link>
            <Link to="/storitve">
              <FileText size={20} />
              <span>
                Povpraševanje za storitev
                <small>Kosovni odvoz, praznjenje greznice in drugo</small>
              </span>
              <ChevronRight size={18} />
            </Link>
            <Link to="/obvestila#narocilo">
              <Bell size={20} />
              <span>
                Obvestila za moj dom
                <small>Preizkus naročila na lokalne informacije</small>
              </span>
              <ChevronRight size={18} />
            </Link>
          </section>
          <div className="svc-contact-real-help">
            <CheckCircle2 size={20} />
            <h3>Za dejanski odgovor</h3>
            <p>
              Pokličite uradno številko ali napišite e-pošto na{" "}
              <CmsAnchor href={`mailto:${settings.email}`}>
                info@kpv.si
              </CmsAnchor>
              . Predstavitveni obrazec še ni povezan z obravnavo sporočil pri
              podjetju.
            </p>
          </div>
        </aside>
      </div>
      <ContactHours />
      <div className="svc-contact-foot">
        <Source href="https://www.kpv.si/mPodjetje/mPkont.html">
          Vir kontaktov: uradna spletna stran KPV
        </Source>
        <span>
          Preverjeno 29. oktobra 2026. Portal je predstavitveni projekt.
        </span>
      </div>
    </CmsLayout>
  );
}
export function AboutPage() {
  return (
    <CmsLayout>
      <Intro
        eyebrow="O PODJETJU IN PORTALU"
        title="Za okolje, v katerem radi živimo."
      >
        Pitna voda, urejeno okolje in zanesljive komunalne storitve so del
        vsakdana. Ta portal jih povezuje v preproste poti za občane.
      </Intro>
      <section className="svc-about-band">
        <Leaf size={48} strokeWidth={1.4} />
        <h2>
          Vsakdanja skrb.
          <br />
          Skupna prihodnost.
        </h2>
        <p>
          Komunalno podjetje Vrhnika izvaja komunalne dejavnosti na območju
          občin Vrhnika, Borovnica in Log - Dragomer.
        </p>
      </section>
      <div className="svc-service-grid">
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
      <section className="panel svc-about-note">
        <h2>O tej predstavitvi</h2>
        <p>
          To je neodvisna oblikovna in funkcionalna predstavitev bodočega
          portala, ne uradna spletna stran podjetja. Uradni kontakti so povzeti
          iz javnih virov. Urniki, obvestila, točke na zemljevidu, tarife in
          tržnični termini so vzorčni. Oddani obrazci se uporabljajo za preizkus
          delovanja in v javni predstavitvi pošljejo obvestilo skrbniku portala.
          Uradna naročila, potrjeni termini in plačila niso vključeni.
        </p>
        <p>
          Naslov se lahko shrani v vaš brskalnik za hitrejši ponovni obisk.
          Odstranite ga lahko z izbrisom podatkov te spletne strani v
          nastavitvah brskalnika.
        </p>
        <Source href="https://kpv.si/mPodjetje/mPred.html">
          Uradna predstavitev podjetja
        </Source>
      </section>
    </CmsLayout>
  );
}
