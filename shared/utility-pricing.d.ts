export type MunicipalityTariff = {
  id: string;
  name: string;
  effectiveFrom: string;
  sourceUrl: string;
  waterM3: number;
  waterNetwork: number;
  drainageM3: number;
  drainageNetwork: number;
  cleaningM3: number;
  cleaningNetwork: number;
};
export type ServicePrice = {
  id: string;
  category: "bulky" | "septic" | "water" | "other";
  name: string;
  unit: "kg" | "m³" | "ura" | "dan" | "kos" | "storitev";
  priceWithVat: number;
  vatPercent: number;
  effectiveFrom: string;
  sourceUrl: string;
  note: string;
};
export type TariffData = {
  checkedOn: string;
  vatPercent: number;
  municipalities: MunicipalityTariff[];
  septic: {
    serviceM3: number;
    network: number;
    levySepticM3: number;
    levyTreatedM3: number;
  };
  waste: {
    effectiveFrom: string;
    sourceUrl: string;
    annexUrl: string;
    collectionKgPerPerson: number;
    treatmentKgPerPerson: number;
    disposalKgPerPerson: number;
    bioKgPerPerson: number;
    collectionKg: number;
    collectionInfrastructureKg: number;
    treatmentKg: number;
    treatmentInfrastructureKg: number;
    disposalKg: number;
    disposalInfrastructureKg: number;
    bioKg: number;
  };
  servicePrices: ServicePrice[];
};
export type HouseholdInput = {
  municipalityId: string;
  scope: "water" | "waste" | "all";
  consumptionM3: number;
  meterBand: number;
  wastewater: "sewer" | "septic" | "mkcn" | "water-only";
  people: number;
  bio: boolean;
  monthlyDeduction?: number;
};
export type PriceLine = {
  key: string;
  label: string;
  quantity: number;
  unit: string;
  unitNet: number;
  vatPercent: number;
  netCents: number;
  vatCents: number;
  grossCents: number;
};
export const METER_BANDS: readonly { label: string; factor: number }[];
export function validateTariffs(value: unknown): TariffData;
export function tariffDate(now?: Date): string;
export function calculateHousehold(
  tariffs: TariffData,
  input: HouseholdInput,
  today?: string,
): {
  municipality: MunicipalityTariff;
  rows: PriceLine[];
  beforeDeductionCents: number;
  deductionCents: number;
  totalCents: number;
  vatCents: number;
};
