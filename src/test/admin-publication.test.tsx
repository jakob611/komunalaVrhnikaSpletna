import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { expect, it, vi } from "vitest";
import AdminPage from "../pages/AdminPage";
import defaults from "../../shared/site-defaults.json";
import type { AdminSession } from "../components/admin/AdminSignIn";

vi.mock("../components/admin/AdminSignIn", () => ({
  default: ({
    onAuthenticated,
  }: {
    onAuthenticated: (value: AdminSession) => void;
  }) => (
    <button
      onClick={() =>
        onAuthenticated({
          authenticated: true,
          csrfToken: "renewed-fixture",
          expiresAt: "2099-01-01",
          scope: "all",
          user: { email: "editor@example.test", role: "editor" },
        })
      }
    >
      Znova prijavi testnega urednika
    </button>
  ),
}));

// jsdom does not implement the browser's modal dialog methods.
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

function backend(scope: "all" | "content" | "operations" = "all") {
  let savedDraft: object | null = null;
  const fetcher = vi.fn(async (input: string, init?: RequestInit) => {
    if (input === "/api/admin/session")
      return Response.json({
        authenticated: true,
        csrfToken: "fixture",
        scope,
        user: {
          email: "editor@example.test",
          role: "editor",
          accessScope: scope,
        },
      });
    if (input === "/api/admin/content" || input === "/api/content")
      return Response.json({
        sections: defaults,
        revisions: Object.fromEntries(
          Object.keys(defaults).map((key) => [key, 0]),
        ),
      });
    if (input.startsWith("/api/admin/drafts/")) {
      if (init?.method === "PUT") {
        const payload = JSON.parse(String(init.body));
        savedDraft = {
          value: payload.value,
          baseRevisions: payload.baseRevisions,
          revision: 1,
          savedAt: Date.now(),
        };
        return Response.json({ revision: 1, savedAt: Date.now() });
      }
      return Response.json({ draft: savedDraft });
    }
    if (input === "/api/admin/publish") {
      const payload = JSON.parse(String(init?.body));
      return Response.json({
        sections: payload.sections,
        revisions: Object.fromEntries(
          Object.keys(payload.sections).map((key) => [key, 1]),
        ),
      });
    }
    if (input.startsWith("/api/admin/work"))
      return Response.json({ items: [], stats: {}, total: 0 });
    if (input.startsWith("/api/admin/subscribers"))
      return Response.json({ items: [], counts: {}, nextCursor: null });
    if (
      input.startsWith("/api/admin/schedules") ||
      input.startsWith("/api/admin/media")
    )
      return Response.json({ items: [], nextCursor: null });
    return Response.json({});
  });
  vi.stubGlobal("fetch", fetcher);
  return fetcher;
}
const view = () =>
  render(
    <MemoryRouter>
      <AdminPage />
    </MemoryRouter>,
  );
async function navigate(name: string) {
  const nav = within(await screen.findByRole("navigation"));
  fireEvent.click(nav.getByRole("button", { name }));
  await screen.findByRole("heading", { level: 1, name });
}

it("rejects malformed JSON before replacing a usable typed editor draft", async () => {
  backend();
  view();
  await navigate("Nastavitve portala");
  fireEvent.click(screen.getByRole("button", { name: "Napredno" }));
  fireEvent.change(screen.getByLabelText("Vsebina JSON"), {
    target: { value: "{}" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Uporabi v obrazcu" }));
  expect((screen.getByLabelText("Ime portala") as HTMLInputElement).value).toBe(
    defaults.settings.siteName,
  );
  expect(screen.getByLabelText("Vsebina JSON")).toBeTruthy();
  expect(screen.queryByText("Urejevalnika ni mogoče prikazati.")).toBeNull();
  expect(
    screen
      .getAllByRole("alert")
      .some((element) => element.textContent?.includes("nastavitve")),
  ).toBe(true);
});

it("saves an unpublished private draft and recovers it after reloading the editor", async () => {
  const fetcher = backend();
  const first = view();
  await navigate("Nastavitve portala");
  fireEvent.change(screen.getByLabelText("Ime portala"), {
    target: { value: "Zasebni popravek" },
  });
  const save = screen.getByRole("button", {
    name: "Shrani osnutek",
  }) as HTMLButtonElement;
  await waitFor(() => expect(save.disabled).toBe(false));
  fireEvent.click(save);
  await screen.findByText(
    "Osnutek je zasebno shranjen za vaš račun. Javna stran ostaja nespremenjena.",
  );
  expect(
    fetcher.mock.calls.some(
      ([url, init]) =>
        url.startsWith("/api/admin/content/") && init?.method === "PUT",
    ),
  ).toBe(false);
  first.unmount();
  view();
  await navigate("Nastavitve portala");
  const reopen = await screen.findByRole("button", {
    name: "Odpri shranjeni osnutek",
  });
  fireEvent.click(reopen);
  expect((screen.getByLabelText("Ime portala") as HTMLInputElement).value).toBe(
    "Zasebni popravek",
  );
});

it("publishes the website through one transactional endpoint instead of sequential section writes", async () => {
  const fetcher = backend();
  view();
  await navigate("Urejevalnik spletne strani");
  fireEvent.click(screen.getByRole("button", { name: "3. Logotip KPV" }));
  fireEvent.change(screen.getByLabelText("Ime podjetja za bralnike zaslona"), {
    target: { value: "Komunala Vrhnika – novo ime" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Shrani in objavi" }));
  await screen.findByText("Vse spremembe spletne strani so objavljene skupaj.");
  expect(
    fetcher.mock.calls.filter(([url]) => url === "/api/admin/publish"),
  ).toHaveLength(1);
  expect(
    fetcher.mock.calls.some(
      ([url, init]) =>
        url.startsWith("/api/admin/content/") && init?.method === "PUT",
    ),
  ).toBe(false);
});

it("matches navigation to content and operations permissions and keeps a delivery path for operations staff", async () => {
  backend("content");
  const content = view();
  let nav = within(await screen.findByRole("navigation"));
  expect(nav.queryByRole("button", { name: "Delovni nalogi" })).toBeNull();
  expect(
    nav.getByRole("button", { name: "Urejevalnik spletne strani" }),
  ).toBeTruthy();
  content.unmount();
  backend("operations");
  view();
  nav = within(await screen.findByRole("navigation"));
  expect(
    nav.queryByRole("button", { name: "Urejevalnik spletne strani" }),
  ).toBeNull();
  fireEvent.click(nav.getByRole("button", { name: "Pošiljanje obvestil" }));
  await screen.findByRole("heading", {
    name: "Pošiljanje objavljenih obvestil",
  });
});

it("recovers an unsaved editorial draft after the same person signs in again following session expiry", async () => {
  const fetcher = backend();
  const original = fetcher.getMockImplementation()!;
  fetcher.mockImplementation(async (input, init) =>
    input === "/api/admin/content/settings" && init?.method === "PUT"
      ? Response.json({ error: "Prijava je potekla." }, { status: 401 })
      : original(input, init),
  );
  view();
  await navigate("Nastavitve portala");
  fireEvent.change(screen.getByLabelText("Ime portala"), {
    target: { value: "Neshranjeno delo urednika" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Shrani in objavi" }));
  fireEvent.click(
    await screen.findByRole("button", {
      name: "Znova prijavi testnega urednika",
    }),
  );
  await screen.findByText(
    "Osnutek pred potekom seje je obnovljen. Objavljene vsebine se niso spremenile.",
  );
  expect((screen.getByLabelText("Ime portala") as HTMLInputElement).value).toBe(
    "Neshranjeno delo urednika",
  );
});
