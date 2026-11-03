import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import "./verified-address.css";

export type VerifiedAddress = {
  id: string;
  address: string;
  municipality: string;
  municipalityId: string;
};
export type VerifiedAddressPickerProps = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string, reason?: "input" | "selection") => void;
  onSelect: (value: VerifiedAddress | null) => void;
  disabled?: boolean;
  required?: boolean;
  name?: string;
  resolveValue?: boolean;
  describedBy?: string;
};
const municipalities = new Set(["vrhnika", "borovnica", "log-dragomer"]);
function isAddress(value: unknown): value is VerifiedAddress {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return ["id", "address", "municipality", "municipalityId"].every(key => typeof record[key] === "string" && record[key].length > 0 && record[key].length <= 250)
    && municipalities.has(String(record.municipalityId));
}

/** Search our packaged public register; typed household addresses never go to an outside geocoder. */
export default function VerifiedAddressPicker({ id, label, value, onChange, onSelect, disabled = false, required = false, name, resolveValue = true, describedBy }: VerifiedAddressPickerProps) {
  const [results, setResults] = useState<VerifiedAddress[]>([]);
  const [selected, setSelected] = useState<VerifiedAddress | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [searched, setSearched] = useState(false);
  const [more, setMore] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [attempt, setAttempt] = useState(0);
  const [sourceDate, setSourceDate] = useState("");
  const root = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const callbacks = useRef({ onChange, onSelect });
  callbacks.current = { onChange, onSelect };
  const edited = useRef<string | null>(null);
  const accepted = useRef<string | null>(null);
  const sequence = useRef(0);

  function choose(record: VerifiedAddress) {
    input.current?.focus();
    accepted.current = record.address;
    edited.current = null;
    setSelected(record);
    setResults([]);
    setOpen(false);
    setActive(-1);
    setError("");
    setLoading(false);
    callbacks.current.onChange(record.address, "selection");
    callbacks.current.onSelect(record);
  }

  useEffect(() => {
    const current = ++sequence.current;
    const controller = new AbortController();
    const trimmed = value.trim();
    if (accepted.current === value) return () => controller.abort();
    accepted.current = null;
    setSelected(null);
    callbacks.current.onSelect(null);
    setResults([]);
    setError("");
    setSearched(false);
    setActive(-1);
    setMore(false);
    if (trimmed.length < 3) { setLoading(false); return () => controller.abort(); }
    const exact = resolveValue && edited.current !== value;
    setLoading(true);
    const timer = window.setTimeout(() => {
      const timeout = window.setTimeout(() => controller.abort(), 15000);
      void fetch(`/api/addresses?${new URLSearchParams(exact ? { address: trimmed } : { q: trimmed })}`, { signal: controller.signal, cache: "no-store" })
        .then(async response => {
          const data = await response.json();
          if (!response.ok) throw Error(data.error || "Naslovov trenutno ni mogoče preveriti.");
          if (!Array.isArray(data.addresses) || !data.addresses.every(isAddress)) throw Error("Seznama naslovov ni mogoče prikazati. Poskusite znova.");
          if (sequence.current !== current || controller.signal.aborted) return;
          setSourceDate(typeof data.source?.updatedAt === "string" ? data.source.updatedAt : "");
          if (exact && data.addresses.length === 1) choose(data.addresses[0]);
          else {
            setResults(data.addresses);
            setMore(data.more === true);
            setSearched(true);
            setOpen(true);
          }
        })
        .catch(cause => {
          if (sequence.current !== current) return;
          if (controller.signal.aborted) setError("Preverjanje naslova traja predolgo. Poskusite znova.");
          else setError(cause instanceof Error ? cause.message : "Naslovov trenutno ni mogoče preveriti.");
        })
        .finally(() => { window.clearTimeout(timeout); if (sequence.current === current) setLoading(false); });
    }, exact ? 0 : 250);
    return () => { ++sequence.current; window.clearTimeout(timer); controller.abort(); };
  }, [value, attempt, resolveValue]);
  useEffect(() => {
    if(open && active >= 0) document.getElementById(`${id}-option-${active}`)?.scrollIntoView({block:"nearest"});
  },[active,open,id]);

  function keyboard(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") { setOpen(false); setActive(-1); return; }
    if (!results.length) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      setOpen(true);
      setActive(index => event.key === "ArrowDown" ? (index + 1) % results.length : (index <= 0 ? results.length - 1 : index - 1));
    } else if (event.key === "Enter" && open && active >= 0) {
      event.preventDefault();
      choose(results[active]);
    }
  }
  const listId = `${id}-options`, helpId = `${id}-verification`;
  return <div className="verified-address" ref={root} onBlur={event => { if (!root.current?.contains(event.relatedTarget as Node | null)) setOpen(false); }}>
    <label htmlFor={id}>{label}</label>
    <div className="verified-address-control">
    <input ref={input} id={id} name={name} type="text" role="combobox" aria-autocomplete="list" aria-expanded={open && results.length > 0} aria-controls={listId}
      aria-activedescendant={open && active >= 0 ? `${id}-option-${active}` : undefined} aria-describedby={[helpId, describedBy].filter(Boolean).join(" ")}
      autoComplete="off" spellCheck={false} required={required} disabled={disabled} maxLength={250} value={value}
      placeholder="Začnite z ulico ali naseljem in hišno številko" onKeyDown={keyboard}
      onFocus={() => { if (results.length) setOpen(true); }}
      onChange={event => {
        edited.current = event.target.value; accepted.current = null;
        setSelected(null); setResults([]); setSearched(false); setError(""); setOpen(true); setActive(-1);
        callbacks.current.onSelect(null); callbacks.current.onChange(event.target.value, "input");
      }}/>
    {open && results.length > 0 && <ul id={listId} className="verified-address-options" role="listbox" aria-label="Naslovi iz uradnega registra">
      {results.map((record, index) => <li key={record.id} role="presentation"><button id={`${id}-option-${index}`} type="button" role="option" aria-selected={index === active}
        tabIndex={-1} onMouseDown={event => event.preventDefault()} onClick={() => choose(record)}><strong>{record.address}</strong><small>Občina {record.municipality}</small></button></li>)}
    </ul>}
    </div>
    <div id={helpId} className="verified-address-help">
      {loading ? <p role="status">Preverjamo naslov …</p> : selected ? <p role="status">Preverjen naslov · občina {selected.municipality}</p>
        : searched && !results.length ? <p role="status">Naslova ni v prikazanem seznamu. Preverite ulico, hišno številko in kraj. Če ga ne najdete, se obrnite na KPV.</p>
        : <p>Vpišite vsaj tri znake in izberite svoj naslov med zadetki.</p>}
      {open && more && <p>Za več zadetkov dopišite hišno številko ali kraj.</p>}
      {error && <p role="alert">{error} <button type="button" className="text-link" disabled={disabled} onClick={() => setAttempt(value => value + 1)}>Poskusi znova</button></p>}
      <small>Vir: <a href="https://podatki.gov.si/dataset/register-naslovov" target="_blank" rel="noreferrer">GURS, Register naslovov</a> (<a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">CC BY 4.0</a>){sourceDate ? ` · kopija zajeta ${sourceDate.slice(0, 10)}` : ""}. Iskanje poteka v kopiji registra za tri občine.</small>
    </div>
  </div>;
}
