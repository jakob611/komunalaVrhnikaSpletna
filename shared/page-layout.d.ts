export type CmsButton = {
  id: string;
  label: string;
  url: string;
  variant: "primary" | "secondary" | "text";
};
export type CmsBlock = {
  id: string;
  type:
    | "native"
    | "text"
    | "image"
    | "buttons"
    | "cards"
    | "callout"
    | "spacer";
  nativeId?: string;
  title?: string;
  text?: string;
  image?: string;
  alt?: string;
  links?: CmsButton[];
  cards?: {
    id: string;
    title: string;
    text: string;
    url: string;
    label: string;
  }[];
  tone: "plain" | "soft" | "dark";
  align: "left" | "center" | "right";
  width: "wide" | "narrow";
  hidden: boolean;
  size?: "small" | "medium" | "large";
};
export type CmsLayoutData = {
  pages: { path: string; title: string; blocks: CmsBlock[] }[];
  navigation: CmsButton[];
};
export type CmsLinkOverride = {
  page: string;
  key: string;
  original: string;
  label: string;
  url: string;
};
export const BLOCK_TYPES: readonly string[];
export const CUSTOM_PAGE: RegExp;
export function safeDestination(value: string, blank?: boolean): string;
export function safePicture(value: string): string;
export function validateLayout(
  value: unknown,
  publicPages?: readonly string[],
): CmsLayoutData;
export function validateLinks(
  value: unknown,
  publicPages?: readonly string[],
): CmsLinkOverride[];
