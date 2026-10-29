export class BotError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export async function verifyBot(
  request,
  env,
  token,
  action,
  honeypot,
  fetcher = fetch,
) {
  if (honeypot)
    throw new BotError(400, "Oddaje ni mogoče preveriti. Poskusite znova.");
  // This binding exists only in the loopback-only Node development adapter.
  if (env.LOCAL_STORAGE && !env.TURNSTILE_SECRET) return;
  if (!env.TURNSTILE_SECRET || !env.TURNSTILE_HOSTNAMES)
    throw new BotError(
      503,
      "Varna oddaja trenutno ni pripravljena. Poskusite pozneje.",
    );
  if (typeof token !== "string" || !token.trim() || token.length > 2048)
    throw new BotError(
      403,
      "Počakajte na varnostno preverjanje in znova oddajte obrazec.",
    );
  const hostnames = new Set(
    env.TURNSTILE_HOSTNAMES.split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  );
  // A production hostname list must never trust development/test challenges.
  if (
    !env.LOCAL_STORAGE &&
    (hostnames.has("localhost") ||
      hostnames.has("127.0.0.1") ||
      hostnames.has("dummy-key"))
  )
    throw new BotError(503, "Varna oddaja trenutno ni pravilno nastavljena.");
  if (env.FORM_RATE_LIMITER) {
    const key = request.headers.get("cf-connecting-ip") || "unknown";
    const { success } = await env.FORM_RATE_LIMITER.limit({ key });
    if (!success)
      throw new BotError(
        429,
        "V kratkem času ste oddali več obrazcev. Počakajte minuto in poskusite znova.",
      );
  }
  let result;
  try {
    const body = new URLSearchParams({
      secret: env.TURNSTILE_SECRET,
      response: token,
    });
    const ip = request.headers.get("cf-connecting-ip");
    if (ip) body.set("remoteip", ip);
    const response = await fetcher(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
        signal: AbortSignal.timeout(10000),
      },
    );
    if (!response.ok) throw new Error("siteverify unavailable");
    result = await response.json();
  } catch {
    throw new BotError(
      503,
      "Varnostno preverjanje ni dosegljivo. Podatki ostajajo v obrazcu; poskusite znova.",
    );
  }
  if (
    result.success !== true ||
    result.action !== action ||
    !hostnames.has(result.hostname)
  )
    throw new BotError(
      403,
      "Varnostno preverjanje je poteklo ali ni uspelo. Počakajte na novo preverjanje in poskusite znova.",
    );
}
