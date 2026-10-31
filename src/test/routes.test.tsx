import { it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import App from "../App";

// This is a render/route contract test, not a browser layout or delivery test.
const routes = [
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
  "/admin",
  "/obvestila/narocnina",
];
for (const route of routes)
  it(`renders ${route} and keeps its internal links on supported routes`, async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.includes("/api/notices")) return Response.json({ notices: [] });
        if (url.includes("/api/bot-config"))
          return Response.json({ enabled: false });
        if (url.includes("/api/admin/session"))
          return Response.json(
            { error: "Potrebna je prijava." },
            { status: 401 },
          );
        if (url.includes("/api/subscriptions/"))
          return Response.json(
            { error: "Povezava ni veljavna." },
            { status: 400 },
          );
        return Response.json({});
      }),
    );
    render(
      <MemoryRouter initialEntries={[route]}>
        <App />
      </MemoryRouter>,
    );
    await screen.findByRole("heading", { level: 1 });
    await waitFor(() =>
      expect(screen.queryByText("Pripravljamo vsebino …")).toBeNull(),
    );
    const links = Array.from(
      document.querySelectorAll<HTMLAnchorElement>("a[href]"),
    );
    for (const link of links) {
      const href = link.getAttribute("href")!;
      if (!href.startsWith("/")) continue;
      const path = new URL(href, "https://kpv.example").pathname;
      expect(
        routes.includes(path) ||
          path.startsWith("/api/") ||
          path.startsWith("/strani/"),
        `${route}: ${href}`,
      ).toBe(true);
    }
    expect(document.querySelectorAll("main")).toHaveLength(1);
    expect(document.body.textContent).not.toMatch(
      /VZORČNI JAVNI KOŠ|VZORČNA ZBIRALNICA|Zemljevid zbirnih mest · primer/,
    );
  });
