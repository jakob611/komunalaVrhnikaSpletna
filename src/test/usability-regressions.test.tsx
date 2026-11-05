import { useState } from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { it, expect } from "vitest";
import UtilityCalculator from "../components/UtilityCalculator";
import CemeteryEditor from "../components/admin/CemeteryEditor";
import type { CemeteryData } from "../data/cemetery";

it("compares household scenarios without repeated submit clicks and never treats a cleared required field as zero", () => {
  render(
    <MemoryRouter>
      <UtilityCalculator />
    </MemoryRouter>,
  );
  fireEvent.change(screen.getByLabelText(/Občina odjemnega mesta/), {
    target: { value: "vrhnika" },
  });
  const consumption = screen.getByLabelText(/Mesečna poraba vode/);
  fireEvent.change(consumption, { target: { value: "12" } });
  fireEvent.change(screen.getByLabelText(/Število oseb za obračun/), {
    target: { value: "3" },
  });
  fireEvent.click(screen.getByRole("button", { name: /Izračunaj mesečni/ }));
  expect(screen.getByRole("heading", { name: /75,83\s*€/ })).toBeTruthy();
  fireEvent.change(screen.getByLabelText(/Občina odjemnega mesta/), {
    target: { value: "borovnica" },
  });
  expect(screen.getByRole("heading", { name: /91,59\s*€/ })).toBeTruthy();
  fireEvent.change(consumption, { target: { value: "" } });
  expect(screen.queryByRole("table")).toBeNull();
  expect(screen.getByRole("alert").textContent).toContain(
    "Dopolnite obvezne podatke",
  );
  fireEvent.change(consumption, { target: { value: "0" } });
  expect(screen.getByRole("table")).toBeTruthy();
  expect(screen.queryByRole("alert")).toBeNull();
  expect(screen.queryByRole("heading", { name: /91,59\s*€/ })).toBeNull();
});

it("allows normal replacement of a grave identifier through empty and duplicate intermediate text", () => {
  let latest: CemeteryData = {
    plan: { width: 1000, height: 1000, imageUrl: null },
    graves: [
      {
        id: "A",
        section: "A",
        row: 1,
        number: 1,
        x: 0,
        y: 0,
        positioned: false,
        people: [],
      },
      {
        id: "A-01-01",
        section: "A",
        row: 1,
        number: 2,
        x: 0,
        y: 0,
        positioned: false,
        people: [{ name: "Preizkusna oseba", born: "", died: "" }],
      },
    ],
  };
  function Editor() {
    const [value, setValue] = useState(latest);
    return (
      <CemeteryEditor
        value={value}
        onChange={(next) => {
          latest = next;
          setValue(next);
        }}
      />
    );
  }
  render(<Editor />);
  fireEvent.click(screen.getByRole("button", { name: /A-01-01/ }));
  const id = screen.getByLabelText(
    "Oznaka groba (tudi za iskanje)",
  ) as HTMLInputElement;
  fireEvent.change(id, { target: { value: "" } });
  expect(id.value).toBe("");
  fireEvent.change(id, { target: { value: "A" } });
  expect(id.value).toBe("A");
  expect(screen.queryByRole("alert")).toBeNull();
  expect(latest.graves[1].id).toBe("A-01-01");
  fireEvent.change(id, { target: { value: "A-02-02" } });
  fireEvent.blur(id);
  expect(latest.graves[1].id).toBe("A-02-02");
  expect(latest.graves[1].people[0].name).toBe("Preizkusna oseba");
  fireEvent.change(id, { target: { value: "A" } });
  fireEvent.blur(id);
  expect(id.value).toBe("A-02-02");
  expect(latest.graves[1].id).toBe("A-02-02");
  expect(screen.getByRole("alert").textContent).toContain("enolična");
});
