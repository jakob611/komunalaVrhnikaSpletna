import { afterEach, describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import defaults from "../../shared/site-defaults.json";
import { MarketPage, ContactPage } from "../pages/ServicePages";

const state = vi.hoisted(() => ({
  market: { dates: [] as string[], closedDates: [] as string[] },
}));
vi.mock("../content/SiteContent", async () => {
  const original = await vi.importActual<
    typeof import("../content/SiteContent")
  >("../content/SiteContent");
  return {
    ...original,
    useSiteContent: () => ({ ...defaults, market: state.market }),
  };
});
vi.mock("../components/BotProtection", () => ({
  default: () => null,
  resetProtection: vi.fn(),
}));
afterEach(() => {
  vi.useRealTimers();
  state.market = { dates: [], closedDates: [] };
});
const show = () =>
  render(
    <MemoryRouter>
      <MarketPage />
    </MemoryRouter>,
  );
function clock() {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-31T12:00:00Z"));
}

describe("market dates reflect published availability before submitting", () => {
  it("offers only future published dates and clears a selection when an admin changes them", () => {
    clock();
    state.market = {
      dates: ["2026-10-01", "2026-11-07", "2026-11-14"],
      closedDates: [],
    };
    const view = show();
    const select = screen.getByLabelText("Datum prijave") as HTMLSelectElement;
    expect(select.tagName).toBe("SELECT");
    expect([...select.options].map((option) => option.value)).toEqual([
      "",
      "2026-11-07",
      "2026-11-14",
    ]);
    fireEvent.change(select, { target: { value: "2026-11-07" } });
    state.market = { dates: ["2026-11-14"], closedDates: [] };
    view.rerender(
      <MemoryRouter>
        <MarketPage />
      </MemoryRouter>,
    );
    expect(
      (screen.getByLabelText("Datum prijave") as HTMLSelectElement).value,
    ).toBe("");
    expect(screen.getByRole("alert").textContent).toContain(
      "Termini so bili posodobljeni",
    );
  });
  it("disables registration when the published list contains no upcoming dates", () => {
    clock();
    state.market = { dates: ["2026-10-01"], closedDates: [] };
    show();
    expect(screen.getByRole("status").textContent).toContain(
      "ni objavljenih prihodnjih terminov",
    );
    expect(
      screen
        .getByRole("button", { name: "Oddaj prijavo" })
        .matches(":disabled"),
    ).toBe(true);
    // fieldset disabling is inherited rather than setting disabled on each input.
    expect(
      screen.getByLabelText("Datum prijave").closest("fieldset")?.disabled,
    ).toBe(true);
  });
  it("keeps open-date requests but rejects closed and past dates before sending any network request", () => {
    clock();
    state.market = { dates: [], closedDates: ["2026-11-07"] };
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    show();
    const field = screen.getByLabelText("Datum prijave") as HTMLInputElement;
    expect(field.type).toBe("date");
    fireEvent.change(field, { target: { value: "2026-11-07" } });
    fireEvent.submit(field.closest("form")!);
    expect(screen.getByRole("alert").textContent).toContain("ni na voljo");
    fireEvent.change(field, { target: { value: "2026-10-01" } });
    fireEvent.submit(field.closest("form")!);
    expect(screen.getByRole("alert").textContent).toContain("že pretekel");
    expect(fetcher).not.toHaveBeenCalled();
  });
});

describe("billing shortcut is a practical prefilled contact route", () => {
  it("prefills only known category and subcategory values from the URL", () => {
    render(
      <MemoryRouter
        initialEntries={[
          "/kontakt?category=billing&subcategory=invoice#kontakt-obrazec",
        ]}
      >
        <ContactPage />
      </MemoryRouter>,
    );
    expect(
      (screen.getByLabelText("Področje · obvezno") as HTMLSelectElement).value,
    ).toBe("billing");
    expect(
      (screen.getByLabelText("Kaj vas zanima? · obvezno") as HTMLSelectElement)
        .value,
    ).toBe("invoice");
    expect(
      (screen.getByLabelText("Zadeva sporočila · obvezno") as HTMLInputElement)
        .value,
    ).toBe("Računi in obračun – Vprašanje o računu");
  });
  it("ignores unknown query values", () => {
    render(
      <MemoryRouter
        initialEntries={["/kontakt?category=unknown&subcategory=invoice"]}
      >
        <ContactPage />
      </MemoryRouter>,
    );
    expect(
      (screen.getByLabelText("Področje · obvezno") as HTMLSelectElement).value,
    ).toBe("");
  });
});
