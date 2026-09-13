"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

/**
 * Requires a signed-in user when Firebase is configured. Without Firebase
 * config there is no sign-in to require, so the console stays open — the
 * sidebar shows "Sign-in not configured" rather than bouncing to a sign-in
 * page that couldn't work.
 */
export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, isConfigured } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isConfigured && !loading && !user) {
      router.replace("/signin");
    }
  }, [isConfigured, loading, user, router]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-recon-ink/10 border-t-gold" />
      </div>
    );
  }

  if (isConfigured && !user) return null; // redirect effect above is already firing

  return <>{children}</>;
}
