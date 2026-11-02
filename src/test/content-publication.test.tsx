import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import defaults from "../../shared/site-defaults.json";
import { SiteContentProvider, contentKey, useSiteContent } from "../content/SiteContent";
import { CmsText, fieldKey } from "../content/ContentFields";
import { CmsLayout, nativeSection } from "../content/PageComposer";
import { canonicalNativeBlocks } from "../content/native-sections";
import type { CmsBlock } from "../../shared/page-layout";
import CemeteryPage from "../pages/CemeteryPage";
import App from "../App";

const published = (patch: object = {}) => Response.json({ sections: { ...defaults, ...patch }, revisions: {} });
function Phone() {
  const { settings } = useSiteContent();
  return <p>{settings.phone}</p>;
}
function provider(children: React.ReactNode, route = "/") {
  return <MemoryRouter initialEntries={[route]}><SiteContentProvider>{children}</SiteContentProvider></MemoryRouter>;
}

describe("published content availability", () => {
  it("does not present bundled operational data as live during an outage and can retry", async () => {
    const fetcher = vi.fn().mockRejectedValueOnce(new TypeError("offline"))
      .mockResolvedValueOnce(published({ settings: { ...defaults.settings, phone: "01 111 22 33" } }));
    vi.stubGlobal("fetch", fetcher);
    render(provider(<Phone/>));
    expect(screen.queryByText(defaults.settings.phone)).toBeNull();
    await screen.findByRole("heading", { name: "Podatkov trenutno ni mogoče naložiti." });
    fireEvent.click(screen.getByRole("button", { name: "Poskusi znova" }));
    await screen.findByText("01 111 22 33");
    expect(screen.queryByText(defaults.settings.phone)).toBeNull();
  });
  it("keeps admin reachable and marks an already fetched publication stale if refreshing fails", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(published({ settings: { ...defaults.settings, phone: "01 111 22 33" } }))
      .mockRejectedValue(new TypeError("offline"));
    vi.stubGlobal("fetch", fetcher);
    const view = render(provider(<Phone/>));
    await screen.findByText("01 111 22 33");
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
    fireEvent(document, new Event("visibilitychange"));
    await screen.findByRole("alert");
    expect(screen.getByText("01 111 22 33")).toBeTruthy();
    expect(screen.getByRole("alert").textContent).toContain("zadnjo uspešno naloženo objavo");
    view.unmount();
    render(provider(<h1>Admin sign in remains available</h1>, "/admin"));
    expect(screen.getByRole("heading", { name: "Admin sign in remains available" })).toBeTruthy();
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(3));
  });
});

describe("stable CMS identities and legacy publications", () => {
  it("retains a published hidden section after inserting a new native source section", async () => {
    const first = nativeSection("Home.hero"), second = nativeSection("Home.quick-actions");
    expect(first).toBe(`native-${contentKey(".0").slice(0, 16)}`);
    const block = (id: string, hidden: boolean): CmsBlock => ({ id, nativeId: id, type: "native", tone: "plain", align: "left", width: "wide", hidden });
    vi.stubGlobal("fetch", vi.fn(async () => published({ layout: { navigation: [], pages: [{ path: "/", title: "Home", blocks: [block(first, true), block(second, false)] }] } })));
    function Content({ inserted = false }) {
      return <CmsLayout>
        {inserted && <section key="new-permanent-section">New section</section>}
        <section key={first}>Hidden original</section>
        <section key={second}>Visible original</section>
      </CmsLayout>;
    }
    const view = render(provider(<Content/>));
    await screen.findByText("Visible original");
    expect(screen.queryByText("Hidden original")).toBeNull();
    view.rerender(provider(<Content inserted/>));
    expect(screen.getByText("New section")).toBeTruthy();
    expect(screen.getByText("Visible original")).toBeTruthy();
    expect(screen.queryByText("Hidden original")).toBeNull();
  });
  it("preserves legacy wording edits across default copy changes and allows distinct fields to diverge", async () => {
    const legacy = "Za vse, kar vaš dom in naš kraj potrebujeta.";
    vi.stubGlobal("fetch", vi.fn(async () => published({ copy: [
      { page: "/", key: contentKey(legacy), original: legacy, value: "Previously edited heading" },
      { page: "/", key: contentKey("Repeated text"), original: "Repeated text", value: "Shared legacy wording" },
      { page: "/", key: fieldKey("test.first"), original: "Repeated text", value: "Distinct editorial wording" },
    ] })));
    render(provider(<>
      <CmsText id="Home.p-1">New default wording from a later release.</CmsText>
      <CmsText id="test.first">Repeated text</CmsText>
      <CmsText id="test.second">Repeated text</CmsText>
    </>));
    await screen.findByText("Previously edited heading");
    expect(screen.queryByText("New default wording from a later release.")).toBeNull();
    expect(screen.getByText("Distinct editorial wording")).toBeTruthy();
    expect(screen.getByText("Shared legacy wording")).toBeTruthy();
  });
  it("coalesces old service-specific guide identities while retaining the first saved configuration", () => {
    const block = (service: string, hidden: boolean): CmsBlock => ({ id: service, nativeId: `native-${contentKey(`.$${service}`).slice(0, 16)}`, type: "native", hidden, tone: "plain", align: "left", width: "wide" });
    const result = canonicalNativeBlocks("/storitve", [block("septic", true), block("bulky", false)]);
    expect(result).toHaveLength(1);
    expect(result?.[0].hidden).toBe(true);
    expect(result?.[0].nativeId).toBe(nativeSection("ServicesPage.svc-service-guide"));
  });
});

describe("public operational content", () => {
  it("replaces an empty cemetery search with useful contact and visiting information", () => {
    render(<MemoryRouter initialEntries={["/pokopalisce"]}><CemeteryPage/></MemoryRouter>);
    expect(screen.queryByRole("searchbox")).toBeNull();
    expect(screen.getByRole("heading", { name: "Informacije za obisk in urejanje groba." })).toBeTruthy();
    expect(screen.getByRole("link", { name: defaults.settings.phone }).getAttribute("href")).toContain("tel:");
    expect(screen.queryByText(/0 sektorjev/)).toBeNull();
  });
  it("uses the published emergency number in the water emergency panel", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => url === "/api/content"
      ? published({ settings: { ...defaults.settings, emergencyPhone: "041 111 222" } }) : Response.json({})));
    render(provider(<App/>, "/voda"));
    const phone = await screen.findByRole("link", { name: "041 111 222" });
    expect(phone.getAttribute("href")).toBe("tel:+38641111222");
    expect(screen.queryByRole("link", { name: "041 364 681" })).toBeNull();
  });
});
