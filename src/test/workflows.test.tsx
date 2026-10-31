import { useState } from "react";
import { MemoryRouter } from "react-router-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { CalendarDialog } from "../components/CalendarDialog";
import UtilityCalculator from "../components/UtilityCalculator";
import CemeteryEditor from "../components/admin/CemeteryEditor";
import NoticeDelivery from "../components/admin/NoticeDelivery";
import WorkQueue from "../components/admin/WorkQueue";
import type { CemeteryData } from "../data/cemetery";

describe("citizen workflows", () => {
  it("offers one date directly and a finite published series with explicit import instructions", () => {
    const events = [
      {
        id: "one",
        date: "2026-11-03",
        type: "bio",
        label: "Biološki odpadki",
        color: "#234",
      },
      {
        id: "two",
        date: "2026-11-17",
        type: "bio",
        label: "Biološki odpadki",
        color: "#234",
      },
      {
        id: "other",
        date: "2026-11-10",
        type: "packaging",
        label: "Embalaža",
        color: "#432",
      },
    ];
    render(
      <CalendarDialog
        event={events[0]}
        events={events}
        address="Verd 12, Vrhnika"
        onClose={() => {}}
      />,
    );
    expect(
      screen.getByRole("link", { name: /Odpri Google/ }).getAttribute("href"),
    ).toContain("calendar.google.com");
    fireEvent.click(screen.getByLabelText(/Ponavljajoči se odvozi/));
    const link = screen.getByRole("link", { name: /Prenesi ponavljajoče/ });
    const url = new URL(link.getAttribute("href")!, "https://kpv.example");
    expect(url.searchParams.get("repeat")).toBe("published");
    expect(url.searchParams.get("date")).toBe("2026-11-03");
    expect(screen.getByText(/Za več datumov prenesite/)).toBeTruthy();
    expect(screen.queryByText("Embalaža")).toBeNull();
  });
  it("calculates from household input and clears an obsolete result when the municipality changes", () => {
    render(
      <MemoryRouter>
        <UtilityCalculator />
      </MemoryRouter>,
    );
    fireEvent.change(screen.getByLabelText(/Občina odjemnega mesta/), {
      target: { value: "vrhnika" },
    });
    fireEvent.change(screen.getByLabelText(/Mesečna poraba vode/), {
      target: { value: "12" },
    });
    fireEvent.change(screen.getByLabelText(/Število oseb za obračun/), {
      target: { value: "3" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Izračunaj mesečni/ }));
    expect(screen.getByRole("table", { name: /Razčlenitev/ })).toBeTruthy();
    expect(screen.getByText("Vodarina")).toBeTruthy();
    fireEvent.change(screen.getByLabelText(/Občina odjemnega mesta/), {
      target: { value: "borovnica" },
    });
    expect(screen.queryByRole("table")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Izračunaj mesečni/ }));
    expect(screen.getByText(/OCENA ZA EN CEL MESEC · Borovnica/)).toBeTruthy();
  });
});

describe("admin workflows", () => {
  it("cancels cemetery background changes without mutating records or leaving misleading dimensions", () => {
    const value: CemeteryData = {
      plan: { width: 1000, height: 1000, imageUrl: null },
      graves: [
        {
          id: "A-1-1",
          section: "A",
          row: 1,
          number: 1,
          x: 100,
          y: 100,
          positioned: true,
          people: [],
        },
      ],
    };
    const changed = vi.fn();
    render(<CemeteryEditor value={value} onChange={changed} />);
    const width = screen.getByLabelText("Širina") as HTMLInputElement;
    fireEvent.change(width, { target: { value: "900" } });
    fireEvent.blur(width);
    expect(width.value).toBe("1000");
    fireEvent.click(
      screen.getByRole("button", { name: "Prekliči menjavo načrta" }),
    );
    expect(changed).not.toHaveBeenCalled();
    fireEvent.click(
      screen.getByRole("button", { name: "Uporabi orientacijski osnutek" }),
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: "Zamenjaj in umakni položaje do preverjanja",
      }),
    );
    expect(changed).toHaveBeenCalledOnce();
    expect(changed.mock.calls[0][0].graves[0].positioned).toBe(false);
    expect(changed.mock.calls[0][0].graves[0].id).toBe("A-1-1");
  });
  it("adds sector, row, empty grave and multiple people without requiring invented dates", () => {
    let latest: CemeteryData = {
      plan: { width: 3000, height: 3060, imageUrl: null },
      graves: [],
    };
    function Editor() {
      const [data, setData] = useState(latest);
      return (
        <CemeteryEditor
          value={data}
          onChange={(next) => {
            latest = next;
            setData(next);
          }}
        />
      );
    }
    render(<Editor />);
    fireEvent.change(screen.getByLabelText("Oznaka novega sektorja"), {
      target: { value: "A" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Dodaj sektor" }));
    fireEvent.click(screen.getByRole("button", { name: "Dodaj vrsto" }));
    fireEvent.click(screen.getByRole("button", { name: /Dodaj grob/ }));
    expect(latest.graves).toHaveLength(1);
    expect(latest.graves[0].positioned).toBe(false);
    const plot = latest.graves[0];
    fireEvent.click(screen.getByRole("button", { name: new RegExp(plot.id) }));
    fireEvent.click(
      screen.getByRole("button", { name: "Dodaj osebo v ta grob" }),
    );
    fireEvent.change(screen.getByLabelText("Ime in priimek"), {
      target: { value: "Preizkusna oseba" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Dodaj osebo v ta grob" }),
    );
    expect(latest.graves[0].people).toHaveLength(2);
    expect(latest.graves[0].people[0]).toEqual({
      name: "Preizkusna oseba",
      born: "",
      died: "",
    });
  });
  it("removes stale audience confirmation when preview refresh fails", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({
          recipients: 3,
          alreadyQueued: false,
          status: null,
          deliveries: {},
        }),
      )
      .mockResolvedValueOnce(
        Response.json({ error: "Povezava ni uspela." }, { status: 503 }),
      );
    vi.stubGlobal("fetch", fetcher);
    render(
      <NoticeDelivery
        noticeId="notice"
        revision={1}
        csrfToken="test"
        dirty={false}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Preveri prejemnike/ }));
    await screen.findByRole("button", { name: /Potrdi pošiljanje za 3/ });
    fireEvent.click(screen.getByRole("button", { name: /Preveri prejemnike/ }));
    await screen.findByRole("alert");
    expect(
      screen.queryByRole("button", { name: /Potrdi pošiljanje/ }),
    ).toBeNull();
  });
  it("combines work-order type and state filters and never leaves old rows after a failed load", async () => {
    const item = {
      id: "KPV-one",
      kind: "contact",
      createdAt: new Date().toISOString(),
      status: "demo-saved",
      payload: { subject: "Vidna začetna oddaja" },
      priority: "normal",
      assignee: "",
      dueDate: "",
      version: 1,
      checklist: [],
      notes: "",
      updatedAt: new Date().toISOString(),
    };
    const fetcher = vi.fn(async (url: string) =>
      url.includes("kind=reports")
        ? Response.json({ error: "Preizkus izpada." }, { status: 503 })
        : Response.json({
            items: [item],
            stats: { open: 1, new: 1, inProgress: 0, overdue: 0, resolved: 0 },
            total: 1,
          }),
    );
    vi.stubGlobal("fetch", fetcher);
    render(
      <MemoryRouter>
        <WorkQueue csrfToken="test" onSessionExpired={() => {}} />
      </MemoryRouter>,
    );
    await screen.findByText("Vidna začetna oddaja");
    fireEvent.change(screen.getByLabelText("Vrsta naloga"), {
      target: { value: "reports" },
    });
    await screen.findByText("Preizkus izpada.");
    expect(screen.queryByText("Vidna začetna oddaja")).toBeNull();
    await waitFor(() =>
      expect(
        fetcher.mock.calls.some(
          ([url]) =>
            new URL(url, "https://kpv.example").searchParams.get("kind") ===
              "reports" &&
            new URL(url, "https://kpv.example").searchParams.get("status") ===
              "open",
        ),
      ).toBe(true),
    );
  });
});
