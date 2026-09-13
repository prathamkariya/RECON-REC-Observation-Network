import type { ComponentType, ReactNode } from "react";
import { cn } from "cn";

type Tone = "none" | "verified" | "risk" | "warn" | "ink";
type Weight = "thin" | "medium" | "thick";

const CAP: Record<Tone, string> = {
  none: "",
  verified: "cap-verified",
  risk: "cap-risk",
  warn: "cap-warn",
  ink: "cap-ink",
};

const WEIGHT: Record<Weight, string> = { thin: "glass-thin", medium: "glass-medium", thick: "glass-thick" };

/** A liquid-glass analytical card. `cap` draws the 3px status edge. */
export function Panel({
  children,
  className,
  cap = "none",
  weight = "medium",
  as: Tag = "section",
}: {
  children: ReactNode;
  className?: string;
  cap?: Tone;
  weight?: Weight;
  as?: "section" | "div" | "article" | "aside";
}) {
  return <Tag className={cn("glass p-5 sm:p-6", WEIGHT[weight], CAP[cap], className)}>{children}</Tag>;
}

export function PanelHeader({
  icon: Icon,
  eyebrow,
  title,
  description,
  actions,
  className,
}: {
  icon?: ComponentType<{ className?: string }>;
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-5 flex flex-wrap items-start justify-between gap-x-4 gap-y-3", className)}>
      <div className="flex min-w-0 items-start gap-3">
        {Icon && (
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/70 bg-white/60 text-recon-ink-soft shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
            <Icon className="h-4 w-4" />
          </span>
        )}
        <div className="min-w-0">
          {eyebrow && <p className="label-caps mb-1 text-recon-steel">{eyebrow}</p>}
          <h2 className="text-[17px] leading-6 font-semibold text-recon-ink sm:text-lg">{title}</h2>
          {description && <p className="mt-1 max-w-2xl text-[13px] leading-5 text-recon-ink-dim">{description}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/** Page title block used at the top of every console screen. */
export function PageHeader({
  crumbs,
  title,
  description,
  meta,
  actions,
}: {
  crumbs?: string[];
  title: ReactNode;
  description?: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div className="min-w-0">
        {crumbs && crumbs.length > 0 && (
          <p className="label-caps mb-2 flex flex-wrap items-center gap-1.5 text-recon-steel">
            {crumbs.map((crumb, i) => (
              <span key={crumb} className="flex items-center gap-1.5">
                {i > 0 && <span className="text-recon-titanium">/</span>}
                <span className={i === crumbs.length - 1 ? "text-gold" : undefined}>{crumb}</span>
              </span>
            ))}
          </p>
        )}
        <h1 className="text-[26px] leading-[34px] font-bold tracking-tight text-recon-ink sm:text-[32px] sm:leading-10">
          {title}
        </h1>
        {description && <p className="mt-1.5 max-w-2xl text-sm text-recon-ink-dim">{description}</p>}
        {meta && <div className="mt-3 flex flex-wrap items-center gap-2">{meta}</div>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/** Small glass chip for metadata ("Cycle 2026-Q3 · synced 12s ago"). */
export function MetaChip({ children, className, live }: { children: ReactNode; className?: string; live?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/55 px-3 py-1 text-xs text-recon-ink-soft shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] backdrop-blur-md",
        className,
      )}
    >
      {live && <LiveDot />}
      {children}
    </span>
  );
}

export function LiveDot({ tone = "verified", className }: { tone?: "verified" | "risk" | "neutral"; className?: string }) {
  return (
    <span
      className={cn(
        "inline-block h-2 w-2 shrink-0 rounded-full animate-pulse-dot",
        tone === "verified" ? "bg-verified text-verified" : tone === "risk" ? "bg-risk text-risk" : "bg-recon-steel text-recon-steel",
        className,
      )}
    />
  );
}

/** Label/value row for dense forensic readouts. */
export function Readout({
  label,
  value,
  tone,
  className,
}: {
  label: ReactNode;
  value: ReactNode;
  tone?: "risk" | "verified" | "warn";
  className?: string;
}) {
  return (
    <div className={cn("flex items-baseline justify-between gap-4 py-1.5", className)}>
      <dt className="label-caps shrink-0 text-recon-steel">{label}</dt>
      <dd
        className={cn(
          "mono-data text-right text-recon-ink",
          tone === "risk" && "text-risk",
          tone === "verified" && "text-verified",
          tone === "warn" && "text-warn",
        )}
      >
        {value}
      </dd>
    </div>
  );
}
