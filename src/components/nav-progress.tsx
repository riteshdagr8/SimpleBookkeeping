"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

/**
 * Thin progress bar pinned to the top of the page that runs while a route
 * is loading. It listens for clicks on anchor tags and for pathname changes,
 * which is enough to give the user feedback during slow first-compile
 * navigation in dev mode.
 */
export function NavProgress() {
  const pathname = usePathname();
  const [active, setActive] = useState(false);
  const [progress, setProgress] = useState(0);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Drive the bar while active.
  useEffect(() => {
    if (!active) return;
    let raf = 0;
    let value = progress;
    const tick = () => {
      value = Math.min(value + (100 - value) * 0.05, 92);
      setProgress(value);
      if (active) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active]); // eslint-disable-line react-hooks/exhaustive-deps

  // On every pathname change, finish and reset the bar.
  useEffect(() => {
    setProgress(100);
    if (resetTimer.current) clearTimeout(resetTimer.current);
    resetTimer.current = setTimeout(() => {
      setActive(false);
      setProgress(0);
    }, 250);
  }, [pathname]);

  // Trigger on any in-app click.
  useEffect(() => {
    function onClick(e: MouseEvent) {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const anchor = target.closest("a");
      if (!anchor) return;
      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#")) return;
      if (anchor.target === "_blank") return;
      // Same-page hash or external link: don't show bar.
      if (/^https?:\/\//i.test(href)) return;
      if (href === pathname) return;
      setActive(true);
      setProgress(8);
    }
    document.addEventListener("click", onClick, { capture: true });
    return () => document.removeEventListener("click", onClick, { capture: true });
  }, [pathname]);

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed left-0 right-0 top-0 z-50 h-0.5"
    >
      <div
        className="h-full bg-primary transition-[width,opacity] duration-200 ease-out"
        style={{
          width: `${progress}%`,
          opacity: active || progress > 0 ? 1 : 0,
        }}
      />
    </div>
  );
}
