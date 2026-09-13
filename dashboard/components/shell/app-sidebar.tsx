"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { LogOut } from "lucide-react";
import { cn } from "cn";
import { ReconWordmark } from "@/components/brand/recon-mark";
import { LiveDot } from "@/components/glass/panel";
import { NAV_GROUPS, NAV_ITEMS, activeNavItem } from "@/components/shell/nav-items";
import { useAuth } from "@/lib/auth-context";
import { chainName } from "@/lib/chain";
import { useSystemStatus } from "@/lib/hooks/use-certificates";

const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK_DATA === "true";

export function AppSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const active = activeNavItem(pathname);
  const { user, signOut, isConfigured } = useAuth();

  const name = user?.displayName ?? user?.email ?? "Guest";
  const initials = name
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  return (
    <div className="flex h-full flex-col">
      <div className={cn("px-5 pt-5 pb-4", onNavigate && "pr-14")}>
        <Link href="/" onClick={onNavigate} aria-label="RECON home">
          <ReconWordmark />
        </Link>
      </div>

      <div className="mx-5 h-px bg-gradient-to-r from-transparent via-recon-ink/10 to-transparent" />

      <nav aria-label="Primary" className="flex-1 space-y-5 overflow-y-auto px-3 py-4" data-lenis-prevent>
        {NAV_GROUPS.map((group) => (
          <div key={group}>
            <p className="label-caps px-3 pb-2 text-recon-steel">{group}</p>
            <ul className="space-y-0.5">
              {NAV_ITEMS.filter((item) => item.group === group).map((item) => {
                const isActive = active?.href === item.href;
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      aria-current={isActive ? "page" : undefined}
                      className={cn(
                        "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] font-medium transition-colors duration-200",
                        isActive ? "text-recon-ink" : "text-recon-ink-dim hover:text-recon-ink",
                      )}
                    >
                      {isActive && (
                        <motion.span
                          layoutId="sidebar-active"
                          className="absolute inset-0 -z-10 rounded-xl border border-white/80 bg-white/75 shadow-[inset_0_1px_0_#fff,0_6px_16px_-8px_rgba(19,27,46,0.25)]"
                          transition={{ type: "spring", stiffness: 420, damping: 36 }}
                        />
                      )}
                      {isActive && <span className="absolute top-2 bottom-2 left-0 w-[3px] rounded-full bg-gold" />}
                      <Icon
                        className={cn(
                          "h-[18px] w-[18px] shrink-0 transition-colors",
                          isActive ? "text-gold" : "text-recon-steel group-hover:text-recon-ink-soft",
                        )}
                      />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="space-y-3 p-4">
        <SystemStatusCard />

        <div className="flex items-center gap-3 rounded-xl px-2 py-1.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-recon-forest text-xs font-semibold text-[#d8f3dc] ring-2 ring-white/80">
            {initials || "G"}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-recon-ink">{name}</p>
            <p className="mono-micro truncate text-recon-steel">{isConfigured ? "Signed in" : "Sign-in not configured"}</p>
          </div>
          {isConfigured && (
            <button
              type="button"
              aria-label="Sign out"
              onClick={async () => {
                await signOut();
                router.push("/signin");
              }}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-recon-steel transition-colors hover:bg-white/70 hover:text-recon-ink"
            >
              <LogOut className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/** Live system state from the backend's status endpoint — nothing here is a fixed label. */
function SystemStatusCard() {
  const { data: status, isError, isLoading } = useSystemStatus();

  const api = isLoading ? "Checking…" : isError ? "Offline" : USE_MOCK ? "Demo data" : "Online";
  const chain = isLoading ? "Checking…" : !status ? "Unknown" : status.chain.ready ? "Ready" : status.chain.connected ? "No contract" : "Unreachable";
  const liveSources = status ? Object.values(status.sources).filter((s) => s === "real").length : 0;
  const totalSources = status ? Object.keys(status.sources).length : 0;
  const healthy = !isError && !!status?.chain.ready;

  return (
    <div className="rounded-xl border border-white/70 bg-white/45 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
      <div className="flex items-center justify-between">
        <span className="label-caps text-recon-steel">System</span>
        <LiveDot tone={isLoading ? "neutral" : healthy ? "verified" : "risk"} className="h-1.5 w-1.5" />
      </div>
      <dl className="mt-2 space-y-1">
        <StatusRow label="API" value={api} bad={isError} />
        <StatusRow label={chainName} value={chain} bad={!isLoading && !status?.chain.ready} />
        {status && <StatusRow label="Live models" value={`${liveSources} of ${totalSources}`} />}
      </dl>
    </div>
  );
}

function StatusRow({ label, value, bad }: { label: string; value: string; bad?: boolean }) {
  return (
    <div className="flex justify-between gap-2">
      <dt className="mono-micro truncate text-recon-steel">{label}</dt>
      <dd className={cn("mono-micro shrink-0", bad ? "text-risk" : "text-recon-ink-soft")}>{value}</dd>
    </div>
  );
}
