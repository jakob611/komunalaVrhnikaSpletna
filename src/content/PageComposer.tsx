import {
  Children,
  cloneElement,
  isValidElement,
  useEffect,
  useState,
  type ReactNode,
  type ReactElement,
} from "react";
import {
  Link as RouterLink,
  useLocation,
  type LinkProps,
} from "react-router-dom";
import { useSiteContent, contentKey } from "./SiteContent";
import type {
  CmsBlock,
  CmsLayoutData,
  CmsLinkOverride,
} from "../../shared/page-layout";
import { safeDestination, safePicture } from "../../shared/page-layout";
import "./page-composer.css";

export const isCmsPreview = () =>
  window.parent !== window &&
  (window.name === "kpv-cms-preview" ||
    new URLSearchParams(location.search).has("cms-preview"));
const textOf = (children: ReactNode): string =>
  Children.toArray(children)
    .map((child) =>
      typeof child === "string" || typeof child === "number"
        ? String(child)
        : isValidElement(child) && typeof child.type === "string"
          ? textOf((child.props as { children?: ReactNode }).children)
          : "",
    )
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
const names: Record<string, string> = {
  hero: "Uvodna predstavitev",
  "quick-section": "Najpogostejša opravila",
  "home-address": "Naslov in informacije",
  "home-notices": "Aktualna obvestila",
  "home-services-section": "Področja storitev",
  "depo-banner": "Predstavitev DEPO",
  "help-strip": "Kontaktna pomoč",
  notice: "Pojasnilo",
  "svc-help": "Pomoč",
  "svc-service-tools": "Sorodne storitve",
  "svc-contact-grid": "Kontaktni podatki",
  "svc-hours": "Delovni časi",
};
const sectionName = (
  props: Record<string, unknown> | undefined,
  index: number,
) => {
  if (typeof props?.title === "string") return props.title;
  if (typeof props?.["data-cms-title"] === "string")
    return String(props["data-cms-title"]);
  const classes = String(props?.className || "").split(" ");
  for (const key of classes) if (names[key]) return names[key];
  function heading(children: ReactNode): string {
    for (const node of Children.toArray(children)) {
      if (isValidElement(node)) {
        const p = node.props as { children?: ReactNode; title?: string };
        if (["h1", "h2", "h3"].includes(String(node.type))) {
          const value = textOf(p.children);
          if (value) return value;
        }
        const nested = heading(p.children);
        if (nested) return nested;
      }
    }
    return "";
  }
  return heading(props?.children as ReactNode) || `Razdelek ${index + 1}`;
};
function useLink(destination: string, children: ReactNode) {
  const data = useSiteContent();
  const { pathname } = useLocation();
  const label = textOf(children);
  const key = contentKey(`${destination}|${label}`);
  let change =
    data.links.find((x) => x.page === pathname && x.key === key) ||
    data.links.find((x) => x.page === "*" && x.key === key);
  if (change)
    try {
      safeDestination(change.url);
    } catch {
      change = undefined;
    }
  return { key, label, change };
}
export function CmsLink({ to, children, ...props }: LinkProps) {
  const destination =
    typeof to === "string"
      ? to
      : `${to.pathname || ""}${to.search || ""}${to.hash || ""}`;
  const { key, label, change } = useLink(destination, children);
  const actual = change?.url || destination;
  const metadata = {
    "data-cms-link-key": key,
    "data-cms-link-original": destination,
    "data-cms-link-label": label,
  };
  if (/^(?:https:|mailto:|tel:)/.test(actual))
    return (
      <a
        {...(props as React.AnchorHTMLAttributes<HTMLAnchorElement>)}
        {...metadata}
        href={actual}
      >
        {change?.label || children}
      </a>
    );
  return (
    <RouterLink {...props} {...metadata} to={actual}>
      {change?.label || children}
    </RouterLink>
  );
}
export function CmsAnchor({
  href = "",
  children,
  ...props
}: React.AnchorHTMLAttributes<HTMLAnchorElement>) {
  const { key, label, change } = useLink(href, children);
  return (
    <a
      {...props}
      href={change?.url || href}
      data-cms-link-key={key}
      data-cms-link-original={href}
      data-cms-link-label={label}
    >
      {change?.label || children}
    </a>
  );
}
function PublicButton({
  link,
}: {
  link: { id: string; label: string; url: string; variant?: string };
}) {
  const cls =
    link.variant === "text"
      ? "text-link"
      : `button${link.variant === "secondary" ? " secondary" : ""}`;
  try {
    safeDestination(link.url);
  } catch {
    return (
      <span className={cls} aria-disabled="true">
        {link.label}
      </span>
    );
  }
  return (
    <CmsLink className={cls} to={link.url}>
      {link.label}
    </CmsLink>
  );
}
function CustomBlock({ block }: { block: CmsBlock }) {
  let picture = "";
  try {
    picture = safePicture(block.image || "");
  } catch {
    /* Invalid draft images never load. */
  }
  if (block.type === "spacer")
    return <div className={`cms-spacer ${block.size}`} aria-hidden="true" />;
  return (
    <section
      className={`cms-block cms-tone-${block.tone} cms-align-${block.align} cms-width-${block.width}`}
      data-motion-section
      data-cms-block-id={block.id}
    >
      {block.type === "image" ? (
        picture && (
          <figure>
            <img src={picture} alt={block.alt || ""} loading="lazy" />
          </figure>
        )
      ) : (
        <>
          {block.title && <h2>{block.title}</h2>}
          {block.text && (
            <div className="cms-prose">
              {block.text.split(/\n\s*\n/).map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
          )}
          {block.type === "cards" && (
            <div className="cms-card-grid">
              {block.cards?.map((card) => (
                <article key={card.id}>
                  <h3>{card.title}</h3>
                  <p>{card.text}</p>
                  {card.url && (
                    <PublicButton
                      link={{
                        id: card.id,
                        label: card.label || "Več informacij",
                        url: card.url,
                        variant: "text",
                      }}
                    />
                  )}
                </article>
              ))}
            </div>
          )}
          {!!block.links?.length && (
            <div className="cms-button-row">
              {block.links.map((link) => (
                <PublicButton key={link.id} link={link} />
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}
export function CmsLayout({ children }: { children: ReactNode }) {
  const data = useSiteContent();
  const { pathname } = useLocation();
  const [preview, setPreview] = useState<CmsLayoutData | null>(null);
  const native = Children.toArray(children).map((node, index) => {
    const element = isValidElement(node) ? node : null;
    const props = element?.props as Record<string, unknown> | undefined;
    const id = `native-${contentKey(String(element?.key ?? index)).slice(0, 16)}`;
    const title = sectionName(props, index);
    return { id, title, node };
  });
  const signature = native.map((x) => `${x.id}:${x.title}`).join("|");
  useEffect(() => {
    if (!isCmsPreview()) return;
    const notify = () =>
      window.parent.postMessage(
        {
          type: "kpv-cms-structure",
          page: pathname,
          native: native.map(({ id, title }) => ({ id, title })),
        },
        location.origin,
      );
    const receive = (event: MessageEvent) => {
      if (event.origin !== location.origin || event.source !== window.parent)
        return;
      if (event.data?.type === "kpv-cms-update" && event.data.layout) {
        setPreview(event.data.layout);
        notify();
      }
      if (event.data?.type === "kpv-cms-request-structure") notify();
    };
    window.addEventListener("message", receive);
    notify();
    return () => window.removeEventListener("message", receive);
  }, [pathname, signature]);
  const layout = preview || data.layout;
  const configuration = layout.pages.find((p) => p.path === pathname);
  if (!configuration) return <>{children}</>;
  const used = new Set(
    configuration.blocks
      .filter((b) => b.type === "native")
      .map((b) => b.nativeId),
  );
  return (
    <>
      {configuration.blocks.map((block) => {
        if (block.hidden) return null;
        if (block.type !== "native")
          return <CustomBlock key={block.id} block={block} />;
        const item = native.find((n) => n.id === block.nativeId);
        if (!item) return null;
        if (isValidElement(item.node) && typeof item.node.type === "string") {
          const element = item.node as ReactElement<{
            className?: string;
            "data-cms-block-id"?: string;
          }>;
          return cloneElement(element, {
            key: block.id,
            "data-cms-block-id": block.id,
            className: `${element.props.className || ""} cms-native-block cms-native-${block.width} cms-native-align-${block.align}`,
          });
        }
        return (
          <div
            className={`cms-native-component${block.width === "narrow" || block.align !== "left" ? ` cms-native-box cms-native-${block.width} cms-native-align-${block.align}` : ""}`}
            data-cms-block-id={block.id}
            key={block.id}
          >
            {item.node}
          </div>
        );
      })}
      {native
        .filter((n) => !used.has(n.id))
        .map((n) => (
          <div className="cms-native-component" key={n.id}>
            {n.node}
          </div>
        ))}
    </>
  );
}
export function CustomCmsPage() {
  const data = useSiteContent();
  const { pathname } = useLocation();
  const page = data.layout.pages.find((p) => p.path === pathname);
  if (!page)
    return (
      <div className="container inner-page empty-state">
        <h1>Te strani nismo našli.</h1>
        <CmsLink to="/" className="button">
          Na začetno stran
        </CmsLink>
      </div>
    );
  return (
    <div className="container inner-page">
      <header className="page-intro">
        <span className="eyebrow">KOMUNALA VRHNIKA</span>
        <h1>{page.title}</h1>
      </header>
      <CmsLayout>{null}</CmsLayout>
    </div>
  );
}
