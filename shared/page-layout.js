// Deliberately bounded publishing primitives. Never store executable HTML/CSS.
export const BLOCK_TYPES = [
  "native",
  "text",
  "image",
  "buttons",
  "cards",
  "callout",
  "spacer",
];
export const CUSTOM_PAGE = /^\/strani\/[a-z0-9]+(?:-[a-z0-9]+)*$/;
// Keep newly introduced functional sections visible and editable after restoring
// an older layout that predates them. Explicitly hidden sections stay hidden.
export function mergeNativeBlocks(configured, native) {
  const blocks = configured ? [...configured] : [];
  const used = new Set(blocks.filter(block => block.type === "native").map(block => block.nativeId));
  for (const item of native) {
    if (!used.has(item.id)) blocks.push({ id: item.id, nativeId: item.id, type: "native", tone: "plain", align: "left", width: "wide", hidden: false });
  }
  return blocks;
}
const fail = (message) => {
  const error = new Error(`Preverite urejevalnik strani: ${message}.`);
  error.status = 400;
  throw error;
};
const plain = (value, limit = 500, blank = false) => {
  if (
    typeof value !== "string" ||
    value.length > limit ||
    (!blank && !value.trim()) ||
    /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]|<[^>]*>/.test(value)
  )
    fail("besedilo ni veljavno");
  return value;
};
const list = (value, limit) => {
  if (!Array.isArray(value) || value.length > limit) fail("preveč zapisov");
  return value;
};
const obj = (value, keys) => {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.keys(value).some((k) => !keys.includes(k))
  )
    fail("neznano polje");
};
const choice = (value, options) => {
  if (!options.includes(value)) fail("izbira ni podprta");
  return value;
};
const identifier = (value) => {
  if (
    typeof value !== "string" ||
    !/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,99}$/.test(value) ||
    ["constructor", "prototype", "__proto__"].includes(value)
  )
    fail("oznaka ni veljavna");
  return value;
};
const unique = (values) => {
  if (new Set(values).size !== values.length) fail("oznake se ponavljajo");
};
export function safeDestination(value, blank = false) {
  plain(value, 1500, blank);
  if (blank && !value) return "";
  if (
    /[\s\\\u0000-\u001f]/.test(value) ||
    /%(?:0[0-9a-f]|1[0-9a-f]|7f|5c)/i.test(value)
  )
    fail("povezava ni veljavna");
  if (/^#[a-zA-Z0-9_-]+$/.test(value)) return value;
  if (
    /^mailto:[^?\s@]+@[^?\s@]+\.[^?\s@]+$/.test(value) ||
    /^tel:\+?[\d-]{3,30}$/.test(value)
  )
    return value;
  let url;
  try {
    url = new URL(value, "https://portal.invalid");
  } catch {
    fail("povezava ni veljavna");
  }
  if (value.startsWith("/") && !value.startsWith("//")) {
    let path;
    try {
      path = decodeURIComponent(url.pathname);
    } catch {
      fail("povezava ni veljavna");
    }
    if (
      url.origin !== "https://portal.invalid" ||
      path.startsWith("//") ||
      /^\/(?:api|admin|cdn-cgi)(?:\/|$)/i.test(path) ||
      path.includes("\\")
    )
      fail("zasebni ali tehnični naslov ni javna povezava");
    return value;
  }
  if (
    !/^https:\/\//.test(value) ||
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    /^(?:localhost|.*\.localhost|127\.|10\.|192\.168\.|0\.|169\.254\.|\[|172\.(?:1[6-9]|2\d|3[01])\.)/i.test(
      url.hostname,
    ) ||
    !url.hostname.includes(".")
  )
    fail("uporabite javno povezavo HTTPS");
  return url.href;
}
export function safePicture(value) {
  if (!value) return "";
  if (/^\/api\/media\/[a-zA-Z0-9-]{1,100}$/.test(value)) return value;
  const url = safeDestination(value);
  if (url.startsWith("/") && !/^\/(?:images\/|api\/media\/)/.test(url))
    fail("uporabite sliko iz knjižnice ali javni HTTPS");
  if (!url.startsWith("/") && !url.startsWith("https://"))
    fail("slika ni veljavna");
  let path;
  try {
    path = decodeURIComponent(new URL(url, "https://portal.invalid").pathname);
  } catch {
    fail("slika ni veljavna");
  }
  if (
    /^\/(?:admin|cdn-cgi)(?:\/|$)/i.test(path) ||
    (/^\/api(?:\/|$)/i.test(path) &&
      !/^\/api\/media\/[a-zA-Z0-9-]{1,100}$/.test(path)) ||
    /\.(?:svg|html?|js)(?:$|[?#])/i.test(path)
  )
    fail("slika mora biti javna fotografija");
  return url;
}
const link = (item) => {
  obj(item, ["id", "label", "url", "variant"]);
  return {
    id: identifier(item.id),
    label: plain(item.label, 180),
    url: safeDestination(item.url),
    variant: choice(item.variant, ["primary", "secondary", "text"]),
  };
};
export function validateLayout(value, publicPages = []) {
  obj(value, ["pages", "navigation"]);
  const pages = list(value.pages, 60).map((page) => {
    obj(page, ["path", "title", "blocks"]);
    if (!publicPages.includes(page.path) && !CUSTOM_PAGE.test(page.path))
      fail("naslov strani ni dovoljen");
    const blocks = list(page.blocks, 100).map((block) => {
      obj(block, [
        "id",
        "type",
        "nativeId",
        "title",
        "text",
        "image",
        "alt",
        "links",
        "cards",
        "tone",
        "align",
        "width",
        "hidden",
        "size",
      ]);
      const result = {
        id: identifier(block.id),
        type: choice(block.type, BLOCK_TYPES),
        tone: choice(block.tone, ["plain", "soft", "dark"]),
        align: choice(block.align, ["left", "center", "right"]),
        width: choice(block.width, ["wide", "narrow"]),
        hidden: block.hidden,
      };
      if (typeof block.hidden !== "boolean") fail("vidnost ni veljavna");
      if (block.type === "native") result.nativeId = identifier(block.nativeId);
      if (["text", "callout", "cards"].includes(block.type)) {
        result.title = plain(block.title, 300, true);
        result.text = plain(block.text, 12000, true);
      }
      if (block.type === "image") {
        result.image = safePicture(block.image);
        result.alt = plain(block.alt, 1000, true);
      }
      if (["text", "callout", "buttons"].includes(block.type)) {
        result.links = list(block.links, 12).map(link);
        unique(result.links.map((x) => x.id));
      }
      if (block.type === "cards") {
        result.cards = list(block.cards, 12).map((card) => {
          obj(card, ["id", "title", "text", "url", "label"]);
          return {
            id: identifier(card.id),
            title: plain(card.title, 300),
            text: plain(card.text, 3000, true),
            url: safeDestination(card.url, true),
            label: plain(card.label, 180, true),
          };
        });
        unique(result.cards.map((x) => x.id));
      }
      if (block.type === "spacer")
        result.size = choice(block.size, ["small", "medium", "large"]);
      return result;
    });
    unique(blocks.map((x) => x.id));
    unique(blocks.filter((x) => x.type === "native").map((x) => x.nativeId));
    return { path: page.path, title: plain(page.title, 200), blocks };
  });
  unique(pages.map((x) => x.path));
  const navigation = list(value.navigation, 10).map(link);
  unique(navigation.map((x) => x.id));
  return { pages, navigation };
}
export function validateLinks(value, publicPages = []) {
  const result = list(value, 1000).map((item) => {
    obj(item, ["page", "key", "original", "label", "url"]);
    if (
      item.page !== "*" &&
      !publicPages.includes(item.page) &&
      !CUSTOM_PAGE.test(item.page)
    )
      fail("stran povezave ni veljavna");
    if (!/^[a-f0-9]{64}$/.test(item.key)) fail("ključ povezave ni veljaven");
    return {
      page: item.page,
      key: item.key,
      original: safeDestination(item.original),
      label: plain(item.label, 300, true),
      url: safeDestination(item.url),
    };
  });
  unique(result.map((x) => `${x.page}|${x.key}`));
  return result;
}
