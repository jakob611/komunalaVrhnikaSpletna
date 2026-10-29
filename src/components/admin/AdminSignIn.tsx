import { useEffect, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  CheckCircle2,
  LoaderCircle,
  LockKeyhole,
  Mail,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import BotProtection, { resetProtection } from "../BotProtection";
import "./admin-auth.css";

export type AdminSession = {
  authenticated: true;
  csrfToken: string;
  expiresAt: string | number;
  user: { email: string; role: "owner" | "editor" };
};
type Challenge = {
  verificationRequired: true;
  challengeId: string;
  expiresAt: string;
  resendAfter: string;
};
async function submit(path: string, value: object) {
  const response = await fetch(`/api/admin/${path}`, {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(value),
    signal: AbortSignal.timeout(18000),
  });
  const data = await response.json();
  if (!response.ok)
    throw Error(data.error || "Prijave trenutno ni mogoče dokončati.");
  return data;
}

export default function AdminSignIn({
  onAuthenticated,
}: {
  onAuthenticated: (session: AdminSession) => void;
}) {
  const [params, setParams] = useSearchParams();
  const invite = params.get("invite");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [code, setCode] = useState("");
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [enrolled, setEnrolled] = useState(false);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!challenge) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [challenge]);
  const expired = !!challenge && Date.parse(challenge.expiresAt) <= now;
  const wait = challenge
    ? Math.max(0, Math.ceil((Date.parse(challenge.resendAfter) - now) / 1000))
    : 0;
  const enroll = !!invite && !enrolled;
  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const values = Object.fromEntries(new FormData(event.currentTarget));
      const data: Challenge = await submit("login", {
        ...values,
        email,
        password,
      });
      setChallenge(data);
      setPassword("");
      setCode("");
      setNow(Date.now());
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Prijave ni mogoče začeti.",
      );
    } finally {
      setBusy(false);
      resetProtection("adminlogin");
    }
  }
  async function verify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !challenge || expired) return;
    setBusy(true);
    setError("");
    try {
      const data: AdminSession = await submit("verify", {
        challengeId: challenge.challengeId,
        code,
      });
      onAuthenticated(data);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Kode ni mogoče preveriti.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function resend() {
    if (busy || !challenge || wait > 0 || expired) return;
    setBusy(true);
    setError("");
    try {
      setChallenge(
        await submit("resend", { challengeId: challenge.challengeId }),
      );
      setCode("");
      setNow(Date.now());
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Nove kode ni mogoče poslati.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function activate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    if (password !== confirmation) {
      setError("Gesli se ne ujemata.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await submit("enroll", { email, password, code, challengeId: invite });
      setEnrolled(true);
      setPassword("");
      setConfirmation("");
      setCode("");
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Povabila ni mogoče potrditi.",
      );
    } finally {
      setBusy(false);
    }
  }
  function startOver() {
    setError("");
    setChallenge(null);
    setCode("");
    setPassword("");
    setEnrolled(false);
    const next = new URLSearchParams(params);
    next.delete("invite");
    setParams(next, { replace: true });
  }
  return (
    <div className="admin-root admin-auth admin-login-shell">
      <Link className="admin-back" to="/">
        <ArrowLeft size={17} /> Na spletno stran
      </Link>
      <section
        className="admin-login-card admin-auth-card"
        aria-labelledby="admin-login-title"
      >
        <span className="admin-auth-symbol">
          {enrolled ? (
            <CheckCircle2 size={28} />
          ) : challenge ? (
            <Mail size={28} />
          ) : (
            <LockKeyhole size={28} />
          )}
        </span>
        <p className="eyebrow">KPV · UREDNIŠTVO</p>
        <h1 id="admin-login-title">
          {enrolled
            ? "Dostop je pripravljen."
            : enroll
              ? "Dobrodošli v uredništvu."
              : challenge
                ? "Preverite svoj predal."
                : "Dobrodošli nazaj."}
        </h1>
        <p>
          {enrolled ? (
            "Vaše osebno geslo je shranjeno. Nadaljujte s prijavo in potrdite novo kodo iz e-pošte."
          ) : enroll ? (
            "Vnesite podatke iz povabila in določite svoje geslo. Povabilo lahko uporabite samo enkrat."
          ) : challenge ? (
            <>
              Enkratno kodo smo poslali na <strong>{email}</strong>. Prijavo
              zaključite do{" "}
              {new Date(challenge.expiresAt).toLocaleTimeString("sl-SI", {
                hour: "2-digit",
                minute: "2-digit",
              })}
              .
            </>
          ) : (
            "Dostop samo za povabljene urednike: e-pošta, geslo in enkratna koda iz e-pošte."
          )}
        </p>
        {!enrolled && (
          <ol
            className="admin-auth-steps"
            aria-label="Varnostni koraki prijave"
          >
            <li className={!challenge ? "current" : "done"}>
              1 · E-pošta in geslo
            </li>
            <li className={challenge || enroll ? "current" : ""}>
              2 · Potrditev e-pošte
            </li>
          </ol>
        )}
        {error && (
          <p className="admin-error" role="alert">
            {error}
          </p>
        )}
        {enrolled ? (
          <button className="admin-button admin-primary" onClick={startOver}>
            Nadaljuj na prijavo
          </button>
        ) : enroll ? (
          <form onSubmit={activate} className="admin-auth-form">
            <label>
              E-pošta iz povabila
              <input
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                maxLength={254}
                disabled={busy}
              />
            </label>
            <label>
              Koda iz povabila
              <input
                type="text"
                autoComplete="one-time-code"
                inputMode="numeric"
                pattern="[0-9]{8}"
                maxLength={8}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                required
                disabled={busy}
              />
            </label>
            <label>
              Vaše novo geslo
              <input
                type="password"
                autoComplete="new-password"
                minLength={12}
                maxLength={128}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={busy}
              />
              <small>
                Najmanj 12 znakov. Uporabite geslo, ki ga drugje ne uporabljate.
              </small>
            </label>
            <label>
              Ponovite geslo
              <input
                type="password"
                autoComplete="new-password"
                minLength={12}
                maxLength={128}
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
                required
                disabled={busy}
              />
            </label>
            <button
              className="admin-button admin-primary"
              type="submit"
              disabled={busy}
            >
              {busy ? (
                <LoaderCircle className="admin-spin" size={17} />
              ) : (
                <ShieldCheck size={17} />
              )}{" "}
              {busy ? "Preverjamo …" : "Potrdi povabilo in shrani geslo"}
            </button>
            <button
              className="admin-auth-link"
              type="button"
              onClick={startOver}
              disabled={busy}
            >
              Že imate dostop? Na prijavo
            </button>
            <small>
              Povabilo velja 24 ur. Če je poteklo, naj vam lastnik pošlje novo.
            </small>
          </form>
        ) : challenge ? (
          <form onSubmit={verify} className="admin-auth-form">
            <label>
              8-mestna prijavna koda
              <input
                className="admin-auth-code"
                type="text"
                autoComplete="one-time-code"
                inputMode="numeric"
                pattern="[0-9]{8}"
                maxLength={8}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                required
                disabled={busy || expired}
                autoFocus
              />
            </label>
            {expired && (
              <p className="admin-error" role="alert">
                Prijava je potekla. Vrnite se na prvi korak in zahtevajte novo
                kodo.
              </p>
            )}
            <button
              className="admin-button admin-primary"
              type="submit"
              disabled={busy || expired || code.length !== 8}
            >
              {busy ? (
                <LoaderCircle className="admin-spin" size={17} />
              ) : (
                <ShieldCheck size={17} />
              )}{" "}
              {busy ? "Preverjamo …" : "Potrdi kodo in odpri konzolo"}
            </button>
            <button
              className="admin-auth-link"
              type="button"
              onClick={resend}
              disabled={busy || expired || wait > 0}
            >
              <RefreshCw size={15} />{" "}
              {wait > 0
                ? `Novo kodo lahko zahtevate čez ${wait} s`
                : "Pošlji novo kodo"}
            </button>
            <button
              className="admin-auth-link"
              type="button"
              onClick={startOver}
              disabled={busy}
            >
              <ArrowLeft size={15} /> Nazaj na e-pošto in geslo
            </button>
            <small>
              Preverite tudi neželeno pošto. Kode ne posredujte drugim osebam.
            </small>
          </form>
        ) : (
          <form onSubmit={login} className="admin-auth-form">
            <label>
              E-poštni naslov
              <input
                type="email"
                name="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                maxLength={254}
                disabled={busy}
                autoFocus
              />
            </label>
            <label>
              Geslo za upravljanje
              <input
                type="password"
                name="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                maxLength={256}
                disabled={busy}
              />
            </label>
            <BotProtection action="adminlogin" />
            <button
              className="admin-button admin-primary"
              type="submit"
              disabled={busy}
            >
              {busy ? (
                <LoaderCircle className="admin-spin" size={17} />
              ) : (
                <Mail size={17} />
              )}{" "}
              {busy ? "Pošiljamo kodo …" : "Preveri podatke in pošlji kodo"}
            </button>
          </form>
        )}
        <p className="admin-auth-footer">
          <ShieldCheck size={15} /> Zaščitena seja se ustvari šele po potrditvi
          e-poštne kode.
        </p>
      </section>
    </div>
  );
}
