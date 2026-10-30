import { useEffect, useState } from "react";
import NoticeDelivery from './NoticeDelivery';
import type { District } from './DistrictsEditor';
import { Eye, Plus, Search, Trash2 } from "lucide-react";
import "./notices-editor.css";

export type EditableNotice = {
  id: string; title: string; category: "water" | "roads" | "waste" | "general";
  area: string; date: string; summary: string; status: string;
  latitude: number | null; longitude: number | null; published?: boolean;
  districtIds?: string[]; allDistricts?: boolean; addressRules?: string[];
};
const categories = { water: "Voda in kanalizacija", roads: "Ceste in javne površine", waste: "Odpadki", general: "Splošno" };
const statuses = { info: "Informacija", planned: "Načrtovana dela / motnja", active: "Motnja v teku", resolved: "Zaključeno" };
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Ljubljana", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const normalize = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

export default function NoticesEditor({ value, onChange, disabled = false, districts, revision, csrfToken, dirty }: {
  value: EditableNotice[]; onChange: (value: EditableNotice[]) => void; disabled?: boolean;
  districts: District[]; revision: number; csrfToken: string; dirty: boolean;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const item = value.find(n => n.id === selected);
  const [addressText,setAddressText]=useState('');
  useEffect(()=>{setAddressText(item?.addressRules?.join('\n')||'');},[selected]);
  const shown = value.filter(n => normalize(`${n.title} ${n.area} ${n.summary}`).includes(normalize(query)) && (filter === "all" || (filter === "draft" ? n.published === false : n.published !== false))).sort((a,b) => b.date.localeCompare(a.date));
  const patch = (change: Partial<EditableNotice>) => onChange(value.map(n => n.id === selected ? { ...n, ...change } : n));
  function add() {
    const notice: EditableNotice = { id: `obvestilo-${crypto.randomUUID()}`, title: "", category: "general", area: "", date: today(), summary: "", status: "info", latitude: null, longitude: null, published: false };
    onChange([notice, ...value]); setSelected(notice.id); setQuery(""); setFilter("all");
  }
  return <div className="notice-editor">
    <div className="notice-editor-guide"><strong>1. Pripravite obvestilo → 2. Izberite prejemnike → 3. Shranite in preverite pošiljanje</strong><p>Osnutki so vidni samo urednikom. Shranjevanje objavi vsebino; e-pošto pošljete posebej z gumbom pod predogledom prejemnikov.</p></div>
    <div className="notice-editor-columns">
      <aside className="notice-editor-list" aria-label="Seznam obvestil">
        <button className="admin-button admin-primary" type="button" onClick={add} disabled={disabled || value.length >= 200}><Plus size={17}/> Dodaj obvestilo</button>
        <label className="admin-field"><span><Search size={14}/> Poišči obvestilo</span><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Naslov ali območje"/></label>
        <label className="admin-field"><span>Prikaz</span><select value={filter} onChange={e => setFilter(e.target.value)}><option value="all">Vsa obvestila ({value.length})</option><option value="published">Objave</option><option value="draft">Osnutki</option></select></label>
        <p className="admin-muted">{shown.length} obvestil</p>
        {shown.map(n => <button type="button" key={n.id} className={`notice-editor-row ${selected === n.id ? "is-selected" : ""}`} aria-pressed={selected === n.id} onClick={() => setSelected(n.id)}><strong>{n.title || "Novo obvestilo brez naslova"}</strong><span>{n.area || "Območje še ni vpisano"} · {n.date}</span><small>{n.published === false ? "Osnutek" : "Objava"} · {statuses[n.status as keyof typeof statuses]}</small></button>)}
        {!shown.length && <p>Ni obvestil za ta izbor.</p>}
      </aside>
      {!item ? <section className="notice-editor-empty"><Eye size={30}/><h2>Obvestila za občane</h2><p>Izberite obvestilo na levi ali dodajte novo. Motnjo zaključite s spremembo stanja; za umik objave izključite prikaz na spletni strani.</p><a href="/obvestila" target="_blank" rel="noreferrer">Odpri javna obvestila ↗</a></section> : <fieldset className="notice-editor-form" disabled={disabled}>
        <div className="notice-editor-heading"><h2>{item.title || "Novo obvestilo"}</h2><button type="button" className="admin-button admin-small" onClick={() => { if (window.confirm(`Izbrišem obvestilo »${item.title || "Brez naslova"}«? Izbris se uveljavi po shranjevanju.`)) { onChange(value.filter(n => n.id !== item.id)); setSelected(null); } }}><Trash2 size={15}/> Izbriši</button></div>
        <p className="admin-muted">Polja z * so obvezna za javno objavo. Nedokončano vsebino lahko shranite kot osnutek z izključenim prikazom.</p>
        <label className="admin-field"><span>Naslov obvestila *</span><input maxLength={250} value={item.title} onChange={e => patch({title:e.target.value})} placeholder="Npr. Prekinitev oskrbe s pitno vodo v Verdu"/></label>
        <div className="admin-field-grid"><label className="admin-field"><span>Področje</span><select value={item.category} onChange={e => patch({category:e.target.value as EditableNotice["category"]})}>{Object.entries(categories).map(([k,v]) => <option key={k} value={k}>{v}</option>)}</select></label><label className="admin-field"><span>Stanje</span><select value={item.status} onChange={e => patch({status:e.target.value})}>{Object.entries(statuses).map(([k,v]) => <option key={k} value={k}>{v}</option>)}</select></label></div>
        <div className="admin-field-grid"><label className="admin-field"><span>Območje / prizadeti naslovi *</span><input maxLength={300} value={item.area} onChange={e => patch({area:e.target.value})} placeholder="Kraj, ulica in po potrebi hišne številke"/></label><label className="admin-field"><span>Datum obvestila *</span><input type="date" value={item.date} onChange={e => patch({date:e.target.value})}/></label></div>
        <label className="admin-field"><span>Vsebina in navodila za občane *</span><textarea rows={7} maxLength={5000} value={item.summary} onChange={e => patch({summary:e.target.value})} placeholder="Kaj se dogaja, kje, kdaj in kaj naj storijo občani?"/></label>
        <section className="notice-editor-preview"><h3>Koga zadeva to obvestilo?</h3><p>Besedilo območja zgoraj je opis za občane. Za dostavo po e-pošti prejemnike izberite tukaj.</p><label className="admin-checkbox"><input type="checkbox" checked={item.allDistricts===true} onChange={e=>patch({allDistricts:e.target.checked})}/>Vsa aktivna območja obveščanja</label>
          {!item.allDistricts&&<div className="admin-choice-grid">{districts.filter(d=>d.active).map(d=><label key={d.id} className="admin-checkbox"><input type="checkbox" checked={(item.districtIds||[]).includes(d.id)} onChange={e=>patch({districtIds:e.target.checked?[...(item.districtIds||[]),d.id]:(item.districtIds||[]).filter(id=>id!==d.id)})}/>{d.name}</label>)}</div>}
          <label className="admin-field"><span>Omejitev na ulice ali hiše · neobvezno</span><textarea rows={3} value={addressText} placeholder={'Verd, Vrhnika\nTržaška cesta 48, Vrhnika'} onChange={e=>{setAddressText(e.target.value);patch({addressRules:e.target.value.split('\n').map(s=>s.trim()).filter(Boolean)});}}/><small>En naslov ali ulica na vrstico. Vedno dodajte kraj. Brez te omejitve prejmejo obvestilo vsi naročniki izbranih območij za izbrano temo. Hiša 1 ne vključuje 12 ali 1a. Razpon hiš vpišite kot posamezne naslove; prostega opisa »del ulice« sistem ne ugiba.</small></label>
        </section>
        <p className="admin-muted">Datum je podatek za občane. Ne določa časa objave; vključeno obvestilo se prikaže takoj po shranjevanju.</p><details><summary>Neobvezna točka na zemljevidu cestnih del</summary><p>Vnesite obe koordinati samo, če poznate točno lokacijo. Obvestilo je brez točke še vedno vidno na seznamu.</p><div className="admin-field-grid">{(["latitude", "longitude"] as const).map(k => <label className="admin-field" key={k}><span>{k === "latitude" ? "Zemljepisna širina" : "Zemljepisna dolžina"}</span><input type="number" step="any" min={k === "latitude" ? -90 : -180} max={k === "latitude" ? 90 : 180} value={item[k] ?? ""} onChange={e => patch({[k]:e.target.value === "" ? null : Number(e.target.value)})}/></label>)}</div></details>
        <label className="admin-checkbox notice-editor-publish"><input type="checkbox" checked={item.published !== false} onChange={e => patch({published:e.target.checked})}/><span><strong>Prikaži na spletni strani</strong><small>Sprememba začne veljati, ko zgoraj izberete »Shrani in objavi«.</small></span></label>
        <section className="notice-editor-preview" aria-label="Predogled obvestila"><span>Predogled · {item.published === false ? "osnutek" : "objava po shranjevanju"}</span><p>{categories[item.category]} · {statuses[item.status as keyof typeof statuses]} · {item.date}</p><h3>{item.title || "Naslov obvestila"}</h3><p className="notice-preview-body">{item.summary || "Vsebina obvestila se prikaže tukaj."}</p><small>{item.area || "Območje"}</small></section>
        <NoticeDelivery noticeId={item.id} revision={revision} csrfToken={csrfToken} dirty={dirty}/>
      </fieldset>}
    </div>
  </div>;
}
