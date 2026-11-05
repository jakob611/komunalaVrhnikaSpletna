export class BotError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export async function enforceFormQuota(request, env, now = Date.now()) {
  if (env.FORM_RATE_LIMITER) return; // The platform binding was already checked before verification.
  if (!env.DB) throw new BotError(503, "Varna oddaja trenutno ni pripravljena. Poskusite pozneje.");
  const secret = env.SUBSCRIPTION_SIGNING_SECRET || env.TURNSTILE_SECRET;
  if (!secret) throw new BotError(503, "Varna oddaja trenutno ni pripravljena. Poskusite pozneje.");
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(request.headers.get("cf-connecting-ip") || "unknown"));
  const digest = Array.from(new Uint8Array(signature), byte => byte.toString(16).padStart(2, "0")).join("");
  const limits = [{ label: "minute", duration: 60000, maximum: 10 }, { label: "hour", duration: 3600000, maximum: 100 }];
  const results = await env.DB.batch(limits.map(({ label, duration }) => env.DB.prepare(
    "INSERT INTO public_form_limits(key,window,attempts) VALUES(?,?,1) ON CONFLICT(key,window) DO UPDATE SET attempts=attempts+1 RETURNING attempts",
  ).bind(`${label}:${digest}`, Math.floor(now / duration) * duration)));
  if (results.some((result, index) => !result.results?.[0] || result.results[0].attempts > limits[index].maximum))
    throw new BotError(429, "V kratkem času ste oddali več obrazcev. Počakajte in poskusite znova.");
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
  // Only successful challenges consume the fallback quota. Unverified traffic
  // cannot fill another household's allowance or create submission records.
  if (["contact", "reports", "requests", "market", "subscriptions"].includes(action))
    await enforceFormQuota(request, env);
}
