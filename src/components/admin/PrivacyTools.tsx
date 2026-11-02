import { useState, type FormEvent } from "react";

type Preview = {
  counts: Record<string, number>;
  confirmationToken: string;
  scopeNote?: string;
  note?: string;
};
const labels: Record<string, string> = {
  submissions: "Oddaje",
  contacts: "Kontaktna sporočila",
  cases: "Obravnave",
  events: "Opombe in dogodki",
  photos: "Fotografije",
  subscribers: "Naročnine",
  deliveries: "Dostave",
  outbox: "E-poštna sporočila",
};

export default function PrivacyTools({
  csrfToken,
  onSessionExpired,
}: {
  csrfToken: string;
  onSessionExpired?: () => void;
}) {
  const [reference, setReference] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const hasRecords =
    !!preview && Object.values(preview.counts).some((count) => count > 0);
  async function submit(event: FormEvent, erase = false) {
    event.preventDefault();
    if (busy || (erase && (!preview || !hasRecords))) return;
    const reviewed = preview;
    // A refresh or failed erase requires a fresh review and unchecked consent.
    setPreview(null);
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(
        `/api/admin/privacy/${erase ? "erase" : "preview"}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-CSRF-Token": csrfToken,
          },
          credentials: "same-origin",
          body: JSON.stringify({
            reference,
            ...(erase
              ? { confirmationToken: reviewed!.confirmationToken }
              : {}),
          }),
          signal: AbortSignal.timeout(40000),
        },
      );
      const data = await response.json();
      if (response.status === 401) onSessionExpired?.();
      if (!response.ok) throw Error(data.error || "Zahteve ni mogoče izvesti.");
      if (erase) {
        setPreview(null);
        setReference("");
        setNotice(
          "Izbrane evidence portala so izbrisane. Preverite še zunanje kopije in veljavno politiko varnostnih kopij.",
        );
      } else setPreview(data);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Povezava ni uspela.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="admin-panel" style={{ padding: 24 }}>
      <h2>Izbris osebnih podatkov</h2>
      <p>
        Izbris lahko izvede samo lastnik portala. Pred izbrisom preverite identiteto
        prosilca ter podlago in obseg zahteve. Vnesite e-poštni naslov za vse
        povezane oddaje in naročnino ali referenco KPV za posamezno oddajo.
      </p>
      <p>
        Izbris zajame povezane evidence in fotografije portala. Že dostavljena
        ali trenutno poslana pošta ter varnostne kopije zahtevajo ločeno
        obravnavo. Samodejni roki hrambe niso nastavljeni.
      </p>
      <form onSubmit={(event) => void submit(event)}>
        <label className="admin-field">
          <span>E-poštni naslov ali referenca oddaje</span>
          <input
            required
            maxLength={254}
            value={reference}
            disabled={busy}
            onChange={(event) => {
              setReference(event.target.value);
              setPreview(null);
              setError("");
              setNotice("");
            }}
          />
        </label>
        <button className="admin-button" disabled={busy}>
          {busy ? "Preverjamo …" : "Preveri obseg izbrisa"}
        </button>
      </form>
      {error && (
        <p role="alert" className="admin-error">
          {error}
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
      {preview && (
        <form onSubmit={(event) => void submit(event, true)}>
          <h3>Predogled izbrisa</h3>
          <ul>
            {Object.entries(preview.counts).map(([key, count]) => (
              <li key={key}>
                {labels[key] || key}: {count}
              </li>
            ))}
          </ul>
          {(preview.scopeNote || preview.note) && (
            <p>{preview.scopeNote || preview.note}</p>
          )}
          {hasRecords ? (
            <>
              <p>
                Izbris trajno odstrani navedene evidence iz portala. Potrditev
                velja deset minut. Če se podatki medtem spremenijo, morate znova preveriti obseg izbrisa.
              </p>
              <label className="admin-checkbox">
                <input type="checkbox" required disabled={busy} />
                Preveril sem zahtevo in potrjujem trajni izbris navedenih
                evidenc.
              </label>
              <button type="submit" className="admin-button" disabled={busy}>
                Trajno izbriši preverjene evidence
              </button>
            </>
          ) : (
            <p>
              Za vneseni naslov ali referenco ni evidenc za izbris. Preverite
              vnos.
            </p>
          )}
        </form>
      )}
    </section>
  );
}
