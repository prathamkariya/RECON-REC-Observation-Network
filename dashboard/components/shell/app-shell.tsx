"use client";

import { useEffect, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { LiquidBackground } from "@/components/brand/liquid-background";
import { AppSidebar } from "@/components/shell/app-sidebar";
import { AppTopbar } from "@/components/shell/app-topbar";

export function AppShell({ children }: { children: ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);

  // Links inside the drawer close it via onNavigate; Escape closes it here.
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenuOpen(false);
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  return (
    <div className="relative min-h-screen overflow-x-clip">
      <LiquidBackground />

      {/* Desktop: floating glass rail */}
      <aside className="glass glass-thin fixed top-3 bottom-3 left-3 z-40 hidden w-[256px] rounded-2xl lg:block">
        <AppSidebar />
      </aside>

      {/* Mobile / tablet drawer */}
      <AnimatePresence>
        {menuOpen && (
          <>
            <motion.button
              type="button"
              aria-label="Close navigation"
              className="fixed inset-0 z-50 bg-recon-ink/25 backdrop-blur-[2px] lg:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMenuOpen(false)}
            />
            <motion.aside
              role="dialog"
              aria-modal="true"
              aria-label="Navigation"
              data-lenis-prevent
              className="glass glass-thick fixed top-3 bottom-3 left-3 z-50 w-[min(300px,calc(100vw-24px))] rounded-2xl lg:hidden"
              initial={{ x: "-110%" }}
              animate={{ x: 0 }}
              exit={{ x: "-110%" }}
              transition={{ type: "spring", stiffness: 380, damping: 38 }}
            >
              <button
                type="button"
                onClick={() => setMenuOpen(false)}
                aria-label="Close navigation"
                className="absolute top-5 right-4 z-10 flex h-8 w-8 items-center justify-center rounded-lg text-recon-ink-soft hover:bg-white/70"
              >
                <X className="h-4 w-4" />
              </button>
              <AppSidebar onNavigate={() => setMenuOpen(false)} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Frosted top fade so content scrolling under the floating bar dissolves instead of peeking above it. */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 top-0 z-20 h-20 backdrop-blur-[6px]"
        style={{
          background: "linear-gradient(to bottom, rgba(244,245,241,0.92), rgba(244,245,241,0.55) 55%, rgba(244,245,241,0))",
          maskImage: "linear-gradient(to bottom, #000 45%, transparent)",
          WebkitMaskImage: "linear-gradient(to bottom, #000 45%, transparent)",
        }}
      />

      <div className="lg:pl-[272px]">
        <AppTopbar onOpenMenu={() => setMenuOpen(true)} />
        <main className="mx-auto w-full max-w-[1440px] px-4 pt-6 pb-16 sm:px-6 lg:pr-8 lg:pl-2">{children}</main>
      </div>
    </div>
  );
}
