import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { EngravedPattern } from "@/components/brand/engraved-pattern";
import { PublicHeader } from "@/components/landing/public-header";
import { PipelineScroll } from "@/components/landing/pipeline-scroll";
import { ChainSplitExplainer } from "@/components/landing/chain-split-explainer";
import { PlatformStats } from "@/components/landing/platform-stats";

export default function LandingPage() {
  return (
    <div className="min-h-screen">
      <PublicHeader />

      <section className="relative flex min-h-[80vh] flex-col items-center justify-center overflow-hidden px-6 text-center">
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
      </section>

      <PipelineScroll />
      <ChainSplitExplainer />
      <PlatformStats />

      <footer className="border-t border-border px-6 py-10 text-center text-xs text-recon-ink-dim">
        Recon &middot; Renewable Energy Certificate registry &middot; Ethereum Sepolia
      </footer>
    </div>
  );
}
