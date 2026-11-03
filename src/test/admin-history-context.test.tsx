import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { expect, it, vi } from "vitest";
import AdminPage from "../pages/AdminPage";
import defaults from "../../shared/site-defaults.json";

Object.defineProperties(HTMLDialogElement.prototype, {
  showModal: { configurable: true, value(this: HTMLDialogElement) { this.open = true; } },
  close: { configurable: true, value(this: HTMLDialogElement) { this.open = false; } },
});

it("binds history labels and restoration to the fetched section despite a late selector change", async () => {
  let finish!: (response: Response) => void;
  const fetcher = vi.fn(async (url: string, _init?: RequestInit): Promise<Response> => {
    if (url === "/api/admin/session") return Response.json({ authenticated: true, csrfToken: "fixture", scope: "content", user: { email: "editor@example.test", role: "editor", accessScope: "content" } });
    if (url === "/api/admin/content") return Response.json({ sections: defaults, revisions: { ...Object.fromEntries(Object.keys(defaults).map(key => [key, 1])), copy: 4, images: 9 } });
    if (url === "/api/admin/history/copy") return new Promise(resolve => { finish = resolve; });
    if (url.startsWith("/api/admin/restore/")) return Response.json({ revision: 3, value: [] });
    return Response.json({ items: [], draft: null });
  });
  vi.stubGlobal("fetch", fetcher);
  vi.spyOn(window, "confirm").mockReturnValue(true);
  render(<MemoryRouter><AdminPage/></MemoryRouter>);
  fireEvent.click(within(await screen.findByRole("navigation")).getByRole("button", { name: "Urejevalnik spletne strani" }));
  const selector = await screen.findByLabelText("Zgodovina področja") as HTMLSelectElement;
  fireEvent.click(screen.getByRole("button", { name: "Zgodovina" }));
  expect(selector.disabled).toBe(true);
  // A late change event cannot relabel an already requested history snapshot.
  fireEvent.change(selector, { target: { value: "images" } });
  await act(async () => finish(Response.json({ items: [{ revision: 2, createdAt: "2026-11-01T12:00:00Z", value: [{ page: "/", value: "Historical copy" }] }] })));
  expect(screen.getByRole("dialog", { name: "Zgodovina · Besedila na straneh" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Obnovi" }));
  const restored = fetcher.mock.calls.find(([url]) => url.startsWith("/api/admin/restore/"))!;
  expect(restored[0]).toBe("/api/admin/restore/copy");
  expect(JSON.parse(String(restored[1]?.body))).toEqual({ revision: 2, currentRevision: 4 });
});

it.each([false, true])("adopts the successfully saved private draft (server-normalized response: %s)", async serverValue => {
  const fetcher = vi.fn(async (url: string, _init?: RequestInit): Promise<Response> => {
    if (url === "/api/admin/session") return Response.json({ authenticated: true, csrfToken: "fixture", scope: "content", user: { email: "editor@example.test", role: "editor", accessScope: "content" } });
    if (url === "/api/admin/content") return Response.json({ sections: defaults, revisions: {} });
    if (url === "/api/admin/drafts/settings" && _init?.method === "PUT") return Response.json({ revision: 1, savedAt: Date.now(), ...(serverValue ? {value: {...defaults.settings, siteName: "Ime s strežnika"}} : {}) });
    return Response.json({ items: [], draft: null });
  });
  vi.stubGlobal("fetch", fetcher);
  render(<MemoryRouter><AdminPage/></MemoryRouter>);
  fireEvent.click(within(await screen.findByRole("navigation")).getByRole("button", { name: "Nastavitve portala" }));
  const name = await screen.findByLabelText("Ime portala") as HTMLInputElement;
  fireEvent.change(name, { target: { value: "  Urejeno ime  " } });
  const save = screen.getByRole("button", { name: "Shrani osnutek" });
  await waitFor(() => expect(save.matches(":disabled")).toBe(false));
  fireEvent.click(save);
  await screen.findByText("Osnutek je zasebno shranjen za vaš račun. Javna stran ostaja nespremenjena.");
  const sent = fetcher.mock.calls.find(([url, init]) => url === "/api/admin/drafts/settings" && init?.method === "PUT")!;
  expect(JSON.parse(String(sent[1]?.body)).value.siteName).toBe("Urejeno ime");
  expect(name.value).toBe(serverValue ? "Ime s strežnika" : "Urejeno ime");
  expect(screen.queryByText("Neshranjene spremembe")).toBeNull();
  expect(screen.getByText("Osnutek je shranjen; še ni objavljen")).toBeTruthy();
});

it("does not overwrite a newer working copy when a private-save response completes", async () => {
  let finish!: (response: Response) => void;
  vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit): Promise<Response> => {
    if (url === "/api/admin/session") return Response.json({ authenticated: true, csrfToken: "fixture", scope: "content", user: { email: "editor@example.test", role: "editor", accessScope: "content" } });
    if (url === "/api/admin/content") return Response.json({ sections: defaults, revisions: {} });
    if (url === "/api/admin/drafts/settings" && init?.method === "PUT") return new Promise(resolve => { finish = resolve; });
    return Response.json({ items: [], draft: null });
  }));
  render(<MemoryRouter><AdminPage/></MemoryRouter>);
  fireEvent.click(within(await screen.findByRole("navigation")).getByRole("button", { name: "Nastavitve portala" }));
  const name = await screen.findByLabelText("Ime portala") as HTMLInputElement;
  fireEvent.change(name, { target: { value: "  Shranjeni posnetek  " } });
  const save = screen.getByRole("button", { name: "Shrani osnutek" });
  await waitFor(() => expect(save.matches(":disabled")).toBe(false));
  fireEvent.click(save);
  expect(name.matches(":disabled")).toBe(true);
  // Simulate an already dispatched update completing after controls were locked.
  fireEvent.change(name, { target: { value: "Poznejši popravek" } });
  await act(async () => finish(Response.json({ revision: 1, savedAt: Date.now() })));
  expect(name.value).toBe("Poznejši popravek");
  expect(screen.getByText("Neshranjene spremembe")).toBeTruthy();
  expect(screen.queryByText("Osnutek je shranjen; še ni objavljen")).toBeNull();
});
