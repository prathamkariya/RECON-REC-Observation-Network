import { LiquidBackground } from "@/components/brand/liquid-background";
import { PublicHeader } from "@/components/landing/public-header";
import { PipelineScroll } from "@/components/landing/pipeline-scroll";
import { ChainSplitExplainer } from "@/components/landing/chain-split-explainer";
import { CtaBand, SiteFooter } from "@/components/landing/cta-band";
import { Reveal } from "@/components/motion/reveal";

export default function HowItWorksPage() {
  return (
    <div className="relative min-h-screen overflow-x-clip">
      <LiquidBackground variant="hero" />
      <PublicHeader current="how-it-works" />

      <Reveal className="mx-auto max-w-3xl px-4 pt-36 pb-6 text-center sm:px-6 sm:pt-44">
        <p className="label-caps text-gold">How it works</p>
        <h1 className="font-display mt-4 text-[40px] leading-[1.04] font-bold tracking-[-0.035em] text-recon-ink sm:text-6xl">
          From a plant&apos;s meter to a certificate no one can duplicate.
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-[16px] leading-7 text-recon-ink-dim">
          Scroll to walk the full lifecycle, one stage at a time — the page advances with you and never autoplays.
        </p>
      </Reveal>

      <PipelineScroll expanded />
      <ChainSplitExplainer />
      <CtaBand />
      <SiteFooter />
    </div>
  );
}
