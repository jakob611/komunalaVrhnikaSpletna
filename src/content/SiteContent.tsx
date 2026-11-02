import {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
  type ReactNode,
} from "react";
import defaults from "../../shared/site-defaults.json";
import type { CollectionPoint, WasteCategory } from "../data/waste";
import type { CemeteryData } from "../data/cemetery";
import type {TariffData} from '../../shared/utility-pricing.js';
import "./content.css";
import type { CmsLayoutData, CmsLinkOverride } from "../../shared/page-layout";
import { useLocation } from "react-router-dom";

export type CopyOverride = {
  page: string;
  key: string;
  original: string;
  value: string;
};
export type ImageOverride = {
  page: string;
  key: string;
  original: string;
  url: string;
  alt: string;
};
export type SiteData = Omit<
  typeof defaults,
  | "wastePoints"
  | "wasteItems"
  | "copy"
  | "images"
  | "cemetery"
  | "notices"
  | "market"
  | "layout"
  | "links"
  | "tariffs"
> & {
  tariffs:TariffData;
  layout: CmsLayoutData;
  links: CmsLinkOverride[];
  market: { dates: string[]; closedDates: string[] };
  _revisions?: Record<string, number>;
  wastePoints: CollectionPoint[];
  wasteItems: {
    name: string;
    keywords: string[];
    category: WasteCategory;
    note?: string;
  }[];
  copy: CopyOverride[];
  images: ImageOverride[];
  cemetery: CemeteryData;
  notices: {
    id: string;
    title: string;
    category: "water" | "roads" | "waste" | "general";
    area: string;
    date: string;
    summary: string;
    status: string;
    districtIds?: string[];
    allDistricts?: boolean;
    addressRules?: string[];
    latitude: number | null;
    longitude: number | null;
    published?: boolean;
  }[];
};
const initial = defaults as unknown as SiteData;
const Context = createContext<SiteData>(initial);

export function SiteContentProvider({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const [data, setData] = useState(initial);
  const [status, setStatus] = useState<"loading" | "ready" | "unavailable" | "stale">("loading");
  const [attempt, setAttempt] = useState(0);
  const published = useRef(false);
  const previewDraft = useRef<Partial<SiteData>>({});
  useEffect(() => {
    if (window.parent === window) return;
    const receive = (event: MessageEvent) => {
      if (
        event.origin !== location.origin ||
        event.source !== window.parent ||
        event.data?.type !== "kpv-cms-update"
      )
        return;
      previewDraft.current = {
        ...previewDraft.current,
        ...(event.data.layout ? { layout: event.data.layout } : {}),
        ...(event.data.settings ? { settings: event.data.settings } : {}),
        ...(Array.isArray(event.data.links) ? { links: event.data.links } : {}),
        ...(Array.isArray(event.data.copy) ? { copy: event.data.copy } : {}),
        ...(Array.isArray(event.data.images) ? { images: event.data.images } : {}),
      };
      setData((current) => ({ ...current, ...previewDraft.current }));
    };
    window.addEventListener("message", receive);
    return () => window.removeEventListener("message", receive);
  }, []);
  useEffect(() => {
    let active = true;
    let refreshSequence = 0;
    let pending: AbortController | null = null;
    const refresh = async () => {
      pending?.abort();
      const sequence = ++refreshSequence;
      const controller = new AbortController();
      pending = controller;
      const timer = window.setTimeout(() => controller.abort(), 12000);
      try {
        const response = await fetch("/api/content", {
          signal: controller.signal,
          cache: "no-store",
        });
        if (!response.ok) throw new Error("Published content is unavailable");
        const body = await response.json();
        if (!body.sections || typeof body.sections !== "object" ||
          Object.keys(initial).some(key => !Object.hasOwn(body.sections, key)))
          throw new Error("Published content is incomplete");
        if (active && sequence === refreshSequence) {
          setData({
            ...body.sections,
            _revisions: body.revisions || {},
            ...previewDraft.current,
          });
          published.current = true;
          setStatus("ready");
        }
      } catch {
        if (active && sequence === refreshSequence)
          setStatus(published.current ? "stale" : "unavailable");
      } finally {
        clearTimeout(timer);
      }
    };
    void refresh();
    const visible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", visible);
    return () => {
      active = false;
      pending?.abort();
      document.removeEventListener("visibilitychange", visible);
    };
  }, [attempt]);
  const admin = pathname.replace(/\/+$/, "") === "/admin";
  const retry = () => { if (!published.current) setStatus("loading"); setAttempt(value => value + 1); };
  return <Context.Provider value={data}>
    {admin || status === "ready" || status === "stale" ? <>
      {!admin && status === "stale" && <aside className="content-availability" role="alert">
        <p>Prikazujemo zadnjo uspešno naloženo objavo. Aktualnosti podatkov trenutno ne moremo preveriti.</p>
        <button className="button secondary" onClick={retry}>Preveri znova</button>
      </aside>}
      {children}
    </> : <main id="main" className="container inner-page" tabIndex={-1}>
      {status === "loading" ? <p role="status">Nalagamo objavljene podatke …</p> : <section className="panel content-availability" role="alert">
        <h1>Podatkov trenutno ni mogoče naložiti.</h1>
        <p>Poskusite znova. Kontakte in nujna obvestila lahko preverite na spletni strani KPV.</p>
        <button className="button" onClick={retry}>Poskusi znova</button>{" "}
        <a className="text-link" href="https://www.kpv.si/">Spletna stran KPV</a>
      </section>}
    </main>}
  </Context.Provider>;
}
export const useSiteContent = () => useContext(Context);
export function telephone(value: string) {
  const number = value.replace(/[^+0-9]/g, "");
  return number.startsWith("00")
    ? `+${number.slice(2)}`
    : /^0[1-9]/.test(number)
      ? `+386${number.slice(1)}`
      : number;
}

export { contentKey } from "./content-key";

export function CmsPageImage({ page }: { page: string }) {
  const data = useSiteContent();
  const record = data.images.find(
    (image) => image.page === page && image.original === "cms:featured",
  );
  const preview =
    window.parent !== window &&
    (window.name === "kpv-cms-preview" ||
      new URLSearchParams(location.search).has("cms-preview"));
  if (record?.url)
    return (
      <figure className="container cms-page-image">
        <img
          src={record.url}
          alt={record.alt}
          data-cms-original="cms:featured"
        />
      </figure>
    );
  if (preview && page !== "/admin")
    return (
      <div
        className="container cms-image-placeholder"
        data-cms-image-slot="featured"
      >
        + Dodaj glavno sliko strani
      </div>
    );
  return null;
}
