import { useEffect, useState } from "react";
import { tariffDate } from "../../../shared/utility-pricing.js";
import { validateEditorDraft } from "./draft-validation";

type Scheduled = {
  id: string;
  section: string;
  publishOn: string;
  status: string;
  createdBy: string;
  error?: string;
};
type Call = <T>(path: string, init?: RequestInit) => Promise<T>;
export default function ScheduledPublications({
  section,
  value,
  revisions,
  call,
  disabled,
  dirty,
  user,
  owner,
}: {
  section: string;
  value: unknown;
  revisions: Record<string, number>;
  call: Call;
  disabled: boolean;
  dirty: boolean;
  user: string;
  owner: boolean;
}) {
  const [date, setDate] = useState(""),
    [items, setItems] = useState<Scheduled[]>([]);
  const [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true),
    [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let current = true;
    setError("");
    setItems([]);
    setLoading(true);
    void call<{ items?: Scheduled[] }>(
      "/api/admin/schedules?section=" + encodeURIComponent(section),
    )
      .then((data) => {
        if (current) setItems(data.items || []);
      })
      .catch((cause) => {
        if (current)
          setError(
            cause instanceof Error
              ? cause.message
              : "Seznam načrtovanih objav ni dosežljiv.",
          );
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, [section, refresh]);
  useEffect(() => {
    setNotice("");
  }, [section]);
  async function schedule() {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const clean = validateEditorDraft(section, value);
      const keys =
        section === "website"
          ? ["copy", "images", "links", "layout", "settings"]
          : [section];
      await call("/api/admin/schedules", {
        method: "POST",
        body: JSON.stringify({
          section,
          value: clean,
          publishOn: date,
          baseRevisions: Object.fromEntries(
            keys.map((key) => [key, revisions[key] ?? 0]),
          ),
        }),
      });
      setRefresh((n) => n + 1);
      setNotice(
        "Trenutni osnutek je shranjen za objavo na izbrani datum po slovenskem času. Poznejše spremembe osnutka ne spremenijo načrtovane vsebine.",
      );
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Načrtovanje ni uspelo.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function cancel(id: string) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await call(`/api/admin/schedules/${id}`, { method: "DELETE" });
      setRefresh((n) => n + 1);
      setNotice(
        "Načrtovana objava je preklicana. Trenutni uredniški osnutek se ni spremenil.",
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Preklic ni uspel.");
    } finally {
      setBusy(false);
    }
  }
  const statuses: Record<string, string> = {
    pending: "Čaka na datum",
    running: "Objavljanje",
    published: "Objavljeno",
    failed: "Ni objavljeno – potreben pregled",
    cancelled: "Preklicano",
  };
  const tomorrow = new Date(tariffDate() + "T12:00:00Z");
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  return (
    <details className="admin-panel" style={{ padding: 18, marginBottom: 18 }}>
      <summary>Načrtovana objava tega področja</summary>
      <p>
        Za prihodnjo objavo se shrani trenutna vsebina osnutka. Poznejši popravki vanjo niso vključeni. Datum velja po slovenskem času. Če drug
        urednik prej spremeni objavljeno vsebino, se načrtovana objava ustavi in jo morate pregledati. Objava obvestila ne pošlje e-pošte naročnikom; pošiljanje potrdite posebej.
      </p>
      <button
        type="button"
        className="admin-button"
        disabled={disabled || busy || loading}
        onClick={() => setRefresh((value) => value + 1)}
      >
        Osveži načrtovane objave
      </button>
      {loading && <p role="status">Nalagamo načrtovane objave …</p>}
      {!loading &&
        !error &&
        !items.some((item) => item.section === section) && (
          <p>Za to področje še ni načrtovanih objav.</p>
        )}
      <label className="admin-field">
        <span>Datum načrtovane objave</span>
        <input
          type="date"
          min={tomorrow.toISOString().slice(0, 10)}
          value={date}
          disabled={disabled || busy}
          onChange={(event) => setDate(event.target.value)}
        />
      </label>
      <button
        type="button"
        className="admin-button"
        disabled={disabled || busy || !date || !dirty}
        onClick={() => void schedule()}
      >
        Načrtuj objavo trenutnega osnutka
      </button>
      {items
        .filter((item) => item.section === section)
        .map((item) => (
          <article key={item.id} style={{ marginTop: 14 }}>
            <strong>
              {item.publishOn} · {statuses[item.status] || item.status}
            </strong>
            {item.error && <p role="alert">{item.error}</p>}
            {item.status === "pending" &&
              (owner || item.createdBy === user) && (
                <button
                  type="button"
                  className="admin-button"
                  disabled={disabled || busy}
                  onClick={() => void cancel(item.id)}
                >
                  Prekliči načrtovano objavo
                </button>
              )}
          </article>
        ))}
      {error && (
        <p role="alert" className="admin-error">
          {error}
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
    </details>
  );
}
