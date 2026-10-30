import { ljubljanaDate, addDays } from "./seed.js";
import { BotError, verifyBot } from "./bot-protection.js";
import { emailEnabled, outboxInsert, processEmail } from "./email.js";
import { handleAdmin, readPublished, cleanupAdmin } from "./admin.js";
import { managedCollection } from "./managed-collection.js";
import { requestSubscription, subscriptionAction, processCampaigns } from "./subscriptions.js";

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
      const table =
        record.kind === "contact" ? "contact_submissions" : "submissions";
      const submission = env.DB.prepare(
        `INSERT INTO ${table} (id, kind, created_at, status, payload) VALUES (?, ?, ?, ?, ?)`,
      ).bind(
        record.id,
        record.kind,
        record.createdAt,
        record.status,
        JSON.stringify(record.payload),
      );
      if (emailEnabled(env))
        await env.DB.batch([submission, await outboxInsert(env.DB, record, env)]);
      else await submission.run();
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
export function calendar(schedule, options = {}) {
  const stamp = new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//KPV//Urnik odvoza//SL",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:KPV – urnik odvoza",
  ];
  const events = options.eventId
    ? schedule.events.filter((event) => event.id === options.eventId)
    : schedule.events;
  for (const event of events) {
    const recurrence =
      options.repeat === "weekly"
        ? `RRULE:FREQ=WEEKLY;INTERVAL=${options.interval};COUNT=${options.count}`
        : null;
    const uidSuffix = recurrence
      ? `-repeat-${options.interval}-${options.count}`
      : "";
    lines.push(
      "BEGIN:VEVENT",
      `UID:${event.id}${uidSuffix}@kpv.jakobtominc.com`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${event.date.replace(/-/g, "")}`,
      `DTEND;VALUE=DATE:${addDays(event.date, 1).replace(/-/g, "")}`,
      `SUMMARY:${safeICS(event.label)}`,
      `LOCATION:${safeICS(schedule.address)}`,
      `DESCRIPTION:${safeICS("Urnik odvoza KPV. Uvoženi koledar se ne posodablja samodejno; spremembe preverite na spletni strani." + (recurrence ? " Ponavljanje ste izbrali sami; ne upošteva praznikov ali sprememb odvoza." : ""))}`,
    );
    if (recurrence) lines.push(recurrence);
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.map(foldLine).join("\r\n") + "\r\n";
}

function calendarOptions(params, schedule) {
  const eventId = params.get("eventId");
  const repeat = params.get("repeat") || "once";
  if (!["once", "weekly"].includes(repeat))
    throw new ApiError(
      400,
      "Izberite enkraten dogodek ali tedensko ponavljanje.",
    );
  if (!eventId) {
    if (repeat === "weekly")
      throw new ApiError(
        400,
        "Za ponavljanje najprej izberite posamezen odvoz.",
      );
    return {};
  }
  const event = schedule.events.find((item) => item.id === eventId);
  if (!event)
    throw new ApiError(
      404,
      "Izbranega odvoza ni več v prikazanem urniku. Osvežite urnik in izberite nov termin.",
    );
  if (repeat === "once") return { eventId, repeat };
  const defaults = { bio: 1, packaging: 2, residual: 3 };
  const intervalText =
    params.get("interval") ?? String(defaults[event.type] || 1);
  const countText = params.get("count") ?? "12";
  if (
    !/^[1-8]$/.test(intervalText) ||
    !/^\d{1,2}$/.test(countText) ||
    Number(countText) < 2 ||
    Number(countText) > 52
  )
    throw new ApiError(
      400,
      "Ponavljanje je mogoče na 1 do 8 tednov, za 2 do 52 odvozov.",
    );
  return {
    eventId,
    repeat,
    interval: Number(intervalText),
    count: Number(countText),
  };
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
  return {
    payload,
    upload,
    token: data["cf-turnstile-response"],
    honeypot: data.website,
  };
}

export async function handleRequest(request, env = {}, ctx) {
  const url = new URL(request.url);
  const route = url.pathname;
  if (!route.startsWith("/api/")) {
    if (env.ASSETS) {
      const response = await env.ASSETS.fetch(request);
      if (route !== "/admin" && route !== "/admin/" && route !== "/obvestila/narocnina") return response;
      const headers = new Headers(response.headers);
      headers.set("X-Robots-Tag", "noindex, nofollow");
      headers.set("Cache-Control", "no-store");
      headers.set("X-Frame-Options", "DENY");
      headers.set("Referrer-Policy", "no-referrer");
      return new Response(response.body, { status: response.status, headers });
    }
    return new Response(
      "API KPV · za spletni vmesnik odprite razvojni strežnik.",
      { status: 404 },
    );
  }
  try {
    const subscriptionResponse = await subscriptionAction(request, env, { json, readJson, readDistricts: () => readPublished(env, "districts") });
    if (subscriptionResponse) return subscriptionResponse;
    const adminResponse = await handleAdmin(request, env);
    if (adminResponse) {
      if (route === '/api/admin/notice-delivery' && adminResponse.ok && ctx?.waitUntil)
        ctx.waitUntil(processCampaigns(env).then(()=>processEmail(env,{limit:1})).catch(()=>console.error(JSON.stringify({event:'campaign_queue_unavailable'}))));
      return adminResponse;
    }
    if (request.method === "GET") {
      if (route === "/api/health")
        return json({
          ok: true,
          demo: false,
          storage: env.LOCAL_STORAGE
            ? env.DB
              ? "local-sqlite"
              : "local-file"
            : env.DB
              ? "d1"
              : "unavailable",
          email: emailEnabled(env) ? "resend" : "not-configured",
          payments: "not-enabled",
          botProtection: env.LOCAL_STORAGE
            ? "local-demo"
            : env.TURNSTILE_SECRET && env.TURNSTILE_SITE_KEY
              ? "turnstile"
              : "not-configured",
        });
      if (route === "/api/config")
        return json({
          email: { enabled: emailEnabled(env) },
          turnstile: {
            enabled: !env.LOCAL_STORAGE,
            siteKey: env.LOCAL_STORAGE ? "" : env.TURNSTILE_SITE_KEY || "",
            mode: env.LOCAL_STORAGE ? "local-demo" : "managed",
          },
        });
      if (route === "/api/notices")
        return json({
          notices: await readPublished(env, "notices"),
          demo: false,
        });
      if (route === "/api/collection" || route === "/api/calendar") {
        const address = field(
          { address: url.searchParams.get("address") },
          "address",
          3,
          250,
        );
        const configured = await readPublished(env, "collection");
        const schedule = managedCollection(address, configured);
        if (!schedule)
          throw new ApiError(
            422,
            "Za ta naslov ni mogoče zanesljivo določiti urnika. Vnesite ulico, hišno številko in kraj. Urnik preverite tudi na https://www.kpv.si/mDejavnosti/rzo/rzoUrnik.html.",
          );
        if (route === "/api/calendar")
          return new Response(
            calendar(schedule, calendarOptions(url.searchParams, schedule)),
            {
              headers: {
                ...securityHeaders,
                "Content-Type": "text/calendar; charset=utf-8",
                "Content-Disposition":
                  'attachment; filename="kpv-urnik.ics"',
              },
            },
          );
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
        "/api/contact",
      ].includes(route)
    )
      throw new ApiError(404, "Ta naslov API ne obstaja.");
    const store = storage(env);
    let payload;
    let upload = null;
    let token;
    let honeypot;
    if (route === "/api/reports")
      ({ payload, upload, token, honeypot } = await report(request));
    else {
      const data = await readJson(request);
      token = data["cf-turnstile-response"];
      honeypot = data.website;
      const person = contact(data);
      if (route === "/api/contact") {
        const subcategories = {
          water: ["supply", "septic", "connection"],
          waste: ["collection", "sorting", "bulky"],
          roads: ["road", "lighting", "public"],
          billing: ["invoice", "meter", "payment"],
          market: ["booking", "conditions"],
          depo: ["donation", "purchase"],
          other: [],
        };
        const category = choice(data, "category", Object.keys(subcategories));
        const subcategory = optional(data, "subcategory", 40);
        if (
          category === "other"
            ? subcategory !== ""
            : !subcategories[category].includes(subcategory)
        )
          throw new ApiError(400, "Izberite ustrezno podkategorijo vprašanja.");
        payload = {
          ...person,
          category,
          subcategory,
          subject: field(data, "subject", 3, 180),
          message: field(data, "message", 10, 4000),
          phone: optional(data, "phone", 40),
        };
      } else if (route === "/api/subscriptions") {
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
          districtId: field(data, "districtId", 1, 80),
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
        const proposedDate = date(data, "date", true);
        const market = await readPublished(env, "market");
        if (
          market.closedDates.includes(proposedDate) ||
          (market.dates.length && !market.dates.includes(proposedDate))
        )
          throw new ApiError(
            400,
            "Izbrani termin ni na voljo. Izberite objavljen termin tržnice.",
          );
        payload = {
          ...person,
          phone: optional(data, "phone", 40),
          date: proposedDate,
          stallType: choice(data, "stallType", ["standard", "food", "craft"]),
          products: field(data, "products", 3, 2000),
          paymentStatus: "not-charged",
        };
      }
    }
    await verifyBot(request, env, token, route.slice(5), honeypot);
    if (route === "/api/subscriptions") {
      const data = await requestSubscription(env, { ...payload, districtId: payload.districtId, consent: true }, await readPublished(env, "districts"), request.headers.get("cf-connecting-ip") || "local");
      if (ctx?.waitUntil) ctx.waitUntil(processEmail(env,{limit:1}));
      return json(data, 201);
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
    const queued = emailEnabled(env);
    if (queued && ctx?.waitUntil) ctx.waitUntil(processEmail(env, { id }));
    return json(
      {
        id,
        status: "demo-saved",
        demo: false,
        emailStatus: queued ? "queued" : "disabled",
        message: queued
          ? "Oddaja je shranjena. E-poštno obvestilo je v čakalni vrsti za skrbnika portala. Za povpraševanja in prijave na tržnico je potrebna ločena potrditev izvedbe oziroma termina."
          : "Oddaja je shranjena za obravnavo. E-poštna obvestila trenutno niso vključena.",
      },
      201,
    );
  } catch (error) {
    if (error instanceof ApiError || error instanceof BotError || Number.isInteger(error?.status))
      return json({ error: error.message, demo: false }, error.status);
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
        demo: false,
      },
      503,
    );
  }
}

export default {
  fetch: handleRequest,
  async scheduled(_controller, env) {
    try { await processCampaigns(env); } catch { console.error(JSON.stringify({event:'campaign_queue_unavailable'})); }
    await Promise.all([processEmail(env), cleanupAdmin(env)]);
    await env.DB?.prepare('DELETE FROM subscription_limits WHERE window<?').bind(Math.floor(Date.now()/3600000)-48).run();
  },
};
