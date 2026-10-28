import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { Link, useSearchParams } from "react-router-dom";
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
} from "lucide-react";
import "leaflet/dist/leaflet.css";
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
type Receipt = { id: string; message?: string };
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
  text = "Strinjam se s shranjevanjem vnesenih podatkov za preizkus te predstavitvene storitve.",
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
  if (receipt)
    return (
      <div className="svc-success" role="status">
        <CheckCircle2 size={23} />
        <div>
          <strong>Vaš preizkusni obrazec je shranjen.</strong>
          <p>
            Referenca: {receipt.id}. To je predstavitveni zapis. Sporočilo ni
            poslano izvajalcu, storitev ni naročena in plačilo ni izvedeno.
          </p>
        </div>
      </div>
    );
  if (error)
    return (
      <p className="svc-error" role="alert">
        <CircleAlert size={18} />
        {error}
      </p>
    );
  return null;
}
function useSubmission() {
  const [busy, setBusy] = useState(false);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [error, setError] = useState("");
  async function submit(endpoint: string, payload: object | FormData) {
    setBusy(true);
    setError("");
    setReceipt(null);
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
    }
  }
  return { busy, receipt, error, submit };
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
    <a className="svc-source" href={href} target="_blank" rel="noreferrer">
      {children}
      <ExternalLink size={14} />
    </a>
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
          Izberite območje in teme, ki vas zanimajo. V tej različici shranimo
          preizkusno naročilo; e-pošte še ne pošiljamo.
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
        <article key={notice.id} className="panel svc-notice">
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
    <>
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
    </>
  );
}
export function RoadsPage() {
  const { notices, loading, error, retry } = useNotices();
  const roads = notices.filter((n) => n.category === "roads");
  return (
    <>
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
    </>
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
export function ReportPage() {
  const [params] = useSearchParams();
  const [category, setCategory] = useState("roads");
  useEffect(() => {
    const value = params.get("category");
    setCategory(
      value && ["roads", "lighting", "bins", "other"].includes(value)
        ? value
        : "roads",
    );
  }, [params]);
  const [position, setPosition] = useState<[number, number] | null>(null);
  const [geoError, setGeoError] = useState("");
  const [fileName, setFileName] = useState("");
  const [preview, setPreview] = useState("");
  const [photoError, setPhotoError] = useState("");
  const submission = useSubmission();
  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );
  function locate() {
    setGeoError("");
    if (!navigator.geolocation) {
      setGeoError(
        "Vaš brskalnik ne podpira lokacije. Označite jo na zemljevidu.",
      );
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (value) => setPosition([value.coords.latitude, value.coords.longitude]),
      () =>
        setGeoError(
          "Lokacije ni mogoče pridobiti. Dovolite dostop ali izberite točko na zemljevidu.",
        ),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }
  return (
    <>
      <Intro
        eyebrow="SKUPAJ ZA UREJEN KRAJ"
        title="Opazite. Sporočite. Uredimo."
      >
        Povejte, kaj in kje ne deluje. Jasna lokacija in fotografija pomagata,
        da težavo hitreje razumemo.
      </Intro>
      <Demo>
        Preizkusni obrazec. Prijava se shrani v predstavitveno zbirko in ni
        poslana dežurni službi.
      </Demo>
      <form
        className="svc-report-layout"
        onSubmit={async (event) => {
          event.preventDefault();
          if (photoError) return;
          const data = new FormData(event.currentTarget);
          data.set("category", category);
          data.set("consent", "true");
          if (position) {
            data.set("latitude", position[0].toString());
            data.set("longitude", position[1].toString());
          }
          await submission.submit("/api/reports", data);
        }}
      >
        <div className="panel">
          <div className="svc-step">
            <span>01</span>
            <h2>Kaj ste opazili?</h2>
          </div>
          <div className="svc-type-grid">
            {[
              { value: "roads", title: "Cesta ali pločnik", icon: Road },
              {
                value: "lighting",
                title: "Javna razsvetljava",
                icon: Lightbulb,
              },
              { value: "bins", title: "Poškodovan zabojnik", icon: Trash2 },
              { value: "other", title: "Druga težava", icon: Wrench },
            ].map((item) => (
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
          <Field label="Opis težave" wide>
            <textarea
              name="description"
              required
              minLength={10}
              maxLength={2000}
              rows={5}
              placeholder="Opišite težavo in dodajte morebitne orientacijske točke …"
            />
          </Field>
          <div className="svc-photo">
            <label>
              <Upload size={22} />
              <strong>{fileName || "Dodajte fotografijo"}</strong>
              <span>JPG, PNG ali WebP, največ 5 MB. Neobvezno.</span>
              <input
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
                      "Izberite sliko JPG, PNG ali WebP do velikosti 5 MB.",
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
              <img
                src={preview}
                alt="Predogled fotografije prijavljene težave"
              />
            )}
          </div>
          {photoError && (
            <p className="svc-error" role="alert">
              {photoError}
            </p>
          )}
          <div className="svc-step">
            <span>02</span>
            <h2>Kje je težava?</h2>
          </div>
          <Field label="Naslov ali opis lokacije">
            <input
              name="address"
              required
              minLength={4}
              maxLength={200}
              placeholder="Ulica, hišna številka ali najbližji objekt"
              defaultValue={rememberedAddress()}
            />
          </Field>
          <div className="svc-locate">
            <button className="button secondary" type="button" onClick={locate}>
              <LocateFixed size={17} />
              Uporabi mojo lokacijo
            </button>
            {position && (
              <span>
                {position[0].toFixed(5)}, {position[1].toFixed(5)}
              </span>
            )}
          </div>
          {geoError && (
            <p className="svc-error" role="alert">
              {geoError}
            </p>
          )}
          <p className="svc-small">
            Lokacijo lahko označite tudi s klikom na zemljevid. GPS ni obvezen,
            naslov ali opis lokacije pa je.
          </p>
          <div className="svc-step">
            <span>03</span>
            <h2>Kako vas lahko dosežemo?</h2>
          </div>
          <div className="form-grid">
            <Field label="Ime in priimek">
              <input
                name="name"
                minLength={2}
                required
                autoComplete="name"
                maxLength={100}
                placeholder="Janez Novak"
              />
            </Field>
            <Field label="E-poštni naslov">
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
          <button className="button" disabled={submission.busy || !!photoError}>
            {submission.busy ? "Shranjujemo …" : "Oddaj preizkusno prijavo"}
            <ArrowRight size={17} />
          </button>
          <Result receipt={submission.receipt} error={submission.error} />
        </div>
        <aside>
          <div className="svc-map-wrap">
            <MapContainer
              center={[45.964, 14.298]}
              zoom={13}
              scrollWheelZoom={false}
              className="svc-map"
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <MapPosition position={position} onChange={setPosition} />
            </MapContainer>
            <span className="svc-map-caption">
              Kliknite za izbiro natančne lokacije
            </span>
          </div>
          <div className="svc-help">
            <Lightbulb size={22} />
            <h3>Dober opis naredi razliko.</h3>
            <p>
              Pri svetilki navedite številko droga. Pri cesti opišite smer in
              najbližjo hišno številko. Fotografirajte širšo okolico in
              podrobnost.
            </p>
          </div>
        </aside>
      </form>
    </>
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
export function ServicesPage() {
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
  return (
    <>
      <Intro eyebrow="STORITVE ZA VAŠ DOM" title="Uredite kar od doma.">
        Od odsluženega kavča do praznjenja greznice. Izberite storitev in nam
        zaupajte, kaj potrebujete.
      </Intro>
      <div className="svc-service-grid">
        {serviceOptions.map((item) => (
          <button
            key={item.value}
            className={`panel svc-service-card${service === item.value ? " selected" : ""}`}
            aria-pressed={service === item.value}
            onClick={() => setService(item.value)}
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
      <div className="svc-two-column">
        <section className="panel">
          <div className="eyebrow">POVPRAŠEVANJE</div>
          <h2>{serviceOptions.find((s) => s.value === service)?.title}</h2>
          <p>Izpolnite podatke za preizkus oddaje povpraševanja.</p>
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
              <Field label="Telefon">
                <input
                  name="phone"
                  required
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
                  placeholder={
                    service === "bulky"
                      ? "Npr. 1 kavč, 2 stola; predmeti so dostopni z dvorišča …"
                      : "Opišite potrebe, dostop in druge pomembne informacije …"
                  }
                />
              </Field>
            </div>
            <Consent />
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
    </>
  );
}

export function MarketPage() {
  const [date, setDate] = useState("");
  const [stallType, setStallType] = useState("standard");
  const submission = useSubmission();
  const rate = stallType === "food" ? 24 : stallType === "craft" ? 15 : 12;
  const dateOptions = useMemo(() => {
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
    return result;
  }, []);
  return (
    <>
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
              <Field label="Telefon">
                <input
                  name="phone"
                  required
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
                    Standardno mesto · vzorec 12 €
                  </option>
                  <option value="food">Živilska ponudba · vzorec 24 €</option>
                  <option value="craft">
                    Rokodelski izdelki · vzorec 15 €
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
            <h2>Se vidimo na tržnici.</h2>
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
    </>
  );
}

export function CalculatorPage() {
  const [people, setPeople] = useState(3);
  const [water, setWater] = useState(12);
  const [volume, setVolume] = useState(120);
  const [bio, setBio] = useState(true);
  const [drainage, setDrainage] = useState(true);
  const lines = [
    {
      name: `Odpadki · ${volume} l zabojnik`,
      description: "Vzorčni mesečni pavšal + dodatek na osebo",
      value: (volume / 120) * 6.5 + people * 1.8,
    },
    {
      name: "Biološki odpadki",
      description: "Vzorčni pavšal",
      value: bio ? 4.2 : 0,
    },
    {
      name: `Oskrba s pitno vodo · ${water} m³`,
      description: "Vzorčna omrežnina 5 € + 0,95 €/m³",
      value: 5 + water * 0.95,
    },
    {
      name: "Odvajanje in čiščenje",
      description: "Vzorčno 1,25 €/m³",
      value: drainage ? water * 1.25 : 0,
    },
  ];
  return (
    <>
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
    </>
  );
}

export function DepoPage() {
  return (
    <>
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
          <a
            className="button"
            href="https://www.kpv.si/depoVrhnika/trgovina.html"
            target="_blank"
            rel="noreferrer"
          >
            Raziščite uradno ponudbo
            <ExternalLink size={17} />
          </a>
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
          <a
            className="svc-inline-link"
            href="https://www.google.com/maps/search/?api=1&query=Depo+Cankarjev+trg+6a+Vrhnika"
            target="_blank"
            rel="noreferrer"
          >
            Načrtujte pot
            <ArrowRight size={17} />
          </a>
        </article>
        <article className="panel">
          <Clock3 size={25} />
          <h3>Pred obiskom preverite</h3>
          <p>
            Ponudba se spreminja. Delovni čas in razpoložljivost predmetov
            preverite na uradni strani ali po telefonu.
          </p>
          <a className="svc-inline-link" href="tel:+38641777385">
            041 777 385
            <Phone size={17} />
          </a>
        </article>
        <article className="panel">
          <ShoppingBag size={25} />
          <h3>Imate še uporaben predmet?</h3>
          <p>
            Pred oddajo se z Depojem dogovorite o primernosti in načinu
            prevzema.
          </p>
          <a className="svc-inline-link" href="mailto:depo@kpv.si">
            depo@kpv.si
            <Mail size={17} />
          </a>
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
    </>
  );
}
export function ContactPage() {
  return (
    <>
      <Intro
        eyebrow="TUKAJ SMO ZA VAS"
        title="Pravi odgovor se začne s stikom."
      >
        Poiščite pravi kanal za svoje vprašanje. Za dejanska naročila in nujne
        težave uporabite uradne kontakte podjetja.
      </Intro>
      <div className="svc-contact-grid">
        <section className="panel svc-contact-main">
          <div className="svc-icon">
            <Phone size={25} />
          </div>
          <h2>Komunalno podjetje Vrhnika</h2>
          <p>Javno podjetje Komunalno podjetje Vrhnika, d. o. o.</p>
          <a href="tel:+38617502960" className="svc-contact-number">
            01 750 29 60
          </a>
          <a href="mailto:info@kpv.si" className="svc-inline-link">
            info@kpv.si
            <Mail size={18} />
          </a>
          <div className="svc-address">
            <MapPin size={21} />
            <span>
              Pot na Tojnice 40
              <br />
              1360 Vrhnika
            </span>
          </div>
          <a
            className="button secondary"
            href="https://www.google.com/maps/search/?api=1&query=Komunalno+podjetje+Vrhnika+Pot+na+Tojnice+40"
            target="_blank"
            rel="noreferrer"
          >
            Kako do nas
            <ExternalLink size={16} />
          </a>
        </section>
        <div>
          <section className="svc-contact-urgent">
            <div className="eyebrow">DEŽURNA SLUŽBA</div>
            <h2>Potrebujete nujno pomoč?</h2>
            <p>
              Za nujne komunalne težave uporabite uradno dežurno številko KPV.
            </p>
            <a href="tel:+38641364681">
              <Phone size={22} />
              041 364 681
            </a>
          </section>
          <section className="panel svc-contact-small">
            <h3>Za vsakodnevna opravila</h3>
            <Link to="/prijavi">
              <Wrench size={20} />
              <span>
                Prijava težave
                <small>Preizkusni obrazec s fotografijo in lokacijo</small>
              </span>
              <ChevronRight size={18} />
            </Link>
            <Link to="/storitve">
              <FileText size={20} />
              <span>
                Povpraševanje za storitev
                <small>Odvoz kosovnih odpadkov, greznice in drugo</small>
              </span>
              <ChevronRight size={18} />
            </Link>
            <Link to="/obvestila#narocilo">
              <Bell size={20} />
              <span>
                Obvestila za moj dom
                <small>Preizkus prijave na lokalne informacije</small>
              </span>
              <ChevronRight size={18} />
            </Link>
          </section>
        </div>
      </div>
      <div className="svc-contact-foot">
        <Source>Vir kontaktov: uradna spletna stran KPV</Source>
        <span>
          Preverjeno 28. oktobra 2026. Portal je predstavitveni projekt.
        </span>
      </div>
    </>
  );
}
export function AboutPage() {
  return (
    <>
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
            icon: Store,
            title: "Druge storitve",
            text: "Tržnična in pokopališka dejavnost ter komunalne storitve.",
            to: "/storitve",
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
          delovanja; e-pošta, uradna naročila in plačila niso vključeni.
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
    </>
  );
}
