

"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";

const LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/issue", label: "Issue certificate" },
  { href: "/certificates", label: "Certificates" },
  { href: "/fraud", label: "Fraud" },
  { href: "/verify", label: "Verify" },
];

export function AppNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, signOut } = useAuth();

  return (
    <header className="glass glass-thin sticky top-0 z-40 border-b">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link href="/dashboard" className="font-display text-lg font-semibold tracking-tight">
          Recon
        </Link>

        <nav className="hidden items-center gap-1 sm:flex">
          {LINKS.map((link) => {
            const active = pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm transition-colors",
                  active ? "bg-secondary text-foreground" : "text-recon-ink-dim hover:text-foreground",
                )}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-3">
          <span className="hidden text-xs text-recon-ink-dim sm:inline">{user?.email}</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={async () => {
              await signOut();
              router.push("/signin");
            }}
          >
            Sign out
          </Button>
        </div>
      </div>

      <nav className="flex items-center gap-1 overflow-x-auto border-t border-border px-6 py-2 sm:hidden">
        {LINKS.map((link) => {
          const active = pathname.startsWith(link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "shrink-0 rounded-md px-3 py-1.5 text-sm transition-colors",
                active ? "bg-secondary text-foreground" : "text-recon-ink-dim hover:text-foreground",
              )}
            >
              {link.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
