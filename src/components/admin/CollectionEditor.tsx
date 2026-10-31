import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Copy,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import {
  COLLECTION_TYPES,
  generateCollectionEvents,
  matchCollectionSchedule,
  mergeCollectionEvents,
  moveCollectionEvents,
  normalizedAddress,
  shiftCollectionDate,
  type CollectionData,
  type CollectionEvent,
  type CollectionRoute,
  type CollectionType,
} from "../../../shared/collection-utils.js";
import "./collection-editor.css";
export type { CollectionData } from "../../../shared/collection-utils.js";

type Props = {
  value: CollectionData;
  onChange: (value: CollectionData) => void;
  disabled?: boolean;
};
const types = Object.entries(COLLECTION_TYPES) as [CollectionType, string][];
const weekdays = [
  [1, "Ponedeljek"],
  [2, "Torek"],
  [3, "Sreda"],
  [4, "Četrtek"],
  [5, "Petek"],
  [6, "Sobota"],
  [0, "Nedelja"],
] as const;
const today = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Ljubljana",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
const newId = () => `area-${crypto.randomUUID()}`;
const displayDate = (date: string) =>
  new Intl.DateTimeFormat("sl-SI", {
    weekday: "short",
    day: "numeric",
    month: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T12:00:00Z`));

export default function CollectionEditor({
  value,
  onChange,
  disabled = false,
}: Props) {
  const [selected, setSelected] = useState(value.routes[0]?.id || "");
  const [step, setStep] = useState(1);
  const [areaSearch, setAreaSearch] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [testAddress, setTestAddress] = useState("");
  const [gen, setGen] = useState({
    type: "packaging" as CollectionType,
    start: today(),
    end: shiftCollectionDate(today(), 90),
    weekday: 1,
    interval: 2,
  });
  const [manual, setManual] = useState({
    type: "packaging" as CollectionType,
    date: today(),
  });
  const [filters, setFilters] = useState({ type: "", start: "", end: "" });
  const [checked, setChecked] = useState<string[]>([]);
  const [days, setDays] = useState(1);
  const [page, setPage] = useState(1);
  const route =
    value.routes.find((item) => item.id === selected) || value.routes[0];
  useEffect(() => {
    if (!value.routes.some((item) => item.id === selected))
      setSelected(value.routes[0]?.id || "");
  }, [value.routes, selected]);
  useEffect(() => {
    setChecked([]);
    setPage(1);
    setError("");
    setNotice("");
  }, [route?.id]);
  useEffect(() => {
    setPage(1);
    setChecked([]);
  }, [filters]);
  const preview = useMemo(() => {
    try {
      return { events: generateCollectionEvents(gen), error: "" };
    } catch (cause) {
      return {
        events: [],
        error: cause instanceof Error ? cause.message : "Preverite datume.",
      };
    }
  }, [gen]);
  const match = testAddress.trim()
    ? matchCollectionSchedule(testAddress, value.routes)
    : null;
  const filtered = useMemo(
    () =>
      (route?.events || [])
        .filter(
          (event) =>
            (!filters.type || event.type === filters.type) &&
            (!filters.start || event.date >= filters.start) &&
            (!filters.end || event.date <= filters.end),
        )
        .sort(
          (a, b) =>
            a.date.localeCompare(b.date) || a.type.localeCompare(b.type),
        ),
    [route?.events, filters],
  );
  const lastPage = Math.max(1, Math.ceil(filtered.length / 25));
  const safePage = Math.min(page, lastPage),
    visible = filtered.slice((safePage - 1) * 25, safePage * 25);
  const allVisible =
    visible.length > 0 && visible.every((event) => checked.includes(event.id));
  const duplicateRules = useMemo(() => {
    const owners = new Map<string, string>(),
      conflicts: string[] = [];
    for (const item of value.routes)
      for (const type of new Set(item.events.map((event) => event.type)))
      for (const pattern of item.addresses) {
        const key = `${type}:${normalizedAddress(pattern)}`;
        if (key && owners.has(key))
          conflicts.push(
            `${COLLECTION_TYPES[type]}: »${pattern}« je v več območjih: ${owners.get(key)} / ${item.name}.`,
          );
        if (key) owners.set(key, item.name);
      }
    return conflicts;
  }, [value.routes]);
  function patch(change: Partial<CollectionRoute>) {
    if (route)
      onChange({
        routes: value.routes.map((item) =>
          item.id === route.id ? { ...item, ...change } : item,
        ),
      });
  }
  function action(run: () => void) {
    setError("");
    setNotice("");
    try {
      run();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Spremembe ni bilo mogoče pripraviti.",
      );
    }
  }
  function addArea(copy = false) {
    const item: CollectionRoute = {
      id: newId(),
      name: copy && route ? `${route.name} – kopija` : "Novo območje",
      addresses: [],
      events: copy && route ? structuredClone(route.events) : [],
    };
    onChange({ routes: [...value.routes, item] });
    setSelected(item.id);
  }
  function addEvents(events: CollectionEvent[]) {
    if (!route) return;
    const result = mergeCollectionEvents(route.events, events);
    patch({ events: result.events });
    setNotice(
      `V osnutek je dodanih ${result.added} terminov. Že obstoječih terminov nismo podvojili: ${result.skipped}. Za javno objavo kliknite »Shrani in objavi«.`,
    );
  }
  function updateEvent(id: string, change: Partial<CollectionEvent>) {
    if (!route) return;
    if (change.date !== undefined) shiftCollectionDate(change.date, 0);
    const events = route.events.map((event) =>
      event.id === id ? { ...event, ...change } : event,
    );
    const keys = new Set<string>();
    for (const event of events) {
      const key = `${event.type}:${event.date}`;
      if (keys.has(key))
        throw Error(
          "Ta vrsta odpadkov ima na izbrani datum že termin. Sprememba ni uporabljena.",
        );
      keys.add(key);
    }
    patch({ events });
  }
  function deleteSelected() {
    if (!route || !checked.length) return;
    if (
      !window.confirm(
        `Iz osnutka odstranimo ${checked.length} izbranih terminov? Objava se spremeni šele po shranjevanju.`,
      )
    )
      return;
    patch({
      events: route.events.filter((event) => !checked.includes(event.id)),
    });
    setChecked([]);
  }
  return (
    <fieldset className="collection-editor" disabled={disabled}>
      <div className="collection-intro">
        <CalendarDays size={24} />
        <div>
          <h2>Urejanje urnikov odvoza</h2>
          <p>
            Izberite območje na levi. Nato uredite naslove ali datume in preverite,
            kaj bo za svoj naslov videl občan. Spremembe postanejo javne šele z gumbom »Shrani in objavi«.
          </p>
          <p>Občan lahko v koledar shrani en datum ali vse naslednje odvoze iste vrste. Ponavljanje uporablja samo tukaj objavljene datume, tudi praznične izjeme. Že prenesenega koledarja poznejši popravek ne posodobi.</p>
        </div>
      </div>
      <nav className="collection-steps" aria-label="Koraki urejanja urnikov">
        {[[1,"Območje in naslovi"],[2,"Termini odvozov"],[3,"Preveri naslov"]].map(([number,label]) =>
          <button key={number} type="button" aria-current={step===number ? "step" : undefined}
            className={step===number ? "selected" : ""} onClick={()=>setStep(Number(number))}>
            <span>{number}</span>{label}
          </button>)}
      </nav>
      {error && (
        <p className="collection-alert error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="collection-alert" role="status">
          {notice}
        </p>
      )}
      {duplicateRules.length > 0 && step === 1 && (
        <details className="collection-alert">
          <summary>Naslovi, ki potrebujejo natančnejšo razmejitev ({duplicateRules.length})</summary>
          <p>Za isto vrsto odpadkov se pravila nekaterih območij prekrivajo. Portal teh datumov ne dodeli samodejno. To je lahko posledica delitve med običajno in malo vozilo. Različne vrste odpadkov smejo uporabljati isti naslov.</p>
          {duplicateRules.slice(0, 8).map((text, index) => (
            <p key={index}>{text}</p>
          ))}
        </details>
      )}
      <div className="collection-layout" hidden={step===3}>
        <aside className="collection-areas" aria-label="Odvozna območja">
          <div className="collection-section-title">
            <h3>Območja</h3>
            <span>{value.routes.length}/200</span>
          </div>
          <button
            type="button"
            className="collection-action"
            onClick={() => addArea()}
            disabled={value.routes.length >= 200}
          >
            <Plus size={16} />
            Dodaj območje
          </button>
          <label className="collection-area-search">Poišči območje
            <input value={areaSearch} onChange={(event)=>setAreaSearch(event.target.value)} placeholder="Ime, ulica ali oznaka …" />
          </label>
          {!value.routes.length && (
            <p>
              Začnite z enim dejanskim območjem. Dokler ni objavljene nobene
              poti, portal ne prikazuje datumov za gospodinjstva.
            </p>
          )}
          <div className="collection-area-list">
            {value.routes.filter((item)=>normalizedAddress(`${item.name} ${item.addresses.join(" ")}`).includes(normalizedAddress(areaSearch))).map((item) => (
              <button
                type="button"
                key={item.id}
                className={item.id === route?.id ? "selected" : ""}
                aria-pressed={item.id === route?.id}
                onClick={() => setSelected(item.id)}
              >
                <strong>{item.name || "Neimenovano območje"}</strong>
                <span>
                  {item.addresses.filter((x) => x.trim()).length} naslovnih pravil ·{" "}
                  {item.events.filter((event)=>event.date>=today()).length} prihodnjih terminov
                </span>
              </button>
            ))}
          </div>
        </aside>
        <div className="collection-detail">
          {route ? (
            <>
              <section className="collection-card" aria-label="Podatki območja" hidden={step!==1}>
                <div className="collection-section-title">
                  <h3>1. Območje in naslovi</h3>
                  <button
                    type="button"
                    className="collection-icon"
                    aria-label="Odstrani izbrano območje"
                    onClick={() => {
                      if (
                        window.confirm(
                          `Odstranimo območje »${route.name}« iz osnutka? Skupaj z njim bodo odstranjeni njegovi termini.`,
                        )
                      )
                        onChange({
                          routes: value.routes.filter(
                            (item) => item.id !== route.id,
                          ),
                        });
                    }}
                  >
                    <Trash2 size={17} />
                  </button>
                </div>
                <label>
                  Naziv območja
                  <input
                    value={route.name}
                    maxLength={200}
                    onChange={(event) => patch({ name: event.target.value })}
                    placeholder="Npr. Vrhnika – center"
                  />
                </label>
                <label>
                  Naslovi, ulice ali naselja · eno pravilo v vsako vrstico
                  <textarea
                    rows={5}
                    value={route.addresses.join("\n")}
                    onChange={(event) =>
                      patch({
                        addresses: event.target.value
                          .replace(/\r/g, "")
                          .split("\n"),
                      })
                    }
                    onBlur={() =>
                      patch({
                        addresses: route.addresses
                          .map((text) => text.trim())
                          .filter(Boolean),
                      })
                    }
                    placeholder={
                      "Tržaška cesta, Vrhnika\nSodnijski trg, Vrhnika\nVerd 12"
                    }
                  />
                </label>
                <p className="collection-help">
                  Celotno naselje vključite samo, če zanj velja isti urnik.
                  Natančnejši naslov ima prednost. Številka 1 ne vključuje 12
                  ali 1a. Šumniki in velike črke ne vplivajo na iskanje.
                  Ulici dodajte kraj za vejico, da je ne zamenjamo z enako
                  poimenovano ulico drugje. Za celotno naselje zadostuje ime naselja.
                  Območja za BIO, embalažo in mešane odpadke se lahko razlikujejo;
                  za vsako vrsto lahko pripravite ločeno območje.
                </p>
                {!route.addresses.some((text) => text.trim()) && (
                  <p className="collection-alert error">
                    Pred objavo vpišite vsaj eno pravilo naslova.
                  </p>
                )}
                <button
                  type="button"
                  className="collection-action secondary"
                  onClick={() => addArea(true)}
                  disabled={value.routes.length >= 200}
                >
                  <Copy size={15} />
                  Kopiraj termine v novo območje
                </button>
                <div className="collection-step-next"><button type="button" className="collection-action" onClick={()=>setStep(2)}>Nadaljuj na termine <ArrowRight size={16}/></button></div>
              </section>
              <details
                className="collection-card"
                aria-label="Priprava ponavljajočih se terminov"
                hidden={step!==2}
                open={route.events.length===0}
              >
                <summary>Dodaj redne odvoze s ponavljanjem</summary>
                <p>
                  Izberite eno vrsto odpadkov in obdobje. Ponavljanje se začne
                  na prvi izbrani dan v obdobju. V urnik se shranijo točni
                  datumi, ki jih lahko pozneje premaknete zaradi praznikov.
                </p>
                <div className="collection-grid">
                  <label>
                    Vrsta odpadkov
                    <select
                      value={gen.type}
                      onChange={(event) =>
                        setGen({
                          ...gen,
                          type: event.target.value as CollectionType,
                        })
                      }
                    >
                      {types.map(([key, name]) => (
                        <option key={key} value={key}>
                          {name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Dan odvoza
                    <select
                      value={gen.weekday}
                      onChange={(event) =>
                        setGen({ ...gen, weekday: Number(event.target.value) })
                      }
                    >
                      {weekdays.map(([key, name]) => (
                        <option key={key} value={key}>
                          {name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Od datuma
                    <input
                      type="date"
                      value={gen.start}
                      onChange={(event) =>
                        setGen({ ...gen, start: event.target.value })
                      }
                    />
                  </label>
                  <label>
                    Do vključno
                    <input
                      type="date"
                      value={gen.end}
                      onChange={(event) =>
                        setGen({ ...gen, end: event.target.value })
                      }
                    />
                  </label>
                  <label>
                    Ponavljanje
                    <select
                      value={gen.interval}
                      onChange={(event) =>
                        setGen({ ...gen, interval: Number(event.target.value) })
                      }
                    >
                      {Array.from({ length: 8 }, (_, index) => index + 1).map(
                        (weeks) => (
                          <option key={weeks} value={weeks}>
                            {weeks === 1
                              ? "Vsak teden"
                              : `Vsakih ${weeks} tednov`}
                          </option>
                        ),
                      )}
                    </select>
                  </label>
                </div>
                {preview.error ? (
                  <p className="collection-alert error">{preview.error}</p>
                ) : (
                  <div className="collection-preview">
                    <strong>Predogled: {preview.events.length} terminov</strong>
                    <p>
                      {preview.events
                        .slice(0, 8)
                        .map((event) => displayDate(event.date))
                        .join(" · ")}
                      {preview.events.length > 8 ? " …" : ""}
                    </p>
                    {!preview.events.length && (
                      <p>V obdobju ni izbranega dneva.</p>
                    )}
                  </div>
                )}
                <button
                  type="button"
                  className="collection-action"
                  disabled={!!preview.error || !preview.events.length}
                  onClick={() => action(() => addEvents(preview.events))}
                >
                  <Plus size={16} />
                  Dodaj predogledane termine v osnutek
                </button>
              </details>
              <details
                className="collection-card"
                aria-label="Posamezni in praznični termini"
                hidden={step!==2}
              >
                <summary>Dodaj enkratni odvoz ali pripravi izjemo</summary>
                <div className="collection-section-title">
                  <h3>Izjeme in enkratni odvozi</h3>
                  <span>{route.events.length}/500</span>
                </div>
                <p>
                  Za praznik premaknite obstoječi datum v spodnjem seznamu. Za
                  dodatni odvoz dodajte nov termin; za izpuščeni odvoz termin
                  odstranite.
                </p>
                <div className="collection-grid">
                  <label>
                    Vrsta dodatnega odvoza
                    <select
                      value={manual.type}
                      onChange={(event) =>
                        setManual({
                          ...manual,
                          type: event.target.value as CollectionType,
                        })
                      }
                    >
                      {types.map(([key, name]) => (
                        <option key={key} value={key}>
                          {name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Datum dodatnega odvoza
                    <input
                      type="date"
                      value={manual.date}
                      onChange={(event) =>
                        setManual({ ...manual, date: event.target.value })
                      }
                    />
                  </label>
                </div>
                <button
                  type="button"
                  className="collection-action secondary"
                  onClick={() =>
                    action(() =>
                      addEvents(
                        generateCollectionEvents({
                          ...manual,
                          start: manual.date,
                          end: manual.date,
                          weekday: new Date(
                            `${manual.date}T12:00:00Z`,
                          ).getUTCDay(),
                          interval: 1,
                        }),
                      ),
                    )
                  }
                >
                  <Plus size={16} />
                  Dodaj posamezni termin
                </button>
              </details>
              <section className="collection-card" aria-label="Termini območja" hidden={step!==2}>
                <div className="collection-section-title">
                  <h3>Termini: {route.name}</h3>
                  <span>{filtered.length} zadetkov</span>
                </div>
                <p>{route.events.filter((event)=>event.date>=today()).length} prihodnjih terminov od {route.events.length} vpisanih.
                  {route.events.length>0 && !route.events.some((event)=>event.date>=today()) ? " Vsi datumi so pretekli; občanu se ne bo prikazal noben prihodnji odvoz." : ""}</p>
                <div className="collection-grid three">
                  <label>
                    Filter vrste
                    <select
                      value={filters.type}
                      onChange={(event) =>
                        setFilters({ ...filters, type: event.target.value })
                      }
                    >
                      <option value="">Vse vrste</option>
                      {types.map(([key, name]) => (
                        <option key={key} value={key}>
                          {name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Od
                    <input
                      type="date"
                      value={filters.start}
                      onChange={(event) =>
                        setFilters({ ...filters, start: event.target.value })
                      }
                    />
                  </label>
                  <label>
                    Do
                    <input
                      type="date"
                      value={filters.end}
                      onChange={(event) =>
                        setFilters({ ...filters, end: event.target.value })
                      }
                    />
                  </label>
                </div>
                {(filters.type || filters.start || filters.end) && <button type="button" className="collection-link" onClick={()=>setFilters({type:"",start:"",end:""})}>Počisti filtre</button>}
                {route.events.length > 0 && (
                  <div className="collection-bulk">
                    <label className="collection-check">
                      <input
                        type="checkbox"
                        checked={allVisible}
                        onChange={(event) =>
                          setChecked(
                            event.target.checked
                              ? [
                                  ...new Set([
                                    ...checked,
                                    ...visible.map((item) => item.id),
                                  ]),
                                ]
                              : checked.filter(
                                  (id) =>
                                    !visible.some((item) => item.id === id),
                                ),
                          )
                        }
                      />
                      Označi prikazanih {visible.length}
                    </label>
                    {filtered.length > visible.length && (
                      <button
                        type="button"
                        className="collection-link"
                        onClick={() =>
                          setChecked(filtered.map((item) => item.id))
                        }
                      >
                        Označi vse zadetke ({filtered.length})
                      </button>
                    )}
                    <span>{checked.length} izbranih skupaj</span>
                    {checked.length > 0 && (
                      <>
                        <button
                          type="button"
                          className="collection-link"
                          onClick={() => setChecked([])}
                        >
                          Počisti izbor
                        </button>
                        <label>
                          Premik v dnevih
                          <input
                            type="number"
                            min={-366}
                            max={366}
                            step={1}
                            value={days}
                            onChange={(event) =>
                              setDays(Number(event.target.value))
                            }
                          />
                        </label>
                        <button
                          type="button"
                          className="collection-action secondary"
                          onClick={() =>
                            action(() => {
                              patch({
                                events: moveCollectionEvents(
                                  route.events,
                                  checked,
                                  days,
                                ),
                              });
                              setNotice(
                                `Premaknjenih ${checked.length} terminov v osnutku.`,
                              );
                            })
                          }
                        >
                          Premakni izbrane
                        </button>
                        <button
                          type="button"
                          className="collection-action danger"
                          onClick={deleteSelected}
                        >
                          <Trash2 size={15} />
                          Odstrani izbrane
                        </button>
                      </>
                    )}
                  </div>
                )}
                {!filtered.length && (
                  <p className="collection-empty">
                    {route.events.length
                      ? "Za izbrane filtre ni terminov."
                      : "Termini še niso dodani. Pripravite redne odvoze ali posamezni termin zgoraj."}
                  </p>
                )}
                <div className="collection-event-list">
                  {visible.map((event) => (
                    <div
                      className={`collection-event ${event.type}`}
                      key={event.id}
                    >
                      <input
                        type="checkbox"
                        aria-label={`Izberi termin ${event.label} ${event.date}`}
                        checked={checked.includes(event.id)}
                        onChange={(input) =>
                          setChecked(
                            input.target.checked
                              ? [...checked, event.id]
                              : checked.filter((id) => id !== event.id),
                          )
                        }
                      />
                      <div className="collection-event-fields">
                        <label>
                          Datum termina
                          <input
                            type="date"
                            value={event.date}
                            onChange={(input) =>
                              action(() =>
                                updateEvent(event.id, {
                                  date: input.target.value,
                                }),
                              )
                            }
                          />
                        </label>
                        <label>
                          Vrsta termina
                          <select
                            value={event.type}
                            onChange={(input) =>
                              action(() =>
                                updateEvent(event.id, {
                                  type: input.target.value as CollectionType,
                                  label:
                                    COLLECTION_TYPES[
                                      input.target.value as CollectionType
                                    ],
                                }),
                              )
                            }
                          >
                            {types.map(([key, name]) => (
                              <option key={key} value={key}>
                                {name}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="collection-event-label">
                          Javni naziv termina
                          <input
                            value={event.label}
                            maxLength={250}
                            onChange={(input) =>
                              action(() => updateEvent(event.id, {
                                label: input.target.value,
                              }))
                            }
                          />
                        </label>
                      </div>
                      <button
                        type="button"
                        className="collection-icon"
                        aria-label={`Odstrani termin ${event.label} ${event.date}`}
                        onClick={() => {
                          patch({
                            events: route.events.filter(
                              (item) => item.id !== event.id,
                            ),
                          });
                          setChecked(checked.filter((id) => id !== event.id));
                        }}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
                {filtered.length > 25 && (
                  <div className="collection-pagination">
                    <button
                      type="button"
                      className="collection-action secondary"
                      disabled={safePage <= 1}
                      onClick={() => setPage(safePage - 1)}
                    >
                      <ArrowLeft size={15} />
                      Prejšnja
                    </button>
                    <span>
                      Stran {safePage}/{lastPage}
                    </span>
                    <button
                      type="button"
                      className="collection-action secondary"
                      disabled={safePage >= lastPage}
                      onClick={() => setPage(safePage + 1)}
                    >
                      Naslednja
                      <ArrowRight size={15} />
                    </button>
                  </div>
                )}
                <div className="collection-step-next"><button type="button" className="collection-action" onClick={()=>setStep(3)}>Preveri naslov <ArrowRight size={16}/></button></div>
              </section>
            </>
          ) : (
            <div className="collection-card collection-empty">
              <h3>Vsako območje ima svoj urnik.</h3>
              <p>
                Dodajte območje in navedite ulice oziroma naselja. Nato
                pripravite datume za embalažo, BIO in mešane odpadke.
              </p>
            </div>
          )}
        </div>
      </div>
      <section
        className="collection-card collection-test"
        aria-label="Preverjanje naslova"
        hidden={step!==3}
      >
        <Search size={20} />
        <div>
          <h3>3. Preverite razporeditev naslova</h3>
          <label>
            Preizkusni naslov
            <input
              value={testAddress}
              onChange={(event) => setTestAddress(event.target.value)}
              placeholder="Npr. Tržaška cesta 1, Vrhnika"
            />
          </label>
          {match && (
            <p
              role="status"
              className={match.incompleteTypes.length ? "collection-alert error" : "collection-match"}
            >
              {match.incompleteTypes.length
                ? `Urnik za ta naslov je delni. Potrebno je preverjanje: ${match.incompleteTypes.map((type)=>COLLECTION_TYPES[type]).join(", ")}.`
                : "Naslov je razporejen za vse tri vrste odpadkov. Preverite tudi prihajajoče datume spodaj."}
            </p>
          )}
          {match && <div className="collection-test-results">{types.map(([type,label])=>{
            const result=match.matches[type];
            const events=(result.route?.events || []).filter((event)=>event.type===type && event.date>=today()).sort((a,b)=>a.date.localeCompare(b.date));
            return <div key={type}><strong>{label}</strong>{result.route ? <><p>{result.route.name} · {events.length} prihodnjih terminov</p>
              <p>{events.length ? events.slice(0,4).map((event)=>displayDate(event.date)).join(" · ") : "Ni prihodnjih datumov. Dodajte potrjene termine pred objavo."}</p></>
              : <p>{result.ambiguous ? `Naslov se ujema z več območji: ${result.candidates.map((item)=>item.name).join(" / ")}. Portal za to vrsto ne bo ugibal.` : "Ni ustreznega naslovnega pravila za to vrsto odpadkov."}</p>}</div>;
          })}</div>}
          <p className="collection-help">
            Preverjanje uporablja isti način iskanja kot javni urnik.
            Uporabljajo se natančno vpisani datumi; ponavljanja so pripomoček za
            pripravo, ne samodejno podaljševanje urnika.
          </p>
          <a href="https://www.kpv.si/mDejavnosti/rzo/rzoUrnik.html" target="_blank" rel="noreferrer" className="collection-link">Odpri izvirne urnike KPV</a>
        </div>
      </section>
    </fieldset>
  );
}
