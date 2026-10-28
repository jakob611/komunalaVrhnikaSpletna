import { useEffect } from "react";
import { useLocation } from "react-router-dom";

// Content stays visible without JavaScript or when reduced motion is preferred.
export default function PageMotion() {
  const { pathname } = useLocation();
  useEffect(() => {
    const root = document.getElementById("main");
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (!root || preference.matches || !window.IntersectionObserver) return;
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
        if (preference.matches) return;
        root
          .querySelectorAll<HTMLElement>(
            ".quick-section,.home-address,.home-notices,.home-services-section,.depo-banner,.help-strip,.waste-bottom-help,.svc-help,.svc-service-guide",
          )
          .forEach((element) => {
            if (seen.has(element)) return;
            seen.add(element);
            if (element.getBoundingClientRect().top < window.innerHeight * 0.94)
              return;
            element.dataset.reveal = "pending";
            observer.observe(element);
          });
      });
    };
    const revealAll = () => {
      seen.forEach((element) => element.removeAttribute("data-reveal"));
      observer.disconnect();
    };
    const focus = (event: FocusEvent) => {
      if (!(event.target instanceof Element)) return;
      const section = event.target.closest<HTMLElement>(
        '[data-reveal="pending"]',
      );
      if (section) {
        section.dataset.reveal = "visible";
        observer.unobserve(section);
      }
    };
    const mutation = new MutationObserver(scan);
    mutation.observe(root, { childList: true, subtree: true });
    root.addEventListener("focusin", focus);
    preference.addEventListener("change", revealAll);
    scan();
    return () => {
      cancelAnimationFrame(frame);
      mutation.disconnect();
      revealAll();
      root.removeEventListener("focusin", focus);
      preference.removeEventListener("change", revealAll);
    };
  }, [pathname]);
  return null;
}
