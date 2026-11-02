import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { ContactPage } from "../pages/ServicePages";
import { submissionFingerprint } from "../content/submission-request";

vi.mock("../components/BotProtection", () => ({ default: () => null, resetProtection: vi.fn() }));

describe("citizen submission retries", () => {
  it("reuses a logical submission ID after a lost response and does not resubmit an unchanged successful intent", async () => {
    const payloads: Record<string, unknown>[] = [];
    const fetcher = vi.fn(async (_url: string, init?: RequestInit) => {
      payloads.push(JSON.parse(String(init?.body)));
      if (payloads.length === 1) throw new TypeError("Response lost after storage");
      return Response.json({ id: "stored-reference", message: "Saved" });
    });
    vi.stubGlobal("fetch", fetcher);
    render(<MemoryRouter initialEntries={["/kontakt"]}><ContactPage/></MemoryRouter>);
    const form = screen.getByLabelText("Zadeva sporočila · obvezno").closest("form")!;
    fireEvent.submit(form);
    await screen.findByRole("alert");
    fireEvent.submit(form);
    await screen.findByText("Sporočilo je shranjeno.");
    expect(payloads[0].requestId).toMatch(/^[a-f0-9-]{36}$/);
    expect(payloads[1].requestId).toBe(payloads[0].requestId);
    fireEvent.submit(form);
    await screen.findByText("Sporočilo je shranjeno.");
    expect(payloads).toHaveLength(2);
    fireEvent.change(screen.getByLabelText("Zadeva sporočila · obvezno"), { target: { value: "A new question" } });
    fireEvent.submit(form);
    await screen.findByText("Sporočilo je shranjeno.");
    expect(payloads[2].requestId).not.toBe(payloads[1].requestId);
  });
  it("ignores fresh challenge tokens and empty file metadata while detecting changed form values", () => {
    const one = new FormData(), two = new FormData();
    one.set("message", "Same report"); two.set("message", "Same report");
    one.set("cf-turnstile-response", "old-token"); two.set("cf-turnstile-response", "new-token");
    one.set("photo", new File([], "", { lastModified: 1 }));
    two.set("photo", new File([], "", { lastModified: 2 }));
    expect(submissionFingerprint("/api/reports", one)).toBe(submissionFingerprint("/api/reports", two));
    two.set("message", "A different report");
    expect(submissionFingerprint("/api/reports", one)).not.toBe(submissionFingerprint("/api/reports", two));
  });
});
