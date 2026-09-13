"use client";

import type { ComponentType, ReactNode } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { AlertOctagon, RotateCw } from "lucide-react";
import { cn } from "cn";

/** Glass-tinted shimmer blocks laid out like a console page. */
export function ConsoleSkeleton({ kpis = 4 }: { kpis?: number }) {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <div className="space-y-3">
        <Shimmer className="h-3 w-40" />
        <Shimmer className="h-9 w-full max-w-md" />
      </div>
      <div className={cn("grid gap-4", kpis >= 5 ? "grid-cols-2 lg:grid-cols-5" : "grid-cols-2 lg:grid-cols-4")}>
        {Array.from({ length: kpis }).map((_, i) => (
          <Shimmer key={i} className="h-[132px] rounded-2xl" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Shimmer className="h-[420px] rounded-2xl lg:col-span-2" />
        <Shimmer className="h-[420px] rounded-2xl" />
      </div>
      <span className="sr-only">Loading…</span>
    </div>
  );
}

export function Shimmer({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-lg border border-white/60 bg-white/40 backdrop-blur-md",
        "before:absolute before:inset-0 before:-translate-x-full before:animate-[marquee_1.6s_ease-in-out_infinite] before:bg-gradient-to-r before:from-transparent before:via-white/70 before:to-transparent",
        className,
      )}
    />
  );
}

/** Load failure with a retry that refetches every active query. */
export function ErrorPanel({ title = "Couldn't load registry data", children }: { title?: string; children?: ReactNode }) {
  const queryClient = useQueryClient();
  return (
    <div role="alert" className="glass glass-risk cap-risk mx-auto flex max-w-xl flex-col items-center gap-3 p-8 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-risk/10 text-risk">
        <AlertOctagon className="h-6 w-6" />
      </span>
      <p className="text-base font-semibold text-recon-ink">{title}</p>
      <div className="text-sm text-recon-ink-dim">{children ?? "The registry service isn't responding. It may be starting up — try again in a moment."}</div>
      <button
        type="button"
        onClick={() => queryClient.refetchQueries({ type: "active" })}
        className="mt-1 inline-flex h-9 items-center gap-2 rounded-xl border border-recon-ink/15 bg-white/75 px-4 text-sm font-medium text-recon-ink hover:border-recon-ink/40"
      >
        <RotateCw className="h-3.5 w-3.5" /> Try again
      </button>
    </div>
  );
}

/** Friendly zero-data state with one clear next step. */
export function EmptyState({
  icon: Icon,
  title,
  description,
  actionHref,
  actionLabel,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  description: string;
  actionHref?: string;
  actionLabel?: string;
}) {
  return (
    <div className="glass glass-medium mx-auto flex max-w-xl flex-col items-center gap-3 rounded-2xl p-10 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gold/10 text-gold">
        <Icon className="h-6 w-6" />
      </span>
      <p className="text-base font-semibold text-recon-ink">{title}</p>
      <p className="max-w-sm text-sm text-recon-ink-dim">{description}</p>
      {actionHref && actionLabel && (
        <Link
          href={actionHref}
          className="mt-2 inline-flex h-10 items-center gap-2 rounded-xl bg-recon-forest px-5 text-sm font-semibold text-white shadow-[0_10px_24px_-12px_rgba(15,42,32,0.7)] transition-colors hover:bg-[#1b4332]"
        >
          {actionLabel}
        </Link>
      )}
    </div>
  );
}
