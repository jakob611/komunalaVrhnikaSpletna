import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { isCmsPreview } from "./PageComposer";
import {
  contentKey,
  useSiteContent,
  type CopyOverride,
  type ImageOverride,
} from "./SiteContent";

const ignored =
  "script,style,textarea,input,select,option,svg,canvas,iframe,[data-cms-skip],.leaflet-container,.cemetery-detail,.cemetery-results,[role='status'],[role='alert']";
const clean = (value: string) => value.replace(/\s+/g, " ").trim();

export default function ContentBridge() {
  const data = useSiteContent();
  const { pathname } = useLocation();
  useEffect(() => {
    if (pathname.replace(/\/+$/, "") === "/admin") return;
    const root = document.getElementById("root");
    if (!root) return;
    const inspecting = isCmsPreview();
    let mode = "edit";
    let tool = "text";
    let copy = data.copy;
    let images = data.images;
    const originals = new WeakMap<
      Text,
      { original: string; applied: string }
    >();
    const pictures = new WeakMap<
      HTMLImageElement,
      { original: string; originalSrc: string; alt: string; applied: string }
    >();
    let frame = 0;
    let selectedBlock = "";
    let selectionChanged = false;
    let highlighted: Element | null = null;
    const pageFor = (element: Element) =>
      element.closest(".site-header,.utility-bar,footer") ? "*" : pathname;
    function override<T extends CopyOverride | ImageOverride>(
      records: T[],
      original: string,
      page: string,
    ) {
      const key = contentKey(original);
      return (
        records.find((record) => record.page === page && record.key === key) ||
        records.find((record) => record.page === "*" && record.key === key)
      );
    }
    function scan() {
      frame = 0;
      const walk = document.createTreeWalker(root!, NodeFilter.SHOW_TEXT);
      for (let current = walk.nextNode(); current; current = walk.nextNode()) {
        const node = current as Text;
        const parent = node.parentElement;
        if (!parent || parent.closest(ignored)) continue;
        const value = node.nodeValue || "";
        if (
          !originals.has(node) &&
          (!/[a-zA-ZčšžČŠŽ]/.test(value) || clean(value).length < 3)
        )
          continue;
        let item = originals.get(node);
        if (!item || value !== item.applied)
          item = { original: value, applied: value };
        const original = clean(item.original);
        const change = override(copy, original, pageFor(parent));
        const desired = change
          ? `${item.original.match(/^\s*/)?.[0] || ""}${change.value}${item.original.match(/\s*$/)?.[0] || ""}`
          : item.original;
        item.applied = desired;
        originals.set(node, item);
        if (value !== desired) node.nodeValue = desired;
      }
      root!.querySelectorAll<HTMLImageElement>("img").forEach((image) => {
        if (image.closest(ignored)) return;
        const src = image.getAttribute("src") || "";
        let item = pictures.get(image);
        if (!item || src !== item.applied)
          item = {
            original: image.dataset.cmsOriginal || src,
            originalSrc: src,
            alt: image.alt,
            applied: src,
          };
        const change = override(images, item.original, pageFor(image));
        item.applied = change?.url || item.originalSrc;
        pictures.set(image, item);
        if (item.applied !== src) image.src = item.applied;
        if (image.alt !== (change?.alt ?? item.alt))
          image.alt = change?.alt ?? item.alt;
      });
      const slot = root!.querySelector<HTMLElement>("[data-cms-image-slot]");
      if (slot) {
        const image = images.find(
          (record) =>
            record.page === pathname && record.original === "cms:featured",
        );
        const url = image?.url || "";
        slot.style.backgroundImage =
          /^(?:https:\/\/|\/api\/media\/|\/images\/)/.test(url)
            ? `url(${JSON.stringify(url)})`
            : "";
        slot.classList.toggle(
          "cms-slot-has-image",
          !!slot.style.backgroundImage,
        );
      }
      root!.querySelectorAll(".cms-block-selected").forEach(node => node.classList.remove("cms-block-selected"));
      const selected = Array.from(root!.querySelectorAll<HTMLElement>("[data-cms-block-id]")).find(node => node.dataset.cmsBlockId === selectedBlock);
      if (selected) {
        selected.classList.add("cms-block-selected");
        if (selectionChanged) selected.scrollIntoView({ block: "center", behavior: "auto" });
      }
      selectionChanged = false;
    }
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(scan);
    };
    const observer = new MutationObserver(schedule);
    observer.observe(root, {
      childList: true,
      subtree: true,
      characterData: true,
    });
    scan();
    const message = (event: MessageEvent) => {
      if (
        !inspecting ||
        event.origin !== location.origin ||
        event.source !== window.parent ||
        event.data?.type !== "kpv-cms-update"
      )
        return;
      if (Object.hasOwn(event.data, "selectedBlock")) {
        selectionChanged = selectedBlock !== event.data.selectedBlock;
        selectedBlock = event.data.selectedBlock;
      }
      if (Array.isArray(event.data.copy)) copy = event.data.copy;
      if (Array.isArray(event.data.images)) images = event.data.images;
      if (event.data.mode === "edit" || event.data.mode === "interact")
        mode = event.data.mode;
      if (["text", "image", "link", "layout"].includes(event.data.tool))
        tool = event.data.tool;
      document.body.classList.toggle("cms-interacting", mode === "interact");
      schedule();
    };
    const select = (event: MouseEvent) => {
      if (
        !inspecting ||
        event.button !== 0 ||
        !(event.target instanceof Element)
      )
        return;
      const raw = event.target;
      const anchor = raw.closest<HTMLAnchorElement>("a");
      if (mode === "interact") {
        if (anchor) {
          const url = new URL(anchor.href, location.href);
          if (
            url.origin !== location.origin ||
            /^\/(?:admin|api)(?:\/|$)/.test(url.pathname) ||
            anchor.target === "_blank"
          ) {
            event.preventDefault();
            event.stopImmediatePropagation();
          }
        }
        return;
      }
      // Capture before filtering SVG/input targets: icon clicks must never escape edit mode.
      event.preventDefault();
      event.stopImmediatePropagation();
      const target = raw.closest("svg") ? raw.closest("a,button") || raw : raw;
      if (target.closest(".brand,.footer-brand .cms-brand-image")) {
        window.parent.postMessage({type: "kpv-cms-brand-select"}, location.origin);
        return;
      }
      if (tool !== "layout" && target.closest("[data-cms-custom-block]")) {
        window.parent.postMessage({type: "kpv-cms-block-select", id: target.closest<HTMLElement>("[data-cms-block-id]")?.dataset.cmsBlockId}, location.origin);
        return;
      }
      if (tool === "layout") {
        const block = target.closest<HTMLElement>("[data-cms-block-id]");
        if (block)
          window.parent.postMessage(
            { type: "kpv-cms-block-select", id: block.dataset.cmsBlockId },
            location.origin,
          );
        return;
      }
      if (tool === "link") {
        if (anchor?.dataset.cmsLinkKey)
          window.parent.postMessage(
            {
              type: "kpv-cms-select",
              kind: "link",
              key: anchor.dataset.cmsLinkKey,
              original: anchor.dataset.cmsLinkOriginal,
              label: anchor.dataset.cmsLinkLabel,
              url: anchor.getAttribute("href"),
              tag: "a",
              page: pageFor(anchor),
            },
            location.origin,
          );
        return;
      }
      if (target.closest(ignored)) return;
      const image = target.closest<HTMLImageElement>("img");
      const slot = target.closest("[data-cms-image-slot]");
      if (image || slot) {
        const item = image ? pictures.get(image) : null;
        const original = slot
          ? "cms:featured"
          : item?.original || image?.getAttribute("src") || "";
        window.parent.postMessage(
          {
            type: "kpv-cms-select",
            kind: "image",
            key: contentKey(original),
            original,
            tag: "img",
            src: image?.getAttribute("src") || "",
            alt: image?.alt || "",
            page: pageFor(target),
          },
          location.origin,
        );
        return;
      }
      const doc = document as Document & {
        caretPositionFromPoint?: (
          x: number,
          y: number,
        ) => { offsetNode: Node } | null;
        caretRangeFromPoint?: (x: number, y: number) => Range | null;
      };
      const pointed =
        doc.caretPositionFromPoint?.(event.clientX, event.clientY)
          ?.offsetNode ||
        doc.caretRangeFromPoint?.(event.clientX, event.clientY)?.startContainer;
      const node =
        pointed instanceof Text && target.contains(pointed)
          ? pointed
          : [...target.childNodes].find(
              (child) =>
                child instanceof Text &&
                clean(child.textContent || "").length > 2,
            ) ||
            (() => {
              const walker = document.createTreeWalker(
                target,
                NodeFilter.SHOW_TEXT,
              );
              for (
                let child = walker.nextNode();
                child;
                child = walker.nextNode()
              )
                if (
                  clean(child.textContent || "").length > 2 &&
                  !child.parentElement?.closest(ignored)
                )
                  return child;
              return undefined;
            })();
      if (!(node instanceof Text)) return;
      const original = clean(
        originals.get(node)?.original || node.nodeValue || "",
      );
      if (!original) return;
      window.parent.postMessage(
        {
          type: "kpv-cms-select",
          kind: "text",
          key: contentKey(original),
          original,
          tag: target.tagName.toLowerCase(),
          page: pageFor(target),
        },
        location.origin,
      );
    };
    const hover = (event: MouseEvent) => {
      if (!inspecting || !(event.target instanceof Element)) return;
      highlighted?.classList.remove("cms-inspect-target");
      highlighted =
        mode === "interact" || event.target.closest(ignored)
          ? null
          : tool === "layout" ? event.target.closest("[data-cms-block-id]") : event.target;
      highlighted?.classList.add("cms-inspect-target");
    };
    const stopSubmit = (event: Event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
    };
    const stopAux = (event: MouseEvent) => {
      if (
        mode === "edit" ||
        (event.target instanceof Element && event.target.closest("a"))
      )
        stopSubmit(event);
    };
    const stopKeys = (event: KeyboardEvent) => {
      if (
        mode === "edit" &&
        ["Enter", " "].includes(event.key) &&
        event.target instanceof Element &&
        event.target.closest('a,button,input,select,textarea,[role="button"]')
      )
        stopSubmit(event);
    };
    window.addEventListener("message", message);
    if (inspecting)
      window.parent.postMessage(
        { type: "kpv-cms-ready", page: pathname },
        location.origin,
      );
    if (inspecting) {
      document.addEventListener("click", select, true);
      document.addEventListener("mouseover", hover);
      document.addEventListener("submit", stopSubmit, true);
      document.addEventListener("auxclick", stopAux, true);
      document.addEventListener("keydown", stopKeys, true);
      document.body.classList.add("cms-inspecting");
    }
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      window.removeEventListener("message", message);
      document.removeEventListener("click", select, true);
      document.removeEventListener("mouseover", hover);
      document.removeEventListener("submit", stopSubmit, true);
      document.removeEventListener("auxclick", stopAux, true);
      document.removeEventListener("keydown", stopKeys, true);
      highlighted?.classList.remove("cms-inspect-target");
      document.body.classList.remove("cms-inspecting");
      document.body.classList.remove("cms-interacting");
      // Restore before a pathname/content change so future scans keep the original identifiers.
      const walk = document.createTreeWalker(root!, NodeFilter.SHOW_TEXT);
      for (let node = walk.nextNode(); node; node = walk.nextNode()) {
        const item = originals.get(node as Text);
        if (item && node.nodeValue === item.applied)
          node.nodeValue = item.original;
      }
      root!.querySelectorAll<HTMLImageElement>("img").forEach((image) => {
        const item = pictures.get(image);
        if (item && image.getAttribute("src") === item.applied) {
          image.src = item.originalSrc;
          image.alt = item.alt;
        }
      });
    };
  }, [pathname, data.copy, data.images]);
  return null;
}
