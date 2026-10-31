import { useEffect, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Copy,
  Eye,
  EyeOff,
  Plus,
  RefreshCw,
  Trash2,
} from "lucide-react";
import type {
  CmsBlock,
  CmsLayoutData,
  CmsButton,
} from "../../../shared/page-layout";
import "./layout-editor.css";
import { mergeNativeBlocks } from "../../../shared/page-layout";
type Native = { id: string; title: string };
const uid = () => crypto.randomUUID();
const typeNames: Record<CmsBlock["type"], string> = {
  native: "Obstoječi razdelek",
  text: "Besedilo",
  image: "Slika",
  buttons: "Gumbi",
  cards: "Kartice",
  callout: "Poudarjeno obvestilo",
  spacer: "Razmik",
};
const emptyButton = (): CmsButton => ({
  id: uid(),
  label: "Več informacij",
  url: "/kontakt",
  variant: "primary",
});
const makeBlock = (type: CmsBlock["type"]): CmsBlock => ({
  id: uid(),
  type,
  tone: type === "callout" ? "soft" : "plain",
  align: "left",
  width: "wide",
  hidden: false,
  ...(["text", "cards", "callout"].includes(type)
    ? { title: "Nov razdelek", text: "Tukaj vnesite vsebino." }
    : {}),
  ...(["text", "buttons", "callout"].includes(type)
    ? { links: type === "buttons" ? [emptyButton()] : [] }
    : {}),
  ...(type === "image" ? { image: "", alt: "" } : {}),
  ...(type === "cards"
    ? {
        cards: [
          {
            id: uid(),
            title: "Nova kartica",
            text: "Kratek opis.",
            url: "/kontakt",
            label: "Več informacij",
          },
        ],
      }
    : {}),
  ...(type === "spacer" ? { size: "medium" } : {}),
});
export default function LayoutEditor({
  value,
  onChange,
  pages,
  disabled = false,
  previewData, page, onPageChange, initialSelected = "", onEditContent, media = [], onUpload, hasMoreMedia=false, mediaLoading=false, onMoreMedia,
}: {
  value: CmsLayoutData;
  onChange: (next: CmsLayoutData) => void;
  pages: string[][];
  disabled?: boolean;
  previewData?: Record<string, unknown>;
  page?: string; onPageChange?: (page: string) => void; initialSelected?: string;
  hasMoreMedia?:boolean;mediaLoading?:boolean;onMoreMedia?:()=>void;
  onEditContent?: () => void; media?: {id: string; url: string; name?: string}[];
  onUpload?: (file: File) => Promise<{url: string} | undefined>;
}) {
  const [localPath, setLocalPath] = useState("/");
  const path = page ?? localPath;
  const setPath = (next: string) => { setLocalPath(next); onPageChange?.(next); };
  const [native, setNative] = useState<Native[]>([]);
  const [selected, setSelected] = useState(initialSelected);
  const [type, setType] = useState<CmsBlock["type"]>("text");
  const [newTitle, setNewTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  const properties = useRef<HTMLFieldSetElement>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  const current = value.pages.find((p) => p.path === path);
  const blocks = mergeNativeBlocks(current?.blocks, native);
  const block = blocks.find((b) => b.id === selected);
  const allPages = [
    ...pages,
    ...value.pages
      .filter((p) => !pages.some(([url]) => url === p.path))
      .map((p) => [p.path, p.title]),
  ];
  useEffect(() => {
    // A history restore may remove the custom page currently open in the editor.
    if (
      path.startsWith("/strani/") &&
      !value.pages.some((page) => page.path === path)
    ) {
      setPath("/");
      setNative([]);
      setSelected("");
      setReady(false);
    }
  }, [path, value.pages]);
  const update = (
    next: CmsBlock[],
    title = current?.title ||
      allPages.find(([url]) => url === path)?.[1] ||
      "Nova stran",
  ) => {
    const entry = { path, title, blocks: next };
    onChange({
      ...value,
      pages: current
        ? value.pages.map((p) => (p.path === path ? entry : p))
        : [...value.pages, entry],
    });
  };
  const patch = (change: Partial<CmsBlock>) => {
    if (block)
      update(blocks.map((b) => (b.id === block.id ? { ...b, ...change } : b)));
  };
  useEffect(() => {
    const receive = (event: MessageEvent) => {
      if (
        event.origin !== location.origin ||
        event.source !== frame.current?.contentWindow
      )
        return;
      if (event.data?.type === "kpv-cms-ready") {
        setReady(true);
        frame.current?.contentWindow?.postMessage(
          {
            type: "kpv-cms-update",
            ...previewData,
            layout: value,
            mode: "edit",
            tool: "layout",
          },
          location.origin,
        );
        frame.current?.contentWindow?.postMessage(
          { type: "kpv-cms-request-structure" },
          location.origin,
        );
      }
      if (
        event.data?.type === "kpv-cms-structure" &&
        event.data.page === path &&
        Array.isArray(event.data.native)
      ) {
        const items = event.data.native
          .filter(
            (n: Native) =>
              typeof n?.id === "string" && typeof n.title === "string",
          )
          .slice(0, 100);
        setNative((prev) =>
          JSON.stringify(prev) === JSON.stringify(items) ? prev : items,
        );
        setReady(true);
      }
      if (
        event.data?.type === "kpv-cms-block-select" &&
        typeof event.data.id === "string"
      )
        setSelected(event.data.id);
    };
    window.addEventListener("message", receive);
    return () => window.removeEventListener("message", receive);
  }, [path, value]);
  useEffect(() => {
    frame.current?.contentWindow?.postMessage(
      { type: "kpv-cms-update", ...previewData, layout: value, mode: "edit", tool: "layout", selectedBlock: selected },
      location.origin,
    );
  }, [value, ready, previewData, selected]);
  const labelFor = (item: CmsBlock, index: number) => `${index + 1}. ${item.title || native.find(n => n.id === item.nativeId)?.title || typeNames[item.type]}`;
  function move(index: number, by: number) {
    if (index + by < 0 || index + by >= blocks.length) return;
    setSelected(blocks[index].id);
    const next = [...blocks];
    const [target] = next.splice(index, 1);
    next.splice(index + by, 0, target);
    update(next);
  }
  function addPage() {
    setError("");
    const path = `/strani/${slug.trim()}`;
    if (
      !/^\/strani\/[a-z0-9]+(?:-[a-z0-9]+)*$/.test(path) ||
      !newTitle.trim()
    ) {
      setError("Vnesite naslov in pot z malimi črkami, številkami ter vezaji.");
      return;
    }
    if (value.pages.some((p) => p.path === path)) {
      setError("Ta pot že obstaja.");
      return;
    }
    onChange({
      ...value,
      pages: [
        ...value.pages,
        { path, title: newTitle.trim(), blocks: [makeBlock("text")] },
      ],
    });
    setPath(path);
    setNative([]);
    setReady(false);
    setSlug("");
    setNewTitle("");
  }
  function defaultMenu() {
    onChange({
      ...value,
      navigation: [
        ["Odpadki", "/odpadki"],
        ["Voda in odvajanje", "/voda"],
        ["Javni prostor", "/javni-prostor"],
        ["Storitve", "/storitve"],
        ["O podjetju", "/o-podjetju"],
      ].map(([label, url]) => ({ id: uid(), label, url, variant: "text" })),
    });
  }
  return (
    <div className="layout-editor">
      <div className="admin-panel layout-toolbar">
        <label className="admin-field">
          <span>Stran in razporeditev</span>
          <select
            value={path}
            disabled={disabled}
            onChange={(e) => {
              setPath(e.target.value);
              setNative([]);
              setSelected("");
              setReady(false);
            }}
          >
            {allPages.map(([url, title]) => (
              <option value={url} key={url}>
                {title} · {url}
              </option>
            ))}
          </select>
        </label>
        <button
          className="admin-button"
          onClick={() => {
            if (frame.current) {
              setReady(false);
              frame.current.src = `${path}?cms-preview=1`;
            }
          }}
        >
          <RefreshCw size={16} />
          Osveži predogled
        </button>
      </div>
      <p className="layout-hint">
        Kliknite razdelek v seznamu ali predogledu. Izbrani razdelek se obarva zeleno.
        Puščici premakneta samo ta razdelek za eno mesto. Skrit razdelek lahko
        kadar koli znova prikažete.
      </p>
      {block && <div className="layout-selection-summary"><strong>Izbrano: {labelFor(block, blocks.indexOf(block))}{block.hidden ? " · skrito" : ""}</strong><button type="button" className="admin-button admin-small" onClick={() => properties.current?.scrollIntoView({block: "start", behavior: "auto"})}>Uredi nastavitve razdelka ↓</button></div>}
      {error && (
        <p className="admin-error" role="alert">
          {error}
        </p>
      )}
      <div className="layout-workspace">
        <section
          className="admin-panel layout-block-list"
          aria-label="Razdelki strani"
        >
          <label className="admin-field">
            <span>
              {path.startsWith("/strani/")
                ? "Naslov strani"
                : "Naslov zavihka v brskalniku"}
            </span>
            <input
              value={
                current?.title ||
                allPages.find(([url]) => url === path)?.[1] ||
                ""
              }
              disabled={disabled}
              onChange={(e) => update(blocks, e.target.value)}
            />
            {!path.startsWith("/strani/") && (
              <small>
                Glavni naslov spreminjate pod »Besedila, slike in povezave«.
              </small>
            )}
          </label>
          {!ready && <p role="status">Nalagamo razdelke predogleda …</p>}
          <ol>
            {blocks.map((item, index) => (
              <li
                key={item.id}
                className={item.id === selected ? "is-selected" : ""}
              >
                <button
                  className="layout-select"
                  aria-pressed={item.id === selected}
                  onClick={() => setSelected(item.id)}
                >
                  <small>
                    {item.hidden ? "Skrito · " : ""}
                    {typeNames[item.type]}
                  </small>
                  <strong>
                    {labelFor(item, index)}
                  </strong>
                </button>
                <div className="layout-row-actions">
                  <button
                    aria-label={`Premakni ${labelFor(item, index)} navzgor`}
                    title="Premakni za eno mesto navzgor"
                    disabled={disabled || index === 0}
                    onClick={() => move(index, -1)}
                  >
                    <ArrowUp size={16} />
                  </button>
                  <button
                    aria-label={`Premakni ${labelFor(item, index)} navzdol`}
                    title="Premakni za eno mesto navzdol"
                    disabled={disabled || index === blocks.length - 1}
                    onClick={() => move(index, 1)}
                  >
                    <ArrowDown size={16} />
                  </button>
                  <button
                    aria-label={`${item.hidden ? "Prikaži" : "Skrij"} razdelek ${index + 1}`}
                    title={item.hidden ? "Prikaži na spletni strani" : "Skrij s spletne strani"}
                    disabled={disabled}
                    onClick={() =>
                      update(
                        blocks.map((b) =>
                          b.id === item.id ? { ...b, hidden: !b.hidden } : b,
                        ),
                      )
                    }
                  >
                    {item.hidden ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                  {item.type !== "native" && (
                    <button
                      aria-label={`Odstrani razdelek ${index + 1}`}
                      disabled={disabled}
                      onClick={() => {
                        if (!window.confirm(`Odstranite razdelek »${labelFor(item, index)}«?`)) return;
                        update(blocks.filter((b) => b.id !== item.id));
                        setSelected("");
                      }}
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ol>
          <div className="layout-add">
            <label className="admin-field">
              <span>Vrsta novega razdelka</span>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as CmsBlock["type"])}
              >
                {Object.entries(typeNames)
                  .filter(([key]) => key !== "native")
                  .map(([key, title]) => (
                    <option key={key} value={key}>
                      {title}
                    </option>
                  ))}
              </select>
            </label>
            <button
              className="admin-button"
              disabled={disabled || !ready || blocks.length >= 100}
              onClick={() => {
                const next = makeBlock(type);
                update([...blocks, next]);
                setSelected(next.id);
              }}
            >
              <Plus size={16} />
              Dodaj razdelek
            </button>
          </div>
          {current && (
            <button
              className="admin-danger-link"
              disabled={disabled}
              onClick={() => {
                if (
                  window.confirm(
                    "Ponastavite razporeditev in odstranite dodane razdelke te strani? Objavljena zgodovina ostane na voljo.",
                  )
                ) {
                  onChange({
                    ...value,
                    pages: value.pages.filter((p) => p.path !== path),
                  });
                  setSelected("");
                  if (path.startsWith("/strani/")) setPath("/");
                }
              }}
            >
              Ponastavi razporeditev te strani
            </button>
          )}
        </section>
        <div className="layout-live">
          <iframe
            ref={frame}
            name="kpv-cms-preview"
            title="Predogled razporeditve strani"
            src={`${path}?cms-preview=1`}
            sandbox="allow-scripts allow-same-origin"
          />
          <p>Spremembe objavite z gumbom »Shrani in objavi« zgoraj.</p>
        </div>
      </div>
      {block && (
        <fieldset ref={properties} className="admin-panel layout-properties" disabled={disabled}>
          <legend>Urejate: {labelFor(block, blocks.indexOf(block))}</legend>
          <p className="layout-hint">Te nastavitve veljajo samo za izbrani razdelek.</p>
          <div className="layout-property-grid">
            <label className="admin-field">
              <span>Poravnava besedila</span>
              <select
                value={block.align}
                onChange={(e) =>
                  patch({ align: e.target.value as CmsBlock["align"] })
                }
              >
                <option value="left">Levo</option>
                <option value="center">Na sredino</option>
                <option value="right">Desno</option>
              </select>
            </label>
            <label className="admin-field">
              <span>Širina</span>
              <select
                value={block.width}
                onChange={(e) =>
                  patch({ width: e.target.value as CmsBlock["width"] })
                }
              >
                <option value="wide">Široko</option>
                <option value="narrow">Ozko · lažje branje</option>
              </select>
            </label>
            {block.type !== "native" && (
              <label className="admin-field">
                <span>Videz</span>
                <select
                  value={block.tone}
                  onChange={(e) =>
                    patch({ tone: e.target.value as CmsBlock["tone"] })
                  }
                >
                  <option value="plain">Belo ozadje</option>
                  <option value="soft">Svetlo zeleno</option>
                  <option value="dark">Temno zeleno</option>
                </select>
              </label>
            )}
          </div>
          {block.type === "native" && (
            <div>
              <p>Tukaj spreminjate razporeditev in vidnost obstoječega razdelka.
              Podatke urnikov, obvestil in obrazcev urejajte v njihovem področju.</p>
              {onEditContent && <button type="button" className="admin-button" onClick={onEditContent}>Uredi besedilo ali sliko v tem razdelku</button>}
            </div>
          )}
          {["text", "callout", "cards"].includes(block.type) && (
            <>
              <label className="admin-field">
                <span>Naslov razdelka</span>
                <input
                  value={block.title || ""}
                  onChange={(e) => patch({ title: e.target.value })}
                />
              </label>
              <label className="admin-field">
                <span>Besedilo razdelka</span>
                <textarea
                  rows={5}
                  value={block.text || ""}
                  onChange={(e) => patch({ text: e.target.value })}
                />
                <small>Prazna vrstica ustvari nov odstavek.</small>
              </label>
            </>
          )}
          {block.type === "image" && (
            <>
              <label className="admin-field">
                <span>Naslov slike</span>
                <input
                  value={block.image || ""}
                  onChange={(e) => patch({ image: e.target.value })}
                />
              </label>
              <label className="admin-field">
                <span>Opis slike</span>
                <input
                  value={block.alt || ""}
                  onChange={(e) => patch({ alt: e.target.value })}
                />
              </label>
            </>
          )}
          {block.type === "image" && <>
            {block.image && <img className="admin-selected-image" src={block.image} alt={block.alt || "Predogled slike"} />}
            {onUpload && <label className="admin-button website-upload">Naloži in uporabi sliko<input type="file" accept="image/png,image/jpeg,image/webp" disabled={disabled} onChange={async e => { const file = e.target.files?.[0]; e.target.value = ""; if (file) { const item = await onUpload(file); if (item) patch({image: item.url}); } }} /></label>}
            {!!media.length && <details><summary>Izberi sliko iz knjižnice</summary><div className="admin-image-picker">{media.map(item => <button key={item.id} type="button" onClick={() => patch({image: item.url})} aria-label={`Uporabi ${item.name || "sliko"}`}><img src={item.url} alt={item.name || "Slika"} loading="lazy" /></button>)}</div>{hasMoreMedia&&<button type="button" className="admin-button" disabled={disabled||mediaLoading} onClick={onMoreMedia}>{mediaLoading?'Nalagamo …':'Naloži starejše slike'}</button>}</details>}
          </>}
          {block.type === "spacer" && (
            <label className="admin-field">
              <span>Višina razmika</span>
              <select
                value={block.size}
                onChange={(e) =>
                  patch({ size: e.target.value as CmsBlock["size"] })
                }
              >
                <option value="small">Majhen</option>
                <option value="medium">Srednji</option>
                <option value="large">Velik</option>
              </select>
            </label>
          )}
          {block.links && (
            <>
              <h3>Gumbi in povezave</h3>
              {block.links.map((link, index) => (
                <div className="layout-link-fields" key={link.id}>
                  <label className="admin-field">
                    <span>Besedilo gumba {index + 1}</span>
                    <input
                      value={link.label}
                      onChange={(e) =>
                        patch({
                          links: block.links!.map((x) =>
                            x.id === link.id
                              ? { ...x, label: e.target.value }
                              : x,
                          ),
                        })
                      }
                    />
                  </label>
                  <label className="admin-field">
                    <span>Cilj gumba {index + 1}</span>
                    <input
                      placeholder="/kontakt ali https://…"
                      value={link.url}
                      onChange={(e) =>
                        patch({
                          links: block.links!.map((x) =>
                            x.id === link.id
                              ? { ...x, url: e.target.value }
                              : x,
                          ),
                        })
                      }
                    />
                  </label>
                  <label className="admin-field">
                    <span>Videz gumba {index + 1}</span>
                    <select
                      value={link.variant}
                      onChange={(e) =>
                        patch({
                          links: block.links!.map((x) =>
                            x.id === link.id
                              ? {
                                  ...x,
                                  variant: e.target
                                    .value as CmsButton["variant"],
                                }
                              : x,
                          ),
                        })
                      }
                    >
                      <option value="primary">Glavni gumb</option>
                      <option value="secondary">Obroba</option>
                      <option value="text">Besedilna povezava</option>
                    </select>
                  </label>
                  <button
                    className="admin-button"
                    disabled={index === 0}
                    onClick={() => {
                      const links = [...block.links!];
                      [links[index - 1], links[index]] = [
                        links[index],
                        links[index - 1],
                      ];
                      patch({ links });
                    }}
                    aria-label={`Premakni gumb ${index + 1} navzgor`}
                  >
                    <ArrowUp size={16} />
                  </button>
                  <button
                    className="admin-button"
                    onClick={() =>
                      patch({
                        links: block.links!.filter((x) => x.id !== link.id),
                      })
                    }
                    aria-label={`Odstrani gumb ${index + 1}`}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
              <button
                className="admin-button"
                disabled={block.links.length >= 12}
                onClick={() =>
                  patch({ links: [...block.links!, emptyButton()] })
                }
              >
                <Plus size={16} />
                Dodaj gumb
              </button>
            </>
          )}
          {block.cards && (
            <>
              <h3>Kartice</h3>
              {block.cards.map((card, index) => (
                <div className="layout-card-fields" key={card.id}>
                  {(["title", "text", "label", "url"] as const).map((key) => (
                    <label key={key} className="admin-field">
                      <span>
                        {
                          {
                            title: "Naslov",
                            text: "Opis",
                            label: "Besedilo povezave",
                            url: "Cilj povezave",
                          }[key]
                        }{" "}
                        kartice {index + 1}
                      </span>
                      <input
                        value={card[key]}
                        onChange={(e) =>
                          patch({
                            cards: block.cards!.map((x) =>
                              x.id === card.id
                                ? { ...x, [key]: e.target.value }
                                : x,
                            ),
                          })
                        }
                      />
                    </label>
                  ))}
                  <button
                    className="admin-button"
                    disabled={index === 0}
                    onClick={() => {
                      const cards = [...block.cards!];
                      [cards[index - 1], cards[index]] = [
                        cards[index],
                        cards[index - 1],
                      ];
                      patch({ cards });
                    }}
                    aria-label={`Premakni kartico ${index + 1} navzgor`}
                  >
                    <ArrowUp size={16} />
                  </button>
                  <button
                    className="admin-button"
                    onClick={() =>
                      patch({
                        cards: block.cards!.filter((x) => x.id !== card.id),
                      })
                    }
                  >
                    <Trash2 size={16} />
                    Odstrani kartico
                  </button>
                </div>
              ))}
              <button
                className="admin-button"
                disabled={block.cards.length >= 12}
                onClick={() =>
                  patch({
                    cards: [
                      ...block.cards!,
                      {
                        id: uid(),
                        title: "Nova kartica",
                        text: "",
                        url: "",
                        label: "",
                      },
                    ],
                  })
                }
              >
                Dodaj kartico
              </button>
            </>
          )}
          {block.type !== "native" && (
            <button
              className="admin-button"
              disabled={blocks.length >= 100}
              onClick={() => {
                const next = {
                  ...structuredClone(block),
                  id: uid(),
                  ...(block.links
                    ? { links: block.links.map((x) => ({ ...x, id: uid() })) }
                    : {}),
                  ...(block.cards
                    ? { cards: block.cards.map((x) => ({ ...x, id: uid() })) }
                    : {}),
                };
                update([...blocks, next]);
                setSelected(next.id);
              }}
            >
              <Copy size={16} />
              Podvoji razdelek
            </button>
          )}
        </fieldset>
      )}
      <details className="admin-panel">
        <summary>Glavni meni spletne strani</summary>
        <p>
          Prazen seznam ohrani izvirni meni s podmeniji. Lastni meni je raven
          seznam do 10 povezav.
        </p>
        {!value.navigation.length ? (
          <button className="admin-button" onClick={defaultMenu}>
            Pripravi meni za urejanje
          </button>
        ) : (
          <>
            {value.navigation.map((link, index) => (
              <div className="layout-link-fields" key={link.id}>
                <label className="admin-field">
                  <span>Naziv povezave v meniju {index + 1}</span>
                  <input
                    value={link.label}
                    onChange={(e) =>
                      onChange({
                        ...value,
                        navigation: value.navigation.map((x) =>
                          x.id === link.id
                            ? { ...x, label: e.target.value }
                            : x,
                        ),
                      })
                    }
                  />
                </label>
                <label className="admin-field">
                  <span>Cilj povezave v meniju {index + 1}</span>
                  <input
                    value={link.url}
                    onChange={(e) =>
                      onChange({
                        ...value,
                        navigation: value.navigation.map((x) =>
                          x.id === link.id ? { ...x, url: e.target.value } : x,
                        ),
                      })
                    }
                  />
                </label>
                <button
                  className="admin-button"
                  disabled={index === 0}
                  onClick={() => {
                    const navigation = [...value.navigation];
                    [navigation[index - 1], navigation[index]] = [
                      navigation[index],
                      navigation[index - 1],
                    ];
                    onChange({ ...value, navigation });
                  }}
                  aria-label={`Premakni menijsko povezavo ${index + 1} navzgor`}
                >
                  <ArrowUp size={16} />
                </button>
                <button
                  className="admin-button"
                  onClick={() =>
                    onChange({
                      ...value,
                      navigation: value.navigation.filter(
                        (x) => x.id !== link.id,
                      ),
                    })
                  }
                  aria-label={`Odstrani menijsko povezavo ${index + 1}`}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
            <button
              className="admin-button"
              disabled={value.navigation.length >= 10}
              onClick={() =>
                onChange({
                  ...value,
                  navigation: [...value.navigation, emptyButton()],
                })
              }
            >
              Dodaj povezavo v meni
            </button>
            <button
              className="admin-button"
              onClick={() => onChange({ ...value, navigation: [] })}
            >
              Povrni izvirni meni
            </button>
          </>
        )}
      </details>
      <details className="admin-panel">
        <summary>Dodaj novo vsebinsko stran</summary>
        <div className="layout-property-grid">
          <label className="admin-field">
            <span>Naslov nove strani</span>
            <input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
            />
          </label>
          <label className="admin-field">
            <span>Pot nove strani · /strani/</span>
            <input
              value={slug}
              placeholder="pogosta-vprasanja"
              onChange={(e) => setSlug(e.target.value)}
            />
          </label>
          <button
            className="admin-button"
            disabled={disabled}
            onClick={addPage}
          >
            <Plus size={16} />
            Ustvari stran
          </button>
        </div>
        <p>
          Stran objavite s shranjevanjem. Da bo dosegljiva, dodajte povezavo v
          meni ali gumb.
        </p>
      </details>
    </div>
  );
}
