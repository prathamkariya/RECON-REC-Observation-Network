import { LiquidBackground } from "@/components/brand/liquid-background";
import { PublicHeader } from "@/components/landing/public-header";
import { Hero } from "@/components/landing/hero";
import { SignalMarquee } from "@/components/landing/signal-marquee";
import { SignalsSection } from "@/components/landing/signals-section";
import { PipelineScroll } from "@/components/landing/pipeline-scroll";
import { LiveRegistry } from "@/components/landing/live-registry";
import { ChainSplitExplainer } from "@/components/landing/chain-split-explainer";
import { CtaBand, SiteFooter } from "@/components/landing/cta-band";

export default function LandingPage() {
  return (
    <div className="relative min-h-screen overflow-x-clip">
      <LiquidBackground variant="hero" />
      <PublicHeader />
      <main>
        <Hero />
        <SignalMarquee />
        <SignalsSection />
        <PipelineScroll />
        <LiveRegistry />
        <ChainSplitExplainer />
        <CtaBand />
      </main>
      <SiteFooter />
    </div>
  );
}
