import { fireEvent, screen } from "@testing-library/react";
import type { VerifiedAddress } from "../components/VerifiedAddressPicker";

// A finite public-register fixture: unknown input never becomes a verified house.
export const addressFixtures: VerifiedAddress[] = [
  { id: "100400000000000001", address: "Verd 1, Vrhnika", municipality: "Vrhnika", municipalityId: "vrhnika" },
  { id: "100400000000000002", address: "Verd 2, Vrhnika", municipality: "Vrhnika", municipalityId: "vrhnika" },
  { id: "100400000000000012", address: "Verd 12, Vrhnika", municipality: "Vrhnika", municipalityId: "vrhnika" },
  { id: "100400000000000101", address: "Borovnica 1, Borovnica", municipality: "Borovnica", municipalityId: "borovnica" },
];
export function addressApiResponse(input: unknown): Response | undefined {
  const url = new URL(String(input), "https://kpv.example");
  if (url.pathname !== "/api/addresses") return undefined;
  const exact = url.searchParams.get("address");
  const query = (exact ?? url.searchParams.get("q") ?? "").trim().toLocaleLowerCase("sl");
  const addresses = addressFixtures.filter(record => exact !== null
    ? record.address.toLocaleLowerCase("sl") === query
    : query.length >= 3 && record.address.toLocaleLowerCase("sl").includes(query));
  return Response.json({ addresses, source: { name: "GURS", url: "https://podatki.gov.si/dataset/register-naslovov", updatedAt: "2026-11-03T05:29:11.740Z" }, more: false });
}
export async function selectAddress(label: string | RegExp, address = "Verd 12, Vrhnika") {
  fireEvent.change(screen.getByLabelText(label), { target: { value: address } });
  fireEvent.click(await screen.findByRole("option", { name: new RegExp(`^${address}`) }));
}
