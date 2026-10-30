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
import type { Grave } from "../data/cemetery";
import "./content.css";
import type { CmsLayoutData, CmsLinkOverride } from "../../shared/page-layout";

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
> & {
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
  cemetery: {
    plan: { width: number; height: number; imageUrl: string | null };
    graves: Grave[];
  };
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
  const [data, setData] = useState(initial);
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
      };
      setData((current) => ({ ...current, ...previewDraft.current }));
    };
    window.addEventListener("message", receive);
    return () => window.removeEventListener("message", receive);
  }, []);
  useEffect(() => {
    let active = true;
    const refresh = async () => {
      const controller = new AbortController();
      const timer = window.setTimeout(() => controller.abort(), 12000);
      try {
        const response = await fetch("/api/content", {
          signal: controller.signal,
          cache: "no-store",
        });
        if (!response.ok) return;
        const body = await response.json();
        if (active && body.sections)
          setData({
            ...initial,
            ...body.sections,
            _revisions: body.revisions || {},
            ...previewDraft.current,
          });
      } catch {
        /* Bundled defaults keep the public portal usable if the CMS is unavailable. */
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
      document.removeEventListener("visibilitychange", visible);
    };
  }, []);
  return <Context.Provider value={data}>{children}</Context.Provider>;
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

// Stable content identifiers, not credentials. Hashes never execute or interpret saved text.
export function contentKey(value: string) {
  return Array.from({ length: 8 }, (_, index) => {
    let hash = 2166136261 ^ Math.imul(index + 1, 0x9e3779b1);
    for (let i = 0; i < value.length; i++)
      hash = Math.imul(hash ^ value.charCodeAt(i), 16777619);
    return (hash >>> 0).toString(16).padStart(8, "0");
  }).join("");
}

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
