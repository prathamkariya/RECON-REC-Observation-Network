import type { ReactNode } from "react";
import { cn } from "cn";

export type SignalTone = "verified" | "warn" | "risk" | "ink" | "neutral" | "solid-risk" | "solid-ink";

const TONES: Record<SignalTone, string> = {
  verified: "bg-verified/10 text-verified border-verified/30",
  warn: "bg-warn/10 text-warn border-warn/30",
  risk: "bg-risk/10 text-risk border-risk/35",
  ink: "bg-recon-ink/[0.06] text-recon-ink-soft border-recon-ink/15",
  neutral: "bg-white/60 text-recon-ink-dim border-recon-ink/10",
  "solid-risk": "bg-risk text-white border-risk",
  "solid-ink": "bg-recon-ink text-white border-recon-ink",
};

/** Stitch "Signal Status Badge": 2px radius, mono caps, tinted by verdict. */
export function SignalBadge({ tone, children, className }: { tone: SignalTone; children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "mono-micro inline-flex h-[22px] shrink-0 items-center gap-1.5 rounded-[3px] border px-2 font-semibold uppercase",
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function toneForScore(score: number): SignalTone {
  if (score >= 50) return "risk";
  if (score >= 25) return "warn";
  return "verified";
}

export function severityLabel(score: number): string {
  if (score >= 90) return "Critical";
  if (score >= 75) return "High";
  if (score >= 50) return "Elevated";
  if (score >= 25) return "Watch";
  return "Clear";
}
