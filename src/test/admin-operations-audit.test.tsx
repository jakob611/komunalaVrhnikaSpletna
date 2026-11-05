import { afterEach, it, expect, vi } from "vitest";
import { StrictMode } from "react";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  within,
  act,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import AdminPage from "../pages/AdminPage";
import type { AdminSession } from "../components/admin/AdminSignIn";
import NoticeDelivery from "../components/admin/NoticeDelivery";
import SubscriberOverview from "../components/admin/SubscriberOverview";
import PrivacyTools from "../components/admin/PrivacyTools";
import defaults from "../../shared/site-defaults.json";

const identity = vi.hoisted(() => ({ email: "owner@example.test" }));
vi.mock("../components/admin/AdminSignIn", () => ({
  default: ({
    onAuthenticated,
  }: {
    onAuthenticated: (session: AdminSession) => void;
  }) => (
    <button
      onClick={() =>
        onAuthenticated({
          authenticated: true,
          csrfToken: "renewed",
          expiresAt: "2099-01-01",
          scope: "all",
          user: { email: identity.email, role: "owner" },
        })
      }
    >
      Prijavi audit uporabnika
    </button>
  ),
}));
Object.defineProperties(HTMLDialogElement.prototype, {
  showModal: {
    configurable: true,
    value(this: HTMLDialogElement) {
      this.open = true;
    },
  },
  close: {
    configurable: true,
    value(this: HTMLDialogElement) {
      this.open = false;
    },
  },
});
afterEach(() => {
  identity.email = "owner@example.test";
  window.history.replaceState(null, "", "/");
});

function backend() {
  let item = {
    id: "KPV-one",
    kind: "contact",
    createdAt: "2026-11-01T10:00:00Z",
    status: "demo-saved",
    payload: { subject: "Audit contact", message: "Original" },
    priority: "normal",
    assignee: "",
    dueDate: "",
    version: 1,
    checklist: [],
    notes: "",
    updatedAt: "2026-11-01T10:00:00Z",
  };
  let fail = true;
  const fetcher = vi.fn(async (path: string, init?: RequestInit) => {
    if (path === "/api/admin/session")
      return Response.json({
        authenticated: true,
        csrfToken: "original",
        expiresAt: "2099-01-01",
        scope: "all",
        user: { email: "owner@example.test", role: "owner" },
      });
    if (path === "/api/admin/content" || path === "/api/content")
      return Response.json({
        sections: defaults,
        revisions: Object.fromEntries(
          Object.keys(defaults).map((key) => [key, 0]),
        ),
      });
    if (path.startsWith("/api/admin/work/")) {
      if (init?.method === "PUT") {
        if (fail) {
          fail = false;
          return Response.json({ error: "Seja je potekla." }, { status: 401 });
        }
        item = {
          ...item,
          ...JSON.parse(String(init.body)),
          version: item.version + 1,
        };
      }
      return Response.json({ item, timeline: [] });
    }
    if (path.startsWith("/api/admin/work"))
      return Response.json({
        items: [item],
        stats: { open: 1, new: 1, inProgress: 0, overdue: 0, resolved: 0 },
        total: 1,
        hasMore: false,
      });
    if (
      path.startsWith("/api/admin/media") ||
      path.startsWith("/api/admin/schedules")
    )
      return Response.json({ items: [], nextCursor: null });
    if (path.startsWith("/api/admin/drafts"))
      return Response.json({ draft: null });
    return Response.json({});
  });
  vi.stubGlobal("fetch", fetcher);
  return fetcher;
}
function view(entry = "/admin") {
  window.history.replaceState(null, "", entry);
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <AdminPage />
    </MemoryRouter>,
  );
}
async function nav(name: string) {
  fireEvent.click(
    within(await screen.findByRole("navigation")).getByRole("button", { name }),
  );
  await screen.findByRole("heading", { level: 1, name });
}

it("AO13 unsaved operational notes survive session expiry and same-person reauthentication in memory", async () => {
  const fetcher = backend();
  view("/admin?case=KPV-one");
  const notes = await screen.findByLabelText(/Interne opombe/);
  fireEvent.change(notes, {
    target: { value: "Neshranjena obravnava za isto osebo" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Shrani obravnavo" }));
  fireEvent.click(
    await screen.findByRole("button", { name: "Prijavi audit uporabnika" }),
  );
  await waitFor(() =>
    expect(
      (screen.getByLabelText(/Interne opombe/) as HTMLTextAreaElement).value,
    ).toBe("Neshranjena obravnava za isto osebo"),
  );
  fireEvent.click(screen.getByRole("button", { name: "Shrani obravnavo" }));
  await screen.findAllByText("Spremembe naloga so shranjene.");
  const writes = fetcher.mock.calls.filter(
    ([, init]) => init?.method === "PUT",
  );
  expect(writes).toHaveLength(2);
  expect(JSON.parse(String(writes[1][1]?.body)).notes).toBe(
    "Neshranjena obravnava za isto osebo",
  );
  expect(localStorage.length).toBe(0);
  expect(sessionStorage.length).toBe(0);
});

it("AO13 effect replay after reauthentication does not reload over the recovered operational draft", async () => {
  const fetcher = backend();
  const entry = "/admin?case=KPV-one";
  window.history.replaceState(null, "", entry);
  render(<StrictMode><MemoryRouter initialEntries={[entry]}><AdminPage /></MemoryRouter></StrictMode>);
  fireEvent.change(await screen.findByLabelText(/Interne opombe/), {
    target: { value: "Preserve this unsaved note across effect replay" },
  });
  fireEvent.change(screen.getByLabelText("Odgovorna oseba ali ekipa"), {
    target: { value: "Recovered maintenance team" },
  });
  fireEvent.change(screen.getByLabelText("Rok obravnave"), {
    target: { value: "2026-12-01" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Shrani obravnavo" }));
  await screen.findByRole("button", { name: "Prijavi audit uporabnika" });
  await act(async () => { await Promise.resolve(); });
  fireEvent.click(screen.getByRole("button", { name: "Prijavi audit uporabnika" }));
  await screen.findByText(/Neshranjene spremembe so obnovljene/);
  await waitFor(() => expect((screen.getByLabelText(/Interne opombe/) as HTMLTextAreaElement).value)
    .toBe("Preserve this unsaved note across effect replay"));
  expect((screen.getByLabelText("Odgovorna oseba ali ekipa") as HTMLInputElement).value).toBe("Recovered maintenance team");
  expect((screen.getByLabelText("Rok obravnave") as HTMLInputElement).value).toBe("2026-12-01");
  fireEvent.click(screen.getByRole("button", { name: "Shrani obravnavo" }));
  await screen.findAllByText("Spremembe naloga so shranjene.");
  const writes = fetcher.mock.calls.filter(([, init]) => init?.method === "PUT");
  expect(writes).toHaveLength(2);
  expect(JSON.parse(String(writes[1][1]?.body)).notes).toBe("Preserve this unsaved note across effect replay");
  expect(JSON.parse(String(writes[1][1]?.body)).assignee).toBe("Recovered maintenance team");
  expect(JSON.parse(String(writes[1][1]?.body)).dueDate).toBe("2026-12-01");
});

it("AO28 cancel retains dirty case and task values, while accepting discard releases the unload guard", async () => {
  const fetcher = backend();
  const confirmation = vi.spyOn(window, "confirm").mockReturnValue(false);
  const beforeUnload = () => {
    const event = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(event);
    return event.defaultPrevented;
  };
  try {
    view("/admin?case=KPV-one");
    fireEvent.change(await screen.findByLabelText(/Interne opombe/), { target: { value: "Dirty case note" } });
    expect(beforeUnload()).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Zapri obravnavo" }));
    expect((screen.getByLabelText(/Interne opombe/) as HTMLTextAreaElement).value).toBe("Dirty case note");
    confirmation.mockReturnValue(true);
    fireEvent.click(screen.getByRole("button", { name: "Zapri obravnavo" }));
    await waitFor(() => expect(screen.queryByLabelText(/Interne opombe/)).toBeNull());
    expect(beforeUnload()).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Nov interni nalog" }));
    fireEvent.change(screen.getByLabelText(/Naslov naloga · obvezno/), { target: { value: "Dirty task title" } });
    expect(beforeUnload()).toBe(true);
    confirmation.mockReturnValue(false);
    fireEvent.click(screen.getByRole("button", { name: "Zapri nov interni nalog" }));
    expect((screen.getByLabelText(/Naslov naloga · obvezno/) as HTMLInputElement).value).toBe("Dirty task title");
    fireEvent.click(within(screen.getByRole("navigation")).getByRole("button", { name: "Pregled" }));
    expect(screen.getByLabelText(/Naslov naloga · obvezno/)).toBeTruthy();
    confirmation.mockReturnValue(true);
    fireEvent.click(within(screen.getByRole("navigation")).getByRole("button", { name: "Pregled" }));
    await screen.findByRole("heading", { level: 1, name: "Pregled portala" });
    expect(screen.queryByLabelText(/Naslov naloga · obvezno/)).toBeNull();
    expect(beforeUnload()).toBe(false);
    expect(fetcher.mock.calls.some(([, init]) => ["PUT", "POST"].includes(init?.method || ""))).toBe(false);
  } finally {
    confirmation.mockRestore();
  }
});

it("AO29 failed case loading offers retry without leaving the case", async () => {
  const fetcher = backend(), base = fetcher.getMockImplementation()!;
  let failDetail = true;
  fetcher.mockImplementation(async (path, init) => {
    if (path === "/api/admin/work/KPV-one" && failDetail) {
      failDetail = false;
      return Response.json({ error: "Shramba nalogov trenutno ni na voljo." }, { status: 503 });
    }
    return base(path, init);
  });
  view("/admin?case=KPV-one");
  await screen.findByText("Shramba nalogov trenutno ni na voljo.");
  fireEvent.click(screen.getByRole("button", { name: "Ponovno naloži nalog" }));
  await screen.findByLabelText(/Interne opombe/);
  expect(screen.queryByText("Shramba nalogov trenutno ni na voljo.")).toBeNull();
});

it("AO29 a late 401 from a closed case does not interrupt the current session", async () => {
  const fetcher = backend(), base = fetcher.getMockImplementation()!;
  let complete!: (response: Response) => void;
  fetcher.mockImplementation(async (path, init) =>
    path === "/api/admin/work/KPV-one"
      ? new Promise<Response>(resolve => { complete = resolve; })
      : base(path, init));
  view("/admin?case=KPV-one");
  fireEvent.click(await screen.findByRole("button", { name: "Zapri obravnavo" }));
  await act(async () => complete(Response.json({ error: "Obsolete expiry" }, { status: 401 })));
  expect(screen.queryByRole("button", { name: "Prijavi audit uporabnika" })).toBeNull();
  expect(screen.getByRole("heading", { level: 1, name: "Delovni nalogi" })).toBeTruthy();
});

it("AO13 an operational draft from an expired session is never given to a different signed-in person", async () => {
  backend();
  view("/admin?case=KPV-one");
  fireEvent.change(await screen.findByLabelText(/Interne opombe/), {
    target: { value: "Private unsaved note" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Shrani obravnavo" }));
  await screen.findByRole("button", { name: "Prijavi audit uporabnika" });
  identity.email = "different@example.test";
  fireEvent.click(
    screen.getByRole("button", { name: "Prijavi audit uporabnika" }),
  );
  await waitFor(() =>
    expect(
      (screen.getByLabelText(/Interne opombe/) as HTMLTextAreaElement).value,
    ).toBe(""),
  );
  expect(document.body.textContent).not.toContain("Private unsaved note");
});

it("AO13 a new internal task retains its unsaved title, assignment and priority after same-person reauthentication", async () => {
  const fetcher = backend(),
    base = fetcher.getMockImplementation()!;
  fetcher.mockImplementation(async (path: string, init?: RequestInit) =>
    path === "/api/admin/work" && init?.method === "POST"
      ? Response.json({ error: "Seja je potekla." }, { status: 401 })
      : base(path, init),
  );
  view();
  await nav("Delovni nalogi");
  fireEvent.click(screen.getByRole("button", { name: "Nov interni nalog" }));
  fireEvent.change(screen.getByLabelText(/Naslov naloga · obvezno/), {
    target: { value: "Obnovi neshranjeni interni nalog" },
  });
  fireEvent.change(screen.getByLabelText("Prioriteta novega naloga"), {
    target: { value: "urgent" },
  });
  fireEvent.change(
    screen.getByLabelText("Odgovorna oseba ali ekipa · neobvezno"),
    { target: { value: "Ekipa za portal" } },
  );
  fireEvent.submit(
    screen.getByLabelText(/Naslov naloga · obvezno/).closest("form")!,
  );
  fireEvent.click(
    await screen.findByRole("button", { name: "Prijavi audit uporabnika" }),
  );
  await waitFor(() =>
    expect(
      (screen.getByLabelText(/Naslov naloga · obvezno/) as HTMLInputElement)
        .value,
    ).toBe("Obnovi neshranjeni interni nalog"),
  );
  expect(
    (screen.getByLabelText("Prioriteta novega naloga") as HTMLSelectElement)
      .value,
  ).toBe("urgent");
  expect(
    (
      screen.getByLabelText(
        "Odgovorna oseba ali ekipa · neobvezno",
      ) as HTMLInputElement
    ).value,
  ).toBe("Ekipa za portal");
  expect(
    fetcher.mock.calls.filter(([, init]) => init?.method === "POST"),
  ).toHaveLength(1);
});

it("AO38 direct campaign, subscriber and privacy requests ask the parent to recover an expired session", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      Response.json({ error: "Prijava je potekla." }, { status: 401 }),
    ),
  );
  const expired = vi.fn();
  const first = render(
    <NoticeDelivery
      noticeId="audit"
      revision={1}
      csrfToken="expired"
      dirty={false}
      onSessionExpired={expired}
    />,
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Preveri prejemnike in dostavo" }),
  );
  await waitFor(() => expect(expired).toHaveBeenCalledTimes(1));
  first.unmount();
  const second = render(
    <SubscriberOverview districts={[]} onSessionExpired={expired} />,
  );
  await waitFor(() => expect(expired).toHaveBeenCalledTimes(2));
  second.unmount();
  render(<PrivacyTools csrfToken="expired" onSessionExpired={expired} />);
  fireEvent.change(
    screen.getByLabelText("E-poštni naslov ali referenca oddaje"),
    { target: { value: "KPV-one" } },
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Preveri obseg izbrisa" }),
  );
  await waitFor(() => expect(expired).toHaveBeenCalledTimes(3));
});

it("AO40 a recovered notification recipient and revision survive effect replay after sign-in", async () => {
  const fetcher = backend(),
    base = fetcher.getMockImplementation()!;
  const settings = {
    recipient: "office@example.test",
    defaultRecipient: "office@example.test",
    override: "",
    revision: 2,
    updatedAt: null,
    updatedBy: null,
    sender: "portal@example.test",
    enabled: true,
  };
  let expired = false;
  let finishReload: ((response: Response) => void) | undefined;
  fetcher.mockImplementation(async (path: string, init?: RequestInit) => {
    if (path !== "/api/admin/notifications") return base(path, init);
    if (init?.method === "PUT") {
      if (!expired) {
        expired = true;
        return Response.json({ error: "Seja je potekla." }, { status: 401 });
      }
      const body = JSON.parse(String(init.body));
      return Response.json({
        ...settings,
        recipient: body.recipient,
        revision: 3,
      });
    }
    return expired
      ? new Promise<Response>(resolve => { finishReload = resolve; })
      : Response.json(settings);
  });
  render(<StrictMode><MemoryRouter><AdminPage /></MemoryRouter></StrictMode>);
  await nav("E-poštna obvestila");
  fireEvent.change(await screen.findByLabelText(/Prejemnik novih obvestil/), {
    target: { value: "new-office@example.test" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Shrani prejemnika" }));
  fireEvent.click(
    await screen.findByRole("button", { name: "Prijavi audit uporabnika" }),
  );
  await act(async () => { await Promise.resolve(); });
  await act(async () => { finishReload?.(Response.json(settings)); });
  await waitFor(() =>
    expect(
      (screen.getByLabelText(/Prejemnik novih obvestil/) as HTMLInputElement)
        .value,
    ).toBe("new-office@example.test"),
  );
  fireEvent.click(screen.getByRole("button", { name: "Shrani prejemnika" }));
  await screen.findByText(
    "Prejemnik je shranjen. Nova obvestila bodo poslana na new-office@example.test.",
  );
  const writes = fetcher.mock.calls.filter(
    ([path, init]) =>
      path === "/api/admin/notifications" && init?.method === "PUT",
  );
  expect(writes).toHaveLength(2);
  expect(
    writes.every(([, init]) => JSON.parse(String(init?.body)).revision === 2),
  ).toBe(true);
  expect(localStorage.length).toBe(0);
  expect(sessionStorage.length).toBe(0);
});

it("AO49 a website JSON export/import roundtrip accepts a valid snapshot larger than two MiB and rejects invalid files before replacing the draft", async () => {
  backend();
  view();
  await nav("Urejevalnik spletne strani");
  fireEvent.click(screen.getByRole("button", { name: "Napredno" }));
  const textarea = screen.getByLabelText("Vsebina JSON") as HTMLTextAreaElement,
    original = textarea.value;
  const picture = "https://images.example.test/" + "a".repeat(1700);
  const large = {
    copy: Array.from({ length: 40 }, (_, n) => ({
      page: "/",
      key: n.toString(16).padStart(64, "0"),
      original: `Field ${n}`,
      value: "x".repeat(20000),
    })),
    images: Array.from({ length: 200 }, (_, n) => ({
      page: "/",
      key: n.toString(16).padStart(64, "0"),
      original: `${picture}-${n}.webp`,
      url: `${picture}-${n}.webp`,
      alt: "Slika",
    })),
    links: [],
    layout: {
      pages: [
        {
          path: "/",
          title: "Naslov",
          blocks: Array.from({ length: 70 }, (_, n) => ({
            id: `block-${n}`,
            type: "text",
            tone: "plain",
            align: "left",
            width: "wide",
            hidden: false,
            title: "",
            text: "y".repeat(11000),
            links: [],
          })),
        },
      ],
      navigation: [],
    },
    settings: { ...defaults.settings, siteName: "Velik veljaven osnutek" },
  };
  const json = JSON.stringify(large);
  expect(new Blob([json]).size).toBeGreaterThan(2 * 1024 * 1024);
  const fileInput = screen.getByLabelText("Uvozi JSON") as HTMLInputElement;
  const invalid = new File(["{broken"], "invalid.json", {
    type: "application/json",
  });
  Object.defineProperty(invalid, "text", { value: async () => "{broken" });
  fireEvent.change(fileInput, { target: { files: [invalid] } });
  await screen.findAllByText(
    "Datoteka JSON ni veljavna. Trenutni osnutek je ohranjen.",
  );
  expect(textarea.value).toBe(original);
  const valid = new File([json], "website.json", { type: "application/json" });
  Object.defineProperty(valid, "text", { value: async () => json });
  fireEvent.change(fileInput, { target: { files: [valid] } });
  await waitFor(() =>
    expect(JSON.parse(textarea.value).settings.siteName).toBe(
      "Velik veljaven osnutek",
    ),
  );
  const exported: Blob[] = [];
  vi.stubGlobal(
    "URL",
    class extends URL {
      static createObjectURL(blob: Blob) {
        exported.push(blob);
        return "blob:audit";
      }
      static revokeObjectURL() {}
    },
  );
  const download = vi
    .spyOn(HTMLAnchorElement.prototype, "click")
    .mockImplementation(() => {});
  fireEvent.click(screen.getByRole("button", { name: "Izvozi JSON" }));
  expect(exported[0].size).toBeGreaterThan(2 * 1024 * 1024);
  expect((download.mock.instances[0] as HTMLAnchorElement).download).toBe(
    "kpv-website.json",
  );
  download.mockRestore();
  fireEvent.click(screen.getByRole("button", { name: "Uporabi v obrazcu" }));
  await screen.findByText(
    "Podatki so preneseni v obrazec. Pred objavo jih preglejte in shranite.",
  );
  fireEvent.click(screen.getByRole("button", { name: "Napredno" }));
  expect(
    JSON.parse(
      (screen.getByLabelText("Vsebina JSON") as HTMLTextAreaElement).value,
    ).settings.siteName,
  ).toBe("Velik veljaven osnutek");
});

it("AO30 subscriber controls reach older pages, return to previous pages and reset pagination for search and district changes", async () => {
  const rows = Array.from({ length: 75 }, (_, index) => ({
    email: `reader${String(74 - index).padStart(3, "0")}@example.test`,
    address: `Verd ${74 - index}, Vrhnika`,
    district_id: "vrhnika",
    status: "active",
    topics: ["water"],
  }));
  const fetcher = vi.fn(async (path: string) => {
    const params = new URL(path, "https://audit.example").searchParams,
      district = params.get("district") || "",
      q = params.get("q") || "",
      cursor = params.get("cursor") || "";
    const inDistrict = rows.filter(
        (row) => !district || row.district_id === district,
      ),
      matches = inDistrict.filter(
        (row) => !q || row.email.includes(q) || row.address.includes(q),
      ),
      start = cursor ? 50 : 0;
    return Response.json({
      items: matches.slice(start, start + 50),
      counts: { active: inDistrict.length },
      nextCursor: matches.length > start + 50 ? "777:sub-025" : null,
    });
  });
  vi.stubGlobal("fetch", fetcher);
  render(
    <SubscriberOverview
      districts={[
        { id: "vrhnika", name: "Vrhnika", description: "", active: true },
        { id: "borovnica", name: "Borovnica", description: "", active: true },
      ]}
    />,
  );
  await screen.findByText("reader074@example.test");
  expect(
    (
      screen.getByRole("button", {
        name: "Prejšnja stran naročnikov",
      }) as HTMLButtonElement
    ).disabled,
  ).toBe(true);
  fireEvent.click(
    screen.getByRole("button", { name: "Naslednja stran naročnikov" }),
  );
  await screen.findByText("reader024@example.test");
  expect(screen.queryByText("reader074@example.test")).toBeNull();
  expect(
    (
      screen.getByRole("button", {
        name: "Naslednja stran naročnikov",
      }) as HTMLButtonElement
    ).disabled,
  ).toBe(true);
  fireEvent.click(
    screen.getByRole("button", { name: "Prejšnja stran naročnikov" }),
  );
  await screen.findByText("reader074@example.test");
  fireEvent.click(
    screen.getByRole("button", { name: "Naslednja stran naročnikov" }),
  );
  await screen.findByText("reader024@example.test");
  fireEvent.change(
    screen.getByLabelText("Išči naročnike po e-pošti ali naslovu"),
    { target: { value: "reader050@example.test" } },
  );
  await waitFor(() => {
    const filteredParams = new URL(
      fetcher.mock.calls.at(-1)![0],
      "https://audit.example",
    ).searchParams;
    expect(filteredParams.get("q")).toBe("reader050@example.test");
    expect(filteredParams.get("cursor")).toBe("");
    expect(screen.getAllByRole("article")).toHaveLength(1);
    expect(screen.getByText("reader050@example.test")).toBeTruthy();
    expect(screen.getByText(/^Stran 1 · prikazanih 1 naročnikov/)).toBeTruthy();
  });
  expect(screen.getByText(/Za izbrano območje skupaj/).textContent).toContain(
    "potrjenih 75",
  );
  let params = new URL(fetcher.mock.calls.at(-1)![0], "https://audit.example")
    .searchParams;
  expect(params.get("cursor")).toBe("");
  expect(params.get("q")).toBe("reader050@example.test");
  fireEvent.change(screen.getByLabelText("Območje naročnikov"), {
    target: { value: "borovnica" },
  });
  await screen.findByText("Za izbrane pogoje ni naročnikov.");
  params = new URL(fetcher.mock.calls.at(-1)![0], "https://audit.example")
    .searchParams;
  expect(params.get("cursor")).toBe("");
  expect(params.get("district")).toBe("borovnica");
});

it("AO30 initial and whitespace-only search debounce never reset a quickly selected older page", async () => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  try {
    const row = (email: string) => ({
      email,
      address: "Verd 1, Vrhnika",
      district_id: "vrhnika",
      status: "active",
      topics: ["water"],
    });
    const first = Array.from({ length: 50 }, (_, index) =>
      row(`reader${index}@example.test`),
    );
    const fetcher = vi.fn(async (path: string) =>
      new URL(path, "https://audit.example").searchParams.get("cursor")
        ? Response.json({
            items: [row("older@example.test")],
            counts: { active: 51 },
            nextCursor: null,
          })
        : Response.json({
            items: first,
            counts: { active: 51 },
            nextCursor: "777:first-page",
          }),
    );
    vi.stubGlobal("fetch", fetcher);
    render(<SubscriberOverview districts={[]} />);
    await act(async () => {});
    expect(screen.getByText("reader0@example.test")).toBeTruthy();
    fireEvent.click(
      screen.getByRole("button", { name: "Naslednja stran naročnikov" }),
    );
    await act(async () => {});
    expect(screen.getByText("older@example.test")).toBeTruthy();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
    expect(screen.getByText("older@example.test")).toBeTruthy();
    expect(screen.getByText(/^Stran 2/)).toBeTruthy();
    expect(fetcher).toHaveBeenCalledTimes(2);
    fireEvent.change(
      screen.getByLabelText("Išči naročnike po e-pošti ali naslovu"),
      { target: { value: "   " } },
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
    expect(screen.getByText("older@example.test")).toBeTruthy();
    expect(screen.getByText(/^Stran 2/)).toBeTruthy();
    expect(fetcher).toHaveBeenCalledTimes(2);
  } finally {
    vi.useRealTimers();
  }
});

it("AO32 campaign preview explicitly states that final recipients can change before queueing", () => {
  render(
    <NoticeDelivery
      noticeId="audit"
      revision={1}
      csrfToken="audit"
      dirty={false}
    />,
  );
  expect(
    screen.getByText(/Število v predogledu je trenutno stanje/).textContent,
  ).toContain("lahko spremenijo končno število");
});

it("AO10 explicit logout with an already expired session discards unsaved recovery before the same person signs in again", async () => {
  const fetcher = backend(),
    base = fetcher.getMockImplementation()!;
  fetcher.mockImplementation(async (path: string, init?: RequestInit) =>
    path === "/api/admin/logout"
      ? Response.json({ error: "Seja je že potekla." }, { status: 401 })
      : base(path, init),
  );
  const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
  try {
    view();
    await nav("Delovni nalogi");
    fireEvent.click(screen.getByRole("button", { name: "Nov interni nalog" }));
    fireEvent.change(screen.getByLabelText(/Naslov naloga · obvezno/), {
      target: { value: "Zavrženi osnutek ob odjavi" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Odjava" }));
    await screen.findByText(
      "Seja je že potekla. Lokalno ste odjavljeni; neshranjeni osnutki so zavrženi.",
    );
    expect(confirm).toHaveBeenCalled();
    fireEvent.click(
      screen.getByRole("button", { name: "Prijavi audit uporabnika" }),
    );
    await nav("Delovni nalogi");
    expect(screen.queryByLabelText(/Naslov naloga · obvezno/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Nov interni nalog" }));
    expect(
      (screen.getByLabelText(/Naslov naloga · obvezno/) as HTMLInputElement)
        .value,
    ).toBe("");
  } finally {
    confirm.mockRestore();
  }
});

it.each(["unavailable", "network"] as const)(
  "AO10 logout %s failure keeps the authenticated view and unsaved work without a false sign-out confirmation",
  async (failure) => {
    const fetcher = backend(),
      base = fetcher.getMockImplementation()!;
    fetcher.mockImplementation(async (path: string, init?: RequestInit) => {
      if (path !== "/api/admin/logout") return base(path, init);
      if (failure === "network")
        throw new TypeError("Network unavailable during logout");
      return Response.json(
        { error: "Odjava trenutno ni dosegljiva." },
        { status: 503 },
      );
    });
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    try {
      view();
      await nav("Delovni nalogi");
      fireEvent.click(
        screen.getByRole("button", { name: "Nov interni nalog" }),
      );
      fireEvent.change(screen.getByLabelText(/Naslov naloga · obvezno/), {
        target: { value: "Osnutek ostane ob izpadu" },
      });
      fireEvent.click(screen.getByRole("button", { name: "Odjava" }));
      await screen.findByText(
        failure === "network"
          ? "Network unavailable during logout"
          : "Odjava trenutno ni dosegljiva.",
      );
      expect(
        screen.queryByRole("button", { name: "Prijavi audit uporabnika" }),
      ).toBeNull();
      expect(
        (screen.getByLabelText(/Naslov naloga · obvezno/) as HTMLInputElement)
          .value,
      ).toBe("Osnutek ostane ob izpadu");
      expect(
        screen.queryByText(/Varno ste se odjavili|Lokalno ste odjavljeni/),
      ).toBeNull();
    } finally {
      confirm.mockRestore();
    }
  },
);
