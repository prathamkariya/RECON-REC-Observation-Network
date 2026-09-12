"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

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
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-gold" />
      </div>
    );
  }

  // Firebase isn't configured yet — render the app instead of bouncing to a
  // sign-in page that can't work either, so the rest of the UI stays testable.
  if (!isConfigured) {
    return (
      <>
        <div className="glass glass-gold mx-6 mt-4 rounded-lg px-4 py-2 text-center text-xs text-recon-ink-dim">
          Firebase isn&apos;t configured — auth is bypassed in dev. Set NEXT_PUBLIC_FIREBASE_* in .env.local.
        </div>
        {children}
      </>
    );
  }

  if (!user) return null; // redirect effect above is already firing

  return <>{children}</>;
}
