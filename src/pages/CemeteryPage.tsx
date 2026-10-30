import { CmsLayout, CmsLink as Link, CmsAnchor } from "../content/PageComposer";
import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import { useSearchParams } from "react-router-dom";
import {
  ArrowRight,
  Check,
  ChevronRight,
  Compass,
  Copy,
  Flower2,
  Info,
  Layers3,
  MapPin,
  Minus,
  Move,
  Plus,
  RotateCcw,
  Search,
  X,
} from "lucide-react";
import { findGraves, type Grave } from "../data/cemetery";
import { useSiteContent } from "../content/SiteContent";
import "./cemetery.css";

const dateLabel = (value: string) =>
  new Intl.DateTimeFormat("sl-SI", {
    day: "numeric",
    month: "numeric",
    year: "numeric",
  }).format(new Date(`${value}T12:00:00`));
const shortDate = (value: string) => value.slice(0, 4);
const motion = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ? ("auto" as const)
    : ("smooth" as const);
const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(maximum, Math.max(minimum, value));
const MAX_ZOOM = 4;

function GraveMap({
  matches,
  selected,
  activeFilter,
  onSelect,
  plots: graves,
  plan: cemeteryPlan,
}: {
  matches: Grave[];
  selected: Grave | null;
  activeFilter: boolean;
  onSelect: (grave: Grave) => void;
  plots: Grave[];
  plan: { width: number; height: number; imageUrl: string | null };
}) {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [focused, setFocused] = useState(selected?.id || graves[0]?.id || "");
  const svg = useRef<SVGSVGElement>(null);
  const drag = useRef<{
    x: number;
    y: number;
    panX: number;
    panY: number;
    moved: boolean;
  } | null>(null);
  const moved = useRef(false);
  const width = cemeteryPlan.width / zoom;
  const height = cemeteryPlan.height / zoom;
  const left = (cemeteryPlan.width - width) / 2;
  const top = (cemeteryPlan.height - height) / 2;
  useEffect(() => {
    if (!graves.some((grave) => grave.id === focused))
      setFocused(selected?.id || graves[0]?.id || "");
  }, [graves, focused, selected?.id]);
  useEffect(() => {
    if (!selected) return;
    setFocused(selected.id);
    if (zoom > 1)
      setPan({
        x: clamp(selected.x + 18 - cemeteryPlan.width / 2, -left, left),
        y: clamp(selected.y + 16 - cemeteryPlan.height / 2, -top, top),
      });
    // Keep a newly selected plot in view at the current zoom.
  }, [selected?.id]);
  const ids = new Set(matches.map((grave) => grave.id));
  function changeZoom(next: number) {
    const value = clamp(next, 1, MAX_ZOOM);
    setZoom(value);
    setPan({ x: 0, y: 0 });
  }
  function choose(grave: Grave) {
    if (!moved.current) {
      setFocused(grave.id);
      onSelect(grave);
    }
  }
  function keyboard(event: KeyboardEvent<SVGGElement>, grave: Grave) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onSelect(grave);
      return;
    }
    const direction = (
      {
        ArrowLeft: [-1, 0],
        ArrowRight: [1, 0],
        ArrowUp: [0, -1],
        ArrowDown: [0, 1],
      } as Record<string, number[]>
    )[event.key];
    if (!direction) return;
    event.preventDefault();
    const candidate = graves
      .filter((item) =>
        direction[0]
          ? (item.x - grave.x) * direction[0] > 0 && item.y === grave.y
          : (item.y - grave.y) * direction[1] > 0 && item.x === grave.x,
      )
      .sort(
        (a, b) =>
          Math.abs(a.x - grave.x) +
          Math.abs(a.y - grave.y) -
          Math.abs(b.x - grave.x) -
          Math.abs(b.y - grave.y),
      )[0];
    if (candidate) {
      setFocused(candidate.id);
      onSelect(candidate);
      svg.current
        ?.querySelector<SVGGElement>(`[data-grave="${candidate.id}"]`)
        ?.focus();
      setPan({
        x: clamp(candidate.x - cemeteryPlan.width / 2 + 18, -left, left),
        y: clamp(candidate.y - cemeteryPlan.height / 2 + 16, -top, top),
      });
    }
  }
  function pointerDown(event: PointerEvent<SVGSVGElement>) {
    if (!event.isPrimary) return;
    moved.current = false;
    if (zoom === 1 || event.button !== 0) return;
    drag.current = {
      x: event.clientX,
      y: event.clientY,
      panX: pan.x,
      panY: pan.y,
      moved: false,
    };
    // Capture on the actual target so a stationary tap still reaches its grave.
    (event.target as Element).setPointerCapture(event.pointerId);
  }
  function pointerMove(event: PointerEvent<SVGSVGElement>) {
    if (!event.isPrimary || !drag.current || !svg.current) return;
    if (event.pointerType === "mouse" && event.buttons === 0) {
      drag.current = null;
      return;
    }
    const dx = event.clientX - drag.current.x,
      dy = event.clientY - drag.current.y;
    if (Math.abs(dx) + Math.abs(dy) < 7 && !drag.current.moved) return;
    drag.current.moved = true;
    moved.current = true;
    const box = svg.current.getBoundingClientRect();
    setPan({
      x: clamp(drag.current.panX - (dx * width) / box.width, -left, left),
      y: clamp(drag.current.panY - (dy * height) / box.height, -top, top),
    });
  }
  function centerSelected() {
    if (!selected) return;
    const newZoom = 2;
    setZoom(newZoom);
    setPan({
      x: clamp(
        selected.x + 18 - cemeteryPlan.width / 2,
        -cemeteryPlan.width / 4,
        cemeteryPlan.width / 4,
      ),
      y: clamp(
        selected.y + 16 - cemeteryPlan.height / 2,
        -cemeteryPlan.height / 4,
        cemeteryPlan.height / 4,
      ),
    });
  }
  return (
    <section
      className="cemetery-map-panel"
      aria-labelledby="cemetery-map-title"
    >
      <div className="cemetery-map-heading">
        <div>
          <span className="eyebrow">POGLED OD ZGORAJ</span>
          <h2 id="cemetery-map-title">Vsak spomin ima svoje mesto.</h2>
        </div>
        <span className="cemetery-plan-tag">
          <Layers3 size={15} /> Načrt pokopališča
        </span>
      </div>
      <div className="cemetery-map" data-motion-managed="true">
        <div className="cemetery-map-controls" aria-label="Povečava načrta">
          <button
            type="button"
            aria-label="Povečaj načrt"
            onClick={() => changeZoom(zoom + 0.5)}
            disabled={zoom >= MAX_ZOOM}
          >
            <Plus size={19} />
          </button>
          <span>{Math.round(zoom * 100)} %</span>
          <button
            type="button"
            aria-label="Pomanjšaj načrt"
            onClick={() => changeZoom(zoom - 0.5)}
            disabled={zoom <= 1}
          >
            <Minus size={19} />
          </button>
          <button
            type="button"
            aria-label="Ponastavi pogled načrta"
            onClick={() => {
              changeZoom(1);
            }}
          >
            <RotateCcw size={17} />
          </button>
        </div>
        <svg
          ref={svg}
          viewBox={`${left + pan.x} ${top + pan.y} ${width} ${height}`}
          role="group"
          aria-label={`Interaktivni načrt s ${graves.length} grobovi. S tipko Tab vstopite, s puščicami izberete sosednji grob.`}
          style={{
            touchAction: zoom > 1 ? "none" : "pan-y",
            aspectRatio: `${cemeteryPlan.width}/${cemeteryPlan.height}`,
            cursor: zoom > 1 ? "grab" : "default",
          }}
          onPointerDown={pointerDown}
          onPointerMove={pointerMove}
          onPointerUp={(event) => {
            if (event.isPrimary) drag.current = null;
          }}
          onLostPointerCapture={(event) => {
            if (event.isPrimary) drag.current = null;
          }}
          onPointerCancel={(event) => {
            if (!event.isPrimary) return;
            drag.current = null;
            moved.current = false;
          }}
        >
          <title>Načrt pokopališča in lokacije grobov</title>
          <defs>
            <pattern
              id="cemetery-lawn"
              width="24"
              height="24"
              patternUnits="userSpaceOnUse"
            >
              <rect width="24" height="24" fill="#e3ebd9" />
              <circle cx="4" cy="8" r=".8" fill="#c9d6bf" />
              <circle cx="19" cy="20" r=".7" fill="#c9d6bf" />
            </pattern>
            <filter id="cemetery-shadow">
              <feDropShadow
                dx="0"
                dy="2"
                stdDeviation="2"
                floodColor="#294d30"
                floodOpacity=".12"
              />
            </filter>
          </defs>
          {cemeteryPlan.imageUrl ? (
            <image
              href={cemeteryPlan.imageUrl}
              width={cemeteryPlan.width}
              height={cemeteryPlan.height}
              preserveAspectRatio="none"
            />
          ) : <rect width={cemeteryPlan.width} height={cemeteryPlan.height} fill="#eef1e7" />}
          {graves.map((grave) => {
            const isSelected = grave.id === selected?.id;
            const isMatch = activeFilter && ids.has(grave.id);
            return (
              <g
                key={grave.id}
                role="button"
                tabIndex={focused === grave.id ? 0 : -1}
                data-grave={grave.id}
                aria-pressed={isSelected}
                aria-label={`Grob ${grave.id}: ${grave.people.map((person) => `${person.name}, ${shortDate(person.born)}–${shortDate(person.died)}`).join("; ")}.`}
                className={`cemetery-grave${isSelected ? " is-selected" : ""}${isMatch ? " is-match" : ""}${activeFilter && !ids.has(grave.id) ? " is-dimmed" : ""}`}
                onClick={() => choose(grave)}
                onFocus={() => setFocused(grave.id)}
                onKeyDown={(event) => keyboard(event, grave)}
              >
                <title>
                  {grave.people.map((person) => person.name).join(" · ")} ·{" "}
                  {grave.id}
                </title>
                <rect
                  className="cemetery-grave-hit"
                  x={grave.x - 4}
                  y={grave.y - 5}
                  width="44"
                  height="44"
                  rx="8"
                  fill="transparent"
                />
                <rect
                  className="cemetery-grave-stone"
                  x={grave.x}
                  y={grave.y}
                  width="36"
                  height="32"
                  rx="4"
                  filter="url(#cemetery-shadow)"
                />
                <path
                  d={`M${grave.x + 9} ${grave.y + 7}h18M${grave.x + 12} ${grave.y + 11}h12`}
                  stroke="currentColor"
                  strokeWidth="1.5"
                  opacity=".5"
                  aria-hidden="true"
                />
                <text
                  x={grave.x + 18}
                  y={grave.y + 25}
                  textAnchor="middle"
                  fontSize="10"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  {String(grave.row)}·{String(grave.number)}
                </text>
                {isSelected && (
                  <circle
                    className="cemetery-selection-ring"
                    cx={grave.x + 18}
                    cy={grave.y + 16}
                    r="27"
                    fill="none"
                    stroke="#194f3a"
                    strokeWidth="2"
                    strokeDasharray="3 4"
                    aria-hidden="true"
                  />
                )}
              </g>
            );
          })}
        </svg>
        {zoom > 1 && (
          <span className="cemetery-pan-tip">
            <Move size={14} /> Za premik povlecite načrt
          </span>
        )}
      </div>
      <div className="cemetery-map-footer">
        <div className="cemetery-legend">
          <span>
            <i /> Grob
          </span>
          <span>
            <i className="match" /> Zadetek
          </span>
          <span>
            <i className="selected" /> Izbrani grob
          </span>
        </div>
        {selected && (
          <button
            type="button"
            className="cemetery-text-action"
            onClick={centerSelected}
          >
            <MapPin size={15} /> Povečaj izbrani grob
          </button>
        )}
      </div>
      <p className="cemetery-map-note">
        Kliknite grob za podatke. Načrt lahko povečate in premikate.
      </p>
    </section>
  );
}

export default function CemeteryPage() {
  const { cemetery } = useSiteContent();
  const graves = cemetery.graves;
  const sections = [...new Set(graves.map((grave) => grave.section))].sort();
  const [params, setParams] = useSearchParams();
  const query = (params.get("iskanje") || "").slice(0, 120);
  const section = sections.includes(params.get("oddelek") || "")
    ? params.get("oddelek")!
    : "all";
  const results = findGraves(query, section, graves);
  const selected =
    graves.find((grave) => grave.id === params.get("grob")) || null;
  const [limit, setLimit] = useState(8);
  const [copied, setCopied] = useState(false);
  const [showCopy, setShowCopy] = useState(false);
  const detail = useRef<HTMLElement>(null);
  const selectionTrigger = useRef<HTMLElement | SVGElement | null>(null);
  const feedback = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (feedback.current) clearTimeout(feedback.current);
    },
    [],
  );
  function filter(value: string, key: "iskanje" | "oddelek") {
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        value && value !== "all" ? next.set(key, value) : next.delete(key);
        next.delete("grob");
        return next;
      },
      { replace: true },
    );
    setLimit(8);
    setCopied(false);
    setShowCopy(false);
  }
  function select(grave: Grave) {
    const trigger = document.activeElement;
    selectionTrigger.current =
      trigger instanceof HTMLElement || trigger instanceof SVGElement
        ? trigger
        : null;
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        next.set("grob", grave.id);
        if (!results.some((result) => result.id === grave.id)) {
          next.delete("iskanje");
          next.delete("oddelek");
        }
        return next;
      },
      { replace: true },
    );
    setCopied(false);
    setShowCopy(false);
  }
  async function share() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      if (feedback.current) clearTimeout(feedback.current);
      feedback.current = setTimeout(() => setCopied(false), 3000);
    } catch {
      setShowCopy(true);
    }
  }
  const peopleCount = results.reduce(
    (total, grave) => total + grave.people.length,
    0,
  );
  if (!graves.length) return (
    <div className="cemetery-page">
      <CmsLayout>
        <header className="cemetery-intro" data-motion-section>
          <div><span className="eyebrow"><Flower2 size={16} /> POKOPALIŠČE VRHNIKA</span>
            <h1>Informacije za svojce<br /><em>in obiskovalce.</em></h1>
            <p>Za informacije o grobnem mestu, najemu in vzdrževanju centralnega pokopališča Vrhnika se obrnite na upravljavca.</p>
          </div>
          <div className="cemetery-intro-art" aria-hidden="true"><div className="cemetery-flower-circle"><Flower2 strokeWidth={1} size={76} /></div><span>Prostor spomina.</span></div>
        </header>
        <section className="cemetery-help" data-motion-section>
          <div><span className="eyebrow">CENTRALNO POKOPALIŠČE VRHNIKA</span><h2>Upravljanje in grobna mesta</h2>
            <p>Upravljavec centralnega pokopališča je Javno podjetje Komunalno podjetje Vrhnika, d.o.o. Za poizvedbo o grobnem mestu pripravite ime in priimek pokojnika ter približno leto smrti, če ga poznate.</p>
            <Link to="/kontakt" className="button secondary">Kontakti in uradne ure <ArrowRight size={17} /></Link>
            <CmsAnchor className="text-link" href="https://www.google.com/maps/search/?api=1&query=Centralno+pokopali%C5%A1%C4%8De+Vrhnika" target="_blank" rel="noreferrer"><MapPin size={17} /> Pot do pokopališča <ArrowRight size={16} /></CmsAnchor>
          </div>
          <div><span className="eyebrow">POKOPALIŠKE STORITVE</span><h2>Pomoč ob izgubi svojca</h2>
            <p>Pokopališke storitve na centralnem pokopališču Vrhnika izvaja podjetje Pogrebne storitve Vrhovec, Suzana Vrhovec s.p.</p>
            <CmsAnchor className="button secondary" href="tel:+38631716176">Pokličite 031 716 176 <ArrowRight size={17} /></CmsAnchor>
            <CmsAnchor className="cemetery-source" href="https://www.kpv.si/mDejavnosti/pok/pokOstalo.html" target="_blank" rel="noreferrer">KPV · upravljanje in pokopališke storitve</CmsAnchor>
          </div>
        </section>
      </CmsLayout>
    </div>
  );
  return (
    <div className="cemetery-page">
      <CmsLayout>
        <header className="cemetery-intro" data-motion-section>
          <div>
            <span className="eyebrow">
              <Flower2 size={16} /> POKOPALIŠČE VRHNIKA
            </span>
            <h1>
              Spomin ostane.
              <br />
              <em>Pot naj bo preprosta.</em>
            </h1>
            <p>
              Poiščite ime, izberite grob in si oglejte njegovo mesto na načrtu.
              Tudi ko prihajate od daleč.
            </p>
          </div>
          <div className="cemetery-intro-art" aria-hidden="true">
            <div className="cemetery-flower-circle">
              <Flower2 strokeWidth={1} size={76} />
            </div>
            <span>
              Prostor spomina.
              <br />
              Bližje vam.
            </span>
          </div>
        </header>
        <section
          className="cemetery-panel"
          aria-labelledby="cemetery-search-title"
          data-motion-section
        >
          <div className="cemetery-search-heading">
            <div>
              <span className="eyebrow">POIŠČITE SVOJE BLIŽNJE</span>
              <h2 id="cemetery-search-title">Ime je dovolj za prvi korak.</h2>
            </div>
            <span className="cemetery-search-hint">
              <Compass size={17} /> Načrt · {sections.length} oddelkov
            </span>
          </div>
          <label className="cemetery-search-label" htmlFor="cemetery-search">
            Ime, priimek, leto ali oznaka groba
          </label>
          <div className="cemetery-search-input">
            <Search size={22} />
            <input
              id="cemetery-search"
              type="search"
              autoComplete="off"
              placeholder="Npr. Novak, Jože Kovač ali A-01-01"
              maxLength={120}
              value={query}
              onChange={(event) => filter(event.target.value, "iskanje")}
              aria-describedby="cemetery-search-help"
            />
            {query && (
              <button
                type="button"
                aria-label="Počisti iskanje grobov"
                onClick={() => {
                  document.getElementById("cemetery-search")?.focus();
                  filter("", "iskanje");
                }}
              >
                <X size={18} />
              </button>
            )}
          </div>
          <p className="cemetery-search-help" id="cemetery-search-help">
            Iščete lahko tudi brez šumnikov. Na načrtu se obarvajo vsi zadetki.
          </p>
          <div className="cemetery-filter-row">
            <div
              className="cemetery-filters"
              role="group"
              aria-label="Oddelek pokopališča"
            >
              {["all", ...sections].map((value) => (
                <button
                  type="button"
                  key={value}
                  aria-pressed={section === value}
                  data-motion-select
                  onClick={() => filter(value, "oddelek")}
                >
                  {value === "all" ? "Vsi oddelki" : `Oddelek ${value}`}
                </button>
              ))}
            </div>
            <span
              role="status"
              aria-live="polite"
              className="cemetery-result-count"
            >
              {results.length} grobov · {peopleCount} oseb
            </span>
          </div>
        </section>
        <div className="cemetery-workspace">
          <GraveMap
            matches={results}
            activeFilter={Boolean(query.trim()) || section !== "all"}
            selected={selected}
            onSelect={select}
            plots={graves}
            plan={cemetery.plan}
          />
          <div className="cemetery-sidebar">
            <section
              className="cemetery-detail"
              ref={detail}
              aria-labelledby="cemetery-detail-title"
              aria-live="polite"
            >
              {selected ? (
                <div key={selected.id} data-motion-enter>
                  <div className="cemetery-detail-top">
                    <span className="eyebrow">IZBRANI GROB</span>
                    <button
                      type="button"
                      aria-label="Zapri podatke groba"
                      onClick={() => {
                        const trigger = selectionTrigger.current;
                        if (
                          trigger?.isConnected &&
                          !detail.current?.contains(trigger) &&
                          trigger !== document.body
                        )
                          trigger.focus({ preventScroll: true });
                        else
                          document
                            .querySelector<SVGGElement>(
                              `[data-grave="${selected.id}"]`,
                            )
                            ?.focus({ preventScroll: true });
                        setParams(
                          (previous) => {
                            const next = new URLSearchParams(previous);
                            next.delete("grob");
                            return next;
                          },
                          { replace: true },
                        );
                        setShowCopy(false);
                      }}
                    >
                      <X size={17} />
                    </button>
                  </div>
                  <h2 id="cemetery-detail-title">
                    <Flower2 size={24} /> {selected.id}
                  </h2>
                  <p className="cemetery-coordinate">
                    Oddelek {selected.section}
                    <ChevronRight size={13} /> vrsta {selected.row}
                    <ChevronRight size={13} /> grob {selected.number}
                  </p>
                  <div className="cemetery-people">
                    {selected.people.map((person) => (
                      <div key={person.name}>
                        <h3>{person.name}</h3>
                        <p>
                          <span>Rojen/a</span>
                          <time dateTime={person.born}>
                            {dateLabel(person.born)}
                          </time>
                        </p>
                        <p>
                          <span>Umrl/a</span>
                          <time dateTime={person.died}>
                            {dateLabel(person.died)}
                          </time>
                        </p>
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    className="button secondary cemetery-share"
                    onClick={share}
                  >
                    {copied ? <Check size={17} /> : <Copy size={17} />}{" "}
                    {copied
                      ? "Povezava je kopirana"
                      : "Kopiraj povezavo do groba"}
                  </button>
                  {showCopy && (
                    <label className="cemetery-copy-fallback" data-motion-enter>
                      Kopirajte povezavo
                      <input
                        readOnly
                        aria-label="Povezava do izbranega groba"
                        value={window.location.href}
                        onFocus={(event) => event.currentTarget.select()}
                      />
                    </label>
                  )}
                  <p className="cemetery-detail-note">
                    Povezavo do izbranega groba lahko kopirate in pošljete svojcem.
                  </p>
                </div>
              ) : (
                <div className="cemetery-detail-empty">
                  <Flower2 size={35} strokeWidth={1.4} />
                  <h2 id="cemetery-detail-title">Izberite grob.</h2>
                  <p>
                    Kliknite na načrt ali ime na seznamu. Tukaj se pokažejo
                    podatki in povezava za svojce.
                  </p>
                </div>
              )}
            </section>
            <section
              className="cemetery-results"
              aria-labelledby="cemetery-results-title"
            >
              <div className="cemetery-list-heading">
                <h2 id="cemetery-results-title">
                  {query.trim() ? "Rezultati iskanja" : "Grobna mesta"}
                </h2>
                <span>{results.length}</span>
              </div>
              {results.length ? (
                <>
                  <ul>
                    {results.slice(0, limit).map((grave) => (
                      <li key={grave.id}>
                        <button
                          type="button"
                          className={
                            selected?.id === grave.id ? "is-selected" : ""
                          }
                          aria-pressed={selected?.id === grave.id}
                          onClick={() => {
                            select(grave);
                            if (window.innerWidth <= 760)
                              requestAnimationFrame(() =>
                                detail.current?.scrollIntoView({
                                  behavior: motion(),
                                  block: "center",
                                }),
                              );
                          }}
                        >
                          <span>
                            <strong>
                              {grave.people
                                .map((person) => person.name)
                                .join(" · ")}
                            </strong>
                            <small>
                              {grave.people
                                .map(
                                  (person) =>
                                    `${shortDate(person.born)}–${shortDate(person.died)}`,
                                )
                                .join(" · ")}
                              {grave.people.length > 1 ? ` · ${grave.people.length} oseb` : ""}
                            </small>
                          </span>
                          <span className="cemetery-result-location">
                            {grave.id}
                            <ChevronRight size={15} />
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                  {results.length > limit && (
                    <button
                      type="button"
                      className="cemetery-show-more"
                      onClick={() => setLimit(limit + 12)}
                    >
                      Prikaži še {Math.min(12, results.length - limit)} grobov{" "}
                      <Plus size={15} />
                    </button>
                  )}
                  <p className="cemetery-list-foot">
                    Prikazanih {Math.min(limit, results.length)} od{" "}
                    {results.length}. Vsi zadetki so na načrtu.
                  </p>
                </>
              ) : (
                <div className="cemetery-empty" data-motion-enter>
                  <Search size={24} />
                  <h3>Ni zadetkov.</h3>
                  <p>Poskusite samo priimek ali drug oddelek.</p>
                  <button
                    type="button"
                    className="cemetery-text-action"
                    onClick={() => {
                      setParams({}, { replace: true });
                      setLimit(8);
                      document.getElementById("cemetery-search")?.focus();
                    }}
                  >
                    Počisti vse filtre <RotateCcw size={14} />
                  </button>
                </div>
              )}
            </section>
          </div>
        </div>
        <section className="cemetery-help" data-motion-section>
          <div>
            <span className="eyebrow">ZA OBISK IN INFORMACIJE</span>
            <h2>Ko potrebujete več kot načrt.</h2>
            <p>
              KPV je upravljavec centralnega pokopališča Vrhnika. Za informacije
              o evidenci grobov in upravljanju se obrnite na podjetje.
            </p>
            <CmsAnchor
              href="https://www.google.com/maps/search/?api=1&query=Centralno+pokopali%C5%A1%C4%8De+Vrhnika"
              target="_blank"
              rel="noreferrer"
              className="text-link"
            >
              <MapPin size={17} /> Pot do pokopališča <ArrowRight size={16} />
            </CmsAnchor>
          </div>
          <div>
            <h3>Potrebujete podatek o grobu?</h3>
            <p>
              Pripravite ime in priimek pokojnika ter približno leto smrti, če
              ga poznate.
            </p>
            <Link to="/kontakt" className="button secondary">
              Kontakti in uradne ure <ArrowRight size={17} />
            </Link>
            <CmsAnchor
              href="https://www.kpv.si/mDejavnosti/pok/pokOstalo.html"
              target="_blank"
              rel="noreferrer"
              className="cemetery-source"
            >
              Vir: KPV · upravljanje pokopališč, preverjeno 29. 10. 2026
            </CmsAnchor>
          </div>
        </section>
      </CmsLayout>
    </div>
  );
}
