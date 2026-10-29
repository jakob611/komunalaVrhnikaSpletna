import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import "./motion.css";

/** Retains a small optional section only until its closing motion is finished. */
export default function AnimatedDisclosure({
  open,
  children,
  className = "",
  id,
}: {
  open: boolean;
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  const [mounted, setMounted] = useState(open);
  const element = useRef<HTMLDivElement>(null);
  const animation = useRef<Animation | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const previouslyOpen = useRef(false);
  const currentOpen = useRef(open);
  currentOpen.current = open;

  useLayoutEffect(() => {
    if (open && !mounted) {
      animation.current?.cancel();
      animation.current = null;
      setMounted(true);
      return;
    }
    const node = element.current;
    if (!node) {
      animation.current?.cancel();
      animation.current = null;
      return;
    }
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const interrupted = animation.current;
    const startHeight = interrupted
      ? node.getBoundingClientRect().height
      : previouslyOpen.current
        ? node.scrollHeight
        : 0;
    const startOpacity = interrupted
      ? getComputedStyle(node).opacity
      : open
        ? ".65"
        : "1";
    window.clearTimeout(timer.current);
    animation.current = null;
    interrupted?.cancel();
    delete node.dataset.motionAnimating;
    previouslyOpen.current = open;

    if (!open && node.contains(document.activeElement)) {
      // A close button inside the panel returns focus to its actual external disclosure trigger.
      const controls = document.querySelectorAll<HTMLButtonElement>(
        "button[aria-controls]",
      );
      for (const control of controls) {
        const controlled = document.getElementById(
          control.getAttribute("aria-controls") || "",
        );
        if (
          controlled &&
          node.contains(controlled) &&
          !node.contains(control)
        ) {
          control.focus({ preventScroll: true });
          break;
        }
      }
    }
    if (reduced.matches || !node.animate) {
      if (!open) setMounted(false);
      return;
    }
    const duration = window.matchMedia("(max-width: 680px)").matches
      ? 240
      : 280;
    const run = node.animate(
      [
        { height: `${startHeight}px`, opacity: startOpacity },
        {
          height: open ? `${node.scrollHeight}px` : "0px",
          opacity: open ? 1 : 0.4,
        },
      ],
      { duration, easing: "cubic-bezier(.2,.75,.25,1)", fill: "both" },
    );
    animation.current = run;
    node.dataset.motionAnimating = "true";
    const finish = () => {
      if (animation.current !== run) return;
      window.clearTimeout(timer.current);
      if (!currentOpen.current) {
        // Keep the finished zero-height frame until React actually unmounts the content.
        // Canceling it first can briefly flash the full panel during a deferred render.
        setMounted(false);
        return;
      }
      animation.current = null;
      delete node.dataset.motionAnimating;
      run.cancel();
    };
    run.onfinish = finish;
    // A canceled or throttled animation cannot leave a closing panel mounted indefinitely.
    timer.current = window.setTimeout(finish, duration + 120);
    const preferenceChange = () => {
      if (reduced.matches) finish();
    };
    reduced.addEventListener("change", preferenceChange);
    return () => {
      reduced.removeEventListener("change", preferenceChange);
      window.clearTimeout(timer.current);
    };
  }, [open, mounted]);
  useLayoutEffect(
    () => () => {
      animation.current?.cancel();
      animation.current = null;
      window.clearTimeout(timer.current);
    },
    [],
  );
  if (!mounted) return null;
  return (
    <div
      ref={element}
      id={id}
      className={`motion-disclosure ${className}`}
      data-motion-managed="true"
      aria-hidden={!open}
      inert={!open}
    >
      {children}
    </div>
  );
}
