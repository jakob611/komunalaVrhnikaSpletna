export type CollectionType = "packaging" | "bio" | "residual";
export type CollectionEvent = {
  id: string;
  type: CollectionType;
  label: string;
  date: string;
  bin?: string;
};
export type CollectionRoute = {
  id: string;
  name: string;
  addresses: string[];
  events: CollectionEvent[];
};
export type CollectionData = { routes: CollectionRoute[] };
export const COLLECTION_TYPES: Readonly<Record<CollectionType, string>>;
export function addressTokens(value: string): string[];
export function normalizedAddress(value: string): string;
export function addressRuleMatches(address: string, pattern: string): boolean;
export function matchCollectionRoute(
  address: string,
  routes: CollectionRoute[],
): {
  route: CollectionRoute | null;
  ambiguous: boolean;
  candidates: CollectionRoute[];
};
export function shiftCollectionDate(value: string, days: number): string;
export function generateCollectionEvents(options: {
  type: CollectionType;
  start: string;
  end: string;
  weekday: number;
  interval: number;
}): CollectionEvent[];
export function mergeCollectionEvents(
  existing: CollectionEvent[],
  incoming: CollectionEvent[],
): { events: CollectionEvent[]; added: number; skipped: number };
export function moveCollectionEvents(
  events: CollectionEvent[],
  ids: string[],
  days: number,
): CollectionEvent[];
