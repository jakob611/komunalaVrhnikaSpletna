import { COLLECTION_TYPES } from "../../shared/collection-utils.js";

type CollectionEvent = {
  id: string;
  date: string;
  type: string;
  label: string;
  color: string;
};

export type CollectionSchedule = {
  address: string;
  events: CollectionEvent[];
  complete?: boolean;
  message?: string;
  incompleteTypes?: string[];
  ambiguousTypes?: string[];
  expiredTypes?: string[];
  routes?: Record<string, { id: string; name: string; lastDate: string }>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isFraction(value: unknown): boolean {
  return typeof value === "string" && Object.hasOwn(COLLECTION_TYPES, value);
}

function isDate(value: unknown): boolean {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function isCollectionSchedule(value: unknown): value is CollectionSchedule {
  if (!isRecord(value) || !isText(value.address) || !Array.isArray(value.events)) return false;
  if (!value.events.every((event) =>
    isRecord(event) && isText(event.id) && isDate(event.date) &&
    isFraction(event.type) && isText(event.label) && typeof event.color === "string"
  )) return false;

  if (value.complete !== undefined && typeof value.complete !== "boolean") return false;
  if (value.message !== undefined && typeof value.message !== "string") return false;
  for (const field of ["incompleteTypes", "ambiguousTypes", "expiredTypes"]) {
    const fractions = value[field];
    if (fractions !== undefined && (!Array.isArray(fractions) || !fractions.every(isFraction))) return false;
  }

  return value.routes === undefined || (
    isRecord(value.routes) && Object.entries(value.routes).every(([fraction, route]) =>
      isFraction(fraction) && isRecord(route) && isText(route.id) &&
      isText(route.name) && isDate(route.lastDate)
    )
  );
}
