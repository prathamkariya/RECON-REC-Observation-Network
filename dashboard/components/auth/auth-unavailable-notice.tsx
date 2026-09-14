"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

/** Shown on the auth pages when this deployment has no Firebase config, so sign-in can't work. */
export function AuthUnavailableNotice() {
  const { isConfigured } = useAuth();
  if (isConfigured) return null;

  return (
    <div role="status" className="mb-6 rounded-xl border border-warn/30 bg-warn/10 px-4 py-3 text-sm text-recon-ink-soft">
      Sign-in isn&apos;t enabled on this deployment, so no account is needed.
      <Link href="/dashboard" className="mt-1 flex items-center gap-1 font-semibold text-recon-ink hover:text-gold">
        Continue to the dashboard <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}
