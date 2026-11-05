/** Coordinates are optional; never convert blank or null values into (0, 0). */
export function validCoordinates(latitude, longitude) {
  return (
    typeof latitude === "number" &&
    Number.isFinite(latitude) &&
    Math.abs(latitude) <= 90 &&
    typeof longitude === "number" &&
    Number.isFinite(longitude) &&
    Math.abs(longitude) <= 180
  );
}
export function mapPointUrl(latitude, longitude) {
  if (!validCoordinates(latitude, longitude)) return null;
  return `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
}
export function mapAddressUrl(address) {
  if (typeof address !== "string" || !address.trim()) return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address.trim())}`;
}
