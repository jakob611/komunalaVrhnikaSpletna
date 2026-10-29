import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import "./motion.css";

/** Keeps an optional section mounted until its phone-only closing motion finishes. */
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
  const previousOpen = useRef(false);
  useLayoutEffect(() => {
    if (open && !mounted) {
      setMounted(true);
      return;
    }
    const node = element.current;
    if (!node) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const phone = window.matchMedia("(max-width: 680px)");
    const currentHeight = animation.current
      ? node.getBoundingClientRect().height
      : previousOpen.current
        ? node.scrollHeight
        : 0;
    animation.current?.cancel();
    animation.current = null;
    previousOpen.current = open;
    if (!phone.matches || reduced.matches || !node.animate) {
      if (!open) setMounted(false);
      return;
    }
    const run = node.animate(
      [
        { height: `${currentHeight}px`, opacity: open ? 0.35 : 1 },
        {
          height: open ? `${node.scrollHeight}px` : "0px",
          opacity: open ? 1 : 0.25,
        },
      ],
      { duration: 250, easing: "cubic-bezier(.2,.75,.25,1)", fill: "both" },
    );
    animation.current = run;
    node.dataset.motionAnimating = "true";
    const finish = () => {
      if (animation.current !== run) return;
      animation.current = null;
      delete node.dataset.motionAnimating;
      run.cancel();
      if (!open) setMounted(false);
    };
    run.onfinish = finish;
    const preferenceChange = () => {
      if (reduced.matches || !phone.matches) finish();
    };
    reduced.addEventListener("change", preferenceChange);
    phone.addEventListener("change", preferenceChange);
    return () => {
      reduced.removeEventListener("change", preferenceChange);
      phone.removeEventListener("change", preferenceChange);
    };
  }, [open, mounted]);
  useLayoutEffect(() => () => animation.current?.cancel(), []);
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
