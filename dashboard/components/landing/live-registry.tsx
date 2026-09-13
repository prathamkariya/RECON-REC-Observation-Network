"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { useCertificates } from "@/lib/hooks/use-certificates";
import { StatCard } from "@/components/dashboard/stat-card";
import { IssuanceTrend } from "@/components/control-room/trend-charts";
import { RiskDistributionChart, RiskSplitDonut } from "@/components/fraud/risk-distribution-chart";
import { LiveDot } from "@/components/glass/panel";
import { Shimmer } from "@/components/glass/states";
import { Reveal } from "@/components/motion/reveal";
import { chainName } from "@/lib/chain";
import { FRAUD_FLAG_THRESHOLD } from "@/lib/types";

/** Real registry numbers and charts on the public page — the same components the console uses. */
export function LiveRegistry() {
  const { data: certificates, isLoading, isError } = useCertificates();

  return (
    <section id="registry" className="relative scroll-mt-24 px-4 py-24 sm:px-6 sm:py-28">
      <div className="mx-auto max-w-7xl">
        <Reveal className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="label-caps flex items-center gap-2 text-gold">
              <LiveDot className="h-1.5 w-1.5" /> Live registry
            </p>
            <h2 className="font-display mt-3 max-w-2xl text-[34px] leading-[1.08] font-bold tracking-[-0.03em] text-recon-ink sm:text-5xl">
              Not a mock-up. <span className="text-recon-steel">The registry, right now.</span>
            </h2>
          </div>
          <Link href="/dashboard" className="glass glass-thin inline-flex h-11 items-center gap-2 self-start rounded-2xl px-5 text-sm font-semibold text-recon-ink sm:self-auto">
            Open dashboard <ArrowUpRight className="h-4 w-4" />
          </Link>
        </Reveal>

        {isLoading && (
          <div className="mt-10 grid gap-4 lg:grid-cols-3">
            <Shimmer className="h-[360px] rounded-2xl lg:col-span-2" />
            <Shimmer className="h-[360px] rounded-2xl" />
          </div>
        )}

        {isError && (
          <p className="glass glass-thin mt-10 rounded-2xl p-6 text-center text-sm text-recon-ink-dim">
            The registry is offline right now. Live numbers will appear here once it&apos;s back.
          </p>
        )}

        {certificates && certificates.length === 0 && (
          <p className="glass glass-thin mt-10 rounded-2xl p-6 text-center text-sm text-recon-ink-dim">
            The registry is live but empty — charts appear as soon as the first certificate is issued.
          </p>
        )}

        {certificates && certificates.length > 0 && (
          <>
            <div className="mt-10 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
              <Reveal>
                <StatCard label="Certificates" value={certificates.length} footnote="Minted on" footnoteValue={chainName} />
              </Reveal>
              <Reveal delay={0.05}>
                <StatCard label="Energy certified" value={certificates.reduce((s, c) => s + c.energy_mwh, 0)} suffix="MWh" accent="verified" footnote="Unique records" footnoteValue="On-chain" />
              </Reveal>
              <Reveal delay={0.1}>
                <StatCard
                  label="Fraud caught"
                  value={certificates.filter((c) => c.fraud_score >= FRAUD_FLAG_THRESHOLD).length}
                  accent="risk"
                  footnote="Score"
                  footnoteValue={`≥ ${FRAUD_FLAG_THRESHOLD}`}
                />
              </Reveal>
              <Reveal delay={0.15}>
                <StatCard label="Plants observed" value={new Set(certificates.map((c) => c.plant_id)).size} footnote="Physics checked" footnoteValue="Every claim" />
              </Reveal>
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-3">
              <Reveal className="lg:col-span-2">
                <IssuanceTrend certificates={certificates} />
              </Reveal>
              <Reveal delay={0.08}>
                <RiskSplitDonut certificates={certificates} />
              </Reveal>
            </div>
            <Reveal className="mt-4">
              <RiskDistributionChart certificates={certificates} />
            </Reveal>
          </>
        )}
      </div>
    </section>
  );
}
