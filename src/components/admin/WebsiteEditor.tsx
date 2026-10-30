import { useEffect, useRef, useState } from "react";
import { MousePointer2, Upload } from "lucide-react";
import LayoutEditor from "./LayoutEditor";
import { type SiteData, type CopyOverride, type ImageOverride } from "../../content/SiteContent";
import type { CmsLinkOverride } from "../../../shared/page-layout";
import "./website-editor.css";

export const WEBSITE_SECTIONS = ["copy", "images", "links", "layout", "settings"] as const;
export type WebsiteDraft = Pick<SiteData, typeof WEBSITE_SECTIONS[number]>;
type Media = { id: string; url: string; name?: string };
type Selection = { kind: "text" | "image" | "link"; page: string; key: string; original: string; src?: string; alt?: string; label?: string; url?: string };

export default function WebsiteEditor({ value, onChange, pages, media, onUpload, disabled = false }: {
  value: WebsiteDraft; onChange: (value: WebsiteDraft) => void; pages: string[][];
  media: Media[]; onUpload: (file: File) => Promise<Media | undefined>; disabled?: boolean;
}) {
  const [tab, setTab] = useState<"content" | "layout" | "brand">("content");
  const [page, setPage] = useState("/");
  const [tool, setTool] = useState<"text" | "link">("text");
  const [mode, setMode] = useState<"edit" | "interact">("edit");
  const [selection, setSelection] = useState<Selection | null>(null);
  const [ready, setReady] = useState(false);
  const [selectedBlock, setSelectedBlock] = useState("");
  const frame = useRef<HTMLIFrameElement>(null);
  const allPages = [...pages, ...value.layout.pages.filter(p => !pages.some(([path]) => path === p.path)).map(p => [p.path, p.title])];
  const post = () => frame.current?.contentWindow?.postMessage({ type: "kpv-cms-update", ...value, mode, tool }, location.origin);
  useEffect(() => {
    const receive = (event: MessageEvent) => {
      if (event.origin !== location.origin || event.source !== frame.current?.contentWindow) return;
      if (event.data?.type === "kpv-cms-ready") {
        if (allPages.some(([path]) => path === event.data.page)) setPage(event.data.page);
        setReady(true); post();
      }
      if (event.data?.type === "kpv-cms-select") {
        const item = event.data as Selection;
        if (!["text", "image", "link"].includes(item.kind) || !/^[a-f0-9]{64}$/.test(item.key) || typeof item.original !== "string") return;
        if (item.page !== "*" && !allPages.some(([path]) => path === item.page)) return;
        setSelection(item);
      }
      if (event.data?.type === "kpv-cms-block-select" && typeof event.data.id === "string") { setSelectedBlock(event.data.id); setTab("layout"); }
      if (event.data?.type === "kpv-cms-brand-select") setTab("brand");
    };
    window.addEventListener("message", receive);
    return () => window.removeEventListener("message", receive);
  }, [value, mode, tool, page]);
  useEffect(() => { if (ready) post(); }, [value, mode, tool, ready]);
  const section = selection?.kind === "text" ? "copy" : selection?.kind === "image" ? "images" : "links";
  const current = selection ? value[section].find(x => x.key === selection.key && x.page === selection.page) : undefined;
  const changed = (patch: Record<string, string>) => {
    if (!selection) return;
    const original = current || { page: selection.page, key: selection.key, original: selection.original, ...(selection.kind === "text" ? { value: selection.original } : selection.kind === "image" ? { url: selection.src || "", alt: selection.alt || "" } : { url: selection.url || selection.original, label: selection.label || "" }) };
    const updated = { ...original, ...patch };
    const records = current ? value[section].map(x => x === current ? updated : x) : [...value[section], updated];
    onChange({ ...value, [section]: records });
  };
  const text = current as CopyOverride | undefined;
  const image = current as ImageOverride | undefined;
  const link = current as CmsLinkOverride | undefined;
  const imagePicker = (choose: (url: string) => void) => <>
    <label className="admin-button website-upload"><Upload size={16} /> Naloži in uporabi sliko
      <input type="file" accept="image/png,image/jpeg,image/webp" disabled={disabled} onChange={async e => { const file = e.target.files?.[0]; e.target.value = ""; if (file) { const item = await onUpload(file); if (item) choose(item.url); } }} />
    </label>
    <p className="website-help">JPG, PNG ali WebP do 5 MB. Za logotip priporočamo PNG s prosojnim ozadjem.</p>
    {media.length > 0 && <details><summary>Izberi obstoječo sliko ({media.length})</summary><div className="admin-image-picker">{media.map(item => <button type="button" key={item.id} disabled={disabled} onClick={() => choose(item.url)} aria-label={`Uporabi ${item.name || "sliko"}`}><img src={item.url} alt={item.name || "Slika iz knjižnice"} loading="lazy" /></button>)}</div></details>}
  </>;
  return <div className="website-editor">
    <div className="website-tabs" aria-label="Opravila urejevalnika">
      {([["content", "1. Besedila, slike in povezave"], ["layout", "2. Razdelki in meni"], ["brand", "3. Logotip KPV"]] as const).map(([key, label]) => <button type="button" aria-pressed={tab === key} className={tab === key ? "admin-button admin-primary" : "admin-button"} onClick={() => setTab(key)} key={key}>{label}</button>)}
    </div>
    <p className="website-help">Izberite stran in kliknite vsebino v predogledu. Med opravili lahko prehajate brez izgube sprememb. Ko končate, uporabite »Shrani in objavi«.</p>
    {tab === "layout" ? <LayoutEditor value={value.layout} onChange={layout => onChange({ ...value, layout })} pages={pages} disabled={disabled} previewData={value} page={page} onPageChange={setPage} initialSelected={selectedBlock} onEditContent={() => setTab("content")} media={media} onUpload={onUpload} /> : tab === "brand" ? <section className="admin-panel website-brand">
      <h2>Logotip KPV</h2><p>Ta logotip se prikaže v glavi in nogi vseh strani. Brez izbrane slike se prikaže besedilna oznaka podjetja.</p>
      <div className="website-logo-preview">{value.settings.logoUrl ? <img src={value.settings.logoUrl} alt={value.settings.logoAlt} /> : <strong>Komunala Vrhnika</strong>}</div>
      <fieldset disabled={disabled}><label className="admin-field"><span>Slika logotipa</span><input value={value.settings.logoUrl} placeholder="Izberite ali naložite sliko spodaj" onChange={e => onChange({ ...value, settings: { ...value.settings, logoUrl: e.target.value } })} /></label>
      <label className="admin-field"><span>Ime podjetja za bralnike zaslona</span><input value={value.settings.logoAlt} onChange={e => onChange({ ...value, settings: { ...value.settings, logoAlt: e.target.value } })} /></label>
      {imagePicker(url => onChange({ ...value, settings: { ...value.settings, logoUrl: url } }))}
      {!!value.settings.logoUrl && <button type="button" className="admin-danger-link" onClick={() => onChange({ ...value, settings: { ...value.settings, logoUrl: "" } })}>Odstrani logotip</button>}</fieldset>
    </section> : <>
      <div className="admin-preview-toolbar"><label>Stran za urejanje<select value={page} disabled={disabled} onChange={e => { setPage(e.target.value); setSelection(null); setReady(false); }}>{allPages.map(([path, label]) => <option key={path} value={path}>{label}</option>)}</select></label>
        <label>Opravilo<select value={tool} onChange={e => { setTool(e.target.value as "text" | "link"); setSelection(null); }}><option value="text">Besedilo ali slika · klikni vsebino</option><option value="link">Povezava · klikni gumb ali povezavo</option></select></label>
        <label>Način<select value={mode} onChange={e => setMode(e.target.value as "edit" | "interact")}><option value="edit">Urejanje</option><option value="interact">Preizkus povezav brez oddaje obrazcev</option></select></label>
      </div>
      <div className="admin-visual-workspace"><div className="admin-preview-wrap"><div className="admin-preview-caption"><small>{page} · {mode === "edit" ? "Kliknite vsebino za urejanje" : "Preizkus brez oddaje obrazcev"}</small></div><iframe key={page} ref={frame} name="kpv-cms-preview" title="Predogled strani za urejanje" src={`${page}?cms-preview=1`} sandbox="allow-scripts allow-same-origin" /></div>
        <aside className="admin-visual-inspector"><h2>{selection ? "Izbrana vsebina" : "Kliknite element v predogledu"}</h2>{selection ? <fieldset disabled={disabled}>
          <p className="website-help">{selection.page === "*" ? "Skupni element · sprememba velja na vseh straneh" : `Stran: ${allPages.find(([path]) => path === selection.page)?.[1] || selection.page}`}</p>
          {selection.kind !== "link" && <p className="website-help">{selection.kind === "text" ? "Če se povsem enako besedilo ponovi na tej strani, se spremenijo vse njegove ponovitve." : "Če je ista slika na tej strani uporabljena večkrat, se zamenjajo vse njene ponovitve."} {selection.page === "*" ? "Pri skupnem elementu zamenjava velja na vseh straneh." : ""}</p>}
          <p className="admin-original">{selection.kind === "image" ? selection.alt || "Slika" : selection.original}</p>
          {selection.kind === "text" ? <label className="admin-field"><span>Besedilo</span><textarea rows={7} value={text?.value ?? selection.original} onChange={e => changed({ value: e.target.value })} /></label> : selection.kind === "link" ? <>
            <label className="admin-field"><span>Besedilo povezave</span><input value={link?.label ?? selection.label ?? ""} onChange={e => changed({ label: e.target.value })} /></label><label className="admin-field"><span>Kam vodi povezava?</span><input value={link?.url ?? selection.url ?? selection.original} onChange={e => changed({ url: e.target.value })} /><small>Notranja stran /kontakt, javni naslov https://…, e-pošta mailto: ali telefon tel:.</small></label>
          </> : <>
            {(image?.url || selection.src) && <img className="admin-selected-image" src={image?.url || selection.src} alt={image?.alt || selection.alt || "Izbrana slika"} />}
            <label className="admin-field"><span>Naslov slike</span><input value={image?.url ?? selection.src ?? ""} onChange={e => changed({ url: e.target.value })} /></label><label className="admin-field"><span>Kratek opis slike</span><input value={image?.alt ?? selection.alt ?? ""} onChange={e => changed({ alt: e.target.value })} /><small>Opišite vsebino za obiskovalce z bralnikom zaslona.</small></label>{imagePicker(url => changed({ url }))}
          </>}
          {current && <button type="button" className="admin-danger-link" onClick={() => onChange({ ...value, [section]: value[section].filter(x => !(x.key === selection.key && x.page === selection.page)) })}>Povrni izvirno vsebino</button>}
        </fieldset> : <p className="website-help"><MousePointer2 size={18} /> Kliknite naslov, odstavek ali sliko. Za cilj gumba izberite opravilo »Povezava«. Dodane razdelke urejajte pod »Razdelki in meni«.</p>}</aside>
      </div>
    </>}
  </div>;
}
