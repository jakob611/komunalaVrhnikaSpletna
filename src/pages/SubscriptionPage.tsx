import { useEffect, useRef, useState, type FormEvent } from "react";
import { useSiteContent } from "../content/SiteContent";
import { useLocation, useNavigate, Link } from "react-router-dom";
import { NOTIFICATION_TOPICS } from "../../shared/notification-rules.js";
import VerifiedAddressPicker, { type VerifiedAddress } from "../components/VerifiedAddressPicker";

type Preferences = {
  status?: string;
  address: string;
  districtId: string;
  topics: string[];
  addressId?: string;
};
class SubscriptionRequestError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}
export default function SubscriptionPage() {
  const location = useLocation(),
    navigate = useNavigate(),
    { districts } = useSiteContent();
  const params = new URLSearchParams(location.hash.slice(1) || location.search);
  const token = params.get("token") || "",
    rawAction = params.get("action");
  const action =
    rawAction === "confirm"
      ? "confirm"
      : rawAction === "unsubscribe"
        ? "unsubscribe"
        : "manage";
  const [manageToken, setManageToken] = useState("");
  const [verifiedAddress, setVerifiedAddress] = useState<VerifiedAddress | null>(null);
  const context = JSON.stringify([token, action]);
  const currentContext = useRef(context);
  currentContext.current = context;
  const mutation = useRef<symbol | null>(null);
  // Move older email links out of the address query before any API request.
  useEffect(() => {
    if (location.search && token)
      navigate(
        {
          pathname: location.pathname,
          search: "",
          hash: new URLSearchParams({ action, token }).toString(),
        },
        { replace: true },
      );
  }, [location.pathname, location.search, token, action, navigate]);
  const [value, setValue] = useState<Preferences | null>(null),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  const [inspectionAttempt, setInspectionAttempt] = useState(0);
  const [canRetryInspection, setCanRetryInspection] = useState(false);
  async function request(
    data: Record<string, unknown> = { action: "inspect" },
  ) {
    const response = await fetch(`/api/subscriptions/${action}`, {
      method: "POST",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...data, token }),
      signal: AbortSignal.timeout(15000),
    });
    const result = await response.json();
    if (!response.ok) throw new SubscriptionRequestError(result.error || "Zahteva ni uspela.", response.status);
    return result;
  }
  useEffect(() => {
    let active = true;
    mutation.current = null;
    setBusy(false);
    setCanRetryInspection(false);
    setError("");
    setValue(null);
    setMessage("");
    setManageToken("");
    setVerifiedAddress(null);
    void request()
      .then((data) => {
        if (active) setValue(data);
      })
      .catch((cause) => {
        if (!active) return;
        setError(cause instanceof SubscriptionRequestError ? cause.message : "Nastavitev trenutno ni mogoče naložiti. Preverite povezavo in poskusite znova.");
        setCanRetryInspection(!(cause instanceof SubscriptionRequestError) || cause.status >= 500 || cause.status === 408 || cause.status === 429);
      });
    return () => {
      active = false;
      mutation.current = null;
    };
  }, [token, action, inspectionAttempt]);
  async function save(event: FormEvent, unsubscribe = false) {
    event.preventDefault();
    if (busy || mutation.current) return;
    if (!unsubscribe && action === "manage" && !verifiedAddress) {
      setError("Izberite preverjen naslov iz seznama.");
      return;
    }
    const attempt = Symbol("subscription mutation");
    mutation.current = attempt;
    const stillCurrent = () => mutation.current === attempt && currentContext.current === context;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const data = await request(
        unsubscribe || action === "unsubscribe"
          ? { action: "unsubscribe" }
          : { ...value, ...(action === "manage" && verifiedAddress ? {address:verifiedAddress.address,addressId:verifiedAddress.id,districtId:verifiedAddress.municipalityId} : {}) },
      );
      if (!stillCurrent()) return;
      setMessage(data.message);
      if (data.manageToken) setManageToken(data.manageToken);
      if (unsubscribe || action === "unsubscribe" || action === "confirm")
        setValue(null);
    } catch (cause) {
      if (stillCurrent()) setError(cause instanceof Error ? cause.message : "Zahteva ni uspela.");
    } finally {
      if (stillCurrent()) {
        mutation.current = null;
        setBusy(false);
      }
    }
  }
  return (
    <div className="container inner-page">
      <header className="page-intro">
        <span className="eyebrow">E-OBVESTILA KPV</span>
        <h1>
          {action === "confirm" ? "Potrditev naročnine" : action === "unsubscribe" ? "Odjava e-obvestil" : "Nastavitve e-obvestil"}
        </h1>
        <p>Povezava je osebna. Ne posredujte je drugim.</p>
      </header>
      <section className="panel" style={{ maxWidth: 720 }}>
        {error && (
          <p className="svc-error" role="alert">
            {error}
          </p>
        )}
        {error && canRetryInspection && !value && <button type="button" className="button secondary" onClick={() => setInspectionAttempt(attempt => attempt + 1)}>Poskusi znova</button>}
        {message && (
          <p className="svc-success" role="status">
            {message}
          </p>
        )}
        {manageToken && (
          <p>
            <Link
              to={
                "#" +
                new URLSearchParams({ action: "manage", token: manageToken })
              }
            >
              Uredi nastavitve in naslov
            </Link>
          </p>
        )}
        {!value && !error && !message && (
          <p role="status">Nalagamo nastavitve …</p>
        )}
        {value &&
          (action === "unsubscribe" ? (
            <form onSubmit={save}>
              <p>Ta povezava omogoča samo odjavo e-obvestil.</p>
              <button className="button" disabled={busy}>
                {busy ? "Shranjujemo …" : "Odjavi vsa e-obvestila"}
              </button>
            </form>
          ) : action === "confirm" ? (
            <form onSubmit={save}>
              <p>
                Območje:{" "}
                <strong>
                  {districts.find((d) => d.id === value.districtId)?.name ||
                    value.districtId}
                </strong>
              </p>
              <p>Naslov: {value.address}</p>
              <p>
                Teme:{" "}
                {value.topics
                  .map(
                    (key) =>
                      NOTIFICATION_TOPICS[
                        key as keyof typeof NOTIFICATION_TOPICS
                      ],
                  )
                  .join(", ")}
              </p>
              <p>
                Po potrditvi boste prejemali obvestila o izbranih temah za ta naslov.
                Morebitno prejšnjo naročnino na tem e-poštnem naslovu
                nadomestimo s temi nastavitvami.
              </p>
              <button className="button" disabled={busy}>
                {busy ? "Potrjujemo …" : "Potrdi naročnino"}
              </button>
            </form>
          ) : (
            <form onSubmit={save} onChange={() => { setMessage(""); setError(""); }}>
              <p>
                Stanje:{" "}
                {value.status === "active"
                  ? "Potrjena naročnina"
                  : value.status === "unsubscribed"
                    ? "Odjavljena naročnina"
                    : "Naročnina še ni aktivna"}
              </p>
              <fieldset
                disabled={busy || value.status !== "active"}
                style={{ border: 0, padding: 0 }}
              >
                <VerifiedAddressPicker key={`${token}:${action}`} id="managed-subscription-address" label="Celoten naslov" required disabled={busy || value.status !== "active"} value={value.address}
                  onChange={address => {setMessage("");setError("");setValue(current=>current?{...current,address,addressId:undefined}:current);}}
                  onSelect={record => {setVerifiedAddress(record); if(record)setValue(current=>current?{...current,address:record.address,addressId:record.id,districtId:record.municipalityId}:current);}}/>
                <p role="status">Občina obveščanja: {verifiedAddress ? verifiedAddress.municipality : "določena bo po preverjanju naslova"}.</p>
                {verifiedAddress&&!districts.some(d=>d.active&&d.id===verifiedAddress.municipalityId)&&<p className="svc-error">Za to občino obveščanje trenutno ni omogočeno. Obrnite se na KPV.</p>}
                <fieldset className="svc-topics">
                  <legend>Teme obveščanja</legend>
                  {Object.entries(NOTIFICATION_TOPICS).map(([key, label]) => (
                    <label key={key}>
                      <input
                        type="checkbox"
                        checked={value.topics.includes(key)}
                        onChange={(e) =>
                          setValue({
                            ...value,
                            topics: e.target.checked
                              ? [...value.topics, key]
                              : value.topics.filter((t) => t !== key),
                          })
                        }
                      />
                      {label}
                    </label>
                  ))}
                </fieldset>
                <button
                  className="button"
                  disabled={busy || !value.topics.length || !verifiedAddress || !districts.some(d=>d.active&&d.id===verifiedAddress.municipalityId)}
                >
                  Shrani nastavitve
                </button>
              </fieldset>
              <button
                type="button"
                className="button secondary"
                style={{ marginTop: 20 }}
                disabled={busy}
                onClick={(e) => void save(e, true)}
              >
                Odjavi vsa e-obvestila
              </button>
            </form>
          ))}
        <p style={{ marginTop: 24 }}>
          <Link to="/obvestila#narocilo">
            Nova prijava ali nova potrditvena povezava
          </Link>
        </p>
      </section>
    </div>
  );
}
