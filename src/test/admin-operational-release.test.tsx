import { it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import PrivacyTools from "../components/admin/PrivacyTools";
import ScheduledPublications from "../components/admin/ScheduledPublications";
import NoticeDelivery from "../components/admin/NoticeDelivery";
import AdminPage from "../pages/AdminPage";
import { MemoryRouter } from "react-router-dom";
import defaults from "../../shared/site-defaults.json";

const review = {
  counts: { submissions: 1, photos: 0 },
  confirmationToken: "synthetic-review-token",
  scopeNote: "Poslana pošta in varnostne kopije niso del tega izbrisa.",
};
async function preview() {
  fireEvent.change(
    screen.getByLabelText("E-poštni naslov ali referenca oddaje"),
    { target: { value: "KPV-audit" } },
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Preveri obseg izbrisa" }),
  );
  await screen.findByText("Predogled izbrisa");
}

it("privacy refresh failure invalidates the previous destructive confirmation and a fresh review starts unchecked", async () => {
  let requests = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      ++requests === 2
        ? Response.json(
            { error: "Shramba trenutno ni dosegljiva." },
            { status: 503 },
          )
        : Response.json(review),
    ),
  );
  render(<PrivacyTools csrfToken="test" />);
  await preview();
  await screen.findByText(review.scopeNote);
  fireEvent.click(screen.getByRole("checkbox"));
  expect((screen.getByRole("checkbox") as HTMLInputElement).checked).toBe(true);
  fireEvent.click(
    screen.getByRole("button", { name: "Preveri obseg izbrisa" }),
  );
  await screen.findByRole("alert");
  expect(
    screen.queryByRole("button", {
      name: "Trajno izbriši preverjene evidence",
    }),
  ).toBeNull();
  fireEvent.click(
    screen.getByRole("button", { name: "Preveri obseg izbrisa" }),
  );
  await screen.findByText("Predogled izbrisa");
  expect((screen.getByRole("checkbox") as HTMLInputElement).checked).toBe(
    false,
  );
});

it("failed erasure retains the entered reference but requires a fresh preview before another destructive request", async () => {
  const fetcher = vi.fn(async (path: string) =>
    path.endsWith("/erase")
      ? Response.json(
          { error: "Ponovno preverite obseg izbrisa." },
          { status: 409 },
        )
      : Response.json(review),
  );
  vi.stubGlobal("fetch", fetcher);
  render(<PrivacyTools csrfToken="test" />);
  await preview();
  fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.click(
    screen.getByRole("button", { name: "Trajno izbriši preverjene evidence" }),
  );
  await screen.findByText("Ponovno preverite obseg izbrisa.");
  expect(
    (
      screen.getByLabelText(
        "E-poštni naslov ali referenca oddaje",
      ) as HTMLInputElement
    ).value,
  ).toBe("KPV-audit");
  expect(
    screen.queryByRole("button", {
      name: "Trajno izbriši preverjene evidence",
    }),
  ).toBeNull();
  expect(
    fetcher.mock.calls.filter(([path]) => path.endsWith("/erase")),
  ).toHaveLength(1);
});

it("schedule status refresh removes stale cancellation actions on failure and can recover to the completed state without sending mutations", async () => {
  const item = {
    id: "audit-plan",
    section: "market",
    publishOn: "2099-01-01",
    status: "pending",
    createdBy: "owner@example.test",
  };
  let reads = 0;
  const transport = vi.fn(async (_path: string, _init?: RequestInit) => {
    reads++;
    if (reads === 2) throw Error("Pregled načrtov trenutno ni dosegljiv.");
    return {
      items: [{ ...item, status: reads > 2 ? "published" : "pending" }],
    };
  });
  const call = <T,>(path: string, init?: RequestInit) =>
    transport(path, init) as Promise<T>;
  render(
    <ScheduledPublications
      section="market"
      value={{ dates: [], closedDates: [] }}
      revisions={{ market: 0 }}
      call={call}
      disabled={false}
      dirty={false}
      user="owner@example.test"
      owner
    />,
  );
  fireEvent.click(screen.getByText("Načrtovana objava tega področja"));
  await screen.findByText(/2099-01-01 · Čaka na datum/);
  fireEvent.click(
    screen.getByRole("button", { name: "Osveži načrtovane objave" }),
  );
  await screen.findByRole("alert");
  expect(
    screen.queryByRole("button", { name: "Prekliči načrtovano objavo" }),
  ).toBeNull();
  fireEvent.click(
    screen.getByRole("button", { name: "Osveži načrtovane objave" }),
  );
  await screen.findByText(/2099-01-01 · Objavljeno/);
  expect(
    screen.queryByRole("button", { name: "Prekliči načrtovano objavo" }),
  ).toBeNull();
  expect(transport).toHaveBeenCalledTimes(3);
  expect(
    transport.mock.calls.every(
      ([, init]) => !init?.method || init.method === "GET",
    ),
  ).toBe(true);
});

it("an empty schedule list explicitly explains its empty state", async () => {
  const call = async <T,>() => ({ items: [] }) as T;
  render(
    <ScheduledPublications
      section="market"
      value={{ dates: [], closedDates: [] }}
      revisions={{ market: 0 }}
      call={call}
      disabled={false}
      dirty={false}
      user="owner@example.test"
      owner
    />,
  );
  await screen.findByText("Za to področje še ni načrtovanih objav.");
});

it.each(["cancelled", "complete"])(
  "a %s campaign explains terminal failed deliveries without offering duplicate sending",
  async (status) => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          recipients: 3,
          alreadyQueued: true,
          status,
          deliveries: { failed: 2, sent: 1, pending: 0 },
        }),
      ),
    );
    render(
      <NoticeDelivery
        noticeId="notice"
        revision={1}
        csrfToken="test"
        dirty={false}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Preveri prejemnike in dostavo" }),
    );
    await screen.findByText(
      /Neuspešne ali preklicane dostave niso ponovno poslane/,
    );
    expect(
      screen.queryByRole("button", { name: /Potrdi pošiljanje/ }),
    ).toBeNull();
    if (status === "cancelled")
      expect(
        screen.getByText(/Pošiljanje te različice je preklicano/),
      ).toBeTruthy();
  },
);

it("zero campaign recipients explains the missing prerequisites and cannot dispatch", async () => {
  const fetcher = vi.fn(async () =>
    Response.json({
      recipients: 0,
      alreadyQueued: false,
      status: null,
      deliveries: {},
    }),
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
  fireEvent.click(
    screen.getByRole("button", { name: "Preveri prejemnike in dostavo" }),
  );
  await screen.findByText(
    /Za izbrano temo, območja in naslove ni potrjenih prejemnikov/,
  );
  const button = screen.getByRole("button", {
    name: "Potrdi pošiljanje za 0 naročnikov",
  });
  expect((button as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(button);
  await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
});

it("an empty privacy scope explains no matching data and offers no destructive action", async () => {
  const fetcher = vi.fn(async () =>
    Response.json({
      ...review,
      counts: { submissions: 0, photos: 0, subscribers: 0 },
    }),
  );
  vi.stubGlobal("fetch", fetcher);
  render(<PrivacyTools csrfToken="test" />);
  await preview();
  await screen.findByText(
    "Za vneseni naslov ali referenco ni evidenc za izbris. Preverite vnos.",
  );
  expect(screen.queryByRole("checkbox")).toBeNull();
  expect(
    screen.queryByRole("button", {
      name: "Trajno izbriši preverjene evidence",
    }),
  ).toBeNull();
  expect(fetcher).toHaveBeenCalledTimes(1);
});

it("operations-only staff can inspect paginated subscribers and their topics from the campaign menu without receiving content-editor controls", async () => {
  const fetcher = vi.fn(async (path: string) => {
    if (path === "/api/admin/session")
      return Response.json({
        authenticated: true,
        csrfToken: "ops",
        expiresAt: "2099-01-01",
        scope: "operations",
        user: {
          email: "operator@example.test",
          role: "editor",
          accessScope: "operations",
        },
      });
    if (path === "/api/content")
      return Response.json({ sections: defaults, revisions: { notices: 0 } });
    if (path.startsWith("/api/admin/work"))
      return Response.json({ items: [], stats: {}, total: 0, hasMore: false });
    if (path.startsWith("/api/admin/subscribers"))
      return Response.json({
        items: [
          {
            email: "reader@example.test",
            address: "Verd 1, Vrhnika",
            district_id: "vrhnika",
            status: "active",
            topics: ["water"],
          },
        ],
        counts: { active: 1, suppressed: 2 },
        nextCursor: null,
      });
    return Response.json({});
  });
  vi.stubGlobal("fetch", fetcher);
  render(
    <MemoryRouter initialEntries={["/admin"]}>
      <AdminPage />
    </MemoryRouter>,
  );
  fireEvent.click(
    await screen.findByRole("button", { name: "Pošiljanje obvestil" }),
  );
  await screen.findByText("reader@example.test");
  expect(screen.getByText("Teme: Voda in kanalizacija")).toBeTruthy();
  expect(screen.getByLabelText("Območje naročnikov").textContent).toContain(
    "Vrhnika",
  );
  expect(screen.getByText(/Pošiljanje ustavljeno: 2/)).toBeTruthy();
  expect(
    screen.queryByRole("button", { name: "Urejevalnik spletne strani" }),
  ).toBeNull();
  expect(screen.queryByRole("button", { name: "Osebni podatki" })).toBeNull();
  expect(
    fetcher.mock.calls.some(([path]) => path === "/api/admin/content"),
  ).toBe(false);
});
