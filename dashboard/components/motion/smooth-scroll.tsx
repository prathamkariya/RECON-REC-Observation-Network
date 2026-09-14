"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import Lenis from "lenis";

let instance: Lenis | null = null;

/** Scroll to a target through Lenis when it's running, natively otherwise. */
export function scrollToTarget(target: number | string | HTMLElement) {
  if (instance) {
    instance.scrollTo(target, { offset: -24 });
    return;
  }
  if (typeof target === "number") window.scrollTo({ top: target, behavior: "smooth" });
  else {
    const el = typeof target === "string" ? document.querySelector(target) : target;
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

/**
 * Inertial page scrolling. Wheel input is interpolated (lerp) instead of
 * jumping in 100px steps, which is what makes scroll-linked animations read
 * as continuous. Touch keeps native momentum (syncTouch off) because
 * re-simulating it feels worse than the OS on phones.
 *
 * Skipped entirely under prefers-reduced-motion. Elements that scroll on
 * their own (tables, dropdowns, dialogs) opt out with `data-lenis-prevent`.
 */
export function SmoothScroll() {
  const pathname = usePathname();

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (media.matches) return;

    const lenis = new Lenis({
      lerp: 0.09,
      smoothWheel: true,
      wheelMultiplier: 0.95,
      syncTouch: false,
      touchMultiplier: 1.5,
      prevent: (node) => {
        // Skip Lenis for dialogs, listboxes, and anything explicitly opted-out.
        if (node.closest("[data-lenis-prevent],[role=dialog],[role=listbox],[data-radix-scroll-area-viewport]")) return true;
        // Skip Lenis inside any independently scrollable container (e.g. sidebar nav, tables)
        const scrollParent = node.closest("[style*='overflow'], .overflow-y-auto, .overflow-auto, .overflow-y-scroll");
        if (scrollParent && scrollParent !== document.documentElement && scrollParent !== document.body) return true;
        return false;
      },
    });
    instance = lenis;

    let frame = 0;
    const raf = (time: number) => {
      lenis.raf(time);
      frame = requestAnimationFrame(raf);
    };
    frame = requestAnimationFrame(raf);

    return () => {
      cancelAnimationFrame(frame);
      lenis.destroy();
      instance = null;
    };
  }, []);

  // Route changes start at the top, instantly — a smooth glide from the
  // previous page's scroll position reads as lag, not polish.
  useEffect(() => {
    instance?.scrollTo(0, { immediate: true, force: true });
  }, [pathname]);

  return null;
}
