import { useEffect, useRef, useState } from "react";

type Result = {
  recipients: number;
  alreadyQueued: boolean;
  status: string | null;
  deliveries: Record<string, number>;
};
export default function NoticeDelivery({
  noticeId,
  revision,
  csrfToken,
  dirty,
  onSessionExpired,
}: {
  noticeId: string;
  revision: number;
  csrfToken: string;
  dirty: boolean;
  onSessionExpired?: () => void;
}) {
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const request = useRef<AbortController | null>(null);
  const context = JSON.stringify([noticeId, revision, csrfToken, dirty]);
  const currentContext = useRef(context);
  currentContext.current = context;

  useEffect(() => {
    request.current?.abort();
    request.current = null;
    setBusy(false);
    setResult(null);
    setError("");
    setMessage("");
    return () => {
      request.current?.abort();
      request.current = null;
    };
  }, [context]);

  async function run(preview: boolean) {
    if (
      dirty ||
      request.current ||
      (!preview && (!result || result.alreadyQueued || !result.recipients))
    )
      return;
    const controller = new AbortController();
    request.current = controller;
    const requestedContext = context;
    const stillCurrent = () =>
      !controller.signal.aborted &&
      request.current === controller &&
      currentContext.current === requestedContext;
    setBusy(true);
    setResult(null);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/admin/notice-delivery", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": csrfToken,
        },
        body: JSON.stringify({ noticeId, revision, preview }),
        signal: AbortSignal.any([
          controller.signal,
          AbortSignal.timeout(30000),
        ]),
      });
      const data = await response.json();
      if (!stillCurrent()) return;
      if (response.status === 401) onSessionExpired?.();
      if (!response.ok) throw Error(data.error || "Zahteva ni uspela.");
      setResult(data);
      if (!preview)
        setMessage(
          "Pošiljanje je v čakalni vrsti. Stanje osvežite z gumbom »Preveri prejemnike in dostavo«.",
        );
    } catch (cause) {
      if (stillCurrent())
        setError(
          cause instanceof Error ? cause.message : "Povezava ni uspela.",
        );
    } finally {
      // A superseded response must not unlock a newer request's controls.
      if (request.current === controller) {
        request.current = null;
        setBusy(false);
      }
    }
  }
  return (
    <section className="notice-editor-preview">
      <h3>E-poštno obveščanje naročnikov</h3>
      <p>
        Najprej shranite in objavite obvestilo. Nato preverite prejemnike in
        potrdite pošiljanje. Pošiljanje zajame samo potrjene naročnike za
        izbrana območja, naslove in temo. Število v predogledu je trenutno
        stanje. Ob uvrstitvi v čakalno vrsto prejemnike preverimo znova; nove
        potrditve, odjave ali spremembe nastavitev lahko spremenijo končno
        število.
      </p>
      {dirty && <p role="status">Pred preverjanjem shranite spremembe.</p>}
      <button
        type="button"
        className="admin-button"
        disabled={dirty || busy}
        onClick={() => void run(true)}
      >
        {busy ? "Preverjamo …" : "Preveri prejemnike in dostavo"}
      </button>
      {result && (
        <div role="status">
          <p>
            Potrjeni naročniki za to obvestilo: <strong>{result.recipients}</strong>.
          </p>
          {result.alreadyQueued ? (
            <>
              <p>
                {result.status === "cancelled"
                  ? "Pošiljanje te različice je preklicano. Neposlana sporočila ne bodo poslana; te različice ni mogoče poslati znova."
                  : "Ta različica je že uvrščena za pošiljanje; ponovno je ne pošljemo."}
              </p>
              {!!result.deliveries.failed && (
                <p>
                  Neuspešne ali preklicane dostave niso ponovno poslane s tem
                  gumbom. Preverite veljavnost obvestila in prejemnike; pri
                  težavi s pošto naj lastnik pregleda stanje dostave pri
                  ponudniku. Sprejeto pri ponudniku še ne potrjuje prejema v
                  predal.
                </p>
              )}
              <p>
                Priprava:{" "}
                {result.status === "complete"
                  ? "zaključena"
                  : result.status === "cancelled"
                    ? "preklicana"
                    : "v teku"}{" "}
                · v čakanju: {result.deliveries.pending || 0} · sprejeto pri
                ponudniku: {result.deliveries.sent || 0} · neuspešno ali
                preklicano: {result.deliveries.failed || 0}
              </p>
            </>
          ) : (
            <button
              type="button"
              className="admin-button admin-primary"
              disabled={busy || !result.recipients || dirty}
              onClick={() => void run(false)}
            >
              Potrdi pošiljanje za {result.recipients} naročnikov
            </button>
          )}
          {!result.alreadyQueued && !result.recipients && (
            <p>
              Za izbrano temo, območja in naslove ni potrjenih prejemnikov.
              Preverite izbrana območja, naslove in potrjene naročnine, preden
              poskusite znova.
            </p>
          )}
        </div>
      )}
      {error && (
        <p className="admin-error" role="alert">
          {error}
        </p>
      )}
      {message && <p role="status">{message}</p>}
    </section>
  );
}
