const STORAGE_KEY = "kpv-address";

/** Browser-only convenience; failures must never prevent the actual guest task. */
export function readSavedAddress() {
  try { return localStorage.getItem(STORAGE_KEY) || ""; }
  catch { return ""; }
}
export function saveHomeAddress(address: string) {
  try { localStorage.setItem(STORAGE_KEY, address.trim()); return true; }
  catch { return false; }
}
export function forgetHomeAddress() {
  try { localStorage.removeItem(STORAGE_KEY); return true; }
  catch { return false; }
}
/** Personal addresses travel through transient SPA state, not public URLs. */
export function addressFromNavigation(state: unknown) {
  if (!state || typeof state !== "object" || !("initialAddress" in state) || typeof state.initialAddress !== "string") return "";
  return state.initialAddress.trim().slice(0, 250);
}
