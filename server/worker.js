import { notices, getCollection, ljubljanaDate, addDays } from "./seed.js";

const PHOTO_LIMIT = 5 * 1024 * 1024;
const JSON_LIMIT = 32 * 1024;
const securityHeaders = {
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
};

class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
function json(data, status = 200) {
  return Response.json(data, { status, headers: securityHeaders });
}
function field(data, key, min = 1, max = 200) {
  const raw = data[key];
  if (typeof raw !== "string")
    throw new ApiError(400, `Manjka podatek: ${key}.`);
  const value = raw.trim();
  if (
    value.length < min ||
    value.length > max ||
    /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)
  )
    throw new ApiError(400, `Preverite podatek: ${key}.`);
  return value;
}
function optional(data, key, max = 200) {
  return data[key] == null || data[key] === "" ? "" : field(data, key, 0, max);
}
function email(data) {
  const value = field(data, "email", 3, 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))
    throw new ApiError(400, "Vnesite veljaven e-poštni naslov.");
  return value;
}
function choice(data, key, values) {
  const value = field(data, key, 1, 50);
  if (!values.includes(value))
    throw new ApiError(400, `Neveljavna izbira: ${key}.`);
  return value;
}
function consent(data) {
  if (data.consent !== true && data.consent !== "true")
    throw new ApiError(400, "Za shranjevanje oddaje je potrebna privolitev.");
}
function date(data, key, required = false) {
  const value = optional(data, key, 10);
  if (!value && !required) return "";
  const parsed = new Date(`${value}T12:00:00Z`);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    !Number.isFinite(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== value ||
    value < ljubljanaDate()
  )
    throw new ApiError(400, "Izberite veljaven današnji ali prihodnji datum.");
  return value;
}
async function limitedBytes(request, limit) {
  const declared = Number(request.headers.get("content-length"));
  if (declared > limit)
    throw new ApiError(
      413,
      "Oddaja je prevelika. Fotografija je lahko velika največ 5 MB.",
    );
  if (!request.body) throw new ApiError(400, "Oddaja je prazna.");
  const reader = request.body.getReader();
  const chunks = [];
  let size = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) {
      await reader.cancel();
      throw new ApiError(
        413,
        "Oddaja je prevelika. Fotografija je lahko velika največ 5 MB.",
      );
    }
    chunks.push(value);
  }
  const body = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}
async function readJson(request) {
  if (!request.headers.get("content-type")?.includes("application/json"))
    throw new ApiError(415, "Pričakovana je oddaja JSON.");
  const bytes = await limitedBytes(request, JSON_LIMIT);
  try {
    const data = JSON.parse(new TextDecoder().decode(bytes));
    if (!data || Array.isArray(data) || typeof data !== "object")
      throw new Error();
    return data;
  } catch {
    throw new ApiError(400, "Oddaja ni veljaven JSON.");
  }
}
function storage(env) {
  if (env.LOCAL_STORAGE) return env.LOCAL_STORAGE;
  if (!env.DB)
    throw new ApiError(
      503,
      "Shramba trenutno ni povezana. Oddaja ni shranjena. Poskusite pozneje.",
    );
  return {
    async save(record) {
      await env.DB.prepare(
        "INSERT INTO submissions (id, kind, created_at, status, payload) VALUES (?, ?, ?, ?, ?)",
      )
        .bind(
          record.id,
          record.kind,
          record.createdAt,
          record.status,
          JSON.stringify(record.payload),
        )
        .run();
    },
    async putPhoto(key, bytes, type) {
      if (!env.PHOTOS)
        throw new ApiError(
          503,
          "Shramba fotografij še ni povezana. Oddajte prijavo brez fotografije.",
        );
      await env.PHOTOS.put(key, bytes, { httpMetadata: { contentType: type } });
    },
    async deletePhoto(key) {
      if (env.PHOTOS) await env.PHOTOS.delete(key);
    },
  };
}
function contact(data) {
  consent(data);
  return {
    name: field(data, "name", 2, 120),
    email: email(data),
    consent: true,
  };
}
function safeICS(value) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\r\n|\r|\n/g, "\\n")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,");
}
function foldLine(line) {
  // RFC 5545: fold at 75 octets, never split a Unicode character.
  const encoder = new TextEncoder();
  const lines = [];
  let current = "";
  for (const char of line) {
    if (encoder.encode(current + char).length > 75) {
      lines.push(current);
      current = " ";
    }
    current += char;
  }
  lines.push(current);
  return lines.join("\r\n");
}
export function calendar(schedule) {
  const stamp = new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//KPV demo//Urnik odvoza//SL",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:KPV – prikazni urnik",
  ];
  for (const event of schedule.events) {
    lines.push(
      "BEGIN:VEVENT",
      `UID:${event.id}-${event.date}@kpv-demo.local`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${event.date.replace(/-/g, "")}`,
      `DTEND;VALUE=DATE:${addDays(event.date, 1).replace(/-/g, "")}`,
      `SUMMARY:${safeICS(`PRIMER – ${event.label}`)}`,
      `LOCATION:${safeICS(schedule.address)}`,
      `DESCRIPTION:${safeICS("Prikazni urnik. Ne uporabljajte za dejanski odvoz. Uradne termine preverite na https://www.kpv.si/.")}`,
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return lines.map(foldLine).join("\r\n") + "\r\n";
}
async function report(request) {
  if (!request.headers.get("content-type")?.includes("multipart/form-data"))
    throw new ApiError(415, "Prijavo oddajte kot obrazec.");
  const bytes = await limitedBytes(request, PHOTO_LIMIT + 64 * 1024);
  const bounded = new Request(request.url, {
    method: "POST",
    headers: { "content-type": request.headers.get("content-type") },
    body: bytes,
  });
  let form;
  try {
    form = await bounded.formData();
  } catch {
    throw new ApiError(400, "Obrazca ni mogoče prebrati.");
  }
  const data = Object.fromEntries(form);
  const payload = {
    ...contact(data),
    category: choice(data, "category", ["roads", "lighting", "bins", "other"]),
    address: field(data, "address", 3, 250),
    description: field(data, "description", 10, 4000),
  };
  for (const [key, min, max] of [
    ["latitude", -90, 90],
    ["longitude", -180, 180],
  ]) {
    const value = optional(data, key, 30);
    if (!value) {
      payload[key] = null;
      continue;
    }
    const number = Number(value);
    if (!Number.isFinite(number) || number < min || number > max)
      throw new ApiError(400, "GPS-koordinate niso veljavne.");
    payload[key] = number;
  }
  if ((payload.latitude == null) !== (payload.longitude == null))
    throw new ApiError(400, "Vnesite obe GPS-koordinati.");
  const photo = form.get("photo");
  let upload = null;
  if (photo && typeof photo !== "string" && photo.size) {
    if (photo.size > PHOTO_LIMIT)
      throw new ApiError(413, "Fotografija je lahko velika največ 5 MB.");
    const bytes = new Uint8Array(await photo.arrayBuffer());
    const png =
      bytes.length >= 8 &&
      [137, 80, 78, 71, 13, 10, 26, 10].every((byte, i) => bytes[i] === byte);
    const jpeg =
      bytes.length >= 4 &&
      bytes[0] === 255 &&
      bytes[1] === 216 &&
      bytes[2] === 255;
    const webp =
      bytes.length >= 12 &&
      new TextDecoder().decode(bytes.slice(0, 4)) === "RIFF" &&
      new TextDecoder().decode(bytes.slice(8, 12)) === "WEBP";
    const extension =
      photo.type === "image/png" && png
        ? "png"
        : photo.type === "image/jpeg" && jpeg
          ? "jpg"
          : photo.type === "image/webp" && webp
            ? "webp"
            : null;
    if (!extension)
      throw new ApiError(
        400,
        "Dovoljene so prave fotografije JPG, PNG ali WebP.",
      );
    upload = {
      bytes,
      type: photo.type,
      key: `${crypto.randomUUID()}.${extension}`,
    };
    payload.photoKey = upload.key;
  }
  return { payload, upload };
}

export async function handleRequest(request, env = {}) {
  const url = new URL(request.url);
  const route = url.pathname;
  if (!route.startsWith("/api/"))
    return env.ASSETS
      ? env.ASSETS.fetch(request)
      : new Response(
          "API KPV · za spletni vmesnik odprite razvojni strežnik.",
          { status: 404 },
        );
  try {
    if (request.method === "GET") {
      if (route === "/api/health")
        return json({
          ok: true,
          demo: true,
          storage: env.LOCAL_STORAGE
            ? "local-file"
            : env.DB
              ? "d1"
              : "unavailable",
          email: "not-configured",
          payments: "demo-only",
        });
      if (route === "/api/notices") return json({ notices, demo: true });
      if (route === "/api/collection" || route === "/api/calendar") {
        const address = field(
          { address: url.searchParams.get("address") },
          "address",
          3,
          250,
        );
        const schedule = getCollection(address);
        if (!schedule)
          throw new ApiError(
            422,
            "Prikazni urnik je na voljo za Vrhniko, Borovnico in Log - Dragomer. Dodajte kraj v naslov.",
          );
        if (route === "/api/calendar")
          return new Response(calendar(schedule), {
            headers: {
              ...securityHeaders,
              "Content-Type": "text/calendar; charset=utf-8",
              "Content-Disposition":
                'attachment; filename="kpv-prikazni-urnik.ics"',
            },
          });
        return json(schedule);
      }
      throw new ApiError(404, "Ta naslov API ne obstaja.");
    }
    if (request.method !== "POST")
      throw new ApiError(405, "Metoda ni dovoljena.");
    const origin = request.headers.get("origin");
    if (
      (origin && origin !== url.origin) ||
      request.headers.get("sec-fetch-site") === "cross-site"
    )
      throw new ApiError(403, "Oddaja z druge spletne strani ni dovoljena.");
    if (
      ![
        "/api/subscriptions",
        "/api/requests",
        "/api/market",
        "/api/reports",
      ].includes(route)
    )
      throw new ApiError(404, "Ta naslov API ne obstaja.");
    const store = storage(env);
    let payload;
    let upload = null;
    if (route === "/api/reports") ({ payload, upload } = await report(request));
    else {
      const data = await readJson(request);
      const person = contact(data);
      if (route === "/api/subscriptions") {
        if (
          !Array.isArray(data.topics) ||
          !data.topics.length ||
          data.topics.length > 4 ||
          data.topics.some(
            (topic) => !["water", "roads", "waste", "general"].includes(topic),
          )
        )
          throw new ApiError(400, "Izberite vsaj eno vrsto obvestil.");
        payload = {
          ...person,
          address: field(data, "address", 3, 250),
          topics: [...new Set(data.topics)],
        };
      } else if (route === "/api/requests") {
        payload = {
          ...person,
          service: choice(data, "service", [
            "bulky",
            "septic",
            "water",
            "other",
          ]),
          phone: optional(data, "phone", 40),
          address: field(data, "address", 3, 250),
          message: field(data, "message", 10, 4000),
          preferredDate: date(data, "preferredDate"),
        };
      } else {
        payload = {
          ...person,
          phone: optional(data, "phone", 40),
          date: date(data, "date", true),
          stallType: choice(data, "stallType", ["standard", "food", "craft"]),
          products: field(data, "products", 3, 2000),
          paymentStatus: "not-charged",
        };
      }
    }
    const id = `KPV-${crypto.randomUUID()}`;
    const record = {
      id,
      kind: route.slice(5),
      createdAt: new Date().toISOString(),
      status: "demo-saved",
      payload,
    };
    if (upload) await store.putPhoto(upload.key, upload.bytes, upload.type);
    try {
      await store.save(record);
    } catch (error) {
      if (upload) await store.deletePhoto(upload.key);
      throw error;
    }
    return json(
      {
        id,
        status: "demo-saved",
        demo: true,
        message:
          "Prikazna oddaja je shranjena. Podjetju KPV ni bila poslana, e-pošta ni poslana in plačilo ni izvedeno.",
      },
      201,
    );
  } catch (error) {
    if (error instanceof ApiError)
      return json({ error: error.message, demo: true }, error.status);
    // Never log submitted personal data or request bodies.
    console.error(
      JSON.stringify({
        event: "api_error",
        route,
        type: error?.name || "Error",
      }),
    );
    return json(
      {
        error: "Oddaje ni bilo mogoče shraniti. Poskusite znova pozneje.",
        demo: true,
      },
      503,
    );
  }
}

export default { fetch: handleRequest };
