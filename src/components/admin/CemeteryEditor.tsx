import { useEffect, useRef, useState, type MouseEvent } from "react";
import {
  Plus,
  Trash2,
  MapPin,
  Search,
  Users,
  ImagePlus,
  Move,
  X,
} from "lucide-react";
import {
  addCemeterySector,
  addCemeteryRow,
  addCemeteryGraves,
  cemeterySectors,
  findGraves,
  positionCemeteryGrave,
  positionCemeteryRow,
  renameCemeterySector,
  type CemeteryData,
  type Grave,
  type Person,
} from "../../data/cemetery";
import "./cemetery-editor.css";

type Props = {
  value: CemeteryData;
  onChange: (value: CemeteryData) => void;
  disabled?: boolean;
  onUpload?: (file: File | undefined) => Promise<{ url: string } | undefined>;
};
export default function CemeteryEditor({
  value,
  onChange,
  disabled = false,
  onUpload,
}: Props) {
  const sectors = cemeterySectors(value);
  const [sectorName, setSectorName] = useState(""),
    [chosenSector, setChosenSector] = useState(""),
    [chosenRow, setChosenRow] = useState(0),
    [chosenId, setChosenId] = useState("");
  const [newRow, setNewRow] = useState(1),
    [first, setFirst] = useState(1),
    [count, setCount] = useState(1),
    [query, setQuery] = useState(""),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const [planZoom, setPlanZoom] = useState(1);
  const [pendingPlan, setPendingPlan] = useState<CemeteryData["plan"] | null>(
    null,
  );
  const confirmation = useRef<HTMLElement>(null);
  useEffect(() => {
    if (pendingPlan) {
      confirmation.current?.focus();
      confirmation.current?.scrollIntoView({ block: "nearest" });
    }
  }, [pendingPlan]);
  const [placement, setPlacement] = useState<"grave" | "row" | null>(null),
    [start, setStart] = useState<{ x: number; y: number } | null>(null);
  const sector =
    sectors.find((item) => item.name === chosenSector) || sectors[0];
  const row = sector?.rows.includes(chosenRow) ? chosenRow : sector?.rows[0];
  const plots = value.graves
    .filter((item) => item.section === sector?.name && item.row === row)
    .sort((a, b) => a.number - b.number);
  const selected = value.graves.find((item) => item.id === chosenId);
  const visible = query.trim() ? findGraves(query, "all", value.graves) : plots;
  function cancelPlacement() {
    setPlacement(null);
    setStart(null);
  }
  function background(plan: CemeteryData["plan"]) {
    cancelPlacement();
    if (
      !Number.isInteger(plan.width) ||
      plan.width < 36 ||
      plan.width > 10000 ||
      !Number.isInteger(plan.height) ||
      plan.height < 32 ||
      plan.height > 10000
    ) {
      setError(
        "Širina naj bo med 36 in 10000, višina pa med 32 in 10000 celimi enotami.",
      );
      return false;
    }
    const confirmed = value.graves.some((grave) => grave.positioned !== false);
    if (confirmed) {
      setPendingPlan(plan);
      setError("");
      return false;
    }
    return applyBackground(plan, false);
  }
  function applyBackground(plan: CemeteryData["plan"], keep: boolean) {
    if (
      keep &&
      value.graves.some(
        (g) =>
          g.positioned !== false &&
          (g.x + 36 > plan.width || g.y + 32 > plan.height),
      )
    ) {
      setError(
        "Nekateri potrjeni grobovi bi segali zunaj novih mer. Izberite umik položajev ali večji načrt.",
      );
      return false;
    }
    onChange({
      ...value,
      plan,
      graves: value.graves.map((grave) =>
        keep && grave.positioned !== false
          ? grave
          : {
              ...grave,
              positioned: false,
              x: Math.max(0, Math.min(grave.x, plan.width - 36)),
              y: Math.max(0, Math.min(grave.y, plan.height - 32)),
            },
      ),
    });
    setPendingPlan(null);
    setError("");
    setMessage(
      "Ozadje je spremenjeno v osnutku. Pred objavo preverite vse položaje.",
    );
    return true;
  }
  function perform(action: () => CemeteryData, success = "") {
    try {
      onChange(action());
      setError("");
      setMessage(success);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Zahteva ni uspela.");
    }
  }
  function patch(change: Partial<Grave>) {
    if (selected)
      onChange({
        ...value,
        graves: value.graves.map((item) =>
          item.id === selected.id ? { ...item, ...change } : item,
        ),
      });
  }
  function choose(item: Grave) {
    setChosenSector(item.section);
    setChosenRow(item.row);
    setChosenId(item.id);
    setPlacement(null);
    setStart(null);
  }
  function person(index: number, change: Partial<Person>) {
    if (selected)
      patch({
        people: selected.people.map((item, i) =>
          i === index ? { ...item, ...change } : item,
        ),
      });
  }
  function place(event: MouseEvent<SVGSVGElement>) {
    if (!placement || disabled) return;
    const svg = event.currentTarget,
      ctm = svg.getScreenCTM();
    if (!ctm) return;
    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(
      ctm.inverse(),
    );
    const position = { x: point.x - 18, y: point.y - 16 };
    if (placement === "grave" && selected) {
      perform(
        () => positionCemeteryGrave(value, selected.id, position),
        "Položaj groba je v osnutku. Pred objavo ga preverite.",
      );
      setPlacement(null);
    } else if (placement === "row" && sector && row) {
      if (!start) {
        setStart(position);
        setMessage("Zdaj kliknite sredino zadnjega groba v vrsti.");
      } else {
        perform(
          () => positionCemeteryRow(value, sector.name, row, start, position),
          "Položaji vrste so v osnutku. Preverite jih in po potrebi popravite posamezne grobove.",
        );
        setPlacement(null);
        setStart(null);
      }
    }
  }
  return (
    <section className="cem-editor">
      <div className="notice-editor-guide">
        <h2>Grobna mesta in osebe</h2>
        <p>
          Dodajte sektor → vrsto → grobna mesta → osebe. Položaje določite na
          načrtu. Spremembe postanejo javne šele z »Shrani in objavi« na vrhu.
        </p>
        <p>
          Vnašajte potrjene javne podatke iz evidence. Prazno grobno mesto
          pomeni samo evidentirano mesto; ni oznaka razpoložljivosti za najem.
          Ne vnašajte kontaktov najemnikov.
        </p>
      </div>
      {error && (
        <p className="admin-error" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="cem-editor-message">
          {message}
        </p>
      )}
      <fieldset disabled={disabled} className="cem-editor-fieldset">
        <div className="cem-editor-structure">
          <section className="admin-panel cem-editor-card">
            <h3>1. Sektor</h3>
            <label className="admin-field">
              <span>Izbrani sektor</span>
              <select
                value={sector?.name || ""}
                onChange={(e) => {
                  setChosenSector(e.target.value);
                  setChosenRow(0);
                  setChosenId("");
                  cancelPlacement();
                }}
              >
                <option value="" disabled>
                  Najprej dodajte sektor
                </option>
                {sectors.map((item) => (
                  <option key={item.name}>{item.name}</option>
                ))}
              </select>
            </label>
            <div className="cem-editor-inline">
              <label className="admin-field">
                <span>Oznaka novega sektorja</span>
                <input
                  value={sectorName}
                  maxLength={60}
                  placeholder="Oznaka iz evidence"
                  onChange={(e) => setSectorName(e.target.value)}
                />
              </label>
              <button
                type="button"
                className="admin-button"
                onClick={() => {
                  try {
                    const next = addCemeterySector(value, sectorName);
                    onChange(next);
                    cancelPlacement();
                    setChosenSector(sectorName.trim());
                    setChosenRow(0);
                    setSectorName("");
                    setChosenId("");
                    setError("");
                  } catch (cause) {
                    setError((cause as Error).message);
                  }
                }}
              >
                <Plus size={16} />
                Dodaj sektor
              </button>
            </div>
            {sector && (
              <button
                type="button"
                className="admin-button"
                disabled={!sectorName.trim()}
                onClick={() => {
                  try {
                    const next = renameCemeterySector(
                      value,
                      sector.name,
                      sectorName,
                    );
                    onChange(next);
                    cancelPlacement();
                    setChosenSector(sectorName.trim());
                    setSectorName("");
                    setError("");
                  } catch (cause) {
                    setError((cause as Error).message);
                  }
                }}
              >
                Preimenuj izbrani sektor z vpisano oznako
              </button>
            )}
            {sector && (
              <button
                type="button"
                className="cem-editor-delete"
                disabled={
                  sector.rows.length > 0 ||
                  value.graves.some((g) => g.section === sector.name)
                }
                onClick={() =>
                  perform(() => ({
                    ...value,
                    sectors: sectors.filter((s) => s.name !== sector.name),
                  }))
                }
              >
                <Trash2 size={14} />
                Odstrani prazen sektor
              </button>
            )}
          </section>
          <section className="admin-panel cem-editor-card">
            <h3>2. Vrsta v sektorju {sector?.name || "—"}</h3>
            <label className="admin-field">
              <span>Izbrana vrsta</span>
              <select
                value={row || ""}
                onChange={(e) => {
                  setChosenRow(Number(e.target.value));
                  setChosenId("");
                  cancelPlacement();
                }}
              >
                <option value="" disabled>
                  Dodajte vrsto
                </option>
                {sector?.rows.map((item) => (
                  <option key={item} value={item}>
                    Vrsta {item}
                  </option>
                ))}
              </select>
            </label>
            <div className="cem-editor-inline">
              <label className="admin-field">
                <span>Številka nove vrste</span>
                <input
                  type="number"
                  min={1}
                  max={10000}
                  value={newRow}
                  onChange={(e) => setNewRow(Number(e.target.value))}
                />
              </label>
              <button
                type="button"
                className="admin-button"
                disabled={!sector}
                onClick={() => {
                  if (!sector) return;
                  try {
                    onChange(addCemeteryRow(value, sector.name, newRow));
                    cancelPlacement();
                    setChosenRow(newRow);
                    setChosenId("");
                    setError("");
                    setNewRow(newRow + 1);
                  } catch (cause) {
                    setError((cause as Error).message);
                  }
                }}
              >
                <Plus size={16} />
                Dodaj vrsto
              </button>
            </div>
            {sector && row && (
              <button
                type="button"
                className="cem-editor-delete"
                disabled={plots.length > 0}
                onClick={() =>
                  perform(() => ({
                    ...value,
                    sectors: sectors.map((s) =>
                      s.name === sector.name
                        ? { ...s, rows: s.rows.filter((r) => r !== row) }
                        : s,
                    ),
                  }))
                }
              >
                <Trash2 size={14} />
                Odstrani prazno vrsto
              </button>
            )}
          </section>
        </div>
        <section className="admin-panel cem-editor-card">
          <h3>3. Grobovi v izbrani vrsti</h3>
          <div className="cem-editor-add">
            <label className="admin-field">
              <span>Začetna številka</span>
              <input
                type="number"
                min={1}
                max={100000}
                value={first}
                onChange={(e) => setFirst(Number(e.target.value))}
              />
            </label>
            <label className="admin-field">
              <span>Število novih mest</span>
              <input
                type="number"
                min={1}
                max={100}
                value={count}
                onChange={(e) => setCount(Number(e.target.value))}
              />
            </label>
            <button
              type="button"
              className="admin-button"
              disabled={!sector || !row}
              onClick={() => {
                if (!sector || !row) return;
                try {
                  const next = addCemeteryGraves(
                    value,
                    sector.name,
                    row,
                    first,
                    count,
                  );
                  onChange(next);
                  cancelPlacement();
                  setChosenId(next.graves[value.graves.length].id);
                  setFirst(first + count);
                  setError("");
                  setMessage(
                    "Dodana so prazna mesta brez oseb in brez potrjenega položaja.",
                  );
                } catch (cause) {
                  setError((cause as Error).message);
                }
              }}
            >
              <Plus size={16} />
              Dodaj grobna mesta
            </button>
          </div>
          <p>
            Obstoječih mest ne prepišemo. Za novo osebo najprej poiščite in
            izberite njen obstoječi grob.
          </p>
          <label className="admin-field">
            <span>
              <Search size={15} /> Poišči grob ali osebo v vseh sektorjih
            </span>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ime, priimek ali oznaka groba"
            />
          </label>
          <div className="cem-editor-list">
            {visible.map((item) => (
              <button
                type="button"
                key={item.id}
                className={`cem-editor-plot${selected?.id === item.id ? " is-selected" : ""}`}
                onClick={() => choose(item)}
                aria-pressed={selected?.id === item.id}
              >
                <strong>{item.id}</strong>
                <span>
                  {item.people.map((p) => p.name).join(" · ") ||
                    "Brez vpisanih oseb"}
                </span>
                <small>
                  {item.section} · vrsta {item.row} · grob {item.number} ·{" "}
                  {item.positioned === false
                    ? "položaj še ni potrjen"
                    : "položaj na načrtu"}
                </small>
              </button>
            ))}
          </div>
          {!visible.length && (
            <p>
              {query
                ? "Ni zadetkov. Poskusite drug priimek ali oznako."
                : "V izbrani vrsti še ni grobov."}
            </p>
          )}
        </section>
        {selected && (
          <section className="admin-panel cem-editor-card">
            <div className="cem-editor-heading">
              <h3>4. Izbrani grob: {selected.id}</h3>
              <button
                type="button"
                className="cem-editor-delete"
                onClick={() => {
                  if (
                    window.confirm(
                      `Odstranim grob ${selected.id} in ${selected.people.length} vpisanih oseb iz osnutka? Spremembo nato shranite.`,
                    )
                  ) {
                    onChange({
                      ...value,
                      graves: value.graves.filter((g) => g.id !== selected.id),
                    });
                    setChosenId("");
                  }
                }}
              >
                <Trash2 size={15} />
                Odstrani grob
              </button>
            </div>
            <div className="cem-editor-add">
              <label className="admin-field">
                <span>Oznaka groba (tudi za iskanje)</span>
                <input
                  maxLength={100}
                  value={selected.id}
                  onChange={(e) => {
                    const id = e.target.value;
                    if (
                      !/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(id) ||
                      value.graves.some((g) => g.id === id && g !== selected)
                    ) {
                      setError(
                        "Oznaka mora biti enolična; dovoljeni so črke brez šumnikov, številke, pika, pomišljaj in podčrtaj.",
                      );
                      return;
                    }
                    patch({ id });
                    setChosenId(id);
                    setError("");
                  }}
                />
              </label>
              <label className="admin-field">
                <span>Številka groba v vrsti</span>
                <input
                  type="number"
                  min={1}
                  max={100000}
                  value={selected.number}
                  onChange={(e) => patch({ number: Number(e.target.value) })}
                />
              </label>
            </div>
            <h4>
              <Users size={16} /> Osebe v tem grobu ({selected.people.length}
              /10)
            </h4>
            {selected.people.map((item, index) => (
              <div className="cem-editor-person" key={index}>
                <label className="admin-field">
                  <span>Ime in priimek</span>
                  <input
                    value={item.name}
                    maxLength={200}
                    onChange={(e) => person(index, { name: e.target.value })}
                  />
                </label>
                <label className="admin-field">
                  <span>Datum rojstva · neobvezno</span>
                  <input
                    type="date"
                    value={item.born}
                    onChange={(e) => person(index, { born: e.target.value })}
                  />
                </label>
                <label className="admin-field">
                  <span>Datum smrti · neobvezno</span>
                  <input
                    type="date"
                    value={item.died}
                    max={new Date().toLocaleDateString("en-CA", {
                      timeZone: "Europe/Ljubljana",
                    })}
                    onChange={(e) => person(index, { died: e.target.value })}
                  />
                </label>
                <button
                  type="button"
                  className="admin-button"
                  aria-label={`Odstrani osebo ${item.name || index + 1}`}
                  onClick={() => {
                    if (window.confirm("Odstranim to osebo iz osnutka?"))
                      patch({
                        people: selected.people.filter((_, i) => i !== index),
                      });
                  }}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
            <button
              type="button"
              className="admin-button"
              disabled={selected.people.length >= 10}
              onClick={() =>
                patch({
                  people: [
                    ...selected.people,
                    { name: "", born: "", died: "" },
                  ],
                })
              }
            >
              <Plus size={16} />
              Dodaj osebo v ta grob
            </button>
            <p>
              Neznane datume pustite prazne. Objavi se samo vneseni podatek.
            </p>
            <div className="cem-editor-actions">
              <button
                type="button"
                className="admin-button"
                onClick={() => {
                  setPlacement("grave");
                  setStart(null);
                  setMessage(
                    "V spodnjem načrtu kliknite sredino izbranega groba.",
                  );
                }}
              >
                <MapPin size={16} />
                {selected.positioned === false
                  ? "Postavi grob na načrt"
                  : "Popravi položaj na načrtu"}
              </button>
              <button
                type="button"
                className="admin-button"
                onClick={() => patch({ positioned: false })}
              >
                Umakni položaj z načrta
              </button>
            </div>
          </section>
        )}
        <section className="admin-panel cem-editor-card">
          <h3>5. Načrt in položaji</h3>
          {pendingPlan && (
            <section
              ref={confirmation}
              tabIndex={-1}
              className="admin-panel cem-editor-card"
              role="region"
              aria-label="Potrditev menjave načrta"
            >
              <h3>Kako želite zamenjati načrt?</h3>
              <p>
                Nove mere: {pendingPlan.width} × {pendingPlan.height}. Menjava
                ozadja lahko spremeni pomen obstoječih položajev. Izberite, kaj
                naj se zgodi z njimi.
              </p>
              <div className="cem-editor-actions">
                <button
                  type="button"
                  className="admin-button"
                  disabled={disabled}
                  onClick={() => applyBackground(pendingPlan, true)}
                >
                  Zamenjaj in ohrani potrjene položaje
                </button>
                <button
                  type="button"
                  className="admin-button"
                  disabled={disabled}
                  onClick={() => applyBackground(pendingPlan, false)}
                >
                  Zamenjaj in umakni položaje do preverjanja
                </button>
                <button
                  type="button"
                  className="admin-button"
                  disabled={disabled}
                  onClick={() => {
                    setPendingPlan(null);
                    setError("");
                  }}
                >
                  Prekliči menjavo načrta
                </button>
              </div>
            </section>
          )}
          <p>
            Načrt prikazuje samo potrjene položaje. Grob brez položaja ostane v
            javnem iskalniku, če vsebuje osebe. Položaj lahko določite s klikom;
            za celotno vrsto kliknite prvo in zadnje mesto.
          </p>
          <div className="cem-editor-actions">
            <button
              type="button"
              className="admin-button"
              onClick={() => {
                if (
                  !background({
                    width: 3000,
                    height: 3060,
                    imageUrl: "/images/cemetery-layout.svg",
                  })
                )
                  return;
                setMessage(
                  "Uporabljen je orientacijski osnutek poti in površin. Oznake sektorjev in položaje grobov vnesite po evidenci; pred objavo jih preverite.",
                );
              }}
            >
              <ImagePlus size={16} />
              Uporabi orientacijski osnutek
            </button>
            {onUpload && (
              <label className="admin-button cem-editor-upload">
                Naloži svoj načrt
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    const item = await onUpload(file);
                    if (item) background({ ...value.plan, imageUrl: item.url });
                    e.target.value = "";
                  }}
                />
              </label>
            )}
            <button
              type="button"
              className="admin-button"
              disabled={!plots.length}
              onClick={() => {
                setPlacement("row");
                setStart(null);
                setMessage(
                  "Kliknite sredino prvega groba (najnižja številka) izbrane vrste, nato zadnjega.",
                );
              }}
            >
              <Move size={16} />
              Razporedi izbrano vrsto ({plots.length})
            </button>
            {placement && (
              <button
                type="button"
                className="admin-button"
                onClick={() => {
                  setPlacement(null);
                  setStart(null);
                }}
              >
                <X size={16} />
                Prekliči postavljanje
              </button>
            )}
          </div>
          {placement && (
            <p role="status" className="cem-editor-message">
              {placement === "grave"
                ? `Postavljanje groba ${selected?.id}: kliknite njegovo sredino.`
                : start
                  ? "Izberite zadnji grob v vrsti."
                  : "Izberite prvi grob v vrsti."}
            </p>
          )}
          <div className="cem-editor-actions">
            <button
              type="button"
              className="admin-button"
              disabled={planZoom >= 4}
              onClick={() => setPlanZoom((z) => Math.min(4, z + 0.5))}
            >
              Povečaj delovni načrt
            </button>
            <button
              type="button"
              className="admin-button"
              disabled={planZoom <= 1}
              onClick={() => setPlanZoom((z) => Math.max(1, z - 0.5))}
            >
              Pomanjšaj načrt
            </button>
            <span>
              {Math.round(planZoom * 100)} % · za premik uporabite drsnika
            </span>
          </div>
          <div className="cem-editor-plan">
            <svg
              viewBox={`0 0 ${value.plan.width} ${value.plan.height}`}
              onClick={place}
              style={{
                width: `${planZoom * 100}%`,
                aspectRatio: `${value.plan.width}/${value.plan.height}`,
                cursor: placement ? "crosshair" : "default",
              }}
              aria-label="Uredniški načrt: izberite način postavljanja in kliknite položaj"
            >
              <rect
                width={value.plan.width}
                height={value.plan.height}
                fill="#edf1e7"
              />
              {value.plan.imageUrl && (
                <image
                  href={value.plan.imageUrl}
                  width={value.plan.width}
                  height={value.plan.height}
                  preserveAspectRatio="none"
                />
              )}
              {value.graves
                .filter((g) => g.positioned !== false)
                .map((item) => (
                  <g
                    key={item.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      if (!placement) choose(item);
                    }}
                    onKeyDown={(e) => {
                      if (!placement && (e.key === "Enter" || e.key === " ")) {
                        e.preventDefault();
                        choose(item);
                      }
                    }}
                    aria-label={`Izberi grob ${item.id}`}
                  >
                    <rect
                      x={item.x}
                      y={item.y}
                      width={36}
                      height={32}
                      rx={3}
                      fill={item.id === selected?.id ? "#19543d" : "#fff"}
                      stroke="#19543d"
                      strokeWidth={2}
                    />
                    <text
                      x={item.x + 18}
                      y={item.y + 21}
                      textAnchor="middle"
                      fontSize={10}
                      fill={item.id === selected?.id ? "#fff" : "#19543d"}
                    >
                      {item.number}
                    </text>
                    <title>{item.id}</title>
                  </g>
                ))}
              {start && (
                <circle
                  cx={start.x + 18}
                  cy={start.y + 16}
                  r={9}
                  fill="#b76230"
                />
              )}
            </svg>
          </div>
          <details>
            <summary>Nastavitve slike in mer načrta</summary>
            <p>
              Sprememba mer ne preračuna obstoječih položajev. Preverite, da vsi
              grobovi ostanejo znotraj načrta.
            </p>
            <div className="cem-editor-add">
              <label className="admin-field">
                <span>Širina</span>
                <input
                  type="number"
                  min={36}
                  max={10000}
                  key={value.plan.width}
                  defaultValue={value.plan.width}
                  onBlur={(e) => {
                    const width = Number(e.target.value);
                    e.target.value = String(value.plan.width);
                    if (width !== value.plan.width)
                      background({ ...value.plan, width });
                  }}
                />
              </label>
              <label className="admin-field">
                <span>Višina</span>
                <input
                  type="number"
                  min={32}
                  max={10000}
                  key={value.plan.height}
                  defaultValue={value.plan.height}
                  onBlur={(e) => {
                    const height = Number(e.target.value);
                    e.target.value = String(value.plan.height);
                    if (height !== value.plan.height)
                      background({ ...value.plan, height });
                  }}
                />
              </label>
              <label className="admin-field">
                <span>Naslov slike načrta</span>
                <input
                  key={value.plan.imageUrl || ""}
                  defaultValue={value.plan.imageUrl || ""}
                  placeholder="/api/media/…"
                  onBlur={(e) => {
                    const imageUrl = e.target.value || null;
                    e.target.value = value.plan.imageUrl || "";
                    if (imageUrl !== value.plan.imageUrl)
                      background({ ...value.plan, imageUrl });
                  }}
                />
              </label>
            </div>
          </details>
          <p>
            Skupaj {sectors.length} sektorjev, {value.graves.length} grobov in{" "}
            {value.graves.reduce((n, g) => n + g.people.length, 0)} oseb. Brez
            potrjenega položaja:{" "}
            {value.graves.filter((g) => g.positioned === false).length} grobov.
          </p>
        </section>
      </fieldset>
    </section>
  );
}
