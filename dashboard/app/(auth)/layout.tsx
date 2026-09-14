import Link from "next/link";
import { FileBadge2, ScanSearch, ShieldCheck } from "lucide-react";
import { LiquidBackground } from "@/components/brand/liquid-background";
import { ReconWordmark } from "@/components/brand/recon-mark";
import { Reveal } from "@/components/motion/reveal";
import { AuthUnavailableNotice } from "@/components/auth/auth-unavailable-notice";

const POINTS = [
  { icon: ShieldCheck, title: "Scored before it's minted", body: "Every claim is checked against plant physics, statistics and its trading history." },
  { icon: FileBadge2, title: "Unique on-chain", body: "The same generation record can never be certified twice." },
  { icon: ScanSearch, title: "Verifiable by anyone", body: "Buyers and auditors can check any certificate without an account." },
];

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative grid min-h-screen gap-4 p-3 sm:p-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      <LiquidBackground variant="hero" />

      <div className="flex flex-col justify-between px-3 py-6 sm:px-10 lg:px-14">
        <Link href="/" aria-label="RECON home" className="self-start">
          <ReconWordmark />
        </Link>
        <Reveal className="mx-auto w-full max-w-[400px] py-12">
          <div className="glass glass-medium rounded-[28px] p-6 sm:p-8">
            <AuthUnavailableNotice />
            {children}
          </div>
        </Reveal>
        <p className="mono-micro text-recon-steel">RENEWABLE ENERGY CERTIFICATE REGISTRY</p>
      </div>

      <div className="glass glass-forest relative hidden flex-col justify-end overflow-hidden rounded-[32px] p-10 lg:flex xl:p-14">
        <div aria-hidden className="absolute -top-32 -right-24 h-96 w-96 rounded-full bg-[#52b788]/25 blur-[100px]" />
        <p className="font-display relative max-w-lg text-[34px] leading-[1.12] font-bold tracking-tight text-white">
          Every certificate proves one thing on-chain: <span className="text-[#95d5b2]">it has never been issued before.</span>
        </p>
        <ul className="relative mt-10 space-y-5">
          {POINTS.map(({ icon: Icon, title, body }) => (
            <li key={title} className="flex gap-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 text-[#d8f3dc]">
                <Icon className="h-5 w-5" />
              </span>
              <span>
                <span className="block text-[15px] font-semibold text-white">{title}</span>
                <span className="mt-0.5 block text-sm leading-6 text-white/70">{body}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
