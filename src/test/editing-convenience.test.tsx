import { useState } from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { it, expect, vi } from "vitest";
import { ContactPage } from "../pages/ServicePages";
import TariffsEditor from "../components/admin/TariffsEditor";
import defaults from "../../shared/site-defaults.json";
import type { TariffData } from "../../shared/utility-pricing.js";

vi.mock("../components/BotProtection", () => ({
  default: () => null,
  resetProtection: vi.fn(),
}));

it("keeps a visitor-written contact subject while category and suggested topics change", () => {
  render(
    <MemoryRouter
      initialEntries={["/kontakt?category=billing&subcategory=invoice"]}
    >
      <ContactPage />
    </MemoryRouter>,
  );
  const subject = screen.getByLabelText(
    "Zadeva sporočila · obvezno",
  ) as HTMLInputElement;
  fireEvent.change(subject, {
    target: { value: "Račun 123: napačna poraba za oktober" },
  });
  fireEvent.change(screen.getByLabelText("Kaj vas zanima? · obvezno"), {
    target: { value: "meter" },
  });
  expect(subject.value).toBe("Račun 123: napačna poraba za oktober");
  fireEvent.change(screen.getByLabelText("Področje · obvezno"), {
    target: { value: "water" },
  });
  expect(subject.value).toBe("Račun 123: napačna poraba za oktober");
  fireEvent.change(screen.getByLabelText("Področje · obvezno"), {
    target: { value: "other" },
  });
  expect(subject.value).toBe("Račun 123: napačna poraba za oktober");
});

it("still updates the suggested contact subject when the visitor has not edited it", () => {
  render(
    <MemoryRouter
      initialEntries={["/kontakt?category=billing&subcategory=invoice"]}
    >
      <ContactPage />
    </MemoryRouter>,
  );
  fireEvent.change(screen.getByLabelText("Kaj vas zanima? · obvezno"), {
    target: { value: "meter" },
  });
  expect(
    (screen.getByLabelText("Zadeva sporočila · obvezno") as HTMLInputElement)
      .value,
  ).toBe("Računi in obračun – Vodomer in poraba");
});

it("lets an admin clear and replace a tariff without committing an accidental zero", () => {
  let latest = structuredClone(defaults.tariffs) as TariffData;
  function Editor() {
    const [data, setData] = useState(latest);
    return (
      <TariffsEditor
        value={data}
        disabled={false}
        onChange={(next) => {
          latest = next;
          setData(next);
        }}
      />
    );
  }
  render(<Editor />);
  const input = screen.getByLabelText("Vodarina (€/m³)") as HTMLInputElement;
  const previous = latest.municipalities[0].waterM3;
  fireEvent.change(input, { target: { value: "" } });
  expect(input.value).toBe("");
  expect(latest.municipalities[0].waterM3).toBe(previous);
  fireEvent.blur(input);
  expect(input.value).toBe(String(previous));
  fireEvent.change(input, { target: { value: "" } });
  fireEvent.change(input, { target: { value: "0.9876" } });
  fireEvent.blur(input);
  expect(latest.municipalities[0].waterM3).toBe(0.9876);
  // An intentional zero remains a valid editable amount.
  fireEvent.change(input, { target: { value: "0" } });
  expect(latest.municipalities[0].waterM3).toBe(0);
});
