const fallback = "https://kpv.jakobtominc.com";

/** One deployment setting owns every absolute link sent outside the browser. */
export function publicOrigin(env = {}) {
  const origin = env.PUBLIC_ORIGIN || fallback;
  let url;
  try {
    url = new URL(origin);
  } catch {
    throw new Error("Invalid PUBLIC_ORIGIN");
  }
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== "/"
  )
    throw new Error("PUBLIC_ORIGIN must be an HTTPS origin");
  return url.origin;
}
