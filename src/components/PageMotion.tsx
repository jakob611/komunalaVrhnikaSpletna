import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import "./motion.css";

const desktopSections =
  ".quick-section,.home-address,.home-notices,.home-services-section,.depo-banner,.help-strip,.waste-bottom-help,.svc-help,.svc-service-guide";
// Named content boundaries only: map tiles, form fields and live totals are excluded.
const phoneSections = [
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
  ".svc-road-layout",
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
  "[data-motion-section]",
].join(",");
const phoneChanges =
  ".svc-location-confirmed,.svc-photo-preview,.svc-success,.svc-error,.waste-error,.svc-load-error,.empty-state,.waste-picker-confirmation,.calendar-recurrence,.calendar-help,.svc-contact-subcategory,.svc-contact-suggestion,[data-motion-enter]";
const selectionButtons =
  ".waste-filters button,.svc-tabs button,.svc-type-grid button,.svc-service-card,.svc-contact-topic-card,[data-motion-select]";

function desktopReveals(root: HTMLElement, reduced: MediaQueryList) {
  if (!window.IntersectionObserver || reduced.matches) return () => {};
  const seen = new Set<HTMLElement>();
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach(({ target, isIntersecting }) => {
        if (!isIntersecting) return;
        (target as HTMLElement).dataset.reveal = "visible";
        observer.unobserve(target);
      });
    },
    { threshold: 0.08 },
  );
  let frame = 0;
  const scan = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      root.querySelectorAll<HTMLElement>(desktopSections).forEach((element) => {
        if (seen.has(element)) return;
        seen.add(element);
        if (element.getBoundingClientRect().top < window.innerHeight * 0.94)
          return;
        element.dataset.reveal = "pending";
        observer.observe(element);
      });
    });
  };
  const focus = (event: FocusEvent) => {
    const section =
      event.target instanceof Element
        ? event.target.closest<HTMLElement>('[data-reveal="pending"]')
        : null;
    if (section) {
      section.dataset.reveal = "visible";
      observer.unobserve(section);
    }
  };
  const mutation = new MutationObserver(scan);
  mutation.observe(root, { childList: true, subtree: true });
  root.addEventListener("focusin", focus);
  scan();
  return () => {
    cancelAnimationFrame(frame);
    mutation.disconnect();
    observer.disconnect();
    seen.forEach((element) => element.removeAttribute("data-reveal"));
    root.removeEventListener("focusin", focus);
  };
}

function phoneMotion(root: HTMLElement) {
  const seen = new WeakSet<HTMLElement>();
  const animated = new Map<HTMLElement, Animation>();
  const disclosures = new Map<
    HTMLDetailsElement,
    { animation: Animation; opening: boolean; overflow: string }
  >();
  let disposed = false;
  const excluded = (element: HTMLElement) =>
    !!element.closest(".leaflet-container,[data-motion-managed]");
  const animate = (
    element: HTMLElement,
    frames: Keyframe[],
    duration = 260,
    delay = 0,
  ) => {
    if (disposed || !element.isConnected || !element.animate) return;
    animated.get(element)?.cancel();
    const animation = element.animate(frames, {
      duration,
      delay,
      easing: "cubic-bezier(.2,.75,.25,1)",
      fill: "none",
    });
    animated.set(element, animation);
    animation.onfinish = () => {
      if (animated.get(element) === animation) animated.delete(element);
    };
  };
  const enter = (element: HTMLElement, delay = 0) => {
    // No hidden waiting state: content is readable even if observation never fires.
    element.dataset.mobileMotion = "entered";
    animate(
      element,
      [
        { opacity: 0.48, transform: "translateY(9px)" },
        { opacity: 1, transform: "translateY(0)" },
      ],
      280,
      delay,
    );
  };
  const intersection = window.IntersectionObserver
    ? new IntersectionObserver(
        (entries) => {
          let order = 0;
          entries.forEach(({ target, isIntersecting }) => {
            if (!isIntersecting) return;
            enter(target as HTMLElement, Math.min(order++ * 25, 75));
            intersection?.unobserve(target);
          });
        },
        { threshold: 0.04, rootMargin: "0px 0px -12px 0px" },
      )
    : null;
  const register = (element: HTMLElement, change: boolean) => {
    if (seen.has(element) || excluded(element)) return;
    seen.add(element);
    if (element.parentElement?.closest(phoneChanges)) return;
    const rectangle = element.getBoundingClientRect();
    if (!rectangle.width || !rectangle.height) return;
    if (change) {
      element.dataset.mobileMotion = "entered";
      animate(
        element,
        [
          { opacity: 0.35, transform: "translateY(5px)" },
          { opacity: 1, transform: "translateY(0)" },
        ],
        210,
      );
    } else if (intersection) intersection.observe(element);
    else enter(element);
  };
  const collect = (node: HTMLElement) => {
    if (excluded(node)) return;
    if (node.matches(phoneSections)) register(node, false);
    else if (node.matches(phoneChanges)) register(node, true);
    node
      .querySelectorAll<HTMLElement>(`${phoneSections},${phoneChanges}`)
      .forEach((element) => register(element, element.matches(phoneChanges)));
  };
  const finishDetails = (details: HTMLDetailsElement) => {
    const active = disclosures.get(details);
    if (!active) return;
    details.open = active.opening;
    details.style.overflow = active.overflow;
    delete details.dataset.motionClosing;
    active.animation.cancel();
    disclosures.delete(details);
  };
  const click = (event: MouseEvent) => {
    if (
      !(event.target instanceof Element) ||
      event.button !== 0 ||
      event.defaultPrevented
    )
      return;
    const summary = event.target.closest("summary");
    if (!summary || event.target.closest("a,button,input,select,textarea"))
      return;
    const details = summary.parentElement;
    if (
      !(details instanceof HTMLDetailsElement) ||
      !details.animate ||
      !details.closest("#main,.calendar-sheet")
    )
      return;
    event.preventDefault();
    const current = details.getBoundingClientRect().height;
    const active = disclosures.get(details);
    const opening = !(active?.opening ?? details.open);
    const overflow = active?.overflow ?? details.style.overflow;
    active?.animation.cancel();
    details.open = true;
    details.dataset.motionClosing = opening ? "false" : "true";
    details.style.overflow = "hidden";
    const style = getComputedStyle(details);
    const borders =
      parseFloat(style.borderTopWidth) + parseFloat(style.borderBottomWidth);
    const target = opening
      ? details.scrollHeight + borders
      : summary.getBoundingClientRect().height +
        borders +
        parseFloat(style.paddingTop) +
        parseFloat(style.paddingBottom);
    const animation = details.animate(
      [{ height: `${current}px` }, { height: `${target}px` }],
      { duration: 240, easing: "cubic-bezier(.2,.75,.25,1)", fill: "both" },
    );
    disclosures.set(details, { animation, opening, overflow });
    animation.onfinish = () => {
      if (disclosures.get(details)?.animation === animation)
        finishDetails(details);
    };
  };
  const mutation = new MutationObserver((records) => {
    for (const record of records) {
      if (record.type === "attributes") {
        const target = record.target;
        if (
          target instanceof HTMLElement &&
          target.matches(selectionButtons) &&
          target.getAttribute(record.attributeName || "") === "true"
        )
          animate(
            target,
            [{ transform: "scale(.985)" }, { transform: "scale(1)" }],
            180,
          );
        continue;
      }
      record.addedNodes.forEach((node) => {
        if (node instanceof HTMLElement) collect(node);
      });
    }
  });
  mutation.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["aria-pressed", "aria-selected"],
  });
  document.addEventListener("click", click);
  collect(root);
  return () => {
    disposed = true;
    mutation.disconnect();
    intersection?.disconnect();
    animated.forEach((animation) => animation.cancel());
    animated.clear();
    disclosures.forEach((_, details) => finishDetails(details));
    document.removeEventListener("click", click);
  };
}

export default function PageMotion() {
  const { pathname } = useLocation();
  useEffect(() => {
    const root = document.getElementById("main");
    if (!root) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const phone = window.matchMedia("(max-width: 680px)");
    let stop = () => {};
    const configure = () => {
      stop();
      stop = reduced.matches
        ? () => {}
        : phone.matches
          ? phoneMotion(root)
          : desktopReveals(root, reduced);
    };
    configure();
    reduced.addEventListener("change", configure);
    phone.addEventListener("change", configure);
    return () => {
      stop();
      reduced.removeEventListener("change", configure);
      phone.removeEventListener("change", configure);
    };
  }, [pathname]);
  return null;
}
