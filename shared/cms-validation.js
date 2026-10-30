// CMS content is plain data. Shared helpers have no runtime dependencies.
import { normalizedAddress } from "./collection-utils.js";
import { validateLayout, validateLinks, CUSTOM_PAGE } from "./page-layout.js";
import { validateDistricts, validateDeliveryFields } from "./notification-rules.js";
export const CMS_SECTIONS = Object.freeze([
  "settings",
  "hours",
  "notices",
  "collection",
  "wastePoints",
  "wasteItems",
  "wasteCategories",
  "services",
  "rates",
  "market",
  "cemetery",
  "copy",
  "images",
  "layout",
  "links",
  "districts",
]);
export const PUBLIC_PAGES = Object.freeze([
  "/",
  "/odpadki",
  "/voda",
  "/javni-prostor",
  "/odpadki/urnik",
  "/odpadki/kam-z-odpadki",
  "/odpadki/lokacije",
  "/obvestila",
  "/ceste",
  "/prijavi",
  "/storitve",
  "/trznica",
  "/kalkulator",
  "/depo",
  "/pokopalisce",
  "/kontakt",
  "/o-podjetju",
  "/moj-dom",
  "/zasebnost",
]);
const categories = [
  "embalaza",
  "papir",
  "steklo",
  "bio",
  "mesani",
  "nevarni",
  "elektronika",
  "center",
  "tekstil",
];
const pointTypes = [
  "center",
  "public",
  "papir",
  "steklo",
  "embalaza",
  "baterije",
  "elektronika",
  "tekstil",
];
const services = ["bulky", "septic", "water", "other"];
const rateKeys = [
  "wasteBase",
  "wastePerson",
  "bio",
  "waterBase",
  "waterPerM3",
  "drainagePerM3",
  "marketStandard",
  "marketFood",
  "marketCraft",
];
const forbiddenKeys = new Set(["__proto__", "prototype", "constructor"]);
const maxBytes = 1024 * 1024;

function invalid(label, reason = "neveljavna vrednost") {
  const error = new Error(`Preverite vsebino »${label}«: ${reason}.`);
  error.status = 400;
  throw error;
}
function object(value, label, allowed, required = allowed) {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    ![Object.prototype, null].includes(Object.getPrototypeOf(value))
  )
    invalid(label, "pričakovan je objekt");
  for (const key of Object.keys(value)) {
    if (forbiddenKeys.has(key) || !allowed.includes(key))
      invalid(label, `polje ${key} ni dovoljeno`);
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !("value" in descriptor))
      invalid(label, "dinamična polja niso dovoljena");
  }
  for (const key of required)
    if (!Object.hasOwn(value, key)) invalid(label, `manjka polje ${key}`);
  return value;
}
function array(value, label, max = 1000, min = 0) {
  if (!Array.isArray(value) || value.length < min || value.length > max)
    invalid(label, `dovoljeno število zapisov je ${min}–${max}`);
  return value;
}
function text(value, label, max = 500, min = 1, trim = true) {
  if (typeof value !== "string") invalid(label, "pričakovano je besedilo");
  const result = trim ? value.trim() : value;
  if (
    result.length < min ||
    result.length > max ||
    /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(result)
  )
    invalid(label, `besedilo mora imeti ${min}–${max} znakov`);
  if (/<[^>]*>/.test(result))
    invalid(label, "dovoljeno je samo navadno besedilo brez HTML");
  return result;
}
function number(value, label, min, max, integer = false) {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < min ||
    value > max ||
    (integer && !Number.isInteger(value))
  )
    invalid(
      label,
      `pričakovano je ${integer ? "celo " : ""}število med ${min} in ${max}`,
    );
  return value;
}
function choice(value, label, allowed) {
  if (!allowed.includes(value)) invalid(label, "izbira ni podprta");
  return value;
}
function id(value, label) {
  const result = text(value, label, 100);
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(result) || forbiddenKeys.has(result))
    invalid(label, "identifikator ni veljaven");
  return result;
}
function unique(items, read, label) {
  const seen = new Set();
  for (const item of items) {
    const key = read(item);
    if (seen.has(key)) invalid(label, "zapisi se ne smejo ponavljati");
    seen.add(key);
  }
  return items;
}
function email(value, label) {
  const result = text(value, label, 254);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result))
    invalid(label, "e-poštni naslov ni veljaven");
  return result;
}
function phone(value, label) {
  const result = text(value, label, 50);
  if (!/^[+\d ()\-./]+$/.test(result) || (result.match(/\d/g) || []).length < 3)
    invalid(label, "telefonska številka ni veljavna");
  return result;
}
function date(value, label) {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    value.startsWith("0000")
  )
    invalid(label, "datum mora biti zapisan kot LLLL-MM-DD");
  const parsed = new Date(`${value}T12:00:00Z`);
  if (
    !Number.isFinite(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== value
  )
    invalid(label, "datum ne obstaja");
  return value;
}
function today() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Ljubljana",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  return ["year", "month", "day"]
    .map((type) => parts.find((part) => part.type === type).value)
    .join("-");
}
function httpsUrl(value, label) {
  const result = text(value, label, 2000);
  let parsed;
  try {
    parsed = new URL(result);
  } catch {
    invalid(label, "pričakovana je povezava HTTPS");
  }
  if (
    parsed.protocol !== "https:" ||
    parsed.username ||
    parsed.password ||
    /[\r\n\\]/.test(result)
  )
    invalid(label, "dovoljena je samo povezava HTTPS brez prijavnih podatkov");
  const host = parsed.hostname.toLowerCase();
  if (
    host === "localhost" ||
    host === "[::1]" ||
    host === "[::]" ||
    /\.(?:localhost|local|internal)$/.test(host) ||
    /^(?:0|10|127)\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^169\.254\./.test(host) ||
    /^172\.(?:1[6-9]|2\d|3[01])\./.test(host) ||
    /^\[(?:fc|fd|fe8|fe9|fea|feb)/.test(host)
  )
    invalid(label, "povezave do lokalnih in zasebnih omrežij niso dovoljene");
  return result;
}
function imageUrl(value, label, { blank = false, original = false } = {}) {
  if (blank && value === "") return "";
  const result = text(value, label, 2000);
  let pathname;
  if (result.startsWith("/")) {
    if (
      result.startsWith("//") ||
      result.includes("\\") ||
      /%2f|%5c|%2e/i.test(result)
    )
      invalid(label, "pot slike ni dovoljena");
    const segments = result.split("/");
    if (segments.some((segment) => segment === ".." || segment === "."))
      invalid(label, "pot slike ni dovoljena");
    if (
      !/^\/api\/media\/[a-zA-Z0-9][a-zA-Z0-9._-]{0,119}$/.test(result) &&
      !/^\/images\/(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(
        result,
      )
    )
      invalid(label, "uporabite javno sliko ali naloženo predstavnost");
    pathname = result;
  } else {
    httpsUrl(result, label);
    pathname = new URL(result).pathname;
    if (/^\/(?:admin(?:\/|$)|api\/(?!media\/))/.test(pathname))
      invalid(label, "pot slike ni javna predstavnost");
  }
  if (
    /\.(?:html?|js|mjs|xml|pdf|svg)$/i.test(pathname) &&
    !(original && result.startsWith("/images/") && /\.svg$/i.test(pathname))
  )
    invalid(label, "oblika slike ni dovoljena");
  return result;
}
function texts(value, label, maxItems = 30, maxText = 500) {
  return array(value, label, maxItems).map((item, index) =>
    text(item, `${label} ${index + 1}`, maxText),
  );
}

const validators = {
  districts: value => validateDistricts(value),
  layout: (value) => validateLayout(value, PUBLIC_PAGES),
  links: (value) => validateLinks(value, PUBLIC_PAGES),
  settings(value) {
    object(value, "nastavitve", [
      "siteName",
      "phone",
      "email",
      "address",
      "emergencyPhone",
      "depoUrl",
      "footerText",
      "logoUrl",
      "logoAlt",
    ]);
    return {
      siteName: text(value.siteName, "ime strani", 160),
      phone: phone(value.phone, "telefon"),
      email: email(value.email, "e-pošta"),
      address: text(value.address, "naslov", 300),
      emergencyPhone: phone(value.emergencyPhone, "dežurni telefon"),
      depoUrl: httpsUrl(value.depoUrl, "povezava DEPO"),
      footerText: text(value.footerText, "besedilo noge", 1000),
      logoUrl: imageUrl(value.logoUrl, "logotip", { blank: true }),
      logoAlt: text(value.logoAlt, "opis logotipa", 300),
    };
  },
  hours(value) {
    return unique(
      array(value, "delovni časi", 20).map((item, index) => {
        const label = `delovni čas ${index + 1}`;
        object(item, label, [
          "name",
          "description",
          "tone",
          "phone",
          "telephone",
          "email",
          "rows",
        ]);
        return {
          name: text(item.name, label, 160),
          description: text(item.description, label, 700, 0),
          tone: choice(item.tone, label, ["office", "collection", "depo"]),
          phone: phone(item.phone, label),
          telephone: phone(item.telephone, label),
          email: email(item.email, label),
          rows: array(item.rows, label, 14, 1).map((row) => {
            array(row, label, 2, 2);
            return [text(row[0], label, 120), text(row[1], label, 120)];
          }),
        };
      }),
      (item) => item.name.toLocaleLowerCase("sl"),
      "delovni časi",
    );
  },
  notices(value) {
    return unique(
      array(value, "obvestila", 200).map((item, index) => {
        const label = `obvestilo ${index + 1}`;
        const noticeFields = [
          "id",
          "title",
          "category",
          "area",
          "date",
          "summary",
          "status",
          "latitude",
          "longitude",
        ];
        object(item, label, [...noticeFields, "published", "districtIds", "allDistricts", "addressRules"], noticeFields);
        if (item.published !== undefined && typeof item.published !== "boolean")
          invalid(label, "objava mora biti vključena ali izključena");
        if ((item.latitude === null) !== (item.longitude === null))
          invalid(label, "vnesite obe koordinati ali obe pustite prazni");
        return {
          ...validateDeliveryFields(item),
          id: id(item.id, label),
          title: text(item.title, `${label} – naslov`, 250, item.published === false ? 0 : 1),
          category: choice(item.category, label, [
            "water",
            "roads",
            "waste",
            "general",
          ]),
          area: text(item.area, `${label} – območje`, 300, item.published === false ? 0 : 1),
          date: date(item.date, label),
          summary: text(item.summary, `${label} – vsebina`, 5000, item.published === false ? 0 : 1),
          status: choice(item.status, label, [
            "planned",
            "info",
            "active",
            "resolved",
          ]),
          latitude: item.latitude === null ? null : number(item.latitude, label, -90, 90),
          longitude: item.longitude === null ? null : number(item.longitude, label, -180, 180),
          ...(item.published === undefined ? {} : { published: item.published }),
        };
      }),
      (item) => item.id,
      "obvestila",
    );
  },
  collection(value) {
    object(value, "urniki", ["routes"]);
    const routes = unique(
      array(value.routes, "odvozne poti", 200).map((route, index) => {
        const label = `odvozna pot ${index + 1}`;
        object(route, label, ["id", "name", "addresses", "events"]);
        return {
          id: id(route.id, label),
          name: text(route.name, label, 200),
          addresses: unique(
            array(route.addresses, `${label} – pravila naslovov`, 500, 1).map(
              (item) => {
                const rule = text(item, `${label} – naslov`, 300);
                if (!normalizedAddress(rule))
                  invalid(
                    label,
                    "pravilo naslova mora vsebovati besede ali številke",
                  );
                return rule;
              },
            ),
            (item) => normalizedAddress(item),
            label,
          ),
          events: unique(
            array(route.events, label, 500).map((event) => {
              object(
                event,
                label,
                ["id", "type", "label", "date", "bin"],
                ["id", "type", "label", "date"],
              );
              const clean = {
                id: id(event.id, label),
                type: choice(event.type, label, [
                  "packaging",
                  "bio",
                  "residual",
                ]),
                label: text(event.label, label, 250),
                date: date(event.date, label),
              };
              if (Object.hasOwn(event, "bin"))
                clean.bin = text(event.bin, label, 200, 0);
              return clean;
            }),
            (event) => event.id,
            label,
          ),
        };
      }),
      (item) => item.id,
      "odvozne poti",
    );
    for (const route of routes) {
      unique(
        route.events,
        (event) => `${event.type}|${event.date}`,
        `${route.name} – datum in vrsta odpadkov`,
      );
      // Fractions have independent geographic routes. Overlapping same-fraction
      // rules are retained for vehicle splits whose house boundaries are unknown;
      // public lookup reports these as unconfirmed instead of guessing a route.
    }
    return { routes };
  },
  wastePoints(value) {
    return unique(
      array(value, "zbirna mesta", 1000).map((item, index) => {
        const label = `zbirno mesto ${index + 1}`;
        object(
          item,
          label,
          ["id", "name", "area", "address", "lat", "lng", "types", "center"],
          ["id", "name", "area", "address", "lat", "lng", "types"],
        );
        const clean = {
          id: number(item.id, label, 1, 1_000_000_000, true),
          name: text(item.name, label, 200),
          area: text(item.area, label, 200),
          address: text(item.address, label, 300),
          lat: number(item.lat, label, -90, 90),
          lng: number(item.lng, label, -180, 180),
          types: unique(
            array(item.types, label, pointTypes.length, 1).map((type) =>
              choice(type, label, pointTypes),
            ),
            (type) => type,
            label,
          ),
        };
        if (Object.hasOwn(item, "center")) {
          if (typeof item.center !== "boolean") invalid(label);
          clean.center = item.center;
        }
        return clean;
      }),
      (item) => item.id,
      "zbirna mesta",
    );
  },
  wasteItems(value) {
    return unique(
      array(value, "odpadki", 1000).map((item, index) => {
        const label = `odpadek ${index + 1}`;
        object(
          item,
          label,
          ["name", "keywords", "category", "note"],
          ["name", "keywords", "category"],
        );
        const clean = {
          name: text(item.name, label, 200),
          keywords: unique(
            texts(item.keywords, label, 50, 100),
            (word) => word.toLocaleLowerCase("sl"),
            label,
          ),
          category: choice(item.category, label, categories),
        };
        if (Object.hasOwn(item, "note"))
          clean.note = text(item.note, label, 2000, 0);
        return clean;
      }),
      (item) => item.name.toLocaleLowerCase("sl"),
      "odpadki",
    );
  },
  wasteCategories(value) {
    object(value, "vrste odpadkov", categories);
    return Object.fromEntries(
      categories.map((key) => {
        const item = value[key];
        object(item, key, ["title", "destination", "color", "tip"]);
        if (
          typeof item.color !== "string" ||
          !/^#[0-9a-fA-F]{6}$/.test(item.color)
        )
          invalid(key, "barva mora biti šestmestna šestnajstiška koda");
        return [
          key,
          {
            title: text(item.title, key, 200),
            destination: text(item.destination, key, 300),
            color: item.color,
            tip: text(item.tip, key, 2000),
          },
        ];
      }),
    );
  },
  services(value) {
    const clean = unique(
      array(value, "storitve", services.length, services.length).map((item) => {
        object(item, "storitev", [
          "value",
          "title",
          "desc",
          "intro",
          "prepare",
          "note",
          "placeholder",
        ]);
        return {
          value: choice(item.value, "vrsta storitve", services),
          title: text(item.title, "naslov storitve", 200),
          desc: text(item.desc, "opis storitve", 700),
          intro: text(item.intro, "pojasnilo storitve", 3000),
          prepare: texts(item.prepare, "priprava na storitev", 20, 1000),
          note: text(item.note, "opomba storitve", 2000, 0),
          placeholder: text(item.placeholder, "primer vnosa", 1000, 0),
        };
      }),
      (item) => item.value,
      "storitve",
    );
    return clean;
  },
  rates(value) {
    object(value, "cene", rateKeys);
    return Object.fromEntries(
      rateKeys.map((key) => [
        key,
        number(value[key], `cena ${key}`, 0, 100_000),
      ]),
    );
  },
  market(value) {
    object(value, "tržnica", ["dates", "closedDates"]);
    const dates = unique(
      array(value.dates, "termini tržnice", 500).map((item) =>
        date(item, "termin tržnice"),
      ),
      (item) => item,
      "termini tržnice",
    );
    const closedDates = unique(
      array(value.closedDates, "zaprti termini", 500).map((item) =>
        date(item, "zaprti termin"),
      ),
      (item) => item,
      "zaprti termini",
    );
    if (dates.some((item) => closedDates.includes(item)))
      invalid("tržnica", "isti datum ne more biti odprt in zaprt");
    return { dates, closedDates };
  },
  cemetery(value) {
    object(value, "pokopališče", ["plan", "graves"]);
    object(value.plan, "načrt pokopališča", ["width", "height", "imageUrl"]);
    const plan = {
      width: number(value.plan.width, "širina načrta", 1, 10_000, true),
      height: number(value.plan.height, "višina načrta", 1, 10_000, true),
      imageUrl:
        value.plan.imageUrl === null || value.plan.imageUrl === ""
          ? null
          : imageUrl(value.plan.imageUrl, "slika načrta"),
    };
    const currentDate = today();
    const graves = unique(
      array(value.graves, "grobovi", 1000).map((grave) => {
        object(grave, "grob", [
          "id",
          "section",
          "row",
          "number",
          "x",
          "y",
          "people",
        ]);
        return {
          id: id(grave.id, "oznaka groba"),
          section: text(grave.section, "oddelek", 60),
          row: number(grave.row, "vrsta", 1, 10_000, true),
          number: number(grave.number, "številka groba", 1, 100_000, true),
          x: number(grave.x, "položaj x", 0, plan.width),
          y: number(grave.y, "položaj y", 0, plan.height),
          people: array(grave.people, "osebe v grobu", 10).map((person) => {
            object(person, "pokojnik", ["name", "born", "died"]);
            const born = date(person.born, "datum rojstva");
            const died = date(person.died, "datum smrti");
            if (born >= died || died > currentDate)
              invalid(
                "datuma pokojnika",
                "rojstvo mora biti pred smrtjo, datum smrti pa ne sme biti v prihodnosti",
              );
            return {
              name: text(person.name, "ime pokojnika", 200),
              born,
              died,
            };
          }),
        };
      }),
      (grave) => grave.id,
      "grobovi",
    );
    unique(
      graves,
      (grave) =>
        `${grave.section.toLocaleLowerCase("sl")}|${grave.row}|${grave.number}`,
      "oznaka groba",
    );
    return { plan, graves };
  },
  copy(value) {
    return unique(
      array(value, "besedila strani", 3000).map((item) => {
        object(item, "besedilo strani", ["page", "key", "original", "value"]);
        if (typeof item.key !== "string" || !/^[a-f0-9]{64}$/.test(item.key))
          invalid("ključ besedila", "pričakovan je 64-mestni ključ");
        return {
          page:
            typeof item.page === "string" && CUSTOM_PAGE.test(item.page)
              ? item.page
              : choice(item.page, "stran", ["*", ...PUBLIC_PAGES]),
          key: item.key,
          original: text(item.original, "izvirno besedilo", 20_000, 1, false),
          value: text(item.value, "novo besedilo", 20_000, 0, false),
        };
      }),
      (item) => `${item.page}|${item.key}`,
      "besedila strani",
    );
  },
  images(value) {
    return unique(
      array(value, "slike strani", 500).map((item) => {
        object(item, "slika strani", ["page", "key", "original", "url", "alt"]);
        if (typeof item.key !== "string" || !/^[a-f0-9]{64}$/.test(item.key))
          invalid("ključ slike", "pričakovan je 64-mestni ključ");
        return {
          page:
            typeof item.page === "string" && CUSTOM_PAGE.test(item.page)
              ? item.page
              : choice(item.page, "stran", ["*", ...PUBLIC_PAGES]),
          key: item.key,
          original:
            item.original === "cms:featured"
              ? "cms:featured"
              : imageUrl(item.original, "izvirna slika", {
                  original: true,
                }),
          url: imageUrl(item.url, "nova slika", { blank: true }),
          alt: text(item.alt, "opis slike", 1000, 0),
        };
      }),
      (item) => `${item.page}|${item.key}`,
      "slike strani",
    );
  },
};

/** Validate one complete CMS section and return a detached, allow-listed value. */
export function validateSection(section, value) {
  if (!CMS_SECTIONS.includes(section))
    invalid("področje", "to področje ne obstaja");
  const result = validators[section](value);
  const serialized = JSON.stringify(result);
  if (new TextEncoder().encode(serialized).byteLength > maxBytes)
    invalid(section, "vsebina presega največjo dovoljeno velikost 1 MB");
  return JSON.parse(serialized);
}
