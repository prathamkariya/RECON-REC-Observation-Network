"use client";

import { useEffect, useState, type ComponentType, type ReactNode } from "react";
import { animate, useReducedMotion } from "framer-motion";
import { cn } from "cn";

type Accent = "neutral" | "gold" | "verified" | "risk" | "warn";

const CAP: Record<Accent, string> = {
  neutral: "",
  gold: "cap-verified",
  verified: "cap-verified",
  risk: "cap-risk",
  warn: "cap-warn",
};

const LABEL_TONE: Record<Accent, string> = {
  neutral: "text-recon-steel",
  gold: "text-gold",
  verified: "text-verified",
  risk: "text-risk",
  warn: "text-warn",
};

const VALUE_TONE: Record<Accent, string> = {
  neutral: "text-recon-ink",
  gold: "text-recon-ink",
  verified: "text-recon-ink",
  risk: "text-risk",
  warn: "text-recon-ink",
};

/** Stitch KPI tile: caps label + icon, large tabular figure, footnote row. */
export function StatCard({
  label,
  value,
  suffix,
  accent = "neutral",
  decimals = 0,
  icon: Icon,
  footnote,
  footnoteValue,
}: {
  label: string;
  value: number;
  suffix?: string;
  accent?: Accent;
  decimals?: number;
  icon?: ComponentType<{ className?: string }>;
  footnote?: ReactNode;
  footnoteValue?: ReactNode;
}) {
  const [animated, setAnimated] = useState(0);
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    if (prefersReducedMotion) return;
    const controls = animate(0, value, {
      duration: 1.2,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => setAnimated(v),
    });
    return () => controls.stop();
  }, [value, prefersReducedMotion]);

  // With reduced motion there's no animation to run, so the final value renders directly.
  const display = prefersReducedMotion ? value : animated;

  return (
    <div className={cn("glass glass-medium glass-hover flex h-full flex-col p-4 sm:p-5", CAP[accent])}>
      <div className="flex items-start justify-between gap-3">
        <p className={cn("label-caps", LABEL_TONE[accent])}>{label}</p>
        {Icon && <Icon className={cn("h-4 w-4 shrink-0", accent === "risk" ? "text-risk" : "text-recon-steel")} />}
      </div>
      <p
        className={cn(
          "font-display mt-3 text-[34px] leading-none font-bold tracking-tight tabular-nums sm:text-[40px]",
          VALUE_TONE[accent],
        )}
      >
        {display.toLocaleString("en-US", { maximumFractionDigits: decimals, minimumFractionDigits: decimals })}
        {suffix && <span className="ml-1.5 align-baseline text-base font-medium text-recon-ink-dim">{suffix}</span>}
      </p>
      {(footnote || footnoteValue) && (
        <div className="mt-auto flex items-center justify-between gap-2 pt-4">
          <span className="mono-micro uppercase text-recon-steel">{footnote}</span>
          {footnoteValue && <span className="mono-micro font-semibold uppercase text-recon-ink-soft">{footnoteValue}</span>}
        </div>
      )}
    </div>
  );
}
