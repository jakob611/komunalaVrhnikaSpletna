import { useEffect, useState, type FormEvent } from "react";
import {
  LoaderCircle,
  MailPlus,
  RefreshCw,
  ShieldCheck,
  UserRoundMinus,
} from "lucide-react";
import "./admin-auth.css";

type AccessScope = "all" | "content" | "operations";
const scopeLabels: Record<AccessScope, string> = {
  content: "Samo vsebine",
  operations: "Samo obravnava oddaj in obvestila",
  all: "Vsebine in obravnava oddaj",
};
type User = {
  email: string;
  role: "owner" | "editor";
  status: "active" | "invited" | "revoked";
  created_at: number;
  updated_at: number;
  accessScope?: AccessScope;
};
export default function AdminUsers({
  csrfToken,
  onSessionExpired,
}: {
  csrfToken: string;
  onSessionExpired: () => void;
}) {
  const [users, setUsers] = useState<User[]>([]);
  const [email, setEmail] = useState("");
  const [accessScope, setAccessScope] = useState<AccessScope>("content");
  const [scopeDrafts, setScopeDrafts] = useState<Record<string, AccessScope>>(
    {},
  );
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  async function api(path = "", value?: object) {
    const response = await fetch(`/api/admin/users${path}`, {
      method: value ? "POST" : "GET",
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
        "X-CSRF-Token": csrfToken,
      },
      body: value ? JSON.stringify(value) : undefined,
      signal: AbortSignal.timeout(18000),
    });
    const data = await response.json();
    if (response.status === 401) onSessionExpired();
    if (!response.ok) throw Error(data.error || "Zahteve ni mogoče izvesti.");
    return data;
  }
  async function load() {
    setBusy(true);
    setError("");
    try {
      setUsers((await api()).items);
      setLoaded(true);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Dostopov ni mogoče naložiti.",
      );
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    void load();
  }, []);
  async function invite(address: string, scope: AccessScope = accessScope) {
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await api("", { email: address, accessScope: scope });
      setUsers((await api()).items);
      setEmail("");
      setNotice(
        "Povabilo je poslano. Urednik določi svoje geslo in potrdi prijavo z e-poštno kodo.",
      );
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Povabila ni mogoče poslati.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function changeScope(person: User) {
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await api("/scope", {
        email: person.email,
        accessScope: scopeDrafts[person.email] || person.accessScope || "all",
      });
      setUsers((await api()).items);
      setScopeDrafts({});
      setNotice(
        "Področje dostopa je spremenjeno. Aktivni urednik se mora ponovno prijaviti.",
      );
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Dostopa ni mogoče spremeniti.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function revoke(person: User) {
    if (
      busy ||
      !window.confirm(
        `Prekličem uredniški dostop za ${person.email}? Njegove seje in povabila bodo takoj prenehali veljati. Ponovno ga lahko povabite.`,
      )
    )
      return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await api("/revoke", { email: person.email });
      setUsers((await api()).items);
      setNotice(
        "Dostop je preklican. Seje in prejšnja povabila ne veljajo več.",
      );
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Dostopa ni mogoče preklicati.",
      );
    } finally {
      setBusy(false);
    }
  }
  function send(event: FormEvent) {
    event.preventDefault();
    void invite(email);
  }
  const labels = {
    active: "Aktiven dostop",
    invited: "Čaka na aktivacijo",
    revoked: "Dostop preklican",
  };
  return (
    <section className="admin-users" aria-labelledby="admin-users-title">
      <header>
        <div>
          <p className="eyebrow">DOSTOP IN VARNOST</p>
          <h2 id="admin-users-title">Vsak urednik ima svoj dostop.</h2>
          <p>
            Samo lastnik upravlja povabila. Vsaka prijava zahteva osebno geslo
            in novo enkratno kodo iz e-pošte.
          </p>
        </div>
        <button
          className="admin-button"
          onClick={() => void load()}
          disabled={busy}
        >
          <RefreshCw size={17} /> Osveži
        </button>
      </header>
      {error && (
        <p className="admin-error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="admin-notice" role="status">
          {notice}
        </p>
      )}
      <form className="admin-invite-form" onSubmit={send}>
        <label>
          E-pošta novega urednika
          <input
            type="email"
            autoComplete="off"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            maxLength={254}
            required
            disabled={busy}
            placeholder="urednik@primer.si"
          />
        </label>
        <label>
          Področje dostopa
          <select
            value={accessScope}
            onChange={(event) =>
              setAccessScope(event.target.value as AccessScope)
            }
            disabled={busy}
          >
            {Object.entries(scopeLabels).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <button
          className="admin-button admin-primary"
          type="submit"
          disabled={busy || !email.trim()}
        >
          {busy ? (
            <LoaderCircle className="admin-spin" size={17} />
          ) : (
            <MailPlus size={17} />
          )}{" "}
          Pošlji povabilo
        </button>
      </form>
      <p className="admin-users-help">
        Povabilo velja 24 ur. Novi urednik v povezavi določi svoje geslo, dolgo
        vsaj 12 znakov. Dostop do vsebin ne omogoča vpogleda v zasebne oddaje in
        naslove naročnikov. Obstoječi uredniki ohranijo dosedanji dostop, dokler
        ga lastnik ne spremeni. Dodajanje ljudi ostane lastniku.
      </p>
      {busy && !loaded && <p role="status">Nalagam dostope …</p>}
      <ul className="admin-user-list">
        {users.map((person) => (
          <li key={person.email}>
            <div>
              <strong>{person.email}</strong>
              <span>
                {person.role === "owner" ? "Lastnik portala" : "Urednik"} ·{" "}
                {labels[person.status]}
                {person.role !== "owner" && (
                  <> · {scopeLabels[person.accessScope || "all"]}</>
                )}
              </span>
            </div>
            {person.role === "owner" ? (
              <span className="admin-owner-badge">
                <ShieldCheck size={16} /> Zaščiten lastnik
              </span>
            ) : (
              <div className="admin-user-actions">
                {person.status !== "revoked" && (
                  <>
                    <label>
                      Področje dostopa za {person.email}
                      <select
                        disabled={busy}
                        value={
                          scopeDrafts[person.email] ||
                          person.accessScope ||
                          "all"
                        }
                        onChange={(event) =>
                          setScopeDrafts({
                            ...scopeDrafts,
                            [person.email]: event.target.value as AccessScope,
                          })
                        }
                      >
                        {Object.entries(scopeLabels).map(([key, label]) => (
                          <option key={key} value={key}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button
                      type="button"
                      className="admin-button"
                      disabled={
                        busy ||
                        !scopeDrafts[person.email] ||
                        scopeDrafts[person.email] ===
                          (person.accessScope || "all")
                      }
                      onClick={() => void changeScope(person)}
                    >
                      Spremeni dostop
                    </button>
                  </>
                )}
                {person.status !== "active" && (
                  <button
                    type="button"
                    className="admin-button"
                    disabled={busy}
                    onClick={() =>
                      void invite(person.email, person.accessScope || "all")
                    }
                  >
                    <MailPlus size={16} />{" "}
                    {person.status === "revoked"
                      ? "Ponovno povabi"
                      : "Pošlji novo povabilo"}
                  </button>
                )}
                {person.status !== "revoked" && (
                  <button
                    type="button"
                    className="admin-button"
                    disabled={busy}
                    onClick={() => void revoke(person)}
                  >
                    <UserRoundMinus size={16} /> Prekliči dostop
                  </button>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>
      <p className="admin-users-help">
        Če urednik pozabi geslo, prekličite njegov dostop in ga ponovno
        povabite. To razveljavi stare seje. Lastniško geslo se obnovi prek varne
        nastavitve Workerja; sama e-poštna koda ga ne more zamenjati.
      </p>
    </section>
  );
}
