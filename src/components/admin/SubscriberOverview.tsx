import { useEffect, useRef, useState } from "react";
import type { District } from "./DistrictsEditor";
import { NOTIFICATION_TOPICS } from "../../../shared/notification-rules.js";
type Data = {
  items: {
    email: string;
    address: string;
    district_id: string;
    status: string;
    topics: string[];
  }[];
  counts: Record<string, number>;
  nextCursor?: string | null;
};
export default function SubscriberOverview({
  districts,
  onSessionExpired,
}: {
  districts: District[];
  onSessionExpired?: () => void;
}) {
  const expired = useRef(onSessionExpired);
  expired.current = onSessionExpired;
  const [data, setData] = useState<Data | null>(null),
    [error, setError] = useState(""),
    [district, setDistrict] = useState(""),
    [attempt, setAttempt] = useState(0);
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [cursors, setCursors] = useState([""]);
  const [page, setPage] = useState(0);
  const cursor = cursors[page] || "";
  useEffect(() => {
    const normalized = query.trim();
    if (normalized === search) return;
    const timer = setTimeout(() => {
      setSearch(normalized);
      setCursors([""]);
      setPage(0);
    }, 250);
    return () => clearTimeout(timer);
  }, [query, search]);
  useEffect(() => {
    const controller = new AbortController();
    setData(null);
    setError("");
    void fetch(
      "/api/admin/subscribers?" +
        new URLSearchParams({ district, q: search, cursor }),
      {
        signal: AbortSignal.any([
          controller.signal,
          AbortSignal.timeout(15000),
        ]),
        cache: "no-store",
      },
    )
      .then(async (r) => {
        const d = await r.json();
        if (r.status === 401 && !controller.signal.aborted) expired.current?.();
        if (!r.ok) throw Error(d.error || "Nalaganje ni uspelo.");
        if (!controller.signal.aborted) setData(d);
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      });
    return () => controller.abort();
  }, [district, search, cursor, attempt]);
  const labels: Record<string, string> = {
    pending: "Čaka na potrditev e-pošte",
    active: "Potrjena naročnina",
    unsubscribed: "Odjavljen",
    suppressed: "Pošiljanje ustavljeno",
  };
  return (
    <section className="admin-panel" style={{ padding: 20, marginTop: 24 }}>
      <h2>Naročniki po območjih</h2>
      <p>
        Stari zapisi med delovnimi nalogi še niso potrjene naročnine. Tukaj so
        nove prijave in njihove potrditve. Na strani je največ 50 prijav;
        starejše odprite z naslednjo stranjo ali poiščite po e-pošti oziroma
        naslovu.
      </p>
      <label className="admin-field">
        <span>Območje naročnikov</span>
        <select
          value={district}
          onChange={(e) => {
            setDistrict(e.target.value);
            setCursors([""]);
            setPage(0);
          }}
        >
          <option value="">Vsa območja</option>
          {districts.map((d) => (
            <option value={d.id} key={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      </label>
      <label className="admin-field">
        <span>Išči naročnike po e-pošti ali naslovu</span>
        <input
          type="search"
          value={query}
          maxLength={254}
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>
      <button
        type="button"
        className="admin-button"
        onClick={() => {
          setCursors([""]);
          setPage(0);
          setAttempt((n) => n + 1);
        }}
      >
        Osveži naročnike
      </button>
      {error && (
        <p className="admin-error" role="alert">
          {error}
        </p>
      )}
      {!data && !error && <p role="status">Nalagamo …</p>}
      {data && (
        <>
          <p>
            Za izbrano območje skupaj, ne glede na iskanje: potrjenih{" "}
            {data.counts.active || 0}, čaka na potrditev{" "}
            {data.counts.pending || 0}, odjavljenih{" "}
            {data.counts.unsubscribed || 0}. Pošiljanje ustavljeno:{" "}
            {data.counts.suppressed || 0}.
          </p>
          <p>
            Stran {page + 1} · prikazanih {data.items.length} naročnikov.
          </p>
          {!data.items.length && <p>Za izbrane pogoje ni naročnikov.</p>}
          <div style={{ display: "grid", gap: 12 }}>
            {data.items.map((item) => (
              <article
                key={item.email}
                style={{
                  borderBottom: "1px solid #dfe7df",
                  padding: "12px 0",
                  overflowWrap: "anywhere",
                }}
              >
                <strong>{item.email}</strong>
                <p>
                  {item.address} ·{" "}
                  {districts.find((d) => d.id === item.district_id)?.name ||
                    item.district_id}
                </p>
                <small>{labels[item.status] || item.status}</small>
                <p>
                  Teme:{" "}
                  {item.topics
                    .map(
                      (topic) =>
                        NOTIFICATION_TOPICS[
                          topic as keyof typeof NOTIFICATION_TOPICS
                        ] || topic,
                    )
                    .join(", ") || "Ni izbranih tem"}
                </p>
              </article>
            ))}
          </div>
          <div
            style={{
              display: "flex",
              gap: 12,
              alignItems: "center",
              marginTop: 16,
            }}
          >
            <button
              type="button"
              className="admin-button"
              disabled={page === 0}
              onClick={() => setPage((value) => value - 1)}
            >
              Prejšnja stran naročnikov
            </button>
            <button
              type="button"
              className="admin-button"
              disabled={!data.nextCursor}
              onClick={() => {
                if (!data.nextCursor) return;
                setCursors((previous) => [
                  ...previous.slice(0, page + 1),
                  data.nextCursor!,
                ]);
                setPage((value) => value + 1);
              }}
            >
              Naslednja stran naročnikov
            </button>
          </div>
        </>
      )}
    </section>
  );
}
