import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { EngravedPattern } from "@/components/brand/engraved-pattern";

// Placeholder landing page — the full scroll-scrubbed pipeline narrative is
// Priority 2 per the build brief. This just gets people to the working
// parts of the product (sign in, public verify) without blocking on it.
export default function LandingPage() {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-6 text-center">
      <EngravedPattern className="absolute inset-0 h-full w-full opacity-40" />
      <div className="relative z-10 max-w-2xl space-y-6">
        <p className="text-xs tracking-wide text-recon-ink-dim">Renewable Energy Intelligence</p>
        <h1 className="font-display text-4xl font-semibold sm:text-5xl">
          Certificates an AI scores, <span className="text-gold">and a chain can&apos;t double-issue.</span>
        </h1>
        <p className="mx-auto max-w-lg text-recon-ink-dim">
          Fraud analysis, plant data, and reasoning live off-chain where they can be explained. Only one
          claim needs a blockchain: this generation record has never been certified before.
        </p>
        <div className="flex items-center justify-center gap-3">
          <Link href="/signin" className={buttonVariants({ size: "lg" })}>
            Sign in
          </Link>
          <Link href="/verify" className={buttonVariants({ variant: "outline", size: "lg" })}>
            Verify a certificate
          </Link>
        </div>
      </div>
    </div>
  );
}
