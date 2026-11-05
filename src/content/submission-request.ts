/** Only the logical form values define a retry; short-lived anti-bot tokens do not. */
export function submissionFingerprint(endpoint: string, payload: object | FormData) {
  const entries = payload instanceof FormData ? [...payload.entries()] : Object.entries(payload);
  return JSON.stringify([endpoint, entries
    .filter(([key]) => !["cf-turnstile-response", "requestId"].includes(key))
    .map(([key, value]) => [key, value instanceof File
      ? value.size ? [value.name, value.size, value.type, value.lastModified] : null : value])
    .sort(([a], [b]) => String(a).localeCompare(String(b)))]);
}
