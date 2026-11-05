import { validateDraftSection } from "../../../shared/cms-validation.js";

export function validateEditorDraft(section: string, value: unknown): unknown {
  if (section !== "website") return validateDraftSection(section, value);
  const keys = ["copy", "images", "links", "layout", "settings"];
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    keys.some((key) => !Object.hasOwn(value, key)) ||
    Object.keys(value).length !== keys.length
  )
    throw new Error(
      "Osnutek spletne strani nima vseh zahtevanih področij. Trenutni osnutek je ohranjen.",
    );
  const records = value as Record<string, unknown>;
  return Object.fromEntries(
    keys.map((key) => [key, validateDraftSection(key, records[key])]),
  );
}
