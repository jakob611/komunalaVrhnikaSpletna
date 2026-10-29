import { useEffect, useRef, useState } from "react";
import { RefreshCw, ShieldCheck } from "lucide-react";
import "./bot-protection.css";

type WidgetOptions = {
  sitekey: string;
  action: string;
  appearance: "interaction-only";
  size: "compact" | "flexible";
  theme: "light";
  "response-field": boolean;
  callback: (token: string) => void;
  "expired-callback": () => void;
  "error-callback": () => void;
  "timeout-callback": () => void;
};
type Turnstile = {
  render: (container: HTMLElement, options: WidgetOptions) => string;
  remove: (id: string) => void;
  reset: (id: string) => void;
};
declare global {
  interface Window {
    turnstile?: Turnstile;
  }
}
let scriptPromise: Promise<void> | null = null;
function loadScript() {
  if (window.turnstile) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise<void>((resolve, reject) => {
    document.getElementById("kpv-turnstile-script")?.remove();
    const script = document.createElement("script");
    script.id = "kpv-turnstile-script";
    script.src =
      "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.async = true;
    script.defer = true;
    const timeout = window.setTimeout(() => {
      script.remove();
      reject(new Error("verification unavailable"));
    }, 12000);
    script.onload = () => {
      clearTimeout(timeout);
      if (window.turnstile) resolve();
      else reject(new Error("verification unavailable"));
    };
    script.onerror = () => {
      clearTimeout(timeout);
      reject(new Error("verification unavailable"));
    };
    document.head.appendChild(script);
  }).catch((error) => {
    scriptPromise = null;
    throw error;
  });
  return scriptPromise;
}

export function resetProtection(action: string) {
  window.dispatchEvent(new CustomEvent("kpv:bot-reset", { detail: action }));
}

export default function BotProtection({ action }: { action: string }) {
  const holder = useRef<HTMLDivElement>(null);
  const widget = useRef<string | null>(null);
  const [token, setToken] = useState("");
  const [status, setStatus] = useState<"loading" | "ready" | "error" | "local">(
    "loading",
  );
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    setToken("");
    setStatus("loading");
    async function setup() {
      try {
        const response = await fetch("/api/config", {
          signal: controller.signal,
        });
        if (!response.ok) throw Error();
        const config = await response.json();
        if (!active) return;
        if (
          config.turnstile?.mode === "local-demo" &&
          config.turnstile.enabled === false
        ) {
          setStatus("local");
          return;
        }
        if (!config.turnstile?.enabled || !config.turnstile.siteKey)
          throw Error();
        await loadScript();
        if (!active || !holder.current || !window.turnstile) return;
        const fail = () => {
          if (active) {
            setToken("");
            setStatus("error");
          }
        };
        widget.current = window.turnstile.render(holder.current, {
          sitekey: config.turnstile.siteKey,
          action,
          appearance: "interaction-only",
          size:
            holder.current.getBoundingClientRect().width < 300
              ? "compact"
              : "flexible",
          theme: "light",
          "response-field": false,
          callback: (value) => {
            if (active) {
              setToken(value);
              setStatus("ready");
            }
          },
          "expired-callback": () => {
            if (active) {
              setToken("");
              setStatus("loading");
              if (widget.current) window.turnstile?.reset(widget.current);
            }
          },
          "error-callback": fail,
          "timeout-callback": fail,
        });
      } catch {
        if (active) setStatus("error");
      } finally {
        clearTimeout(timer);
      }
    }
    const reset = (event: Event) => {
      if ((event as CustomEvent<string>).detail !== action) return;
      setToken("");
      if (widget.current && window.turnstile) {
        setStatus("loading");
        window.turnstile.reset(widget.current);
      }
    };
    window.addEventListener("kpv:bot-reset", reset);
    void setup();
    return () => {
      active = false;
      controller.abort();
      clearTimeout(timer);
      window.removeEventListener("kpv:bot-reset", reset);
      if (widget.current) {
        window.turnstile?.remove(widget.current);
        widget.current = null;
      }
    };
  }, [action, attempt]);
  return (
    <div
      className="bot-protection"
      data-bot-action={action}
      data-bot-mode={status === "local" ? "local" : "protected"}
    >
      <input type="hidden" name="cf-turnstile-response" value={token} />
      <label className="bot-honeypot" aria-hidden="true">
        To polje pustite prazno
        <input name="website" tabIndex={-1} autoComplete="off" />
      </label>
      <div ref={holder} />
      <div className={`bot-status ${status}`} role="status">
        <ShieldCheck size={15} />
        <span>
          {status === "local"
            ? "Lokalni preizkus · brez zunanjega preverjanja."
            : status === "error"
              ? "Varnostnega preverjanja ni mogoče naložiti. Preverite povezavo ali blokiranje vsebine."
              : status === "ready"
                ? "Varna oddaja je pripravljena."
                : "Pripravljamo varno oddajo. Če se pokaže potrditveno polje, ga označite."}
        </span>
        {status === "error" && (
          <button
            type="button"
            onClick={() => setAttempt((value) => value + 1)}
          >
            <RefreshCw size={15} />
            Poskusi znova
          </button>
        )}
      </div>
    </div>
  );
}
