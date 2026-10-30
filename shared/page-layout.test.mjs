import test from "node:test";
import assert from "node:assert/strict";
import {
  safeDestination,
  safePicture,
  validateLayout,
  validateLinks,
  mergeNativeBlocks,
} from "./page-layout.js";
import { validateSection, PUBLIC_PAGES } from "./cms-validation.js";
const block = {
  id: "test",
  type: "buttons",
  tone: "plain",
  align: "left",
  width: "wide",
  hidden: false,
  links: [
    { id: "contact", label: "Kontakt", url: "/kontakt", variant: "primary" },
  ],
};

test("restored layouts retain hidden sections and expose newly added native sections for editing", () => {
  const hidden = { id: "hidden", type: "native", nativeId: "old", hidden: true };
  const saved = [block, hidden];
  const merged = mergeNativeBlocks(saved, [{id: "old"}, {id: "new"}]);
  assert.deepEqual(merged.slice(0, 2), saved);
  assert.equal(merged[2].nativeId, "new");
  assert.equal(merged[2].hidden, false);
  assert.equal(mergeNativeBlocks(merged, [{id: "old"}, {id: "new"}]).length, 3);
  assert.equal(saved.length, 2);
});
test("publishing accepts bounded ordered blocks and custom page paths", () => {
  const value = {
    pages: [
      {
        path: "/",
        title: "Domov",
        blocks: [
          { ...block, id: "first" },
          { ...block, id: "second" },
        ],
      },
      { path: "/strani/navodila", title: "Navodila", blocks: [] },
    ],
    navigation: [],
  };
  assert.deepEqual(validateSection("layout", value), value);
});
test("builder rejects duplicate identities, invalid types and technical pages", () => {
  for (const blocks of [
    [block, block],
    [{ ...block, id: 1 }],
    [{ ...block, type: "html" }],
    [{ ...block, text: "<script>alert(1)</script>", type: "text" }],
  ])
    assert.throws(() =>
      validateLayout(
        { pages: [{ path: "/", title: "X", blocks }], navigation: [] },
        PUBLIC_PAGES,
      ),
    );
  assert.throws(() =>
    validateLayout(
      { pages: [{ path: "/admin", title: "X", blocks: [] }], navigation: [] },
      PUBLIC_PAGES,
    ),
  );
});
test("button destinations cannot execute code, access private endpoints or use implicit external URLs", () => {
  for (const url of [
    "javascript:alert(1)",
    "data:text/html,test",
    "//evil.example",
    "relative-path",
    "https:evil.example",
    "https://user:pass@example.com",
    "https://127.0.0.1/a",
    "https://2130706433/a",
    "/api/admin/content",
    "/a/../admin",
    "/%61dmin",
    "/%2fadmin",
    "/\\evil.example",
  ])
    assert.throws(() => safeDestination(url), url);
  for (const url of [
    "/kontakt",
    "/strani/test?x=1#details",
    "#vsebina",
    "https://www.kpv.si/",
    "mailto:info@kpv.si",
    "tel:+38617502960",
  ])
    assert.equal(safeDestination(url), url);
});
test("photos exclude private APIs, active files and non-image schemes", () => {
  for (const url of [
    "/api/admin/submissions/id/photo",
    "https://example.com/api/admin/secret",
    "https://example.com/image.svg",
    "mailto:image@example.com",
  ])
    assert.throws(() => safePicture(url), url);
  assert.equal(safePicture("/api/media/abcd-1234"), "/api/media/abcd-1234");
  assert.equal(
    safePicture("/images/ljubljanica.webp"),
    "/images/ljubljanica.webp",
  );
});
test("link overrides are scoped to known or custom pages and validated on server", () => {
  const link = {
    page: "/strani/test",
    key: "a".repeat(64),
    original: "/kontakt",
    label: "Pišite nam",
    url: "/kontakt#obrazec",
  };
  assert.deepEqual(validateLinks([link], PUBLIC_PAGES), [link]);
  assert.throws(() => validateLinks([link, link], PUBLIC_PAGES));
  assert.throws(() =>
    validateLinks([{ ...link, page: "/admin" }], PUBLIC_PAGES),
  );
  assert.throws(() =>
    validateLinks([{ ...link, url: "javascript:alert(1)" }], PUBLIC_PAGES),
  );
});
