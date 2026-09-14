import { Heart } from "lucide-react";
import { LiquidBackground } from "@/components/brand/liquid-background";
import { PublicHeader } from "@/components/landing/public-header";
import { SiteFooter } from "@/components/landing/cta-band";
import { Reveal } from "@/components/motion/reveal";
import { HangingSpidey } from "@/components/about/hanging-spidey";
import { DinoGame } from "@/components/about/dino-game";

export const metadata = {
  title: "About us · RECON",
};

const TEAM = ["Shreyansh Soni", "Pratham Kariya", "Shaambhavi Dubey", "Jeet Samani"];

const initials = (name: string) =>
  name
    .split(" ")
    .map((part) => part[0])
    .join("");

export default function AboutPage() {
  return (
    <div className="relative min-h-screen overflow-x-clip">
      <LiquidBackground variant="hero" />
      <PublicHeader current="about" />

      <main>
        <section className="px-4 pt-32 pb-10 sm:px-6 sm:pt-40">
          <div className="mx-auto grid max-w-7xl items-center gap-6 lg:grid-cols-[1.15fr_0.85fr] lg:gap-12">
            <Reveal>
              <p className="label-caps text-gold">About us</p>
              <h1 className="font-display mt-4 text-[40px] leading-[1.04] font-bold tracking-[-0.035em] text-recon-ink sm:text-6xl">
                Created with <Heart className="inline h-[0.8em] w-[0.8em] -translate-y-[0.06em] fill-risk text-risk" aria-label="love" /> for
                Hackout&apos;26.
              </h1>
              <p className="mt-5 max-w-xl text-[16px] leading-7 text-recon-ink-dim">
                We built RECON for <span className="font-semibold text-recon-ink">Hackout&apos;26</span>, the flagship hackathon of{" "}
                <span className="font-semibold text-recon-ink">DAU</span> — Dhirubhai Ambani University, formerly DA-IICT. A renewable energy
                certificate should mean real, clean energy was produced exactly once. We wanted a registry that can prove it.
              </p>
            </Reveal>

            {/* Text-free zone: Spider-Man only ever moves inside this box. */}
            <HangingSpidey className="h-[320px] sm:h-[400px] lg:h-[460px]" />
          </div>
        </section>

        <section className="px-4 py-16 sm:px-6 sm:py-24">
          <div className="mx-auto max-w-7xl">
            <Reveal>
              <p className="label-caps text-gold">The team</p>
              <h2 className="font-display mt-3 text-[34px] leading-[1.05] font-bold tracking-[-0.03em] text-recon-ink sm:text-5xl">
                Four people, <span className="text-recon-steel">one registry.</span>
              </h2>
            </Reveal>

            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {TEAM.map((name, i) => (
                <Reveal key={name} delay={i * 0.08}>
                  <article className="glass glass-medium glass-hover relative h-full overflow-hidden rounded-[28px] p-6">
                    <span
                      aria-hidden
                      className="font-display pointer-events-none absolute -top-3 right-4 text-[80px] leading-none font-bold text-recon-ink/[0.05]"
                    >
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="font-display flex h-14 w-14 items-center justify-center rounded-2xl border border-white/80 bg-white/70 text-xl font-bold text-gold shadow-[inset_0_1px_0_#fff]">
                      {initials(name)}
                    </span>
                    <h3 className="font-display mt-6 text-[22px] leading-7 font-bold tracking-tight text-recon-ink">{name}</h3>
                    <p className="mono-micro mt-1 text-recon-steel uppercase">Team RECON · Hackout&apos;26</p>
                  </article>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        <section className="px-4 pt-8 pb-16 sm:px-6 sm:pb-24">
          <Reveal className="mx-auto max-w-7xl">
            <div className="text-center">
              <p className="label-caps text-gold">You scrolled all the way down</p>
              <h2 className="font-display mt-3 text-[30px] leading-[1.08] font-bold tracking-[-0.03em] text-recon-ink sm:text-[42px]">
                Here&apos;s a reward. <span className="text-recon-steel">No internet required.</span>
              </h2>
              <p className="mx-auto mt-3 max-w-md text-[14px] leading-6 text-recon-ink-dim">Space, ↑ or tap to jump the cacti.</p>
            </div>
            <div className="glass glass-medium mt-8 overflow-hidden rounded-[28px] px-2 py-4 sm:px-4">
              <DinoGame />
            </div>
          </Reveal>
        </section>

        <p className="px-4 pb-6 text-center text-[14px] text-recon-ink-dim">
          Made with <Heart className="inline h-3.5 w-3.5 fill-risk text-risk" aria-label="love" /> by Shreyansh, Pratham, Shaambhavi &amp; Jeet
        </p>
      </main>
      <SiteFooter />
    </div>
  );
}
