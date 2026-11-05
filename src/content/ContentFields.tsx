import { createElement, type ImgHTMLAttributes } from "react";
import { useLocation } from "react-router-dom";
import { contentKey, useSiteContent } from "./SiteContent";
import { legacyFieldText } from "./legacy-fields";

/** Permanent field IDs share the existing storage format without tying edits to wording. */
export const fieldKey = (id: string) => contentKey(`field:${id}`);

export function CmsText({ id, children, global = false }: {
  id: string; children: string; global?: boolean;
}) {
  const { copy } = useSiteContent();
  const { pathname } = useLocation();
  const page = global ? "*" : pathname;
  const original = legacyFieldText[id] ?? children.replace(/\s+/g, " ").trim();
  const key = fieldKey(id), legacyKey = contentKey(original);
  const change = copy.find(record => record.page === page && record.key === key)
    ?? copy.find(record => record.page === "*" && record.key === key)
    ?? copy.find(record => record.page === page && record.key === legacyKey)
    ?? copy.find(record => record.page === "*" && record.key === legacyKey);
  // A custom inline tag avoids existing span/strong CSS selectors changing appearance.
  return createElement("kpv-copy", {
    "data-cms-field-key": key,
    "data-cms-field-original": children.replace(/\s+/g, " ").trim(),
    "data-cms-field-legacy-key": legacyKey,
    "data-cms-field-page": page,
  }, change ? `${children.match(/^\s*/)?.[0] ?? ""}${change.value}${children.match(/\s*$/)?.[0] ?? ""}` : children);
}

const imageAliases: Record<string, string> = { "Home.hero-image": "/images/ljubljanica.webp" };
export function CmsImage({ fieldId, src = "", alt = "", ...props }: ImgHTMLAttributes<HTMLImageElement> & { fieldId: string }) {
  const { images } = useSiteContent();
  const { pathname } = useLocation();
  const original = imageAliases[fieldId] ?? src;
  const key = fieldKey(fieldId), legacyKey = contentKey(original);
  const change = images.find(record => record.page === pathname && record.key === key)
    ?? images.find(record => record.page === "*" && record.key === key)
    ?? images.find(record => record.page === pathname && record.key === legacyKey)
    ?? images.find(record => record.page === "*" && record.key === legacyKey);
  return <img {...props} src={change?.url ?? src} alt={change?.alt ?? alt}
    data-cms-image-field="true" data-cms-field-key={key} data-cms-field-original={original}
    data-cms-field-legacy-key={legacyKey} data-cms-field-page={pathname} />;
}
