"use client";

import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useMotionValueEvent, useScroll } from "framer-motion";
import { ArrowUpRight, Menu, X } from "lucide-react";
import { cn } from "cn";
import { ReconWordmark } from "@/components/brand/recon-mark";
import { useAuth } from "@/lib/auth-context";

const LINKS = [
  { href: "/#signals", label: "Signals" },
  { href: "/#registry", label: "Live registry" },
  { href: "/how-it-works", label: "How it works", key: "how-it-works" },
  { href: "/verify", label: "Verify", key: "verify" },
];

/** Floating liquid-glass pill. Condenses (tighter, more opaque) once the page scrolls. */
export function PublicHeader({ current }: { current?: "how-it-works" | "verify" }) {
  const { scrollY } = useScroll();
  const [condensed, setCondensed] = useState(false);
  const [open, setOpen] = useState(false);
  const { user, isConfigured } = useAuth();
  useMotionValueEvent(scrollY, "change", (y) => setCondensed(y > 24));

  const isSignedIn = isConfigured && !!user;

  return (
    <header className="pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center px-3 pt-3 sm:px-4 sm:pt-4">
      <motion.div
        layout
        className={cn(
          "glass pointer-events-auto flex w-full max-w-6xl items-center justify-between gap-3 rounded-2xl px-3 transition-[background-color,padding] duration-500 sm:px-4",
          condensed ? "glass-thick py-2" : "glass-thin py-3",
        )}
      >
        <Link href="/" aria-label="RECON home" className="shrink-0">
          <ReconWordmark subtitle={!condensed} />
        </Link>

        <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              aria-current={current && link.key === current ? "page" : undefined}
              className={cn(
                "rounded-lg px-3 py-2 text-[13px] font-medium transition-colors",
                current && link.key === current ? "bg-white/70 text-recon-ink" : "text-recon-ink-dim hover:bg-white/50 hover:text-recon-ink",
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          {isSignedIn ? (
            <Link href="/dashboard" className="hidden rounded-lg px-3 py-2 text-[13px] font-medium text-recon-ink-soft hover:text-recon-ink sm:block">
              {user.displayName ?? user.email ?? "Dashboard"}
            </Link>
          ) : (
            <Link href="/signin" className="hidden rounded-lg px-3 py-2 text-[13px] font-medium text-recon-ink-soft hover:text-recon-ink sm:block">
              Sign in
            </Link>
          )}
          <Link
            href="/dashboard"
            className="sheen group inline-flex h-9 items-center gap-1.5 rounded-xl bg-recon-forest px-3.5 text-[13px] font-semibold whitespace-nowrap text-white shadow-[0_10px_24px_-12px_rgba(15,42,32,0.8),inset_0_1px_0_rgba(255,255,255,0.15)] transition-colors hover:bg-[#1b4332]"
          >
            <span className="sm:hidden">Dashboard</span>
            <span className="hidden sm:inline">Open dashboard</span>
            <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            <span className="sheen-bar" />
          </Link>
          <button
            type="button"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-recon-ink-soft hover:bg-white/60 md:hidden"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </motion.div>

      <AnimatePresence>
        {open && (
          <motion.nav
            aria-label="Mobile"
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="glass glass-thick pointer-events-auto absolute top-[76px] right-3 left-3 flex flex-col rounded-2xl p-2 md:hidden"
          >
            {LINKS.map((link) => (
              <Link key={link.href} href={link.href} onClick={() => setOpen(false)} className="rounded-xl px-4 py-3 text-[15px] font-medium text-recon-ink hover:bg-white/60">
                {link.label}
              </Link>
            ))}
            {isSignedIn ? (
              <Link href="/dashboard" onClick={() => setOpen(false)} className="rounded-xl px-4 py-3 text-[15px] font-medium text-recon-ink hover:bg-white/60">
                Dashboard
              </Link>
            ) : (
              <Link href="/signin" onClick={() => setOpen(false)} className="rounded-xl px-4 py-3 text-[15px] font-medium text-recon-ink hover:bg-white/60">
                Sign in
              </Link>
            )}
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  );
}

