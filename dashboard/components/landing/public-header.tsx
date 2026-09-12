import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export function PublicHeader({ current }: { current?: "how-it-works" | "verify" }) {
  return (
    <header className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-6">
      <Link href="/" className="font-display shrink-0 text-lg font-semibold tracking-tight">
        Recon
      </Link>
      <nav className="flex items-center gap-4 text-sm">
        {current !== "how-it-works" && (
          <Link href="/how-it-works" className="hidden text-recon-ink-dim hover:text-gold sm:inline">
            How it works
          </Link>
        )}
        {current !== "verify" && (
          <Link href="/verify" className="hidden text-recon-ink-dim hover:text-gold sm:inline">
            Verify a certificate
          </Link>
        )}
        <Link href="/signin" className={buttonVariants({ size: "sm" })}>
          Sign in
        </Link>
      </nav>
    </header>
  );
}
