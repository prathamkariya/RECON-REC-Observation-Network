"use client";

import Link from "next/link";
import { FileBadge2, FilePlus2, FlagTriangleRight, Lock, Zap } from "lucide-react";
import { useCertificates } from "@/lib/hooks/use-certificates";
import { StatCard } from "@/components/dashboard/stat-card";
import { AnomalyMatrix } from "@/components/control-room/anomaly-matrix";
import { SurveillanceFeed } from "@/components/control-room/surveillance-feed";
import { IssuanceTrend, PlantEnergyBars } from "@/components/control-room/trend-charts";
import { RecentCertificates } from "@/components/dashboard/recent-certificates";
import { MetaChip, PageHeader } from "@/components/glass/panel";
import { ConsoleSkeleton, EmptyState, ErrorPanel } from "@/components/glass/states";
import { Reveal, Stagger, StaggerItem } from "@/components/motion/reveal";
import { chainName } from "@/lib/chain";
import { FRAUD_FLAG_THRESHOLD } from "@/lib/types";

export default function DashboardPage() {
  const { data: certificates, isLoading, isError, dataUpdatedAt } = useCertificates();

  if (isLoading) return <ConsoleSkeleton />;
  if (isError || !certificates) return <ErrorPanel />;

  const flagged = certificates.filter((c) => c.fraud_score >= FRAUD_FLAG_THRESHOLD);
  const retired = certificates.filter((c) => c.status === "retired").length;
  const mwh = certificates.reduce((s, c) => s + c.energy_mwh, 0);
  const plants = new Set(certificates.map((c) => c.plant_id)).size;
  const flagRate = certificates.length ? (flagged.length / certificates.length) * 100 : 0;
  const syncedAt = new Date(dataUpdatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="space-y-6">
      <Reveal y={12}>
        <PageHeader
          title="Registry overview"
          description="Every certificate on the registry, scored for fraud risk and recorded on-chain."
          meta={
            <>
              <MetaChip live>Updated {syncedAt}</MetaChip>
              <MetaChip>
                {plants} {plants === 1 ? "plant" : "plants"} · {chainName}
              </MetaChip>
            </>
          }
          actions={
            <Link
              href="/issue"
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-recon-forest px-4 text-sm font-semibold text-white shadow-[0_10px_24px_-12px_rgba(15,42,32,0.7)] transition-colors hover:bg-[#1b4332]"
            >
              <FilePlus2 className="h-4 w-4" /> Issue certificate
            </Link>
          }
        />
      </Reveal>

      {certificates.length === 0 ? (
        <EmptyState
          icon={FileBadge2}
          title="No certificates yet"
          description="Issue the first certificate to start building the registry. Each one is scored for fraud risk before it is minted."
          actionHref="/issue"
          actionLabel="Issue a certificate"
        />
      ) : (
        <>
          <Stagger className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            <StaggerItem>
              <StatCard label="Certificates" value={certificates.length} icon={FileBadge2} footnote="Plants" footnoteValue={String(plants)} />
            </StaggerItem>
            <StaggerItem>
              <StatCard label="Energy certified" value={mwh} decimals={0} suffix="MWh" icon={Zap} accent="verified" footnote="On-chain" footnoteValue={chainName} />
            </StaggerItem>
            <StaggerItem>
              <StatCard
                label="Flagged"
                value={flagged.length}
                icon={FlagTriangleRight}
                accent={flagged.length ? "risk" : "neutral"}
                footnote="Flag rate"
                footnoteValue={`${flagRate.toFixed(1)}%`}
              />
            </StaggerItem>
            <StaggerItem>
              <StatCard
                label="Retired"
                value={retired}
                icon={Lock}
                footnote="Of registry"
                footnoteValue={`${certificates.length ? Math.round((retired / certificates.length) * 100) : 0}%`}
              />
            </StaggerItem>
          </Stagger>

          <div className="grid gap-4 lg:grid-cols-3">
            <Reveal className="lg:col-span-2">
              <AnomalyMatrix certificates={certificates} />
            </Reveal>
            <Reveal delay={0.08}>
              <SurveillanceFeed certificates={certificates} />
            </Reveal>
          </div>

          <div className="grid gap-4 lg:grid-cols-5">
            <Reveal className="lg:col-span-3">
              <IssuanceTrend certificates={certificates} />
            </Reveal>
            <Reveal delay={0.06} className="lg:col-span-2">
              <PlantEnergyBars certificates={certificates} />
            </Reveal>
          </div>

          <Reveal>
            <RecentCertificates certificates={certificates} />
          </Reveal>
        </>
      )}
    </div>
  );
}
