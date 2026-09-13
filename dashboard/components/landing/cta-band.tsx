import Link from "next/link";
import { ArrowRight, ScanSearch } from "lucide-react";
import { Reveal } from "@/components/motion/reveal";
import { ReconWordmark } from "@/components/brand/recon-mark";
import { chainName } from "@/lib/chain";

export function CtaBand() {
  return (
    <section className="px-4 pt-8 pb-10 sm:px-6">
      <Reveal className="mx-auto max-w-7xl">
        <div className="glass glass-forest relative overflow-hidden rounded-[32px] px-6 py-14 text-center sm:px-12 sm:py-20">
          <div aria-hidden className="absolute -top-24 left-1/2 h-72 w-[70%] -translate-x-1/2 rounded-full bg-[#52b788]/25 blur-[90px]" />
          <p className="label-caps relative text-[#a5d0b8]">Ready when your auditors are</p>
          <h2 className="font-display relative mx-auto mt-4 max-w-3xl text-[34px] leading-[1.06] font-bold tracking-[-0.03em] text-white sm:text-[52px]">
            Bring every certificate under forensic observation.
          </h2>
          <p className="relative mx-auto mt-5 max-w-xl text-[16px] leading-7 text-white/70">
            Open the dashboard on the live registry, or check any certificate&apos;s on-chain proof — no account needed.
          </p>
          <div className="relative mt-9 flex flex-col justify-center gap-3 sm:flex-row">
            <Link
              href="/dashboard"
              className="sheen group inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-white px-6 text-[15px] font-semibold text-recon-forest shadow-[0_18px_40px_-16px_rgba(0,0,0,0.5)] transition-transform hover:-translate-y-0.5"
            >
              Open the dashboard <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              <span className="sheen-bar" />
            </Link>
            <Link
              href="/verify"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-white/25 bg-white/10 px-6 text-[15px] font-semibold text-white backdrop-blur transition-colors hover:bg-white/15"
            >
              <ScanSearch className="h-4 w-4" /> Verify a certificate
            </Link>
          </div>
        </div>
      </Reveal>
    </section>
  );
}

export function SiteFooter() {
  return (
    <footer className="px-4 pb-8 sm:px-6">
      <div className="glass glass-thin mx-auto flex max-w-7xl flex-col gap-6 rounded-2xl px-6 py-6 sm:flex-row sm:items-center sm:justify-between">
        <ReconWordmark />
        <nav aria-label="Footer" className="flex flex-wrap gap-x-5 gap-y-2 text-[13px] text-recon-ink-dim">
          <Link href="/how-it-works" className="hover:text-recon-ink">How it works</Link>
          <Link href="/verify" className="hover:text-recon-ink">Verify</Link>
          <Link href="/dashboard" className="hover:text-recon-ink">Dashboard</Link>
          <Link href="/signin" className="hover:text-recon-ink">Sign in</Link>
        </nav>
        <p className="mono-micro text-recon-steel uppercase">Renewable energy certificate registry · {chainName}</p>
      </div>
    </footer>
  );
}
