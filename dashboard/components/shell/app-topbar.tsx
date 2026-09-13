"use client";

import { useState, useSyncExternalStore, type FormEvent } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bell, CircleHelp, Menu, Search } from "lucide-react";
import { LiveDot } from "@/components/glass/panel";
import { pageTitle } from "@/components/shell/nav-items";
import { formatUtcClock } from "@/lib/analytics";
import { useCertificates } from "@/lib/hooks/use-certificates";
import { FRAUD_FLAG_THRESHOLD } from "@/lib/types";

// One shared 1s ticker. The server snapshot is null so the clock renders a
// placeholder during SSR/hydration instead of a time that can't match.
let tick = 0;
function subscribeClock(onChange: () => void) {
  const id = setInterval(() => {
    tick = Math.floor(Date.now() / 1000);
    onChange();
  }, 1000);
  return () => clearInterval(id);
}
const clockSnapshot = () => tick || Math.floor(Date.now() / 1000);
const clockServerSnapshot = () => 0;

function UtcClock() {
  const seconds = useSyncExternalStore(subscribeClock, clockSnapshot, clockServerSnapshot);
  const now = seconds ? new Date(seconds * 1000) : null;

  return (
    <span className="mono-micro hidden items-center gap-2 rounded-full border border-white/70 bg-white/55 px-3 py-1.5 font-semibold text-recon-ink-soft shadow-[inset_0_1px_0_#fff] xl:inline-flex">
      <LiveDot className="h-1.5 w-1.5" />
      <span className="min-w-[178px] tabular-nums">{now ? formatUtcClock(now) : "— — —"}</span>
    </span>
  );
}

export function AppTopbar({ onOpenMenu }: { onOpenMenu: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const title = pageTitle(pathname);
  const [query, setQuery] = useState("");
  const { data: certificates } = useCertificates();
  const flagged = certificates?.filter((c) => c.fraud_score >= FRAUD_FLAG_THRESHOLD).length ?? 0;

  function onSearch(e: FormEvent) {
    e.preventDefault();
    const term = query.trim().replace(/^#|^rec-?/i, "");
    if (!term) return;
    if (/^\d+$/.test(term)) router.push(`/certificates/${Number(term)}`);
    else router.push(`/certificates?q=${encodeURIComponent(query.trim())}`);
    setQuery("");
  }

  return (
    <header className="glass glass-thin sticky top-3 z-30 mx-3 flex h-14 items-center gap-3 rounded-2xl px-3 sm:mx-4 sm:px-4 lg:mx-0 lg:mr-4">
      <button
        type="button"
        onClick={onOpenMenu}
        aria-label="Open navigation"
        className="flex h-9 w-9 items-center justify-center rounded-lg text-recon-ink-soft hover:bg-white/70 lg:hidden"
      >
        <Menu className="h-5 w-5" />
      </button>

      <p className="hidden text-sm font-semibold text-recon-ink md:block">{title}</p>

      <form onSubmit={onSearch} role="search" className="ml-auto flex min-w-0 flex-1 justify-end md:max-w-sm lg:max-w-md">
        <label className="flex h-9 w-full items-center gap-2 rounded-xl border border-recon-ink/10 bg-white/60 px-3 text-sm shadow-[inset_0_1px_0_#fff] transition-colors focus-within:border-gold/50 focus-within:ring-2 focus-within:ring-gold/15">
          <Search className="h-4 w-4 shrink-0 text-recon-steel" />
          <span className="sr-only">Search certificates</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by token ID or plant…"
            className="mono-data min-w-0 flex-1 bg-transparent text-recon-ink outline-none placeholder:font-sans placeholder:text-[13px] placeholder:text-recon-steel"
          />
          <kbd className="mono-micro hidden rounded border border-recon-ink/10 bg-white/70 px-1.5 text-recon-steel sm:inline">↵</kbd>
        </label>
      </form>

      <UtcClock />

      <div className="flex items-center gap-1">
        <Link
          href="/fraud"
          aria-label={`${flagged} flagged certificates`}
          className="relative flex h-9 w-9 items-center justify-center rounded-lg text-recon-ink-soft transition-colors hover:bg-white/70"
        >
          <Bell className="h-[18px] w-[18px]" />
          {flagged > 0 && (
            <span className="mono-micro absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-risk px-1 text-[9px] font-semibold text-white">
              {flagged}
            </span>
          )}
        </Link>
        <Link
          href="/how-it-works"
          aria-label="How it works"
          className="hidden h-9 w-9 items-center justify-center rounded-lg text-recon-ink-soft transition-colors hover:bg-white/70 sm:flex"
        >
          <CircleHelp className="h-[18px] w-[18px]" />
        </Link>
      </div>
    </header>
  );
}
