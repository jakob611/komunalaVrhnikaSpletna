import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import "./motion.css";

// Explicit boundaries keep map tiles, text entry and live totals out of the animation system.
const sections = [
  ".hero-copy",
  ".hero-visual",
  ".page-intro",
  ".quick-card",
  ".home-address",
  ".notice-preview",
  ".service-overview",
  ".depo-banner",
  ".help-strip",
  ".category-card",
  ".address-setting",
  ".my-event",
  ".prose-page > .panel",
  ".waste-address-panel",
  ".waste-wizard-hero",
  ".waste-result-card",
  ".waste-event",
  ".waste-point",
  ".waste-bottom-help",
  ".waste-schedule-placeholder",
  ".svc-notice",
  ".svc-report-step",
  ".svc-report-guidance",
  ".svc-road-aside",
  ".svc-service-card",
  ".svc-service-guide",
  ".svc-subscribe",
  ".svc-date-options",
  ".svc-total",
  ".svc-market-summary",
  ".svc-depo-hero",
  ".svc-depo-grid > *",
  ".svc-contact-grid > *",
  ".svc-contact-foot",
  ".svc-about-band",
  ".svc-about-note",
  ".svc-help",
  ".svc-contact-intro",
  ".svc-contact-topics",
  ".svc-contact-topic",
  ".svc-contact-topic-card",
  ".svc-contact-guide",
  ".svc-contact-form",
  ".svc-hours-card",
  ".cemetery-intro",
  ".cemetery-panel",
  ".cemetery-help",
  "[data-motion-section]",
].join(",");
const changes =
  ".svc-location-confirmed,.svc-photo-preview,.svc-success,.svc-error,.waste-error,.svc-load-error,.empty-state,.waste-picker-confirmation,.calendar-recurrence,.calendar-help,.svc-contact-subcategory,.svc-contact-suggestion,[data-motion-enter]";
const candidates = `${sections},${changes}`;
const mapContent = ".leaflet-container,.cemetery-map";

function mountMotion(root: HTMLElement, compact: boolean) {
  const seen = new WeakSet<HTMLElement>();
  const waiting = new Set<HTMLElement>();
  const animations = new Map<HTMLElement, Animation>();
  const pending = new Set<HTMLElement>();
  let frame = 0;
  let disposed = false;

  const excluded = (element: HTMLElement) =>
    !element.closest("#main,.calendar-sheet") ||
    !!element.closest(
      `${mapContent},[data-motion-managed],[data-motion-skip]`,
    ) ||
    !!element.querySelector(
      `${mapContent},[role="dialog"],[aria-modal="true"],dialog`,
    );

  const cancel = (element: HTMLElement) => {
    const animation = animations.get(element);
    if (animation) {
      animations.delete(element);
      animation.cancel();
    }
  };
  const reveal = (element: HTMLElement, immediate: boolean, delay = 0) => {
    if (disposed || !element.isConnected || !element.animate) return;
    element.dataset.motionState = "entered";
    // Interactable content never moves under a pointer. Only non-interactive titles get a tiny lift.
    const title =
      element.matches(".page-intro,.cemetery-intro") &&
      !element.querySelector("a,button,input,select,textarea");
    const frames: Keyframe[] = title
      ? [
          { opacity: 0.65, transform: `translateY(${compact ? 6 : 9}px)` },
          { opacity: 1, transform: "translateY(0)" },
        ]
      : [{ opacity: immediate ? 0.65 : 0.72 }, { opacity: 1 }];
    if (element.contains(document.activeElement)) return;
    cancel(element);
    const animation = element.animate(frames, {
      duration: immediate ? 190 : compact ? 270 : 360,
      delay,
      easing: "cubic-bezier(.2,.75,.25,1)",
      fill: "none",
    });
    animations.set(element, animation);
    const forget = () => {
      if (animations.get(element) === animation) animations.delete(element);
    };
    animation.onfinish = forget;
    animation.oncancel = forget;
  };
  const intersection = window.IntersectionObserver
    ? new IntersectionObserver(
        (entries) => {
          let order = 0;
          entries.forEach(({ target, isIntersecting }) => {
            if (!isIntersecting) return;
            const element = target as HTMLElement;
            waiting.delete(element);
            intersection?.unobserve(element);
            reveal(
              element,
              false,
              Math.min(order++ * (compact ? 20 : 35), compact ? 60 : 105),
            );
          });
        },
        { threshold: 0.04, rootMargin: "0px 0px -10px 0px" },
      )
    : null;

  const register = (element: HTMLElement) => {
    if (seen.has(element) || !element.isConnected || excluded(element)) return;
    const parent = element.parentElement?.closest<HTMLElement>(candidates);
    if (parent && seen.has(parent) && !excluded(parent)) return;
    const rectangle = element.getBoundingClientRect();
    if (!rectangle.width || !rectangle.height) return;
    seen.add(element);
    if (element.matches(changes)) reveal(element, true);
    else if (intersection) {
      waiting.add(element);
      intersection.observe(element);
    } else reveal(element, false);
  };
  const collect = (node: HTMLElement) => {
    if (
      !node.isConnected ||
      node.closest(`${mapContent},[data-motion-managed],[data-motion-skip]`)
    )
      return;
    if (node.matches(candidates)) register(node);
    node.querySelectorAll<HTMLElement>(candidates).forEach(register);
  };
  const prune = () => {
    waiting.forEach((element) => {
      if (!element.isConnected) {
        intersection?.unobserve(element);
        waiting.delete(element);
      }
    });
    animations.forEach((_, element) => {
      if (!element.isConnected) cancel(element);
    });
    pending.forEach((element) => {
      if (!element.isConnected) pending.delete(element);
    });
  };
  const mutation = new MutationObserver((records) => {
    let removed = false;
    records.forEach((record) => {
      removed ||= !!record.removedNodes.length;
      record.addedNodes.forEach((node) => {
        if (node instanceof HTMLElement && !node.closest(mapContent))
          pending.add(node);
      });
    });
    if (removed) prune();
    if (!pending.size || frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      pending.forEach(collect);
      pending.clear();
    });
  });
  const focus = (event: FocusEvent) => {
    if (!(event.target instanceof Node)) return;
    const target = event.target;
    animations.forEach((_, element) => {
      if (element.contains(target)) cancel(element);
    });
    waiting.forEach((element) => {
      if (element.contains(target)) {
        intersection?.unobserve(element);
        waiting.delete(element);
        element.dataset.motionState = "entered";
      }
    });
  };
  // No click/tap interception. Native details retain their own toggle and keyboard behavior.
  mutation.observe(document.body, { childList: true, subtree: true });
  document.addEventListener("focusin", focus);
  root
    .querySelectorAll<HTMLElement>("[data-reveal]")
    .forEach((element) => element.removeAttribute("data-reveal"));
  collect(root);
  return () => {
    disposed = true;
    cancelAnimationFrame(frame);
    mutation.disconnect();
    intersection?.disconnect();
    waiting.clear();
    pending.clear();
    animations.forEach((animation) => animation.cancel());
    animations.clear();
    document.removeEventListener("focusin", focus);
  };
}

export default function PageMotion() {
  const { pathname } = useLocation();
  useEffect(() => {
    const root = document.getElementById("main");
    if (!root) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const compact = window.matchMedia("(max-width: 680px)");
    let stop = () => {};
    const configure = () => {
      stop();
      stop = reduced.matches ? () => {} : mountMotion(root, compact.matches);
    };
    configure();
    reduced.addEventListener("change", configure);
    compact.addEventListener("change", configure);
    return () => {
      stop();
      reduced.removeEventListener("change", configure);
      compact.removeEventListener("change", configure);
    };
  }, [pathname]);
  return null;
}
