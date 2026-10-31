import { it, expect, vi } from "vitest";
import {
  render,
  screen,
  within,
  fireEvent,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import AdminPage from "../pages/AdminPage";
import defaults from "../../shared/site-defaults.json";

it("opens every administration area using a complete authenticated content response", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      if (url === "/api/admin/session")
        return Response.json({
          csrfToken: "test",
          user: { email: "owner@example.com", role: "owner" },
        });
      if (url === "/api/admin/content")
        return Response.json({
          sections: defaults,
          revisions: Object.fromEntries(
            Object.keys(defaults).map((key) => [key, 0]),
          ),
        });
      if (url.startsWith("/api/admin/work"))
        return Response.json({
          items: [],
          stats: { open: 0, new: 0, inProgress: 0, overdue: 0, resolved: 0 },
          total: 0,
        });
      if (url.startsWith("/api/admin/subscribers"))
        return Response.json({ items: [], counts: {} });
      if (url.startsWith("/api/admin/users"))
        return Response.json({ items: [] });
      if (url.startsWith("/api/admin/media"))
        return Response.json({ items: [], nextCursor: null });
      if (url.startsWith("/api/admin/notifications"))
        return Response.json({
          recipient: "owner@example.com",
          defaultRecipient: "owner@example.com",
          override: "",
          revision: 0,
          updatedAt: null,
          updatedBy: null,
          sender: "KPV",
          enabled: true,
        });
      return Response.json({});
    }),
  );
  render(
    <MemoryRouter>
      <AdminPage />
    </MemoryRouter>,
  );
  const nav = within(await screen.findByRole("navigation"));
  const areas = [
    "Delovni nalogi",
    "Dostop in skrbniki",
    "E-poštna obvestila",
    "Urejevalnik spletne strani",
    "Nastavitve portala",
    "Delovni časi",
    "Obvestila in motnje",
    "Območja e-obveščanja",
    "Ceniki in izračun",
    "Urniki odvoza",
    "Zbirna mesta",
    "Čarovnik za odpadke",
    "Vrste odpadkov",
    "Komunalne storitve",
    "Cene tržničnih stojnic",
    "Tržnica",
    "Pokopališče",
    "Datoteke",
    "Pregled",
  ];
  for (const area of areas) {
    fireEvent.click(nav.getByRole("button", { name: area }));
    const heading =
      area === "Datoteke"
        ? "Knjižnica datotek"
        : area === "Pregled"
          ? "Pregled portala"
          : area;
    await screen.findByRole("heading", { level: 1, name: heading });
    await waitFor(() =>
      expect(screen.queryByText("Nalagamo vsebino …")).toBeNull(),
    );
  }
});
