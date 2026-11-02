import { it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import SubscriptionPage from "../pages/SubscriptionPage";

function CurrentLocation() {
  const location = useLocation();
  return (
    <output data-testid="location">
      {location.pathname + location.search + location.hash}
    </output>
  );
}
function show(entry: string) {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <SubscriptionPage />
      <CurrentLocation />
    </MemoryRouter>,
  );
}

it("moves legacy query links to a fragment and sends capabilities only in POST bodies", async () => {
  const fetcher = vi.fn(async () =>
    Response.json({
      action: "manage",
      status: "active",
      address: "Verd 1, Vrhnika",
      districtId: "vrhnika",
      topics: ["water"],
    }),
  );
  vi.stubGlobal("fetch", fetcher);
  show("/obvestila/narocnina?action=manage&token=personal-secret");
  await screen.findByRole("button", { name: "Shrani nastavitve" });
  expect(screen.getByTestId("location").textContent).toBe(
    "/obvestila/narocnina#action=manage&token=personal-secret",
  );
  expect(fetcher).toHaveBeenCalled();
  for (const call of fetcher.mock.calls) {
    const [url, init] = call as unknown as [string, RequestInit];
    expect(url).toBe("/api/subscriptions/manage");
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toEqual({
      token: "personal-secret",
      action: "inspect",
    });
  }
  fireEvent.change(screen.getByLabelText("Celoten naslov"), {
    target: { value: "Verd 2, Vrhnika" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Shrani nastavitve" }));
  await waitFor(() => expect(fetcher.mock.calls.length).toBeGreaterThan(1));
  const [url, init] = fetcher.mock.calls.at(-1) as unknown as [
    string,
    RequestInit,
  ];
  expect(url).toBe("/api/subscriptions/manage");
  expect(JSON.parse(String(init.body))).toMatchObject({
    token: "personal-secret",
    address: "Verd 2, Vrhnika",
  });
});

it("a confirmation exposes a fresh management link without adding credentials to a request URL", async () => {
  const fetcher = vi.fn(async (_url: string, init: RequestInit) => {
    const data = JSON.parse(String(init.body));
    return Response.json(
      data.action === "inspect"
        ? {
            action: "confirm",
            address: "Verd 1, Vrhnika",
            districtId: "vrhnika",
            topics: ["water"],
          }
        : {
            message: "Naročnina je potrjena.",
            manageToken: "fresh-management-token",
          },
    );
  });
  vi.stubGlobal("fetch", fetcher);
  show("/obvestila/narocnina#action=confirm&token=confirmation-secret");
  fireEvent.click(
    await screen.findByRole("button", { name: "Potrdi naročnino" }),
  );
  const link = await screen.findByRole("link", {
    name: "Uredi nastavitve in naslov",
  });
  expect(link.getAttribute("href")).toBe(
    "/obvestila/narocnina#action=manage&token=fresh-management-token",
  );
  expect(
    fetcher.mock.calls.every(([url]) => url === "/api/subscriptions/confirm"),
  ).toBe(true);
});

it("unsubscribe-only links show no household fields and submit an explicit unsubscribe action", async () => {
  const fetcher = vi.fn(async (_url: string, init: RequestInit) =>
    Response.json(
      JSON.parse(String(init.body)).action === "inspect"
        ? { action: "unsubscribe", status: "active" }
        : { message: "Odjava je shranjena." },
    ),
  );
  vi.stubGlobal("fetch", fetcher);
  show("/obvestila/narocnina#action=unsubscribe&token=unsubscribe-secret");
  fireEvent.click(
    await screen.findByRole("button", { name: "Odjavi vsa e-obvestila" }),
  );
  await screen.findByText("Odjava je shranjena.");
  expect(screen.queryByLabelText("Celoten naslov")).toBeNull();
  const [url, init] = fetcher.mock.calls.at(-1)!;
  expect(url).toBe("/api/subscriptions/unsubscribe");
  expect(JSON.parse(String(init.body))).toEqual({
    token: "unsubscribe-secret",
    action: "unsubscribe",
  });
});
