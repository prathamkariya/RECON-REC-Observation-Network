"use client";

import { useEffect, useState } from "react";
import { animate, useReducedMotion } from "framer-motion";
import { cn } from "cn";

type Accent = "neutral" | "gold" | "verified" | "risk";

const ACCENT_GLASS: Record<Accent, string> = {
  neutral: "glass-thin",
  gold: "glass-gold",
  verified: "glass-verified",
  risk: "glass-risk",
};

const ACCENT_TEXT: Record<Accent, string> = {
  neutral: "text-recon-ink",
  gold: "text-gold",
  verified: "text-verified",
  risk: "text-risk",
};

export function StatCard({
  label,
  value,
  suffix,
  accent = "neutral",
  decimals = 0,
}: {
  label: string;
  value: number;
  suffix?: string;
  accent?: Accent;
  decimals?: number;
}) {
  const [animated, setAnimated] = useState(0);
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    if (prefersReducedMotion) return;

    const controls = animate(0, value, {
      duration: 1.1,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => setAnimated(v),
    });
    return () => controls.stop();
  }, [value, prefersReducedMotion]);

  // Derived rather than set from the effect: with reduced motion there is no
  // animation to run, so the final value is just what renders.
  const display = prefersReducedMotion ? value : animated;

  return (
    <div className={cn("glass p-5", ACCENT_GLASS[accent])}>
      <p className="text-xs tracking-wide text-recon-ink-dim">{label}</p>
      <p className={cn("mt-2 text-3xl font-semibold tabular-nums", ACCENT_TEXT[accent])}>
        {display.toLocaleString("en-US", { maximumFractionDigits: decimals, minimumFractionDigits: decimals })}
        {suffix && <span className="ml-1 text-lg text-recon-ink-dim">{suffix}</span>}
      </p>
    </div>
  );
}
