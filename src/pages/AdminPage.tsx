import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronRight,
  Clock3,
  Code2,
  Copy,
  Download,
  ExternalLink,
  FileClock,
  Files,
  ImagePlus,
  Inbox,
  LayoutDashboard,
  LoaderCircle,
  LogOut,
  Menu,
  Plus,
  RefreshCw,
  Save,
  ShieldCheck,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import siteDefaults from "../../shared/site-defaults.json";
import "./admin.css";
import LocationPicker from "../components/admin/LocationPicker";
import TariffsEditor from "../components/admin/TariffsEditor";
import type { TariffData } from "../../shared/utility-pricing.js";
import WorkQueue, {
  type WorkQueueRecovery,
} from "../components/admin/WorkQueue";
import AdminSignIn, {
  type AdminSession,
} from "../components/admin/AdminSignIn";
import AdminUsers from "../components/admin/AdminUsers";
import NotificationSettings, {
  type NotificationSettingsRecovery,
} from "../components/admin/NotificationSettings";
import CollectionEditor from "../components/admin/CollectionEditor";
import CemeteryEditor from "../components/admin/CemeteryEditor";
import type { CemeteryData } from "../data/cemetery";
import NoticesEditor, {
  type EditableNotice,
} from "../components/admin/NoticesEditor";
import DistrictsEditor, {
  type District,
} from "../components/admin/DistrictsEditor";
import type { CollectionData } from "../../shared/collection-utils";
import LayoutEditor from "../components/admin/LayoutEditor";
import WebsiteEditor, {
  WEBSITE_SECTIONS,
  type WebsiteDraft,
} from "../components/admin/WebsiteEditor";
import type { CmsLayoutData } from "../../shared/page-layout";
import EditorRecoveryBoundary from "../components/admin/EditorRecoveryBoundary";
import { validateEditorDraft } from "../components/admin/draft-validation";
import PrivacyTools from "../components/admin/PrivacyTools";
import ScheduledPublications from "../components/admin/ScheduledPublications";
import NoticeCampaigns from "../components/admin/NoticeCampaigns";

type Json = null | string | number | boolean | Json[] | { [key: string]: Json };
type Sections = Record<string, Json>;
type Session = AdminSession;
type StoredDraft = {
  value: Json;
  baseRevisions: Record<string, number>;
  revision: number;
  savedAt: number;
};
type InterruptedDraft = {
  user: string;
  section: string;
  value: Json;
  baseRevisions: Record<string, number>;
};
type Media = {
  id: string;
  url: string;
  type: string;
  createdAt?: string;
  name?: string;
};
type Version = { revision: number; createdAt: string; value?: Json };
type Selection = {
  kind: "text" | "image" | "link";
  label?: string;
  url?: string;
  key: string;
  original: string;
  tag?: string;
  src?: string;
  alt?: string;
  page: string;
};
type Path = (string | number)[];

const sectionInfo: Record<
  string,
  { name: string; description: string; group: string }
> = {
  website: {
    name: "Urejevalnik spletne strani",
    description:
      "Besedila, slike, povezave, razporeditev in logotip na enem mestu.",
    group: "Portal",
  },
  layout: {
    name: "Razporeditev in nove strani",
    description: "Premikanje razdelkov, dodajanje gumbov, vsebin in strani.",
    group: "Prejšnji urejevalniki",
  },
  links: {
    name: "Povezave in gumbi",
    description: "Spremenite cilj in besedilo javnih povezav.",
    group: "Prejšnji urejevalniki",
  },
  settings: {
    name: "Nastavitve portala",
    description: "Osnovni podatki, kontakti in nastavitve prikaza.",
    group: "Portal",
  },
  copy: {
    name: "Besedila na straneh",
    description: "Odprite stran in kliknite besedilo, ki ga želite urediti.",
    group: "Prejšnji urejevalniki",
  },
  images: {
    name: "Slike na straneh",
    description:
      "Izberite sliko v predogledu in jo zamenjajte z datoteko iz knjižnice.",
    group: "Prejšnji urejevalniki",
  },
  hours: {
    name: "Delovni časi",
    description: "Redni delovni časi, kontaktne informacije in opombe.",
    group: "Vsebine",
  },
  notices: {
    name: "Obvestila in motnje",
    description: "Objavljajte in urejajte obvestila za občane.",
    group: "Vsebine",
  },
  districts: {
    name: "Območja e-obveščanja",
    description:
      "Občine, naselja in predeli, na katere se naročniki prijavijo za e-obvestila.",
    group: "Vsebine",
  },
  tariffs: {
    name: "Ceniki in izračun",
    description:
      "Potrjene cene po občinah, obračunske količine in cene posebnih storitev.",
    group: "Vsebine",
  },
  collection: {
    name: "Urniki odvoza",
    description: "Območja, termini in vrste odpadkov.",
    group: "Vsebine",
  },
  wastePoints: {
    name: "Zbirna mesta",
    description: "Zemljevid, lokacije in podatki o zbirnih mestih.",
    group: "Vsebine",
  },
  wasteItems: {
    name: "Čarovnik za odpadke",
    description: "Posamezni odpadki, iskalne besede in navodila za oddajo.",
    group: "Vsebine",
  },
  wasteCategories: {
    name: "Vrste odpadkov",
    description: "Zabojniki, barve in pravila ločevanja.",
    group: "Vsebine",
  },
  services: {
    name: "Komunalne storitve",
    description: "Ponudba storitev in navodila za povpraševanja.",
    group: "Vsebine",
  },
  rates: {
    name: "Cene tržničnih stojnic",
    description:
      "Sobotni najem zunanje stojnice na Sodnijskem trgu, z DDV. Občinski ceniki so povezani neposredno na veljavne dokumente KPV.",
    group: "Vsebine",
  },
  market: {
    name: "Tržnica",
    description: "Prijave so mogoče samo za objavljene prihodnje termine. Če je seznam terminov prazen, prijave niso omogočene. Zaprti termini niso na voljo.",
    group: "Vsebine",
  },
  cemetery: {
    name: "Pokopališče",
    description: "Načrt, grobovi in podatki v iskalniku.",
    group: "Vsebine",
  },
};
const pages = [
  ["/", "Začetna stran"],
  ["/odpadki", "Odpadki"],
  ["/voda", "Voda in kanalizacija"],
  ["/javni-prostor", "Naš kraj"],
  ["/odpadki/urnik", "Urnik odvoza"],
  ["/odpadki/kam-z-odpadki", "Čarovnik za odpadke"],
  ["/odpadki/lokacije", "Zbirna mesta"],
  ["/obvestila", "Obvestila"],
  ["/ceste", "Ceste in zapore"],
  ["/prijavi", "Prijava težave"],
  ["/storitve", "Storitve"],
  ["/trznica", "Tržnica"],
  ["/kalkulator", "Kalkulator"],
  ["/depo", "DEPO"],
  ["/pokopalisce", "Pokopališče"],
  ["/kontakt", "Kontakt"],
  ["/o-podjetju", "O podjetju"],
  ["/moj-dom", "Moj dom"],
  ["/zasebnost", "Zasebnost"],
];
const labels: Record<string, string> = {
  id: "Oznaka",
  key: "Ključ",
  name: "Ime",
  title: "Naslov",
  subtitle: "Podnaslov",
  description: "Opis",
  text: "Besedilo",
  value: "Vrednost",
  label: "Naziv",
  intro: "Uvod",
  summary: "Povzetek",
  body: "Vsebina",
  phone: "Telefon",
  telephone: "Telefonska povezava",
  email: "E-pošta",
  address: "Naslov / lokacija",
  latitude: "Zemljepisna širina",
  longitude: "Zemljepisna dolžina",
  lat: "Zemljepisna širina",
  lng: "Zemljepisna dolžina",
  x: "Položaj X na načrtu",
  y: "Položaj Y na načrtu",
  width: "Širina načrta",
  height: "Višina načrta",
  date: "Datum",
  startDate: "Začetni datum",
  endDate: "Končni datum",
  born: "Datum rojstva",
  died: "Datum smrti",
  createdAt: "Ustvarjeno",
  updatedAt: "Posodobljeno",
  status: "Stanje",
  category: "Področje",
  subcategory: "Podkategorija",
  area: "Območje",
  section: "Oddelek",
  row: "Vrsta",
  number: "Številka",
  people: "Osebe",
  graves: "Grobovi",
  imageUrl: "Slika načrta (URL)",
  url: "Povezava",
  href: "Ciljna povezava",
  src: "Vir slike",
  alt: "Opis slike",
  original: "Izvirna vsebina",
  page: "Stran",
  type: "Vrsta",
  kind: "Vrsta",
  color: "Barva",
  icon: "Ikona",
  keywords: "Iskalne besede",
  aliases: "Dodatni iskalni izrazi",
  instructions: "Navodila",
  note: "Opomba",
  notes: "Opombe",
  prepare: "Kaj pripraviti",
  placeholder: "Primer vnosa",
  desc: "Kratek opis",
  tone: "Barvni slog",
  rows: "Vrstice urnika",
  hours: "Ure",
  days: "Dnevi",
  day: "Dan",
  time: "Čas",
  open: "Odprto od",
  close: "Zaprto ob",
  closed: "Zaprto",
  enabled: "Vključeno",
  active: "Aktivno",
  published: "Objavljeno",
  demo: "Prikazni podatki",
  price: "Cena (€)",
  rate: "Cena na enoto (€)",
  amount: "Znesek (€)",
  unit: "Enota",
  base: "Osnovni znesek (€)",
  capacity: "Zmogljivost",
  volume: "Prostornina",
  frequency: "Pogostost",
  interval: "Razmik (tedni)",
  count: "Število",
  dates: "Termini",
  events: "Odvozi",
  zones: "Območja",
  schedules: "Urniki",
  types: "Vrste",
  items: "Vnosi",
  points: "Zbirna mesta",
  categories: "Področja",
  services: "Storitve",
  options: "Možnosti",
  bins: "Zabojniki",
  accepted: "Sprejema",
  accepts: "Sprejeti odpadki",
  openingHours: "Delovni čas",
  source: "Vir podatkov",
  sourceUrl: "Povezava do vira",
  verifiedAt: "Datum preverjanja",
  municipalities: "Občine",
  municipality: "Občina",
  stallType: "Vrsta stojnice",
  stalls: "Stojnice",
  products: "Ponudba",
  tariffs: "Tarife",
  rates: "Cene",
  company: "Podjetje",
  emergency: "Dežurna služba",
  contacts: "Kontakti",
  office: "Informacijska pisarna",
  siteName: "Ime portala",
  tagline: "Slogan",
  footer: "Noga strani",
  plan: "Načrt",
  image: "Slika",
  emergencyPhone: "Dežurni telefon",
  depoUrl: "Povezava do DEPO",
  footerText: "Besedilo v nogi strani",
  logoUrl: "Slika logotipa (URL)",
  logoAlt: "Opis logotipa",
  routes: "Odvozne poti",
  addresses: "Naslovi na odvozni poti",
  destination: "Mesto oddaje",
  tip: "Nasvet za ločevanje",
  center: "Zbirni center",
  closedDates: "Zaprti termini",
  wasteBase: "Osnovni znesek za odpadke (€)",
  wastePerson: "Odpadki na osebo (€)",
  bio: "Biološki odpadki (€)",
  waterBase: "Osnovni znesek za vodo (€)",
  waterPerM3: "Voda na m³ (€)",
  drainagePerM3: "Odvajanje na m³ (€)",
  marketStandard: "Sobota · ostali izdelki (€ z DDV)",
  marketFood: "Sobota · prehrambeni izdelki (€ z DDV)",
  marketCraft: "Sobota · rokodelski izdelki (€ z DDV)",
  embalaza: "Odpadna embalaža",
  papir: "Papir in karton",
  steklo: "Steklena embalaža",
  mesani: "Mešani odpadki",
  nevarni: "Nevarni odpadki",
  elektronika: "Elektronika",
  tekstil: "Tekstil",
  bin: "Opis zabojnika",
};
const enums: Record<string, [string, string][]> = {
  status: [
    ["planned", "Načrtovano"],
    ["info", "Informacija"],
    ["active", "V teku"],
    ["resolved", "Zaključeno"],
  ],
  category: [
    ["water", "Voda"],
    ["roads", "Ceste"],
    ["waste", "Odpadki"],
    ["general", "Splošno"],
  ],
  section: [
    ["A", "A"],
    ["B", "B"],
    ["C", "C"],
    ["D", "D"],
  ],
  stallType: [
    ["standard", "Običajna"],
    ["food", "Živila"],
    ["craft", "Rokodelstvo"],
  ],
  tone: [
    ["office", "Informacijska pisarna · zeleno"],
    ["collection", "Zbirni center · modro"],
    ["depo", "DEPO · rjavo"],
  ],
};
const wasteOptions: [string, string][] = [
  ["embalaza", "Odpadna embalaža"],
  ["papir", "Papir in karton"],
  ["steklo", "Steklena embalaža"],
  ["bio", "Biološki odpadki"],
  ["mesani", "Preostanek odpadkov"],
  ["nevarni", "Nevarni odpadki"],
  ["elektronika", "Elektronika"],
  ["center", "Posebni in kosovni odpadki"],
  ["tekstil", "Tekstil"],
];
const pointOptions: [string, string][] = [
  ["center", "Zbirni center"],
  ["public", "Javni zabojnik"],
  ["papir", "Papir"],
  ["steklo", "Steklo"],
  ["embalaza", "Embalaža"],
  ["baterije", "Baterije"],
  ["elektronika", "Elektronika"],
  ["tekstil", "Tekstil"],
];
const serviceChoices: [string, string][] = [
  ["bulky", "Kosovni odpadki"],
  ["septic", "Greznice in MKČN"],
  ["water", "Vodovod in kanalizacija"],
  ["other", "Druga storitev"],
];
const defaultSections = siteDefaults as unknown as Sections;
const isObject = (value: Json): value is Record<string, Json> =>
  value !== null && !Array.isArray(value) && typeof value === "object";
const prettyDate = (value?: string | number) => {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? String(value)
    : new Intl.DateTimeFormat("sl-SI", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(date);
};
const fieldName = (key: string) =>
  labels[key] || key.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[_-]/g, " ");
const clone = <T,>(value: T): T => structuredClone(value);
function newValue(example: Json, key = ""): Json {
  if (Array.isArray(example)) return [];
  if (isObject(example))
    return Object.fromEntries(
      Object.entries(example).map(([name, value]) => [
        name,
        newValue(value, name),
      ]),
    );
  if (typeof example === "boolean") return false;
  if (typeof example === "number")
    return ["row", "number", "width", "height"].includes(key) ? 1 : 0;
  if (example === null) return null;
  if (key === "id" || key === "key")
    return `nov-${crypto.randomUUID().slice(0, 8)}`;
  if (key === "born") return "1940-01-01";
  if (key === "died") return "2020-01-01";
  if (key === "category" || key === "type" || key === "value") return example;
  if (enums[key]?.some(([value]) => value === example)) return example;
  if (
    /date|born|died|verifiedAt/i.test(key) ||
    /^\d{4}-\d{2}-\d{2}$/.test(example)
  )
    return new Date().toISOString().slice(0, 10);
  return "";
}
const arrayFallback: Record<string, Json> = {
  people: { name: "", born: "1940-01-01", died: "2020-01-01" },
  graves: { id: "", section: "A", row: 1, number: 1, x: 0, y: 0, people: [] },
  copy: { page: "/", key: "", original: "", value: "" },
  images: { page: "/", key: "", original: "", url: "", alt: "" },
  rows: ["", ""],
  routes: { id: "", name: "", addresses: [], events: [] },
  events: { id: "", type: "packaging", label: "", date: "2026-01-01", bin: "" },
  dates: "2026-01-01",
  closedDates: "2026-01-01",
};
class RequestError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

function Dialog({
  title,
  onClose,
  children,
  error,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  error?: string;
}) {
  const element = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = element.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  return (
    <dialog
      ref={element}
      className="admin-dialog"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      aria-label={title}
    >
      <header>
        <h2>{title}</h2>
        <button
          className="admin-icon-button"
          type="button"
          onClick={onClose}
          aria-label="Zapri okno"
        >
          <X size={20} />
        </button>
      </header>
      {error && (
        <div className="admin-error" role="alert">
          {error}
        </div>
      )}
      {children}
    </dialog>
  );
}

function NumberField({
  value,
  label,
  onChange,
}: {
  value: number;
  label: string;
  onChange: (value: number) => void;
}) {
  const [text, setText] = useState(String(value));
  useEffect(() => {
    setText((previous) =>
      Number(previous) === value && previous !== "" ? previous : String(value),
    );
  }, [value]);
  return (
    <label className="admin-field">
      <span>{label}</span>
      <input
        type="number"
        step="any"
        value={text}
        onChange={(event) => {
          const next = event.target.value;
          setText(next);
          if (next !== "" && Number.isFinite(Number(next)))
            onChange(Number(next));
        }}
        onBlur={() => {
          if (text === "" || !Number.isFinite(Number(text))) {
            setText(String(value));
          }
        }}
      />
    </label>
  );
}

function Editor({
  value,
  onChange,
  section,
  path = [],
  example,
  depth = 0,
}: {
  value: Json;
  onChange: (value: Json) => void;
  section: string;
  path?: Path;
  example?: Json;
  depth?: number;
}) {
  const key = String(path[path.length - 1] ?? section);
  if (
    Array.isArray(value) &&
    section === "hours" &&
    path[path.length - 2] === "rows"
  )
    return (
      <div className="admin-field-grid">
        {["Dan oziroma dnevi", "Delovni čas"].map((label, index) => (
          <label className="admin-field" key={label}>
            <span>{label}</span>
            <input
              value={String(value[index] ?? "")}
              placeholder={index === 0 ? "Ponedeljek–petek" : "8.00–12.00"}
              onChange={(event) =>
                onChange(
                  index === 0
                    ? [event.target.value, value[1] ?? ""]
                    : [value[0] ?? "", event.target.value],
                )
              }
            />
          </label>
        ))}
      </div>
    );
  if (Array.isArray(value) && section === "wastePoints" && key === "types")
    return (
      <div className="admin-choice-grid">
        {pointOptions.map(([option, title]) => (
          <label className="admin-checkbox" key={option}>
            <input
              type="checkbox"
              checked={value.includes(option)}
              onChange={(event) =>
                onChange(
                  event.target.checked
                    ? [...value, option]
                    : value.filter((item) => item !== option),
                )
              }
            />
            <span>{title}</span>
          </label>
        ))}
      </div>
    );
  if (Array.isArray(value)) {
    const entries = value;
    const samples = Array.isArray(example) ? example : [];
    const fallback = defaultSections[section];
    const template =
      value[0] ??
      samples[0] ??
      arrayFallback[key] ??
      (Array.isArray(fallback) ? fallback[0] : "") ??
      "";
    const fixed = section === "services" && !path.length;
    const manualOverrides =
      (section === "copy" || section === "images") && !path.length;
    function add() {
      let item = Array.isArray(template)
        ? template.map((entry) => newValue(entry))
        : newValue(template, key);
      if (isObject(item) && section === "wastePoints" && !path.length) {
        item.id =
          Math.max(
            0,
            ...entries.map((entry) =>
              isObject(entry) && typeof entry.id === "number" ? entry.id : 0,
            ),
          ) + 1;
        item.types = ["public"];
        item.lat = null;
        item.lng = null;
      }
      if (isObject(item) && key === "graves") {
        const newSection = item.section;
        item.number =
          Math.max(
            0,
            ...entries.map((entry) =>
              isObject(entry) &&
              entry.section === newSection &&
              typeof entry.number === "number"
                ? entry.number
                : 0,
            ),
          ) + 1;
      }
      onChange([...entries, item]);
    }
    return (
      <div className={`admin-array admin-depth-${Math.min(depth, 3)}`}>
        <div className="admin-array-heading">
          <span>
            {value.length} {value.length === 1 ? "vnos" : "vnosov"}
          </span>
          {!fixed && !manualOverrides && (
            <button
              type="button"
              className="admin-button admin-small"
              onClick={add}
            >
              <Plus size={15} />
              Dodaj vnos
            </button>
          )}
        </div>
        {value.length === 0 && (
          <p className="admin-empty-small">
            {manualOverrides
              ? "Za prvo zamenjavo izberite element v predogledu strani."
              : "Tu še ni vnosov. Dodajte prvega z gumbom zgoraj."}
          </p>
        )}
        {value.map((item, index) => {
          const title = isObject(item)
            ? String(
                item.title ||
                  item.name ||
                  item.label ||
                  item.id ||
                  `Vnos ${index + 1}`,
              )
            : `${fieldName(key)} ${index + 1}`;
          const move = (offset: number) => {
            const next = [...value];
            [next[index], next[index + offset]] = [
              next[index + offset],
              next[index],
            ];
            onChange(next);
          };
          return (
            <details
              className="admin-array-item"
              key={`${path.join(".")}-${index}`}
              open={value.length <= 3 || undefined}
            >
              <summary>
                <span className="admin-row-number">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span>{title || `Vnos ${index + 1}`}</span>
                <ChevronRight size={16} />
              </summary>
              <div className="admin-array-body">
                <div className="admin-row-tools">
                  <button
                    className="admin-icon-button"
                    type="button"
                    onClick={() => move(-1)}
                    disabled={index === 0}
                    aria-label={`Premakni ${title} navzgor`}
                  >
                    <ArrowUp size={16} />
                  </button>
                  <button
                    className="admin-icon-button"
                    type="button"
                    onClick={() => move(1)}
                    disabled={index === value.length - 1}
                    aria-label={`Premakni ${title} navzdol`}
                  >
                    <ArrowDown size={16} />
                  </button>
                  {!fixed && (
                    <button
                      className="admin-danger-link"
                      type="button"
                      onClick={() => {
                        if (
                          window.confirm(
                            `Želite odstraniti vnos »${title}«? Sprememba bo objavljena šele ob shranjevanju.`,
                          )
                        )
                          onChange(value.filter((_, i) => i !== index));
                      }}
                    >
                      <Trash2 size={15} />
                      Odstrani vnos
                    </button>
                  )}
                </div>
                <Editor
                  value={item}
                  example={samples[index] ?? samples[0]}
                  section={section}
                  path={[...path, index]}
                  depth={depth + 1}
                  onChange={(next) =>
                    onChange(
                      value.map((entry, i) => (i === index ? next : entry)),
                    )
                  }
                />
              </div>
            </details>
          );
        })}
      </div>
    );
  }
  if (isObject(value))
    return (
      <div className={`admin-field-grid admin-depth-${Math.min(depth, 3)}`}>
        {Object.entries(value).map(([name, field]) => {
          if (section === "wastePoints" && ["lat", "lng"].includes(name)) {
            if (name === "lng") return null;
            return (
              <LocationPicker
                key="location"
                latitude={typeof value.lat === "number" ? value.lat : null}
                longitude={typeof value.lng === "number" ? value.lng : null}
                optional={false}
                onChange={(lat, lng) => onChange({ ...value, lat, lng })}
              />
            );
          }
          if (
            section === "settings" &&
            !path.length &&
            ["logoUrl", "logoAlt"].includes(name)
          )
            return null;
          if (
            section === "rates" &&
            !path.length &&
            !["marketStandard", "marketFood", "marketCraft"].includes(name)
          )
            return null;
          const nested = field !== null && typeof field === "object";
          return (
            <div
              key={name}
              className={
                nested ||
                (typeof field === "string" &&
                  (field.length > 100 ||
                    /description|message|text|intro|summary|body|note|placeholder/i.test(
                      name,
                    )))
                  ? "admin-field-wide"
                  : ""
              }
            >
              {nested && (
                <h3 className="admin-field-title">{fieldName(name)}</h3>
              )}
              <Editor
                value={field}
                example={
                  isObject(example ?? null)
                    ? (example as Record<string, Json>)[name]
                    : undefined
                }
                section={section}
                path={[...path, name]}
                depth={depth + 1}
                onChange={(next) => onChange({ ...value, [name]: next })}
              />
            </div>
          );
        })}
      </div>
    );
  const label =
    typeof path[path.length - 1] === "number" ? "Vrednost" : fieldName(key);
  if (typeof value === "boolean")
    return (
      <label className="admin-checkbox">
        <input
          type="checkbox"
          checked={value}
          onChange={(event) => onChange(event.target.checked)}
        />
        <span>{label}</span>
      </label>
    );
  if (typeof value === "number")
    return <NumberField value={value} label={label} onChange={onChange} />;
  if (value === null)
    return (
      <label className="admin-field">
        <span>
          {label} <small>neobvezno</small>
        </span>
        <input
          value=""
          placeholder="Ni nastavljeno"
          onChange={(event) => onChange(event.target.value || null)}
        />
      </label>
    );
  const choices: [string, string][] | undefined =
    key === "page"
      ? [["*", "Vse strani · glava in noga"], ...(pages as [string, string][])]
      : section === "wasteItems" && key === "category"
        ? wasteOptions
        : section === "services" && key === "value"
          ? serviceChoices
          : section === "collection" && key === "type"
            ? [
                ["packaging", "Odpadna embalaža"],
                ["bio", "Biološki odpadki"],
                ["residual", "Mešani odpadki"],
              ]
            : enums[key];
  if (choices && choices.some(([option]) => option === value))
    return (
      <label className="admin-field">
        <span>{label}</span>
        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
        >
          {choices.map(([option, name]) => (
            <option key={option} value={option}>
              {name}
            </option>
          ))}
        </select>
      </label>
    );
  const multiline =
    value.length > 100 ||
    /description|message|text|intro|summary|body|note|placeholder|original/i.test(
      key,
    );
  const type =
    /^\d{4}-\d{2}-\d{2}$/.test(value) ||
    /^(date|born|died|startDate|endDate|verifiedAt)$/.test(key)
      ? "date"
      : /email/i.test(key)
        ? "email"
        : /phone|telephone/i.test(key)
          ? "tel"
          : /^(url|src|href|imageUrl|sourceUrl)$/.test(key) &&
              /^https?:/.test(value)
            ? "url"
            : "text";
  return (
    <label className="admin-field">
      <span>{label}</span>
      {multiline ? (
        <textarea
          rows={value.length > 300 ? 6 : 3}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : (
        <input
          type={type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
      {key === "id" && (
        <small>Enolična oznaka; sprememba lahko vpliva na povezave.</small>
      )}
    </label>
  );
}

export default function AdminPage() {
  const [session, setSession] = useState<Session | null>(null);
  const currentSessionToken = useRef(session?.csrfToken);
  currentSessionToken.current = session?.csrfToken;
  const [checking, setChecking] = useState(true);
  const [sections, setSections] = useState<Sections>({});
  const [revisions, setRevisions] = useState<Record<string, number>>({});
  const [active, setActive] = useState(() =>
    new URLSearchParams(location.search).has("case")
      ? "submissions"
      : "dashboard",
  );
  const currentArea = useRef(active);
  currentArea.current = active;
  const [draft, setDraft] = useState<Json>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [mobileMenu, setMobileMenu] = useState(false);
  const [compactMenu, setCompactMenu] = useState(
    () => window.matchMedia("(max-width: 900px)").matches,
  );
  const [history, setHistory] = useState<{ section: string; items: Version[] } | null>(null);
  const [advanced, setAdvanced] = useState(false);
  const [websiteHistorySection, setWebsiteHistorySection] =
    useState<string>("copy");
  const [jsonText, setJsonText] = useState("");
  const [media, setMedia] = useState<Media[]>([]);
  const [mediaLoaded, setMediaLoaded] = useState(false);
  const [mediaNextCursor, setMediaNextCursor] = useState<string | null>(null);
  const [mediaLoading, setMediaLoading] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState("");
  const [previewPage, setPreviewPage] = useState("/");
  const [previewMode, setPreviewMode] = useState<"edit" | "interact">("edit");
  const [workDirty, setWorkDirty] = useState(false);
  const [workBusy, setWorkBusy] = useState(false);
  const [storedDraft, setStoredDraft] = useState<StoredDraft | null>(null);
  const [draftLoading, setDraftLoading] = useState(false);
  const interruptedDraft = useRef<InterruptedDraft | null>(null);
  const interruptedWork = useRef<{
    user: string;
    value: WorkQueueRecovery;
  } | null>(null);
  const interruptedNotifications = useRef<{
    user: string;
    value: NotificationSettingsRecovery;
  } | null>(null);
  const interruptedArea = useRef<{ user: string; section: string } | null>(
    null,
  );
  const accessScope = session?.scope || session?.user.accessScope || "all";
  const canContent =
    session?.user.role === "owner" || accessScope !== "operations";
  const canOperations =
    session?.user.role === "owner" || accessScope !== "content";
  const previewPages = [
    ...pages,
    ...((sections.layout as unknown as CmsLayoutData | undefined)?.pages || [])
      .filter((p) => !pages.some(([path]) => path === p.path))
      .map((p) => [p.path, p.title]),
  ];
  const [selection, setSelection] = useState<Selection | null>(null);
  const [previewReady, setPreviewReady] = useState(false);
  const iframe = useRef<HTMLIFrameElement>(null);
  const inspector = useRef<HTMLElement>(null);
  const uploadInput = useRef<HTMLInputElement>(null);
  const sidebar = useRef<HTMLElement>(null);
  useEffect(() => {
    const media = window.matchMedia("(max-width: 900px)");
    const update = () => {
      setCompactMenu(media.matches);
      if (!media.matches) setMobileMenu(false);
    };
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    if (!mobileMenu || !compactMenu) return;
    const previous = document.activeElement as HTMLElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    sidebar.current?.querySelector<HTMLButtonElement>("button")?.focus();
    const keys = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setMobileMenu(false);
      }
      if (event.key !== "Tab") return;
      const controls = Array.from(
        sidebar.current?.querySelectorAll<HTMLElement>("a,button") || [],
      );
      const first = controls[0],
        last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener("keydown", keys);
    return () => {
      document.removeEventListener("keydown", keys);
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, [mobileMenu, compactMenu]);
  const websiteDraft = (source: Sections): Json =>
    Object.fromEntries(
      WEBSITE_SECTIONS.map((key) => [
        key,
        clone(source[key] ?? (siteDefaults as unknown as Sections)[key]),
      ]),
    ) as Json;
  const draftFor = (key: string, source = sections) =>
    key === "website" ? websiteDraft(source) : clone(source[key] ?? null);
  const contentLoaded = Object.keys(sections).length > 0;
  const editing = Object.hasOwn(sectionInfo, active);
  const contentDirty =
    editing &&
    JSON.stringify(draft) !==
      JSON.stringify(
        active === "website"
          ? websiteDraft(sections)
          : (sections[active] ?? null),
      );
  const dirty = contentDirty || workDirty;
  const draftSaved =
    storedDraft !== null &&
    JSON.stringify(draft) === JSON.stringify(storedDraft.value);
  const visual = active === "copy" || active === "images" || active === "links";

  function expireSession() {
    currentSessionToken.current = undefined;
    setBusy(false);
    if (session)
      interruptedArea.current = { user: session.user.email, section: active };
    if (editing && session && draft !== null)
      interruptedDraft.current = {
        user: session.user.email,
        section: active,
        value: clone(draft),
        baseRevisions: Object.fromEntries(
          (active === "website" ? WEBSITE_SECTIONS : [active]).map((key) => [
            key,
            revisions[key] ?? 0,
          ]),
        ),
      };
    setSession(null);
    setSections({});
    setDraft(null);
    setMedia([]);
    setMediaLoaded(false);
    setMediaNextCursor(null);
    setHistory(null);
    setAdvanced(false);
    setSelection(null);
    setNotice(
      "Seja je potekla. Za nadaljevanje se znova prijavite. Neshranjene spremembe niso bile objavljene.",
    );
  }

  async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const headers = new Headers(init.headers);
    if (init.body && !(init.body instanceof FormData))
      headers.set("Content-Type", "application/json");
    if (init.method && init.method !== "GET" && session?.csrfToken)
      headers.set("X-CSRF-Token", session.csrfToken);
    const response = await fetch(path, {
      ...init,
      headers,
      credentials: "same-origin",
      signal: init.signal ?? AbortSignal.timeout(40000),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (
        response.status === 401 &&
        !path.endsWith("/login") &&
        !path.endsWith("/session") &&
        !path.endsWith("/logout")
      ) {
        expireSession();
      }
      throw new RequestError(
        data.error ||
          data.message ||
          (response.status === 409
            ? "Vsebino je medtem spremenil drug urednik. Osvežite jo in preverite spremembe."
            : "Zahteva ni uspela. Poskusite znova."),
        response.status,
      );
    }
    return data as T;
  }
  const failure = (cause: unknown) =>
    setError(
      cause instanceof Error
        ? cause.name === "TimeoutError" || cause.name === "AbortError"
          ? "Strežnik se ni pravočasno odzval. Preverite stanje pred ponovnim poskusom."
          : cause.message
        : "Povezava ni uspela. Preverite internetno povezavo.",
    );
  async function loadContent(
    recover?: InterruptedDraft,
    preserveDraft = false,
  ) {
    setLoading(true);
    try {
      const data = await request<{
        sections: Sections;
        revisions: Record<string, number>;
      }>(canContent ? "/api/admin/content" : "/api/content");
      setSections(data.sections);
      setRevisions({
        ...(data.revisions || {}),
        ...(recover?.baseRevisions || {}),
      });
      if (recover) {
        setActive(recover.section);
        setDraft(recover.value);
        setNotice(
          "Osnutek pred potekom seje je obnovljen. Objavljene vsebine se niso spremenile.",
        );
        interruptedDraft.current = null;
      } else if (Object.hasOwn(sectionInfo, active) && !preserveDraft)
        setDraft(draftFor(active, data.sections));
    } catch (cause) {
      failure(cause);
    } finally {
      setLoading(false);
    }
  }
  async function loadMedia(append = false) {
    if (mediaLoading || (append && !mediaNextCursor)) return;
    setMediaLoading(true);
    if (!append) setLoading(true);
    try {
      const query = append
        ? "?" + new URLSearchParams({ cursor: mediaNextCursor! })
        : "";
      const data = await request<{ items: Media[]; nextCursor: string | null }>(
        "/api/admin/media" + query,
      );
      setMedia((previous) =>
        append
          ? [
              ...new Map(
                [...previous, ...data.items].map((item) => [item.id, item]),
              ).values(),
            ]
          : data.items,
      );
      setMediaNextCursor(data.nextCursor);
      setMediaLoaded(true);
    } catch (cause) {
      failure(cause);
    } finally {
      setMediaLoading(false);
      if (!append) setLoading(false);
    }
  }
  useEffect(() => {
    let mounted = true;
    fetch("/api/admin/session", {
      credentials: "same-origin",
      signal: AbortSignal.timeout(15000),
    })
      .then(async (response) => {
        if (response.status === 401) return;
        if (!response.ok)
          throw new Error(
            "Overjanje trenutno ni dosegljivo. Poskusite osvežiti stran.",
          );
        const data = await response.json();
        if (mounted) setSession(data);
      })
      .catch((cause) => {
        if (mounted) failure(cause);
      })
      .finally(() => {
        if (mounted) setChecking(false);
      });
    return () => {
      mounted = false;
      currentSessionToken.current = undefined;
    };
  }, []);
  useEffect(() => {
    if (session) {
      const recover =
        interruptedDraft.current?.user === session.user.email
          ? interruptedDraft.current
          : undefined;
      const area =
        interruptedArea.current?.user === session.user.email
          ? interruptedArea.current.section
          : undefined;
      const mayRecoverArea =
        area &&
        (["users", "notifications", "privacy"].includes(area)
          ? session.user.role === "owner"
          : ["submissions", "campaigns"].includes(area)
            ? canOperations
            : canContent);
      if (!canOperations) interruptedWork.current = null;
      if (session.user.role !== "owner")
        interruptedNotifications.current = null;
      interruptedArea.current = null;
      setActive(
        recover
          ? recover.section
          : mayRecoverArea
            ? area
            : !canContent ||
                (canOperations &&
                  new URLSearchParams(location.search).has("case"))
              ? "submissions"
              : "dashboard",
      );
      void loadContent(recover);
    }
  }, [session?.csrfToken]);
  useEffect(() => {
    setStoredDraft(null);
    if (!session || !editing || !contentLoaded || !canContent) return;
    let current = true;
    setDraftLoading(true);
    void request<{ draft?: StoredDraft | null }>(`/api/admin/drafts/${active}`)
      .then((data) => {
        if (current) setStoredDraft(data.draft || null);
      })
      .catch((cause) => {
        if (current) failure(cause);
      })
      .finally(() => {
        if (current) setDraftLoading(false);
      });
    return () => {
      current = false;
    };
  }, [session?.user.email, active, contentLoaded]);
  useEffect(() => {
    if (!dirty || (draftSaved && !workDirty)) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, draftSaved, workDirty]);
  function mayLeave() {
    return (
      !dirty ||
      (draftSaved && !workDirty) ||
      window.confirm(
        "Imate neshranjene spremembe. Če nadaljujete, bodo zavržene. Želite nadaljevati?",
      )
    );
  }
  function navigate(next: string) {
    if (!contentLoaded) return;
    if (["copy", "images", "links", "layout"].includes(next)) next = "website";
    if (
      (!canContent &&
        (Object.hasOwn(sectionInfo, next) ||
          next === "media" ||
          next === "dashboard")) ||
      (!canOperations && next === "submissions")
    )
      return;
    if (next === active) {
      setMobileMenu(false);
      return;
    }
    if (busy || workBusy || (next !== active && !mayLeave())) return;
    if (next !== active) {
      setDraft(draftFor(next));
      setSelection(null);
    }
    setActive(next);
    if (next !== "submissions") interruptedWork.current = null;
    if (next !== "notifications") interruptedNotifications.current = null;
    setWorkDirty(false);
    setMobileMenu(false);
    setError("");
    setNotice("");
    if (next === "media" || next === "images" || next === "website")
      void loadMedia();
  }
  async function logout() {
    if (!mayLeave()) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      let alreadyEnded = false;
      try {
        await request("/api/admin/logout", { method: "POST" });
      } catch (cause) {
        // A rejected expired cookie already has no server-side authority.
        // Explicit logout must discard local recovery rather than preserve it.
        if (!(cause instanceof RequestError && cause.status === 401))
          throw cause;
        alreadyEnded = true;
      }
      setSession(null);
      interruptedDraft.current = null;
      interruptedWork.current = null;
      interruptedNotifications.current = null;
      interruptedArea.current = null;
      setSections({});
      setDraft(null);
      setMedia([]);
      setMediaLoaded(false);
      setMediaNextCursor(null);
      setHistory(null);
      setAdvanced(false);
      setSelection(null);
      setNotice(
        alreadyEnded
          ? "Seja je že potekla. Lokalno ste odjavljeni; neshranjeni osnutki so zavrženi."
          : "Varno ste se odjavili.",
      );
    } catch (cause) {
      failure(cause);
    } finally {
      setBusy(false);
    }
  }
  async function save() {
    if (!editing || !dirty || busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      if (active === "website" && isObject(draft)) {
        const changed = WEBSITE_SECTIONS.filter(
          (key) => JSON.stringify(draft[key]) !== JSON.stringify(sections[key]),
        );
        const result = await request<{
          sections: Sections;
          revisions: Record<string, number>;
        }>("/api/admin/publish", {
          method: "POST",
          body: JSON.stringify({
            sections: Object.fromEntries(
              changed.map((key) => [key, draft[key]]),
            ),
            revisions: Object.fromEntries(
              changed.map((key) => [key, revisions[key] ?? 0]),
            ),
          }),
        });
        setSections((old) => ({ ...old, ...result.sections }));
        setDraft((old) =>
          isObject(old) ? { ...old, ...clone(result.sections) } : old,
        );
        setRevisions((old) => ({ ...old, ...result.revisions }));
        setNotice("Vse spremembe spletne strani so objavljene skupaj.");
        return;
      }
      const result = await request<{ revision: number; value?: Json }>(
        `/api/admin/content/${active}`,
        {
          method: "PUT",
          body: JSON.stringify({
            value: draft,
            revision: revisions[active] ?? 0,
          }),
        },
      );
      const saved = result.value === undefined ? clone(draft) : result.value;
      setSections((old) => ({ ...old, [active]: saved }));
      setDraft(clone(saved));
      setRevisions((old) => ({ ...old, [active]: result.revision }));
      setNotice(
        active === "notices"
          ? "Obvestila so shranjena. Na spletni strani so vidni samo vnosi z vključenim prikazom."
          : "Spremembe so shranjene in objavljene na spletni strani.",
      );
    } catch (cause) {
      failure(cause);
    } finally {
      setBusy(false);
    }
  }
  async function saveDraft() {
    if (!editing || busy || draftLoading) return;
    const section = active;
    const sessionToken = currentSessionToken.current;
    const submittedDraft = draft;
    const stillCurrent = () =>
      currentArea.current === section && currentSessionToken.current === sessionToken;
    setBusy(true);
    setError("");
    try {
      const value = validateEditorDraft(active, draft) as Json;
      const keys = active === "website" ? [...WEBSITE_SECTIONS] : [active];
      const baseRevisions = Object.fromEntries(
        keys.map((key) => [key, revisions[key] ?? 0]),
      );
      const result = await request<{ revision: number; savedAt: number; value?: Json }>(
        `/api/admin/drafts/${active}`,
        {
          method: "PUT",
          body: JSON.stringify({
            value,
            baseRevisions,
            revision: storedDraft?.revision || 0,
          }),
        },
      );
      if (!stillCurrent()) return;
      const saved = result.value === undefined
        ? value
        : validateEditorDraft(section, result.value) as Json;
      setStoredDraft({ ...result, value: clone(saved), baseRevisions });
      setDraft(current => current === submittedDraft ? clone(saved) : current);
      setNotice(
        "Osnutek je zasebno shranjen za vaš račun. Javna stran ostaja nespremenjena.",
      );
    } catch (cause) {
      if (stillCurrent()) failure(cause);
    } finally {
      if (stillCurrent()) setBusy(false);
    }
  }
  async function showHistory() {
    const section = active === "website" ? websiteHistorySection : active;
    setBusy(true);
    setError("");
    try {
      const data = await request<{ items: Version[] }>(
        `/api/admin/history/${section}`,
      );
      setHistory({ section, items: data.items });
    } catch (cause) {
      failure(cause);
    } finally {
      setBusy(false);
    }
  }
  async function restore(section: string, revision: number) {
    if (
      !window.confirm(
        `Želite objaviti različico ${revision}? Trenutna vsebina ostane v zgodovini.${dirty ? " Neshranjene spremembe bodo zavržene." : ""}`,
      )
    )
      return;
    setBusy(true);
    setError("");
    try {
      const data = await request<{ revision: number; value?: Json }>(
        `/api/admin/restore/${section}`,
        {
          method: "POST",
          body: JSON.stringify({
            revision,
            currentRevision: revisions[section] ?? 0,
          }),
        },
      );
      setHistory(null);
      if (data.value !== undefined) {
        const key = section;
        setSections((old) => ({ ...old, [key]: data.value! }));
        setDraft((old) =>
          active === "website" && isObject(old)
            ? { ...old, [key]: clone(data.value!) }
            : clone(data.value!),
        );
        setRevisions((old) => ({ ...old, [key]: data.revision }));
      } else await loadContent();
      setNotice(
        `Različica ${revision} je obnovljena in objavljena kot nova različica.`,
      );
    } catch (cause) {
      failure(cause);
    } finally {
      setBusy(false);
    }
  }
  async function upload(file: File | undefined) {
    if (!file) return;
    if (
      !/image\/(jpeg|png|webp)/.test(file.type) ||
      file.size > 5 * 1024 * 1024
    ) {
      setError("Izberite sliko JPG, PNG ali WebP do velikosti 5 MB.");
      return;
    }
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const form = new FormData();
      form.set("photo", file);
      const item = await request<Media>("/api/admin/media", {
        method: "POST",
        body: form,
      });
      setMedia((old) => [
        { ...item, name: file.name, createdAt: new Date().toISOString() },
        ...old,
      ]);
      setMediaLoaded(true);
      setNotice(
        active === "media"
          ? "Slika je shranjena v knjižnici. Za prikaz na spletni strani jo izberite v urejevalniku spletne strani."
          : "Slika je naložena. Spremembe objavite z gumbom »Shrani in objavi«.",
      );
      return item;
    } catch (cause) {
      failure(cause);
    } finally {
      setBusy(false);
      if (uploadInput.current) uploadInput.current.value = "";
    }
  }
  async function copyUrl(url: string) {
    try {
      await navigator.clipboard.writeText(
        new URL(url, window.location.origin).href,
      );
      setCopiedUrl(url);
    } catch {
      setNotice(`Povezavo lahko kopirate iz polja pod sliko: ${url}`);
    }
  }
  function changeOverride(patch: Record<string, Json>) {
    if (!selection || !Array.isArray(draft)) return;
    const index = draft.findIndex(
      (item) =>
        isObject(item) &&
        item.key === selection.key &&
        item.page === selection.page,
    );
    const original =
      index >= 0 && isObject(draft[index])
        ? (draft[index] as Record<string, Json>)
        : {
            page: selection.page,
            key: selection.key,
            original: selection.original,
            ...(selection.kind === "link"
              ? {
                  url: selection.url || selection.original,
                  label: selection.label || "",
                }
              : selection.kind === "image"
                ? {
                    url: selection.src || selection.original,
                    alt: selection.alt || "",
                  }
                : { value: selection.original }),
          };
    const updated = { ...original, ...patch };
    setDraft(
      index < 0
        ? [...draft, updated]
        : draft.map((item, i) => (i === index ? updated : item)),
    );
  }
  useEffect(() => {
    if (!visual) return;
    const receive = (event: MessageEvent) => {
      if (
        event.origin === window.location.origin &&
        event.source === iframe.current?.contentWindow &&
        event.data?.type === "kpv-cms-ready"
      ) {
        setPreviewReady(true);
        if (
          typeof event.data.page === "string" &&
          (pages.some(([path]) => path === event.data.page) ||
            /^\/strani\/[a-z0-9]+(?:-[a-z0-9]+)*$/.test(event.data.page))
        )
          setPreviewPage(event.data.page);
        iframe.current?.contentWindow?.postMessage(
          {
            type: "kpv-cms-update",
            mode: previewMode,
            tool:
              active === "links"
                ? "link"
                : active === "images"
                  ? "image"
                  : "text",
            links: active === "links" ? draft : (sections.links ?? []),
            copy: active === "copy" ? draft : (sections.copy ?? []),
            images: active === "images" ? draft : (sections.images ?? []),
          },
          window.location.origin,
        );
        return;
      }
      if (
        event.origin !== window.location.origin ||
        event.source !== iframe.current?.contentWindow ||
        event.data?.type !== "kpv-cms-select"
      )
        return;
      const data = event.data as Record<string, unknown>;
      if (
        (data.kind !== "text" &&
          data.kind !== "image" &&
          data.kind !== "link") ||
        typeof data.key !== "string" ||
        typeof data.original !== "string" ||
        typeof data.page !== "string" ||
        (data.page !== "*" &&
          !pages.some(([path]) => path === data.page) &&
          !/^\/strani\/[a-z0-9]+(?:-[a-z0-9]+)*$/.test(data.page))
      )
        return;
      const destination =
        data.kind === "text"
          ? "copy"
          : data.kind === "link"
            ? "links"
            : "images";
      if (destination !== active) {
        if (busy || !mayLeave()) return;
        setActive(destination);
        setDraft(clone(sections[destination] ?? []));
        if (destination === "images" && !mediaLoaded) void loadMedia();
      }
      setSelection(data as unknown as Selection);
      setNotice("");
      setError("");
      if (window.innerWidth <= 1200)
        requestAnimationFrame(() =>
          inspector.current?.scrollIntoView({
            block: "nearest",
            behavior: window.matchMedia("(prefers-reduced-motion: reduce)")
              .matches
              ? "auto"
              : "smooth",
          }),
        );
    };
    window.addEventListener("message", receive);
    return () => window.removeEventListener("message", receive);
  }, [visual, active, dirty, draft, sections, busy, mediaLoaded, previewMode]);
  useEffect(() => {
    if (!visual || !previewReady) return;
    iframe.current?.contentWindow?.postMessage(
      {
        type: "kpv-cms-update",
        mode: previewMode,
        tool:
          active === "links" ? "link" : active === "images" ? "image" : "text",
        links: active === "links" ? draft : (sections.links ?? []),
        copy: active === "copy" ? draft : (sections.copy ?? []),
        images: active === "images" ? draft : (sections.images ?? []),
      },
      window.location.origin,
    );
  }, [
    visual,
    active,
    draft,
    previewReady,
    sections.copy,
    sections.images,
    sections.links,
    previewMode,
  ]);
  const currentOverride =
    selection && Array.isArray(draft)
      ? draft.find(
          (item) =>
            isObject(item) &&
            item.key === selection.key &&
            item.page === selection.page,
        )
      : undefined;
  const selectedOverride =
    currentOverride && isObject(currentOverride) ? currentOverride : null;
  const title =
    sectionInfo[active]?.name ||
    ({
      dashboard: "Pregled portala",
      media: "Knjižnica datotek",
      submissions: "Delovni nalogi",
      users: "Dostop in skrbniki",
      notifications: "E-poštna obvestila",
      privacy: "Osebni podatki",
      campaigns: "Pošiljanje obvestil",
    }[active] ??
      "Upravljanje");

  if (checking || (session && !contentLoaded && !error))
    return (
      <div className="admin-root admin-auth">
        <div className="admin-auth-card">
          <LoaderCircle className="admin-spin" size={27} />
          <h1>Preverjamo varno sejo …</h1>
        </div>
      </div>
    );
  if (!session)
    return (
      <>
        {notice && (
          <p
            role="status"
            style={{ margin: 0, padding: "12px 24px", textAlign: "center" }}
          >
            {notice}
          </p>
        )}
        <AdminSignIn
          onAuthenticated={(next) => {
            if (interruptedWork.current?.user !== next.user.email)
              interruptedWork.current = null;
            if (interruptedNotifications.current?.user !== next.user.email)
              interruptedNotifications.current = null;
            if (interruptedDraft.current?.user !== next.user.email)
              interruptedDraft.current = null;
            if (interruptedArea.current?.user !== next.user.email)
              interruptedArea.current = null;
            setSession(next);
            setNotice("");
            setError("");
          }}
        />
      </>
    );

  return (
    <div className="admin-root admin-console">
      <aside
        ref={sidebar}
        className={`admin-sidebar${mobileMenu ? " is-open" : ""}`}
        aria-label="Uredniška navigacija"
        inert={compactMenu && !mobileMenu}
        aria-hidden={compactMenu && !mobileMenu}
        role={compactMenu && mobileMenu ? "dialog" : undefined}
        aria-modal={compactMenu && mobileMenu ? true : undefined}
      >
        <a
          href="/"
          className="admin-brand"
          onClick={(event) => {
            if (!mayLeave()) event.preventDefault();
          }}
        >
          <span>K</span>
          <div>
            KPV uredništvo<small>Vsebine in storitve</small>
          </div>
        </a>
        <button
          className="admin-sidebar-close admin-icon-button"
          type="button"
          onClick={() => setMobileMenu(false)}
          aria-label="Zapri navigacijo"
        >
          <X size={21} />
        </button>
        <nav>
          {canContent && (
            <button
              className={active === "dashboard" ? "is-current" : ""}
              onClick={() => navigate("dashboard")}
            >
              <LayoutDashboard size={18} />
              Pregled
            </button>
          )}
          {canOperations && (
            <button
              className={active === "submissions" ? "is-current" : ""}
              onClick={() => navigate("submissions")}
            >
              <Inbox size={18} />
              Delovni nalogi
            </button>
          )}
          {canOperations && (
            <button
              type="button"
              className={active === "campaigns" ? "is-current" : ""}
              onClick={() => navigate("campaigns")}
            >
              <Inbox size={18} />
              Pošiljanje obvestil
            </button>
          )}
          {session.user.role === "owner" && (
            <button
              type="button"
              className={active === "users" ? "is-current" : ""}
              onClick={() => navigate("users")}
            >
              <ShieldCheck size={18} />
              Dostop in skrbniki
            </button>
          )}
          {session.user.role === "owner" && (
            <button
              type="button"
              className={active === "notifications" ? "is-current" : ""}
              onClick={() => navigate("notifications")}
            >
              <Inbox size={18} /> E-poštna obvestila
            </button>
          )}
          {session.user.role === "owner" && (
            <button
              type="button"
              className={active === "privacy" ? "is-current" : ""}
              onClick={() => navigate("privacy")}
            >
              <ShieldCheck size={18} />
              Osebni podatki
            </button>
          )}
          {canContent &&
            ["Portal", "Vsebine"].map((group) => (
              <div key={group} className="admin-nav-group">
                <span>{group}</span>
                {Object.entries(sectionInfo)
                  .filter(([, item]) => item.group === group)
                  .map(([key, item]) => (
                    <button
                      key={key}
                      className={active === key ? "is-current" : ""}
                      onClick={() => navigate(key)}
                      aria-current={active === key ? "page" : undefined}
                    >
                      {key === "copy" ? (
                        <Copy size={17} />
                      ) : key === "images" ? (
                        <ImagePlus size={17} />
                      ) : (
                        <span className="admin-nav-dot" />
                      )}
                      {item.name}
                    </button>
                  ))}
              </div>
            ))}
          {canContent && (
            <div className="admin-nav-group">
              <span>Knjižnica</span>
              <button
                className={active === "media" ? "is-current" : ""}
                onClick={() => navigate("media")}
              >
                <Files size={18} />
                Datoteke
              </button>
            </div>
          )}
        </nav>
        <div className="admin-sidebar-bottom">
          <a href="/" target="_blank" rel="noreferrer">
            Odpri spletno stran
            <ExternalLink size={15} />
          </a>
          <button type="button" onClick={logout} disabled={busy || workBusy}>
            <LogOut size={17} />
            Odjava
          </button>
        </div>
      </aside>
      {mobileMenu && (
        <button
          className="admin-sidebar-backdrop"
          onClick={() => setMobileMenu(false)}
          aria-label="Zapri navigacijo"
        />
      )}
      <section className="admin-main" aria-label="Urejanje portala">
        <header className="admin-topbar">
          <button
            className="admin-menu-button admin-icon-button"
            type="button"
            onClick={() => setMobileMenu(true)}
            aria-label="Odpri navigacijo"
          >
            <Menu size={23} />
          </button>
          <div>
            <span className="admin-kicker">NADZORNA PLOŠČA</span>
            <h1>{title}</h1>
          </div>
          <span className="admin-secure">
            <ShieldCheck size={16} />
            Varna seja
          </span>
        </header>
        <div className="admin-content">
          {error && (
            <div className="admin-error admin-message" role="alert">
              <span>{error}</span>
              <button
                type="button"
                className="admin-icon-button"
                onClick={() => setError("")}
                aria-label="Skrij opozorilo"
              >
                <X size={17} />
              </button>
            </div>
          )}
          {notice && (
            <div className="admin-notice admin-message" role="status">
              <span>
                <Check size={17} />
                {notice}
              </span>
              <button
                type="button"
                className="admin-icon-button"
                onClick={() => setNotice("")}
                aria-label="Skrij obvestilo"
              >
                <X size={17} />
              </button>
            </div>
          )}
          {!contentLoaded ? (
            <div className="admin-panel admin-empty">
              <LoaderCircle size={27} className={loading ? "admin-spin" : ""} />
              <h2>
                {loading
                  ? "Nalagamo vsebine …"
                  : "Vsebin ni bilo mogoče naložiti."}
              </h2>
              {!loading && (
                <button
                  className="admin-button"
                  onClick={() => void loadContent()}
                >
                  <RefreshCw size={16} />
                  Poskusi znova
                </button>
              )}
            </div>
          ) : (
            <>
              {active === "dashboard" && (
                <>
                  <section className="admin-welcome">
                    <span className="admin-kicker">ZAČETNA STRAN</span>
                    <h2>Urejanje portala</h2>
                    <p>
                      Posodobite podatke, zamenjajte fotografije ali preglejte
                      nova sporočila. Pred objavo preverite podatke in
                      predogled strani.
                    </p>
                  </section>
                  <div className="admin-dashboard-grid">
                    <button
                      onClick={() => navigate("copy")}
                      className="admin-dashboard-card"
                    >
                      <Copy size={25} />
                      <h3>Besedila, slike in povezave</h3>
                      <p>
                        V predogledu kliknite naslov ali odstavek in spremenite
                        besedilo.
                      </p>
                      <span>
                        Odpri urejevalnik
                        <ArrowUp size={17} />
                      </span>
                    </button>
                    {canOperations && (
                      <button
                        onClick={() => navigate("submissions")}
                        className="admin-dashboard-card"
                      >
                        <Inbox size={25} />
                        <h3>Delovni nalogi</h3>
                        <p>
                          Kontaktna sporočila, prijave napak, povpraševanja in
                          prijave na tržnico.
                        </p>
                        <span>
                          Odpri naloge
                          <ArrowUp size={17} />
                        </span>
                      </button>
                    )}
                    <button
                      onClick={() => navigate("collection")}
                      className="admin-dashboard-card"
                    >
                      <ImagePlus size={25} />
                      <h3>Urniki odvoza</h3>
                      <p>
                        Uredite območja in termine ter preverite urnik po
                        naslovu.
                      </p>
                      <span>
                        Odpri urnike
                        <ArrowUp size={17} />
                      </span>
                    </button>
                  </div>
                  <section className="admin-panel">
                    <div className="admin-panel-heading">
                      <h2>Hiter dostop do vsebin</h2>
                      <span>
                        {
                          Object.values(sectionInfo).filter(
                            (item) => item.group !== "Prejšnji urejevalniki",
                          ).length
                        }{" "}
                        področij
                      </span>
                    </div>
                    <div className="admin-quick-grid">
                      {Object.entries(sectionInfo)
                        .filter(
                          ([, item]) => item.group !== "Prejšnji urejevalniki",
                        )
                        .map(([key, item]) => (
                          <button key={key} onClick={() => navigate(key)}>
                            <span>
                              {item.name}
                              <small>
                                {key === "website"
                                  ? "Besedila, slike, razporeditev in logotip"
                                  : `Različica ${revisions[key] ?? 0}`}
                              </small>
                            </span>
                            <ChevronRight size={17} />
                          </button>
                        ))}
                    </div>
                  </section>
                  <p className="admin-footnote">
                    <ShieldCheck size={16} />
                    Spremembe se shranjujejo z zgodovino različic. Seja poteče:{" "}
                    {prettyDate(session.expiresAt)}.
                  </p>
                </>
              )}
              {editing && (
                <>
                  <div className="admin-editor-intro">
                    <p>{sectionInfo[active].description}</p>
                    <div>
                      {active === "website" && (
                        <label className="admin-field">
                          <span>Zgodovina področja</span>
                          <select
                            value={websiteHistorySection}
                            disabled={busy}
                            onChange={(e) =>
                              setWebsiteHistorySection(e.target.value)
                            }
                          >
                            {WEBSITE_SECTIONS.map((key) => (
                              <option value={key} key={key}>
                                {sectionInfo[key]?.name || key}
                              </option>
                            ))}
                          </select>
                        </label>
                      )}
                      <button
                        className="admin-button admin-small"
                        type="button"
                        onClick={showHistory}
                        disabled={busy}
                      >
                        <FileClock size={16} />
                        Zgodovina
                      </button>
                      <button
                        className="admin-button admin-small"
                        type="button"
                        onClick={() => {
                          setJsonText(JSON.stringify(draft, null, 2));
                          setAdvanced(true);
                        }}
                        disabled={busy}
                      >
                        <Code2 size={16} />
                        Napredno
                      </button>
                    </div>
                  </div>
                  <div className="admin-savebar">
                    <span className={dirty ? "admin-dirty" : ""}>
                      {dirty ? (
                        <>
                          <span />
                          {draftSaved
                            ? "Osnutek je shranjen; še ni objavljen"
                            : "Neshranjene spremembe"}
                        </>
                      ) : (
                        <>
                          <Check size={16} />
                          Prikazana je objavljena vsebina
                        </>
                      )}
                      <small>
                        {active === "website"
                          ? "Skupni osnutek spletne strani"
                          : `Različica ${revisions[active] ?? 0}`}
                      </small>
                    </span>
                    <div>
                      <button
                        type="button"
                        className="admin-button"
                        disabled={!dirty || busy || draftLoading}
                        onClick={() => void saveDraft()}
                      >
                        Shrani osnutek
                      </button>
                      <button
                        type="button"
                        className="admin-button"
                        disabled={!dirty || busy}
                        onClick={() => {
                          if (
                            window.confirm(
                              "Zavržete vse neshranjene spremembe tega področja?",
                            )
                          ) {
                            setDraft(draftFor(active));
                            setError("");
                          }
                        }}
                      >
                        <RotateIcon />
                        Zavrzi
                      </button>
                      <button
                        type="button"
                        className="admin-button admin-primary"
                        onClick={save}
                        disabled={!dirty || busy}
                      >
                        {busy ? (
                          <LoaderCircle size={17} className="admin-spin" />
                        ) : (
                          <Save size={17} />
                        )}
                        Shrani in objavi
                      </button>
                    </div>
                  </div>
                  {storedDraft && (
                    <section
                      className="admin-panel"
                      aria-label="Shranjeni osnutek"
                    >
                      <p>
                        Vaš zasebni osnutek: {prettyDate(storedDraft.savedAt)}.
                        Shranjeni osnutek se samodejno ne objavi.
                      </p>
                      <button
                        type="button"
                        className="admin-button"
                        disabled={busy}
                        onClick={() => {
                          if (
                            dirty &&
                            !window.confirm(
                              "Zamenjate trenutne spremembe s shranjenim osnutkom?",
                            )
                          )
                            return;
                          try {
                            setDraft(
                              validateEditorDraft(
                                active,
                                storedDraft.value,
                              ) as Json,
                            );
                            setRevisions((old) => ({
                              ...old,
                              ...storedDraft.baseRevisions,
                            }));
                            setNotice(
                              "Osnutek je odprt. Objava bo preverila, ali so se javne vsebine medtem spremenile.",
                            );
                          } catch (cause) {
                            failure(cause);
                          }
                        }}
                      >
                        Odpri shranjeni osnutek
                      </button>
                      <button
                        type="button"
                        className="admin-button"
                        disabled={busy}
                        onClick={() => void loadContent(undefined, true)}
                      >
                        Osveži objavljene različice in ohrani osnutek
                      </button>
                    </section>
                  )}
                  <EditorRecoveryBoundary
                    key={active}
                    draft={draft}
                    onReset={() => setDraft(draftFor(active))}
                  >
                    <ScheduledPublications
                      section={active}
                      value={draft}
                      revisions={revisions}
                      call={request}
                      disabled={busy}
                      dirty={contentDirty}
                      user={session.user.email}
                      owner={session.user.role === "owner"}
                    />
                    {active === "website" ? (
                      <fieldset
                        className="admin-complex-editor"
                        disabled={busy}
                      >
                        <WebsiteEditor
                          value={draft as unknown as WebsiteDraft}
                          onChange={(next) => setDraft(next as unknown as Json)}
                          pages={pages}
                          media={media}
                          onUpload={upload}
                          disabled={busy}
                          hasMoreMedia={!!mediaNextCursor}
                          mediaLoading={mediaLoading}
                          onMoreMedia={() => void loadMedia(true)}
                        />
                      </fieldset>
                    ) : active === "layout" ? (
                      <fieldset
                        className="admin-complex-editor"
                        disabled={busy}
                      >
                        <LayoutEditor
                          value={draft as unknown as CmsLayoutData}
                          onChange={(next) => setDraft(next as unknown as Json)}
                          pages={pages}
                          disabled={busy}
                        />
                      </fieldset>
                    ) : active === "notices" ? (
                      <NoticesEditor
                        value={draft as unknown as EditableNotice[]}
                        onChange={(next) => setDraft(next as unknown as Json)}
                        disabled={busy}
                        districts={sections.districts as unknown as District[]}
                        revision={revisions.notices ?? 0}
                        csrfToken={session.csrfToken}
                        dirty={dirty}
                        canDeliver={canOperations}
                        onSessionExpired={expireSession}
                      />
                    ) : active === "districts" ? (
                      <DistrictsEditor
                        value={draft as unknown as District[]}
                        onChange={(next) => setDraft(next as unknown as Json)}
                        disabled={busy}
                        canViewSubscribers={canOperations}
                        onSessionExpired={expireSession}
                      />
                    ) : active === "tariffs" ? (
                      <TariffsEditor
                        value={draft as unknown as TariffData}
                        onChange={(next) => setDraft(next as unknown as Json)}
                        disabled={busy}
                      />
                    ) : active === "cemetery" ? (
                      <CemeteryEditor
                        value={draft as unknown as CemeteryData}
                        onChange={(next) => setDraft(next as unknown as Json)}
                        disabled={busy}
                        onUpload={upload}
                      />
                    ) : active === "collection" ? (
                      <fieldset
                        className="admin-complex-editor"
                        disabled={busy}
                      >
                        <CollectionEditor
                          value={draft as unknown as CollectionData}
                          onChange={(next) => setDraft(next as unknown as Json)}
                          disabled={busy}
                        />
                      </fieldset>
                    ) : visual ? (
                      <>
                        <div className="admin-preview-toolbar">
                          <label>
                            Način predogleda
                            <select
                              value={previewMode}
                              onChange={(e) =>
                                setPreviewMode(
                                  e.target.value as "edit" | "interact",
                                )
                              }
                            >
                              <option value="edit">
                                Urejanje · klik izbere element
                              </option>
                              <option value="interact">
                                Preizkus · gumbi delujejo
                              </option>
                            </select>
                          </label>
                          <label>
                            Stran za urejanje
                            <select
                              value={previewPage}
                              disabled={busy}
                              onChange={(event) => {
                                setPreviewReady(false);
                                setPreviewPage(event.target.value);
                                setSelection(null);
                              }}
                            >
                              {previewPages.map(([path, label]) => (
                                <option key={path} value={path}>
                                  {label}
                                </option>
                              ))}
                            </select>
                          </label>
                          <button
                            className="admin-button admin-small"
                            type="button"
                            onClick={() => {
                              setPreviewReady(false);
                              if (iframe.current)
                                iframe.current.src = `${previewPage}?cms-preview=1`;
                            }}
                          >
                            <RefreshCw size={15} />
                            Osveži predogled
                          </button>
                        </div>
                        <div className="admin-visual-workspace">
                          <div className="admin-preview-wrap">
                            <div className="admin-preview-caption">
                              <span />
                              <span />
                              <span />
                              <small>
                                {previewPage} ·{" "}
                                {previewMode === "edit"
                                  ? "Klik izbere element"
                                  : "Preizkus brez oddaje obrazcev"}
                              </small>
                            </div>
                            <iframe
                              name="kpv-cms-preview"
                              sandbox="allow-scripts allow-same-origin"
                              ref={iframe}
                              title="Predogled spletne strani za urejanje"
                              src={`${previewPage}?cms-preview=1`}
                              onLoad={() => {
                                iframe.current?.contentWindow?.postMessage(
                                  { type: "kpv-cms-request-structure" },
                                  location.origin,
                                );
                              }}
                            />
                          </div>
                          <aside
                            className="admin-visual-inspector"
                            ref={inspector}
                          >
                            <div className="admin-inspector-heading">
                              {active === "images" ? (
                                <ImagePlus size={20} />
                              ) : (
                                <Copy size={20} />
                              )}
                              <h2>
                                {selection
                                  ? "Urejanje izbire"
                                  : "Izberite element"}
                              </h2>
                            </div>
                            {selection ? (
                              <fieldset disabled={busy}>
                                <span className="admin-selection-tag">
                                  {selection.kind === "image"
                                    ? "Slika"
                                    : "Besedilo"}{" "}
                                  · {selection.tag || "element"}
                                </span>
                                <p className="admin-original">
                                  {selection.kind === "image"
                                    ? selection.alt || "Izbrana slika"
                                    : selection.original}
                                </p>
                                {selection.kind === "link" ? (
                                  <>
                                    <label className="admin-field">
                                      <span>Besedilo povezave</span>
                                      <input
                                        value={String(
                                          selectedOverride?.label ??
                                            selection.label ??
                                            "",
                                        )}
                                        onChange={(e) =>
                                          changeOverride({
                                            label: e.target.value,
                                          })
                                        }
                                      />
                                    </label>
                                    <label className="admin-field">
                                      <span>Cilj povezave</span>
                                      <input
                                        value={String(
                                          selectedOverride?.url ??
                                            selection.url ??
                                            selection.original,
                                        )}
                                        onChange={(e) =>
                                          changeOverride({
                                            url: e.target.value,
                                          })
                                        }
                                      />
                                      <small>
                                        Uporabite /pot, https://…, mailto: ali
                                        tel:. V načinu Preizkus lahko preverite
                                        delovanje notranje povezave.
                                      </small>
                                    </label>
                                  </>
                                ) : selection.kind === "text" ? (
                                  <label className="admin-field">
                                    <span>Novo besedilo</span>
                                    <textarea
                                      rows={7}
                                      value={String(
                                        selectedOverride?.value ??
                                          selection.original,
                                      )}
                                      onChange={(event) =>
                                        changeOverride({
                                          value: event.target.value,
                                        })
                                      }
                                    />
                                    <small>
                                      Spremembo vidite v predogledu. Za javno
                                      objavo jo shranite.
                                    </small>
                                  </label>
                                ) : (
                                  <>
                                    {(selectedOverride?.url ||
                                      selection.src ||
                                      selection.original !==
                                        "cms:featured") && (
                                      <img
                                        className="admin-selected-image"
                                        src={String(
                                          selectedOverride?.url ??
                                            selection.src ??
                                            selection.original,
                                        )}
                                        alt="Predogled izbrane slike"
                                      />
                                    )}
                                    <label className="admin-field">
                                      <span>Povezava do nove slike</span>
                                      <input
                                        value={String(
                                          selectedOverride?.url ??
                                            selection.src ??
                                            selection.original,
                                        )}
                                        onChange={(event) =>
                                          changeOverride({
                                            url: event.target.value,
                                          })
                                        }
                                      />
                                    </label>
                                    <label className="admin-field">
                                      <span>Opis slike za dostopnost</span>
                                      <input
                                        value={String(
                                          selectedOverride?.alt ??
                                            selection.alt ??
                                            "",
                                        )}
                                        onChange={(event) =>
                                          changeOverride({
                                            alt: event.target.value,
                                          })
                                        }
                                      />
                                      <small>
                                        Kratek opis vsebine; za okrasno sliko
                                        pustite prazno.
                                      </small>
                                    </label>
                                    <h3 className="admin-field-title">
                                      Izberite iz knjižnice
                                    </h3>
                                    <div className="admin-image-picker">
                                      {media.map((item) => (
                                        <button
                                          key={item.id}
                                          type="button"
                                          onClick={() =>
                                            changeOverride({ url: item.url })
                                          }
                                          aria-label={`Uporabi sliko ${item.name || item.id}`}
                                        >
                                          <img
                                            src={item.url}
                                            alt={
                                              item.name || "Slika iz knjižnice"
                                            }
                                            loading="lazy"
                                          />
                                        </button>
                                      ))}
                                    </div>
                                    <button
                                      className="admin-button admin-small"
                                      type="button"
                                      onClick={() =>
                                        uploadInput.current?.click()
                                      }
                                    >
                                      <Upload size={15} />
                                      Naloži drugo sliko
                                    </button>
                                  </>
                                )}
                                {selectedOverride && (
                                  <button
                                    className="admin-danger-link"
                                    type="button"
                                    onClick={() => {
                                      if (Array.isArray(draft))
                                        setDraft(
                                          draft.filter(
                                            (item) =>
                                              !(
                                                isObject(item) &&
                                                item.key === selection.key &&
                                                item.page === selection.page
                                              ),
                                          ),
                                        );
                                    }}
                                  >
                                    <Trash2 size={15} />
                                    Povrni izvirnik
                                  </button>
                                )}
                              </fieldset>
                            ) : (
                              <p>
                                V predogledu kliknite{" "}
                                {active === "images"
                                  ? "sliko"
                                  : "naslov, odstavek ali gumb"}
                                . Tu boste uredili izbrano vsebino. Za premik po
                                spletni strani uporabite izbiro strani zgoraj.
                              </p>
                            )}
                          </aside>
                        </div>
                        <details className="admin-panel admin-overrides">
                          <summary>
                            Shranjene zamenjave (
                            {Array.isArray(draft) ? draft.length : 0})
                          </summary>
                          <fieldset disabled={busy}>
                            <Editor
                              value={draft}
                              example={sections[active]}
                              section={active}
                              onChange={setDraft}
                            />
                          </fieldset>
                        </details>
                      </>
                    ) : (
                      <section className="admin-panel admin-editor-panel">
                        <fieldset disabled={busy}>
                          <Editor
                            value={draft}
                            example={sections[active]}
                            section={active}
                            onChange={setDraft}
                          />
                        </fieldset>
                      </section>
                    )}
                  </EditorRecoveryBoundary>
                </>
              )}
              {active === "media" && (
                <>
                  <div className="admin-editor-intro">
                    <p>
                      Slike za javne strani. JPG, PNG ali WebP, največ 5 MB na
                      datoteko.
                    </p>
                    <button
                      className="admin-button admin-primary"
                      onClick={() => uploadInput.current?.click()}
                      disabled={busy}
                    >
                      <Upload size={17} />
                      Naloži sliko
                    </button>
                  </div>
                  {loading && (
                    <p className="admin-loading">
                      <LoaderCircle size={17} className="admin-spin" />
                      Nalagamo knjižnico …
                    </p>
                  )}
                  {!media.length && !loading && (
                    <div className="admin-panel admin-empty">
                      <ImagePlus size={34} />
                      <h2>V knjižnici še ni slik</h2>
                      <p>
                        Z gumbom »Naloži sliko« dodajte sliko za uporabo na spletni strani. Samo nalaganje slike še ne objavi.
                      </p>
                    </div>
                  )}
                  <div className="admin-media-grid">
                    {media.map((item) => (
                      <article key={item.id} className="admin-media-card">
                        <img
                          src={item.url}
                          alt={item.name || "Naložena slika"}
                          loading="lazy"
                        />
                        <div>
                          <strong>{item.name || item.id}</strong>
                          <small>{prettyDate(item.createdAt)}</small>
                          <input
                            aria-label={`Povezava do slike ${item.name || item.id}`}
                            readOnly
                            value={item.url}
                            onFocus={(event) => event.currentTarget.select()}
                          />
                          <button
                            className="admin-button admin-small"
                            type="button"
                            onClick={() => copyUrl(item.url)}
                          >
                            {copiedUrl === item.url ? (
                              <Check size={15} />
                            ) : (
                              <Copy size={15} />
                            )}
                            {copiedUrl === item.url
                              ? "Kopirano"
                              : "Kopiraj povezavo"}
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                  {mediaNextCursor && (
                    <button
                      type="button"
                      className="admin-button"
                      disabled={mediaLoading}
                      onClick={() => void loadMedia(true)}
                    >
                      {mediaLoading
                        ? "Nalagamo starejše slike …"
                        : "Naloži starejše slike"}
                    </button>
                  )}
                </>
              )}
              {active === "notifications" && session.user.role === "owner" && (
                <NotificationSettings
                  csrfToken={session.csrfToken}
                  onSessionExpired={expireSession}
                  onDirtyChange={setWorkDirty}
                  onBusyChange={setWorkBusy}
                  recovery={
                    interruptedNotifications.current?.user ===
                    session.user.email
                      ? interruptedNotifications.current.value
                      : undefined
                  }
                  onRecoveryChange={(value) => {
                    interruptedNotifications.current = value
                      ? { user: session.user.email, value }
                      : null;
                  }}
                />
              )}
              {active === "privacy" && session.user.role === "owner" && (
                <PrivacyTools
                  csrfToken={session.csrfToken}
                  onSessionExpired={expireSession}
                />
              )}
              {active === "campaigns" && canOperations && (
                <NoticeCampaigns
                  districts={sections.districts as unknown as District[]}
                  notices={
                    (sections.notices || []) as unknown as EditableNotice[]
                  }
                  revision={revisions.notices ?? 0}
                  csrfToken={session.csrfToken}
                  onRefresh={() => void loadContent()}
                  onSessionExpired={expireSession}
                />
              )}
              {active === "users" && session.user.role === "owner" && (
                <AdminUsers
                  csrfToken={session.csrfToken}
                  onSessionExpired={expireSession}
                />
              )}
              {active === "submissions" && session && (
                <WorkQueue
                  csrfToken={session.csrfToken}
                  onDirtyChange={setWorkDirty}
                  onBusyChange={setWorkBusy}
                  onSessionExpired={expireSession}
                  recovery={
                    interruptedWork.current?.user === session.user.email
                      ? interruptedWork.current.value
                      : undefined
                  }
                  onRecoveryChange={(value) => {
                    interruptedWork.current = value
                      ? { user: session.user.email, value }
                      : null;
                  }}
                />
              )}
            </>
          )}
        </div>
      </section>
      <input
        ref={uploadInput}
        className="sr-only"
        tabIndex={-1}
        aria-label="Naloži sliko v knjižnico"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={(event) => void upload(event.target.files?.[0])}
      />
      {history && (
        <Dialog
          error={error}
          title={`Zgodovina · ${sectionInfo[history.section]?.name || history.section}`}
          onClose={() => {
            if (!busy) setHistory(null);
          }}
        >
          <p className="admin-dialog-description">
            Obnova objavi izbrano vsebino kot novo različico. Prejšnje različice
            ostanejo ohranjene.
          </p>
          {history.items.length ? (
            <div className="admin-history-list">
              {history.items.map((item) => (
                <article key={item.revision}>
                  <div>
                    <strong>Različica {item.revision}</strong>
                    <small>
                      <Clock3 size={14} />
                      {prettyDate(item.createdAt)}
                    </small>
                  </div>
                  <button
                    type="button"
                    className="admin-button admin-small"
                    disabled={
                      busy ||
                      item.revision ===
                        revisions[history.section]
                    }
                    onClick={() => restore(history.section, item.revision)}
                  >
                    {item.revision ===
                    revisions[history.section]
                      ? "Trenutna"
                      : "Obnovi"}
                  </button>
                  {item.value !== undefined && (
                    <details>
                      <summary>Predogled podatkov</summary>
                      <pre>{JSON.stringify(item.value, null, 2)}</pre>
                    </details>
                  )}
                </article>
              ))}
            </div>
          ) : (
            <div className="admin-empty-small">
              Za to področje še ni zgodovine sprememb.
            </div>
          )}
        </Dialog>
      )}
      {advanced && (
        <Dialog
          title="Napredno urejanje podatkov"
          error={error}
          onClose={() => setAdvanced(false)}
        >
          <p className="admin-dialog-description">
            Za več popravkov hkrati lahko uvozite ali uredite zapis JSON. Spremembe se
            najprej prenesejo v obrazec. Na spletni strani se prikažejo šele, ko izberete »Shrani in objavi«.
          </p>
          <textarea
            className="admin-json"
            aria-label="Vsebina JSON"
            value={jsonText}
            onChange={(event) => setJsonText(event.target.value)}
            spellCheck={false}
          />
          <div className="admin-dialog-actions">
            <button
              type="button"
              className="admin-button"
              onClick={() => {
                const link = document.createElement("a");
                const url = URL.createObjectURL(
                  new Blob([jsonText], { type: "application/json" }),
                );
                link.href = url;
                link.download = `kpv-${active}.json`;
                link.click();
                setTimeout(() => URL.revokeObjectURL(url), 1000);
              }}
            >
              <Download size={16} />
              Izvozi JSON
            </button>
            <label className="admin-button">
              <Upload size={16} />
              Uvozi JSON
              <input
                className="sr-only"
                type="file"
                accept="application/json,.json"
                onChange={async (event) => {
                  const input = event.currentTarget;
                  const file = input.files?.[0];
                  if (!file) return;
                  const section = active;
                  const limitMb = section === "website" ? 6 : 2;
                  if (file.size > limitMb * 1024 * 1024) {
                    setError(
                      `Datoteka JSON je prevelika (največ ${limitMb} MB).`,
                    );
                    input.value = "";
                    return;
                  }
                  try {
                    const parsed: unknown = JSON.parse(await file.text());
                    const valid = validateEditorDraft(section, parsed);
                    if (currentArea.current === section) {
                      setJsonText(JSON.stringify(valid, null, 2));
                      setError("");
                    }
                  } catch (cause) {
                    if (currentArea.current === section)
                      failure(
                        cause instanceof SyntaxError
                          ? new Error(
                              "Datoteka JSON ni veljavna. Trenutni osnutek je ohranjen.",
                            )
                          : cause,
                      );
                  } finally {
                    input.value = "";
                  }
                }}
              />
            </label>
            <button
              type="button"
              className="admin-button admin-primary"
              onClick={() => {
                try {
                  const parsed: unknown = JSON.parse(jsonText);
                  if (parsed === null || typeof parsed !== "object")
                    throw new Error();
                  setDraft(validateEditorDraft(active, parsed) as Json);
                  setAdvanced(false);
                  setNotice(
                    "Podatki so preneseni v obrazec. Pred objavo jih preglejte in shranite.",
                  );
                  setError("");
                } catch (cause) {
                  failure(
                    cause instanceof SyntaxError
                      ? new Error(
                          "Zapis JSON ni veljaven. Trenutni osnutek je ohranjen.",
                        )
                      : cause,
                  );
                }
              }}
            >
              Uporabi v obrazcu
            </button>
          </div>
        </Dialog>
      )}
    </div>
  );
}

function RotateIcon() {
  return <RefreshCw size={15} />;
}
