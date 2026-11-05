import { CUSTOM_PAGE } from "../shared/page-layout.js";
import { publicOrigin } from "./public-origin.js";

export const PUBLIC_PAGE_PATHS = [
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
];
const privatePaths = new Set(["/admin", "/obvestila/narocnina"]);
const builtins = new Set([...PUBLIC_PAGE_PATHS, ...privatePaths]);
const escapeXml = (value) =>
  value.replace(
    /[&<>"']/g,
    (char) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&apos;",
      })[char],
  );
const pageMetadata = {
  "/": [
    "Komunala Vrhnika",
    "Urniki odvoza, obvestila, komunalne storitve in kontakti za Vrhniko, Borovnico in Log – Dragomer.",
  ],
  "/odpadki": [
    "Odpadki in ločevanje",
    "Urniki odvoza, pravilno ločevanje odpadkov ter zbirna mesta in centri.",
  ],
  "/voda": [
    "Voda in odvajanje",
    "Oskrba s pitno vodo, odvajanje, vodomeri in pomoč pri komunalnih storitvah.",
  ],
  "/javni-prostor": [
    "Javni prostor",
    "Ceste, razsvetljava in prijava težav na javnih površinah.",
  ],
  "/odpadki/urnik": [
    "Urnik odvoza odpadkov",
    "Preverite objavljene termine odvoza za svoj naslov in jih dodajte v koledar.",
  ],
  "/odpadki/kam-z-odpadki": [
    "Kam z odpadkom?",
    "Poiščite navodila za ločevanje in pravilno oddajo odpadkov.",
  ],
  "/odpadki/lokacije": [
    "Zbirna mesta in centri",
    "Poiščite zbirna mesta, delovne čase in navodila za oddajo odpadkov.",
  ],
  "/obvestila": [
    "Obvestila in motnje",
    "Objavljena obvestila o oskrbi z vodo, cestah, odpadkih in drugih komunalnih storitvah.",
  ],
  "/ceste": [
    "Ceste in zapore",
    "Objavljena cestna obvestila in možnosti za prijavo težav na cestah.",
  ],
  "/prijavi": [
    "Prijavite težavo",
    "Sporočite težavo na javni infrastrukturi ter po potrebi dodajte lokacijo in fotografijo.",
  ],
  "/storitve": [
    "Komunalne storitve",
    "Pošljite povpraševanje za odvoz kosovnih odpadkov, greznice ali druge komunalne storitve.",
  ],
  "/trznica": [
    "Tržnica Vrhnika",
    "Preverite objavljene termine in pošljite povpraševanje za prodajno mesto na tržnici.",
  ],
  "/kalkulator": [
    "Ceniki in izračun",
    "Preverite objavljene tarife in ocenite redne mesečne komunalne stroške gospodinjstva.",
  ],
  "/depo": [
    "DEPO – ponovna uporaba",
    "Informacije o ponovni uporabi in trgovini DEPO.",
  ],
  "/pokopalisce": [
    "Pokopališče Vrhnika",
    "Informacije za obiskovalce in preverjeni kontakti upravljavca pokopališča.",
  ],
  "/kontakt": [
    "Kontakt in uradne ure",
    "Poiščite ustrezen kontakt, delovni čas ali pošljite sporočilo.",
  ],
  "/o-podjetju": [
    "O podjetju",
    "Komunalne dejavnosti in območja delovanja Komunale Vrhnika.",
  ],
  "/moj-dom": [
    "Moj dom",
    "Vaš naslov, odvozi in povezane informacije na enem mestu.",
  ],
  "/zasebnost": [
    "Zasebnost in dostopnost",
    "Informacije o podatkih, zunanjih storitvah in dostopnosti portala.",
  ],
  "/admin": ["Upravljanje portala", "Prijava za pooblaščene urednike portala."],
  "/obvestila/narocnina": [
    "Vaša e-obvestila",
    "Potrditev naročnine, nastavitve in odjava e-obvestil.",
  ],
};

async function metadata(response, canonical, title, description) {
  // Only our built HTML entry shell reaches this function; citizen input is never HTML.
  const html = await response.text();
  const extra = `<link rel="canonical" href="${escapeXml(canonical)}"><meta property="og:title" content="${escapeXml(title)}"><meta property="og:description" content="${escapeXml(description)}"><meta property="og:url" content="${escapeXml(canonical)}"><meta property="og:type" content="website">`;
  const updated = html
    .replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeXml(title)}</title>`)
    .replace(
      /<meta\s+name=["']description["'][\s\S]*?>/i,
      `<meta name="description" content="${escapeXml(description)}">`,
    )
    .replace(/<\/head>/i, `${extra}</head>`);
  const headers = new Headers(response.headers);
  headers.delete("Content-Length");
  headers.delete("ETag");
  headers.delete("Last-Modified");
  return new Response(updated, { status: response.status, headers });
}

export function documentHeaders(
  response,
  request,
  { status = response.status, privatePage = false, preview = false } = {},
) {
  const headers = new Headers(response.headers);
  if (request.method === "HEAD") {
    headers.delete("Content-Length");
    headers.delete("ETag");
    headers.delete("Last-Modified");
  }
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set(
    "Referrer-Policy",
    privatePage ? "no-referrer" : "strict-origin-when-cross-origin",
  );
  headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), payment=(), geolocation=(self)",
  );
  headers.set("X-Frame-Options", privatePage ? "DENY" : "SAMEORIGIN");
  headers.set(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "base-uri 'self'",
      "object-src 'none'",
      "script-src 'self' https://challenges.cloudflare.com",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self'",
      "connect-src 'self' https://challenges.cloudflare.com",
      "frame-src 'self' https://challenges.cloudflare.com",
      "form-action 'self'",
      `frame-ancestors ${privatePage ? "'none'" : "'self'"}`,
    ].join("; "),
  );
  if (new URL(request.url).protocol === "https:")
    headers.set("Strict-Transport-Security", "max-age=31536000");
  if (privatePage || preview || status >= 400) {
    headers.set("X-Robots-Tag", "noindex, nofollow");
    headers.set("Cache-Control", "no-store");
  }
  // Content-Length/ETag describe the asset body; they remain valid when only the status changes.
  return new Response(request.method === "HEAD" ? null : response.body, {
    status,
    headers,
  });
}

export async function servePublicPage(request, env, readLayout) {
  const url = new URL(request.url);
  const route = url.pathname;
  if (!["GET", "HEAD"].includes(request.method))
    return new Response("Metoda ni dovoljena.", {
      status: 405,
      headers: { Allow: "GET, HEAD" },
    });
  if (route === "/robots.txt") {
    const text = `User-agent: *\nDisallow: /admin\nDisallow: /api/\nDisallow: /obvestila/narocnina\nSitemap: ${url.origin}/sitemap.xml\n`;
    return new Response(request.method === "HEAD" ? null : text, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "public, max-age=300",
        "X-Content-Type-Options": "nosniff",
      },
    });
  }
  if (route === "/sitemap.xml") {
    const layout = await readLayout();
    const paths = [
      ...new Set([
        ...PUBLIC_PAGE_PATHS.filter((path) => path !== "/moj-dom"),
        ...layout.pages
          .filter((page) => CUSTOM_PAGE.test(page.path))
          .map((page) => page.path),
      ]),
    ];
    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${paths.map((path) => `<url><loc>${escapeXml(url.origin + path)}</loc></url>`).join("")}</urlset>`;
    return new Response(request.method === "HEAD" ? null : xml, {
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Cache-Control": "public, max-age=300",
        "X-Content-Type-Options": "nosniff",
      },
    });
  }
  if (!env.ASSETS)
    return new Response("Spletni vmesnik ni na voljo.", { status: 404 });
  const canonical = route.length > 1 ? route.replace(/\/+$/, "") : route;
  let exists = builtins.has(canonical);
  let customTitle;
  if (!exists && CUSTOM_PAGE.test(canonical)) {
    const layout = await readLayout();
    exists = layout.pages.some((page) => page.path === canonical);
    customTitle = layout.pages.find((page) => page.path === canonical)?.title;
  }
  if (exists && route !== canonical) {
    url.pathname = canonical;
    return Response.redirect(url.toString(), 308);
  }
  const response = await env.ASSETS.fetch(request);
  const html = response.headers.get("Content-Type")?.includes("text/html");
  if (!html) return response; // Actual hashed JS, CSS, images and fonts.
  // The static asset binding's SPA fallback is intentional for known routes only.
  const [title, description] = exists
    ? pageMetadata[canonical] || [
        customTitle || "Komunala Vrhnika",
        "Informacije in storitve Komunale Vrhnika.",
      ]
    : [
        "Strani ni mogoče najti",
        "Preverite naslov ali nadaljujte na začetno stran.",
      ];
  const document =
    request.method === "HEAD"
      ? response
      : await metadata(
          response,
          publicOrigin(env) + canonical,
          title === "Komunala Vrhnika" ? title : `${title} · Komunala Vrhnika`,
          description,
        );
  return documentHeaders(document, request, {
    status: exists ? response.status : 404,
    privatePage: privatePaths.has(canonical),
    preview: url.searchParams.has("cms-preview"),
  });
}
