import { useEffect, useRef, useState, type FormEvent } from "react";
import { Mail, RefreshCw, Save } from "lucide-react";

type Settings = {
  recipient: string;
  defaultRecipient: string;
  override: string;
  revision: number;
  updatedAt: string | null;
  updatedBy: string | null;
  sender: string;
  enabled: boolean;
};

export default function NotificationSettings({ csrfToken, onSessionExpired, onDirtyChange, onBusyChange }: {
  csrfToken: string;
  onSessionExpired: () => void;
  onDirtyChange?: (dirty: boolean) => void;
  onBusyChange?: (busy: boolean) => void;
}) {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [recipient, setRecipient] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [conflict, setConflict] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const listeners = useRef({ onSessionExpired, onDirtyChange, onBusyChange });
  listeners.current = { onSessionExpired, onDirtyChange, onBusyChange };
  const dirty = !!settings && recipient !== settings.recipient;
  useEffect(() => { listeners.current.onDirtyChange?.(dirty); }, [dirty]);
  useEffect(() => { listeners.current.onBusyChange?.(busy); }, [busy]);
  useEffect(() => () => {
    listeners.current.onDirtyChange?.(false);
    listeners.current.onBusyChange?.(false);
  }, []);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  async function request(init: RequestInit = {}): Promise<Settings> {
    const response = await fetch("/api/admin/notifications", {
      ...init, credentials: "same-origin", cache: "no-store",
      headers: { "Content-Type": "application/json", "X-CSRF-Token": csrfToken },
      signal: init.signal || AbortSignal.timeout(20000),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (response.status === 401) listeners.current.onSessionExpired();
      if (response.status === 409) setConflict(true);
      throw Error(data.error || "Nastavitev trenutno ni mogoče shraniti.");
    }
    return data;
  }
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(""); setNotice(""); setConflict(false);
    void request({ signal: controller.signal }).then(data => {
      if (!controller.signal.aborted) { setSettings(data); setRecipient(data.recipient); }
    }).catch(cause => {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Nalaganje ni uspelo.");
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [refresh, csrfToken]);
  async function save(event: FormEvent) {
    event.preventDefault();
    if (!settings || busy || !dirty) return;
    setBusy(true); setError(""); setNotice(""); setConflict(false);
    try {
      const result = await request({ method: "PUT", body: JSON.stringify({ recipient, revision: settings.revision }) });
      setSettings(result); setRecipient(result.recipient);
      setNotice(`Prejemnik je shranjen. Nova obvestila bodo poslana na ${result.recipient}.`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Shranjevanje ni uspelo."); }
    finally { setBusy(false); }
  }
  function reload() {
    if (busy || (dirty && !window.confirm("Zavržem neshranjeni naslov in naložim trenutne nastavitve?"))) return;
    setRefresh(value => value + 1);
  }
  return <section className="admin-panel" style={{ padding: 24, maxWidth: 800 }} aria-labelledby="notification-settings-title">
    <h2 id="notification-settings-title"><Mail size={22} /> E-poštna obvestila o novih oddajah</h2>
    <p>Določite en predal, v katerega prejmete nove prijave težav, kontaktna sporočila, povpraševanja in prijave na tržnico. Naslov lahko spremeni samo lastnik portala.</p>
    {loading ? <p role="status">Nalagamo nastavitve …</p> : <>
      {settings && <>
        <p><strong>Trenutni prejemnik:</strong> {settings.recipient}</p>
        <p><strong>Pošiljatelj:</strong> {settings.sender || "Ni nastavljen"}</p>
        {!settings.enabled && <p className="admin-message admin-message-error" role="status">Pošiljanje e-pošte v tem okolju ni vključeno. Nastavitev lahko shranite; oddaje ostajajo v delovnih nalogih.</p>}
        <form onSubmit={save}>
          <fieldset disabled={busy} style={{ border: 0, padding: 0, margin: 0 }}>
            <label className="admin-field"><span>Prejemnik novih obvestil</span><input type="email" required maxLength={254} value={recipient} autoComplete="email" onChange={event => { setRecipient(event.target.value); setNotice(""); }} /><small>Vnesite samo en e-poštni naslov, na primer naslov sprejemne pisarne.</small></label>
            <p>Sprememba velja za obvestila, ustvarjena po shranjevanju. Obvestila, ki že čakajo na pošiljanje, obdržijo prejšnjega prejemnika. Prijavni naslovi skrbnikov in kode za dostop se ne spremenijo.</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 20 }}>
              <button className="admin-button admin-primary" type="submit" disabled={!dirty || busy}><Save size={17} />{busy ? "Shranjujemo …" : "Shrani prejemnika"}</button>
              <button className="admin-button" type="button" onClick={reload}><RefreshCw size={16} />Ponovno naloži</button>
              {settings.override && <button className="admin-button" type="button" onClick={() => { setRecipient(settings.defaultRecipient); setNotice(""); }}>Uporabi začetni naslov</button>}
            </div>
          </fieldset>
        </form>
        {settings.updatedAt && <p><small>Zadnja sprememba: {new Intl.DateTimeFormat("sl-SI", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Ljubljana" }).format(new Date(settings.updatedAt))}{settings.updatedBy ? ` · ${settings.updatedBy}` : ""}</small></p>}
      </>}
    </>}
    {error && <div className="admin-message admin-message-error" role="alert">{error}{(conflict || !settings) && <button type="button" className="admin-button" disabled={busy} onClick={reload}>Ponovno naloži nastavitve</button>}</div>}
    {notice && <p className="admin-message" role="status">{notice}</p>}
  </section>;
}
