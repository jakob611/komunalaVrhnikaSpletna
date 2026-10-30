import { useEffect, useRef, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCheck,
  Clock3,
  ExternalLink,
  ListChecks,
  Plus,
  RefreshCw,
  Save,
  Search,
  Trash2,
  X,
} from "lucide-react";
import "./workqueue.css";

type Step = { id: string; text: string; done: boolean };
type Item = {
  id: string;
  kind: string;
  createdAt: string;
  status: string;
  payload: Record<string, unknown>;
  priority: string;
  assignee: string;
  dueDate: string;
  version: number;
  checklist: Step[];
  notes: string;
  updatedAt: string;
  notificationStatus?: string;
};
type Event = { id: string; createdAt: string; event: string; detail: string };
type Stats = {
  open: number;
  new: number;
  inProgress: number;
  overdue: number;
  resolved: number;
  notificationFailed?: number;
};
const states: Record<string, string> = {
  "demo-saved": "Novo",
  "in-progress": "V obravnavi",
  resolved: "Zaključeno",
  spam: "Neželena oddaja",
};
const kinds: Record<string, string> = {
  internal: "Interni nalog",
  reports: "Prijavljena težava",
  contact: "Kontaktno sporočilo",
  requests: "Povpraševanje",
  market: "Tržnica",
  subscriptions: "Naročilo obvestil",
};
const priorities: Record<string, string> = {
  low: "Nizka",
  normal: "Običajna",
  high: "Visoka",
  urgent: "Nujna",
};
const categories: Record<string, string> = {
  portal: "Spletni portal",
  roads: "Cesta",
  lighting: "Javna razsvetljava",
  bins: "Zabojnik",
  water: "Voda",
  waste: "Odpadki",
  billing: "Obračun",
  market: "Tržnica",
  depo: "DEPO",
  other: "Drugo",
  general: "Splošna obvestila",
};
const values: Record<string, string> = {
  supply: "Oskrba s pitno vodo", septic: "Greznice in male čistilne naprave",
  connection: "Priključki", collection: "Odvoz odpadkov in urnik",
  sorting: "Ločevanje in zbirna mesta", bulky: "Kosovni odpadki",
  road: "Vzdrževanje cest", lighting: "Javna razsvetljava", public: "Javne površine",
  invoice: "Računi", meter: "Odčitki števcev", payment: "Plačila",
  booking: "Prijava na tržnico", conditions: "Pogoji tržnice",
  donation: "Oddaja predmetov", purchase: "Nakup v DEPO",
  standard: "Standardno prodajno mesto", food: "Živilska ponudba", craft: "Rokodelski izdelki",
};
const displayValue = (value: unknown) => {
  const translate = (entry: unknown) => categories[String(entry)] || values[String(entry)] || String(entry);
  return Array.isArray(value) ? value.map(translate).join(", ") : translate(value);
};
const date = (value: string) =>
  new Intl.DateTimeFormat("sl-SI", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Ljubljana",
  }).format(new Date(value.length === 10 ? `${value}T12:00:00` : value));
const today = () =>
  new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Ljubljana" });
const title = (item: Item) =>
  String(
    item.payload.subject ||
      item.payload.description ||
      item.payload.address ||
      kinds[item.kind] ||
      "Nova oddaja",
  );
const closed = (item: Item) => ["resolved", "spam"].includes(item.status);
const labels: Record<string, string> = {
  name: "Pošiljatelj",
  email: "E-pošta",
  phone: "Telefon",
  address: "Naslov / lokacija",
  category: "Področje",
  subcategory: "Podpodročje",
  subject: "Zadeva",
  description: "Opis težave",
  message: "Sporočilo",
  service: "Storitev",
  date: "Želeni datum",
  preferredDate: "Želeni termin",
  products: "Ponudba",
  topics: "Izbrane teme",
  stallType: "Vrsta stojnice",
  latitude: "Zemljepisna širina",
  longitude: "Zemljepisna dolžina",
  createdBy: "Ustvaril skrbnik",
};
const emptyTask = () => ({
  title: "",
  description: "",
  category: "portal",
  address: "",
  priority: "normal",
  assignee: "",
  dueDate: "",
});

export default function WorkQueue({
  csrfToken,
  onSessionExpired,
  onDirtyChange,
  onBusyChange,
}: {
  csrfToken: string;
  onSessionExpired: () => void;
  onDirtyChange?: (dirty: boolean) => void;
  onBusyChange?: (busy: boolean) => void;
}) {
  const [params, setParams] = useSearchParams();
  const [items, setItems] = useState<Item[]>([]);
  const [stats, setStats] = useState<Stats>({
    open: 0,
    new: 0,
    inProgress: 0,
    overdue: 0,
    resolved: 0,
  });
  const [filters, setFilters] = useState({
    kind: "",
    status: "open",
    priority: "",
    overdue: false,
  });
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [conflict, setConflict] = useState(false);
  const [item, setItem] = useState<Item | null>(null);
  const [draft, setDraft] = useState<Item | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [caseError, setCaseError] = useState("");
  const [caseNotice, setCaseNotice] = useState("");
  const [caseLoading, setCaseLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newTask, setNewTask] = useState(emptyTask);
  const [createRequestId, setCreateRequestId] = useState(() =>
    crypto.randomUUID(),
  );
  const [createError, setCreateError] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const caseRequest = useRef<AbortController | null>(null);
  const expired = useRef(onSessionExpired);
  expired.current = onSessionExpired;
  const dirtyListener = useRef(onDirtyChange);
  dirtyListener.current = onDirtyChange;
  const busyListener = useRef(onBusyChange);
  busyListener.current = onBusyChange;
  const dirty =
    !!item && !!draft && JSON.stringify(item) !== JSON.stringify(draft);
  const caseId = params.get("case");
  const createDirty =
    creating && JSON.stringify(newTask) !== JSON.stringify(emptyTask());
  useEffect(() => {
    dirtyListener.current?.(dirty || createDirty);
  }, [dirty, createDirty]);
  useEffect(() => {
    busyListener.current?.(busy);
  }, [busy]);
  useEffect(
    () => () => {
      dirtyListener.current?.(false);
      busyListener.current?.(false);
    },
    [],
  );

  async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
    const response = await fetch(path, {
      ...init,
      credentials: "same-origin",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        "X-CSRF-Token": csrfToken,
        ...init.headers,
      },
      signal: init.signal || AbortSignal.timeout(20000),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (response.status === 401) expired.current();
      if (response.status === 409) setConflict(true);
      throw Error(body.error || "Zahteve trenutno ni mogoče izvesti.");
    }
    return body as T;
  }
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebounced(query);
      setPage(1);
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    const search = new URLSearchParams({
      kind: filters.kind,
      status: filters.status,
      priority: filters.priority,
      overdue: String(filters.overdue),
      page: String(page),
      q: debounced,
    });
    void api<{ items: Item[]; hasMore: boolean; total: number; stats: Stats }>(
      `/api/admin/work?${search}`,
      { signal: controller.signal },
    )
      .then((data) => {
        if (!controller.signal.aborted) {
          setItems(data.items);
          setHasMore(data.hasMore);
          setTotal(data.total);
          setStats(data.stats);
          if (!data.items.length && page > 1) setPage(page - 1);
        }
      })
      .catch((cause) => {
        if (!controller.signal.aborted)
          setError(cause.message || "Povezava ni uspela.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [filters, page, debounced, refresh, csrfToken]);
  async function open(id: string) {
    caseRequest.current?.abort();
    const controller = new AbortController();
    caseRequest.current = controller;
    setCaseLoading(true);
    setCaseError("");
    setCaseNotice("");
    setConflict(false);
    setItem(null);
    setDraft(null);
    try {
      const data = await api<{ item: Item; timeline: Event[] }>(
        `/api/admin/work/${encodeURIComponent(id)}`,
        { signal: controller.signal },
      );
      if (!controller.signal.aborted) {
        setItem(data.item);
        setDraft(structuredClone(data.item));
        setEvents(data.timeline);
      }
    } catch (cause) {
      if (!controller.signal.aborted)
        setCaseError(
          cause instanceof Error ? cause.message : "Naloga ni mogoče odpreti.",
        );
    } finally {
      if (!controller.signal.aborted) setCaseLoading(false);
    }
  }
  useEffect(() => {
    if (caseId) void open(caseId);
    else {
      caseRequest.current?.abort();
      setItem(null);
      setDraft(null);
      setCaseError("");
    }
    return () => caseRequest.current?.abort();
  }, [caseId]);
  useEffect(() => {
    if (caseId && !dialog.current?.open) dialog.current?.showModal();
    else if (!caseId && dialog.current?.open) {
      dialog.current?.close();
      requestAnimationFrame(() => {
        if (opener.current?.isConnected)
          opener.current.focus({ preventScroll: true });
        else
          document
            .querySelector<HTMLButtonElement>(".work-intro button")
            ?.focus({ preventScroll: true });
      });
    }
  }, [caseId]);
  useEffect(() => {
    if (!dirty && !createDirty) return;
    const stop = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", stop);
    return () => window.removeEventListener("beforeunload", stop);
  }, [dirty, createDirty]);
  function cancelCreate() {
    if (
      busy ||
      (createDirty && !window.confirm("Zavržem neshranjeni interni nalog?"))
    )
      return;
    setCreating(false);
    setNewTask(emptyTask());
    setCreateRequestId(crypto.randomUUID());
    setCreateError("");
  }
  async function createTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setCreateError("");
    try {
      const result = await api<{ item: Item }>("/api/admin/work", {
        method: "POST",
        body: JSON.stringify({ ...newTask, requestId: createRequestId }),
      });
      setCreating(false);
      setNewTask(emptyTask());
      setCreateRequestId(crypto.randomUUID());
      setRefresh((value) => value + 1);
      setNotice(
        "Interni nalog je ustvarjen. Določite korake in spremljajte obravnavo.",
      );
      select(result.item);
    } catch (cause) {
      setCreateError(
        cause instanceof Error
          ? cause.message
          : "Naloga ni bilo mogoče ustvariti.",
      );
    } finally {
      setBusy(false);
    }
  }
  function close() {
    if (busy) return;
    if (dirty && !window.confirm("Zavržem neshranjene spremembe obravnave?"))
      return;
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        next.delete("case");
        return next;
      },
      { replace: true },
    );
  }
  function select(value: Item) {
    opener.current = document.activeElement as HTMLElement;
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        next.set("case", value.id);
        return next;
      },
      { replace: true },
    );
  }
  async function save(status = draft?.status) {
    if (!draft || busy || !status) return;
    if (status === "resolved" && item?.status !== "resolved" &&
      draft.checklist.some((step) => !step.done) &&
      !window.confirm("Nekateri predlagani koraki niso označeni kot opravljeni. Želite nalog vseeno zaključiti? Koraki bodo ostali nespremenjeni.")) return;
    setBusy(true);
    setCaseError("");
    setCaseNotice("");
    setConflict(false);
    try {
      const data = await api<{ item: Item; timeline: Event[] }>(
        `/api/admin/work/${draft.id}`,
        { method: "PUT", body: JSON.stringify({ ...draft, status }) },
      );
      setItem(data.item);
      setDraft(structuredClone(data.item));
      setEvents(data.timeline);
      const message = status === "resolved" ? "Nalog je zaključen. Najdete ga med zaključenimi nalogi." : "Spremembe naloga so shranjene.";
      setNotice(message);
      setCaseNotice(message);
      setRefresh((value) => value + 1);
    } catch (cause) {
      setCaseError(
        cause instanceof Error
          ? cause.message
          : "Sprememb ni bilo mogoče shraniti.",
      );
    } finally {
      setBusy(false);
    }
  }
  const completed = draft?.checklist.filter((step) => step.done).length || 0;
  const checklistValid = !!draft && draft.checklist.every((step) => step.text.trim());
  const patch = (value: Partial<Item>) => {
    setCaseNotice("");
    setDraft((current) => (current ? { ...current, ...value } : current));
  };
  const filter = (key: keyof typeof filters, value: string | boolean) => {
    setPage(1);
    setFilters((current) => ({
      ...current, [key]: value,
      ...(key === "status" ? { overdue: false } : {}),
      ...(key === "overdue" && value ? { status: "open" } : {}),
    }));
  };
  function showSummary(status: string) {
    setPage(1);
    setQuery("");
    setDebounced("");
    setFilters({ kind: "", priority: "", status: status === "overdue" ? "open" : status, overdue: status === "overdue" });
  }
  return (
    <section className="work-queue" aria-label="Delovni nalogi">
      <div className="work-intro">
        <div>
          <span className="eyebrow">OD PRIJAVE DO REŠITVE</span>
          <h2>Delovni nalogi in prejeta sporočila</h2>
          <p>
            Odprite nalog, preberite podatke in ga prevzemite v obravnavo.
            Določite odgovorno osebo in rok, zapišite dogovor ter po opravljeni obravnavi zaključite nalog.
          </p>
        </div>
        <div className="work-intro-actions">
          <button
            className="admin-button admin-primary"
            type="button"
            disabled={busy || creating}
            onClick={() => {
              setCreating(true);
              setCreateError("");
            }}
          >
            <Plus size={16} />
            Nov interni nalog
          </button>
          <button
            className="admin-button"
            onClick={() => setRefresh((value) => value + 1)}
            disabled={loading}
          >
            <RefreshCw size={16} />
            Osveži
          </button>
        </div>
      </div>
      {creating && (
        <section
          className="admin-panel work-create"
          aria-labelledby="work-create-title"
        >
          <div className="admin-panel-heading">
            <h3 id="work-create-title">Nov interni nalog</h3>
            <button
              className="admin-icon-button"
              type="button"
              onClick={cancelCreate}
              disabled={busy}
              aria-label="Zapri nov interni nalog"
            >
              <X size={20} />
            </button>
          </div>
          <p id="work-create-help">
            Za popravke portala, opažene napake ali druga interna opravila.
            Nalog vidijo samo skrbniki; e-poštnega obvestila ali javne prijave
            ne pošlje.
          </p>
          <form onSubmit={createTask} aria-describedby="work-create-help">
            <fieldset disabled={busy}>
              <div className="work-fields">
                <label className="work-field-wide">
                  Naslov naloga · obvezno
                  <input
                    value={newTask.title}
                    required
                    minLength={3}
                    maxLength={250}
                    autoFocus
                    placeholder="Npr. Popravi povezavo do urnika v mobilnem meniju"
                    onChange={(event) =>
                      setNewTask((current) => ({
                        ...current,
                        title: event.target.value,
                      }))
                    }
                  />
                </label>
                <label>
                  Področje naloga
                  <select
                    value={newTask.category}
                    onChange={(event) =>
                      setNewTask((current) => ({
                        ...current,
                        category: event.target.value,
                      }))
                    }
                  >
              {Object.entries(categories).filter(([value]) => value !== "general").map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Prioriteta novega naloga
                  <select
                    value={newTask.priority}
                    onChange={(event) =>
                      setNewTask((current) => ({
                        ...current,
                        priority: event.target.value,
                      }))
                    }
                  >
                    {Object.entries(priorities).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Odgovorna oseba ali ekipa · neobvezno
                  <input
                    value={newTask.assignee}
                    maxLength={120}
                    onChange={(event) =>
                      setNewTask((current) => ({
                        ...current,
                        assignee: event.target.value,
                      }))
                    }
                  />
                </label>
                <label>
                  Rok novega naloga · neobvezno
                  <input
                    type="date"
                    value={newTask.dueDate}
                    onChange={(event) =>
                      setNewTask((current) => ({
                        ...current,
                        dueDate: event.target.value,
                      }))
                    }
                  />
                </label>
                <label className="work-field-wide">
                  Lokacija ali naslov strani · neobvezno
                  <input
                    value={newTask.address}
                    maxLength={500}
                    placeholder="Npr. /kontakt ali naslov težave"
                    onChange={(event) =>
                      setNewTask((current) => ({
                        ...current,
                        address: event.target.value,
                      }))
                    }
                  />
                </label>
              </div>
              <label className="work-notes">
                Opis naloga · neobvezno
                <textarea
                  rows={4}
                  value={newTask.description}
                  maxLength={5000}
                  placeholder="Kaj ne deluje, kako ponoviti težavo in kakšen rezultat pričakujete?"
                  onChange={(event) =>
                    setNewTask((current) => ({
                      ...current,
                      description: event.target.value,
                    }))
                  }
                />
              </label>
              {createError && (
                <p className="admin-message admin-message-error" role="alert">
                  {createError}
                </p>
              )}
              <div className="work-create-actions">
                <button
                  className="admin-button"
                  type="button"
                  onClick={cancelCreate}
                >
                  Prekliči
                </button>
                <button
                  className="admin-button admin-primary"
                  type="submit"
                  disabled={newTask.title.trim().length < 3}
                >
                  <Plus size={16} />
                  {busy ? "Ustvarjamo …" : "Ustvari interni nalog"}
                </button>
              </div>
            </fieldset>
          </form>
        </section>
      )}
      <div className="work-stats">
        {[
          { key: "open", label: "Odprti", value: stats.open },
          { key: "demo-saved", label: "Novi", value: stats.new },
          { key: "in-progress", label: "V obravnavi", value: stats.inProgress },
          { key: "overdue", label: "Čez rok", value: stats.overdue },
          { key: "resolved", label: "Zaključeni", value: stats.resolved },
        ].map((stat) => (
          <button
            key={stat.key}
            onClick={() => showSummary(stat.key)}
            aria-pressed={!filters.kind && !filters.priority && !query && (stat.key === "overdue" ? filters.overdue : !filters.overdue && filters.status === stat.key)}
            className={
              stat.key === "overdue" && stat.value ? "work-stat-overdue" : ""
            }
          >
            <strong>{stat.value}</strong>
            <span>{stat.label}</span>
          </button>
        ))}
      </div>
      {!!stats.notificationFailed && (
        <div className="work-warning">
          <AlertCircle size={18} />
          {stats.notificationFailed} e-poštnih obvestil ni bilo mogoče poslati.
          Oddaje ostajajo shranjene in jih lahko obravnavate tukaj.
        </div>
      )}
      <div className="admin-panel work-filters">
        <label className="work-search">
          <Search size={18} />
          <input
            aria-label="Iskanje po nalogih"
            placeholder="Ime, lokacija, referenca, odgovorna oseba ali opomba …"
            value={query}
            maxLength={150}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <div className="work-filter-selects">
          <label>
            Vrsta naloga
            <select
              value={filters.kind}
              onChange={(event) => filter("kind", event.target.value)}
            >
              <option value="">Vse vrste</option>
              {Object.entries(kinds).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Stanje
            <select
              value={filters.status}
              onChange={(event) => filter("status", event.target.value)}
            >
              <option value="open">Odprti nalogi</option>
              <option value="all">Vsa stanja</option>
              {Object.entries(states).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Prioriteta
            <select
              value={filters.priority}
              onChange={(event) => filter("priority", event.target.value)}
            >
              <option value="">Vse prioritete</option>
              {Object.entries(priorities).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="work-overdue-check">
            <input
              type="checkbox"
              checked={filters.overdue}
              onChange={(event) => filter("overdue", event.target.checked)}
            />
            Samo čez rok
          </label>
          <button className="admin-button" onClick={() => showSummary("all")}>
            Počisti filtre
          </button>
        </div>
      </div>
      {error && (
        <div className="admin-message admin-message-error" role="alert">
          {error}
        </div>
      )}
      {notice && (
        <p className="work-saved" role="status">
          <CheckCheck size={17} />
          {notice}
        </p>
      )}
      {!loading && !error && <p className="work-result-count" role="status">{total ? `Prikaz ${((page - 1) * 20) + 1}–${Math.min(page * 20, total)} od ${total} nalogov` : "Ni najdenih nalogov"} · seznam je razvrščen po prioriteti, nato po datumu prejema.</p>}
      <div className="admin-panel work-list" aria-busy={loading}>
        {loading ? (
          <p className="work-loading">Pridobivamo naloge …</p>
        ) : items.length ? (
          <ul>
            {items.map((entry) => (
              <li key={entry.id}>
                <button onClick={() => select(entry)}>
                  <span
                    className={`work-priority-dot priority-${entry.priority}`}
                    title={priorities[entry.priority]}
                  />
                  <span className="work-item-copy">
                    <span className="work-item-type">
                      {kinds[entry.kind]}
                      {entry.payload.category
                        ? ` · ${categories[String(entry.payload.category)] || entry.payload.category}`
                        : ""}
                    </span>
                    <strong>{title(entry)}</strong>
                    <small>
                      {String(
                        entry.payload.address || entry.payload.name || "",
                      )}{" "}
                      · {entry.id}
                    </small>
                    <span className="work-item-tags">
                      <i className={`work-status status-${entry.status}`}>
                        {states[entry.status]}
                      </i>
                      <i>{priorities[entry.priority]}</i>
                      {entry.assignee && <i>{entry.assignee}</i>}
                      {entry.dueDate && (
                        <i
                          className={
                            !closed(entry) && entry.dueDate < today()
                              ? "work-due-late"
                              : ""
                          }
                        >
                          Rok: {new Intl.DateTimeFormat("sl-SI").format(new Date(`${entry.dueDate}T12:00:00`))}
                        </i>
                      )}
                      {entry.notificationStatus === "failed" && (
                        <i className="work-due-late">E-pošta ni uspela</i>
                      )}
                    </span>
                  </span>
                  <span className="work-item-progress">
                    <ListChecks size={18} />
                    {entry.checklist.filter((step) => step.done).length}/
                    {entry.checklist.length}
                    <small>{date(entry.createdAt)}</small>
                    <ArrowRight size={18} />
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <div className="admin-empty">
            <ListChecks size={34} />
            <h3>Ni nalogov za te filtre.</h3>
            <p>
              Nove oddaje se pokažejo po osvežitvi seznama. Za pregled vseh nalogov počistite filtre.
            </p>
            <button className="admin-button" onClick={() => showSummary("all")}>Prikaži vse naloge</button>
          </div>
        )}
      </div>
      <div className="admin-pagination">
        <button
          className="admin-button"
          disabled={page === 1 || loading}
          onClick={() => setPage(page - 1)}
        >
          <ArrowLeft size={15} />
          Prejšnja
        </button>
        <span>Stran {page}</span>
        <button
          className="admin-button"
          disabled={!hasMore || loading}
          onClick={() => setPage(page + 1)}
        >
          Naslednja
          <ArrowRight size={15} />
        </button>
      </div>
      <p className="work-privacy">
        <Clock3 size={15} />
        Nalogi so interni. Sprememba stanja, opombe in zaključek ne pošljejo odgovora obiskovalcu.
        Obiskovalci nimajo dostopa do konzole. Nujne nevarnosti obravnavajte
        prek ustrezne dežurne službe.
      </p>
      <dialog
        className="work-dialog"
        ref={dialog}
        onCancel={(event) => {
          event.preventDefault();
          close();
        }}
        aria-labelledby="work-dialog-title"
      >
        <div className="work-dialog-heading">
          <div>
            <span className="eyebrow">
              {item ? kinds[item.kind] : "DELOVNI NALOG"}
            </span>
            <h2 id="work-dialog-title">
              {item ? title(item) : "Odpiranje naloga …"}
            </h2>
            {item && (
              <p>
                {item.id} · {date(item.createdAt)}
              </p>
            )}
          </div>
          <button
            className="admin-icon-button"
            aria-label="Zapri obravnavo"
            onClick={close}
            disabled={busy}
          >
            <X size={22} />
          </button>
        </div>
        {caseNotice && <p className="work-saved work-dialog-notice" role="status"><CheckCheck size={17} />{caseNotice}</p>}
        {caseError && (
          <div className="admin-message admin-message-error" role="alert">
            {caseError}
            {conflict && (
              <button
                className="admin-button"
                onClick={() => {
                  if (
                    !dirty ||
                    window.confirm(
                      "Zavržem lokalne spremembe in naložim novejšo obravnavo?",
                    )
                  )
                    void open(caseId!);
                }}
              >
                Ponovno naloži nalog
              </button>
            )}
          </div>
        )}
        {caseLoading ? (
          <p>Pridobivamo podatke …</p>
        ) : (
          item &&
          draft && (
            <div className="work-dialog-body">
              <section className="work-original">
                <h3>
                  {item.kind === "internal"
                    ? "Interni zapis"
                    : "Prvotna oddaja"}
                </h3>
                <dl>
                  {Object.entries(item.payload)
                    .filter(
                      ([key, value]) =>
                        key in labels &&
                        value !== "" &&
                        value !== null &&
                        value !== undefined,
                    )
                    .map(([key, value]) => (
                      <div key={key}>
                        <dt>
                          {key === "description" && item.kind === "internal"
                            ? "Opis naloga"
                            : labels[key]}
                        </dt>
                        <dd>
                          {key === "email" ? <a href={`mailto:${String(value)}`}>{String(value)}</a>
                            : key === "phone" ? <a href={`tel:${String(value).replace(/[^+\d]/g, "")}`}>{String(value)}</a>
                            : ["category", "subcategory", "service", "topics", "stallType"].includes(key) ? displayValue(value)
                            : String(value)}
                        </dd>
                      </div>
                    ))}
                </dl>
                {Boolean(item.payload.photoKey) && (
                  <a
                    href={`/api/admin/submissions/${item.id}/photo`}
                    target="_blank"
                    rel="noreferrer"
                    className="work-photo"
                  >
                    <img
                      src={`/api/admin/submissions/${item.id}/photo`}
                      alt="Fotografija iz prijave"
                    />
                    <span>
                      Odpri fotografijo
                      <ExternalLink size={14} />
                    </span>
                  </a>
                )}
                <p className="work-email-state">
                  {item.kind === "internal" ? (
                    "Interni nalog · brez samodejnega e-poštnega obvestila."
                  ) : (
                    <>
                      Obvestilo skrbniku:{" "}
                      {
                        (
                          {
                            sent: "posredovano storitvi Resend",
                            pending: "čaka na pošiljanje",
                            failed: "pošiljanje ni uspelo",
                            "not-queued": "ni v čakalni vrsti",
                          } as Record<string, string>
                        )[item.notificationStatus || "not-queued"]
                      }
                    </>
                  )}
                </p>
              </section>
              <section className="work-treatment">
                <h3>Obravnava naloga</h3>
                <div className="work-actions" aria-label="Sprememba stanja naloga">
                  <span className={`work-status status-${item.status}`}>{states[item.status]}</span>
                  {item.status === "demo-saved" && <button className="admin-button" disabled={busy || !checklistValid} onClick={() => void save("in-progress")}>Začni obravnavo</button>}
                  {closed(item) ? <button className="admin-button" disabled={busy || !checklistValid} onClick={() => void save("in-progress")}>Ponovno odpri nalog</button>
                    : <button className="admin-button admin-primary" disabled={busy || !checklistValid} onClick={() => void save("resolved")}><CheckCheck size={16} />Zaključi nalog</button>}
                </div>
                <p className="work-action-help">Gumbi za stanje shranijo tudi spodnje spremembe. Za odgovor pošiljatelju uporabite njegov e-poštni naslov.</p>
                <div className="work-fields">
                  <label>
                    Stanje obravnave
                    <select
                      value={draft.status}
                      onChange={(event) =>
                        patch({ status: event.target.value })
                      }
                      disabled={busy}
                    >
                      {Object.entries(states).map(([value, label]) => (
                        <option
                          key={value}
                          value={value}
                        >
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Prioriteta naloga
                    <select
                      value={draft.priority}
                      onChange={(event) =>
                        patch({ priority: event.target.value })
                      }
                      disabled={busy}
                    >
                      {Object.entries(priorities).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Odgovorna oseba ali ekipa
                    <input
                      value={draft.assignee}
                      maxLength={120}
                      placeholder="Npr. vzdrževalna ekipa"
                      onChange={(event) =>
                        patch({ assignee: event.target.value })
                      }
                      disabled={busy}
                    />
                  </label>
                  <label>
                    Rok obravnave
                    <input
                      type="date"
                      value={draft.dueDate}
                      onChange={(event) =>
                        patch({ dueDate: event.target.value })
                      }
                      disabled={busy}
                    />
                  </label>
                </div>
                <div className="work-checklist-heading">
                  <h3>Kontrolni seznam · neobvezno</h3>
                  <span>
                    {completed}/{draft.checklist.length}
                  </span>
                </div>
                <p className="work-action-help">Predlagane korake lahko prilagodite ali odstranite. Označite samo dejansko opravljena opravila.</p>
                <div className="work-progress-bar">
                  <span
                    style={{
                      width: `${draft.checklist.length ? (completed / draft.checklist.length) * 100 : 0}%`,
                    }}
                  />
                </div>
                <div className="work-checklist">
                  {draft.checklist.map((step, index) => (
                    <div key={step.id} className={step.done ? "is-done" : ""}>
                      <input
                        type="checkbox"
                        aria-label={`Opravljeno: ${step.text}`}
                        checked={step.done}
                        disabled={busy}
                        onChange={(event) =>
                          patch({
                            checklist: draft.checklist.map((current) =>
                              current.id === step.id
                                ? { ...current, done: event.target.checked }
                                : current,
                            ),
                          })
                        }
                      />
                      <input
                        aria-label={`Besedilo koraka ${index + 1}`}
                        value={step.text}
                        maxLength={300}
                        disabled={busy}
                        onChange={(event) =>
                          patch({
                            checklist: draft.checklist.map((current) =>
                              current.id === step.id
                                ? { ...current, text: event.target.value }
                                : current,
                            ),
                          })
                        }
                      />
                      <button
                        className="admin-icon-button"
                        aria-label={`Odstrani korak ${index + 1}`}
                        disabled={busy}
                        onClick={() =>
                          patch({
                            checklist: draft.checklist.filter(
                              (current) => current.id !== step.id,
                            ),
                          })
                        }
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  className="work-add-step"
                  disabled={busy || draft.checklist.length >= 30}
                  onClick={() =>
                    patch({
                      checklist: [
                        ...draft.checklist,
                        {
                          id: crypto.randomUUID(),
                          text: "Nov korak",
                          done: false,
                        },
                      ],
                    })
                  }
                >
                  <Plus size={16} />
                  Dodaj korak
                </button>
                <label className="work-notes">
                  Interne opombe
                  <textarea
                    value={draft.notes}
                    maxLength={5000}
                    rows={4}
                    placeholder="Kaj je bilo preverjeno, kaj je treba še urediti …"
                    onChange={(event) => patch({ notes: event.target.value })}
                    disabled={busy}
                  />
                  <small>
                    Opombe in ime odgovorne osebe so vidni samo prijavljenemu
                    skrbniku.
                  </small>
                </label>
                {!checklistValid && (
                  <p className="work-complete-hint">
                    Prazen korak dopolnite ali odstranite, preden shranite nalog.
                  </p>
                )}
                <div className="work-save">
                  <span>
                    {dirty
                      ? "Neshranjene spremembe"
                      : `Shranjeno · različica ${item.version}`}
                  </span>
                  <button
                    className="admin-button admin-primary"
                    disabled={
                      !dirty ||
                      busy ||
                      !checklistValid
                    }
                    onClick={() => void save()}
                  >
                    <Save size={17} />
                    {busy ? "Shranjujemo …" : "Shrani obravnavo"}
                  </button>
                </div>
                <div className="work-timeline">
                  <h3>Zgodovina obravnave</h3>
                  {events.length ? (
                    <ol>
                      {events.map((event) => (
                        <li key={event.id}>
                          <time>{date(event.createdAt)}</time>
                          <p>{event.detail}</p>
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <p>
                      Obravnava še ni bila spremenjena. Vsako shranjevanje doda
                      zapis v zgodovino.
                    </p>
                  )}
                </div>
              </section>
            </div>
          )
        )}
      </dialog>
    </section>
  );
}
