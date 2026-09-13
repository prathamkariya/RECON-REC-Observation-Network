"use client";

import { Gauge, ShieldAlert, Siren, Zap } from "lucide-react";
import { useCertificates } from "@/lib/hooks/use-certificates";
import { StatCard } from "@/components/dashboard/stat-card";
import { FlagRateTrend, RiskDistributionChart, RiskSplitDonut } from "@/components/fraud/risk-distribution-chart";
import { HighRiskList } from "@/components/fraud/high-risk-list";
import { MetaChip, PageHeader } from "@/components/glass/panel";
import { ConsoleSkeleton, ErrorPanel } from "@/components/glass/states";
import { Reveal, Stagger, StaggerItem } from "@/components/motion/reveal";
import { FRAUD_FLAG_THRESHOLD } from "@/lib/types";

export default function InvestigationsPage() {
  const { data: certificates, isLoading, isError } = useCertificates();

  if (isLoading) return <ConsoleSkeleton kpis={4} />;
  if (isError || !certificates) return <ErrorPanel title="Couldn't load fraud data" />;

  const flagged = certificates.filter((c) => c.fraud_score >= FRAUD_FLAG_THRESHOLD);
  const critical = certificates.filter((c) => c.fraud_score >= 75);
  const avgScore = certificates.length ? Math.round(certificates.reduce((sum, c) => sum + c.fraud_score, 0) / certificates.length) : 0;
  const mwhUnderReview = flagged.reduce((s, c) => s + c.energy_mwh, 0);

  return (
    <div className="space-y-6">
      <Reveal y={12}>
        <PageHeader
          crumbs={["REC Market", "Investigations"]}
          title="Risk analytics & the investigation queue."
          description="How fraud risk is distributed across the registry, and every certificate that needs a human decision."
          meta={
            <>
              <MetaChip live>
                <span className="mono-micro font-semibold">{flagged.length} OPEN CASES</span>
              </MetaChip>
              <MetaChip>
                <span className="mono-micro text-recon-steel">THRESHOLD:</span> score ≥ {FRAUD_FLAG_THRESHOLD}
              </MetaChip>
            </>
          }
        />
      </Reveal>

      <Stagger className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StaggerItem>
          <StatCard label="Open cases" value={flagged.length} icon={ShieldAlert} accent={flagged.length ? "risk" : "neutral"} footnote="Of registry" footnoteValue={`${certificates.length ? Math.round((flagged.length / certificates.length) * 100) : 0}%`} />
        </StaggerItem>
        <StaggerItem>
          <StatCard label="Critical" value={critical.length} icon={Siren} accent={critical.length ? "risk" : "neutral"} footnote="Score" footnoteValue="≥ 75" />
        </StaggerItem>
        <StaggerItem>
          <StatCard label="Average score" value={avgScore} suffix="/100" icon={Gauge} accent="warn" footnote="Across" footnoteValue={`${certificates.length} certs`} />
        </StaggerItem>
        <StaggerItem>
          <StatCard label="MWh under review" value={mwhUnderReview} icon={Zap} footnote="Flagged energy" footnoteValue="Held" />
        </StaggerItem>
      </Stagger>

      <div className="grid gap-4 lg:grid-cols-3">
        <Reveal className="lg:col-span-2">
          <RiskDistributionChart certificates={certificates} />
        </Reveal>
        <Reveal delay={0.06}>
          <RiskSplitDonut certificates={certificates} />
        </Reveal>
      </div>

      <Reveal>
        <HighRiskList certificates={certificates} />
      </Reveal>

      <Reveal>
        <FlagRateTrend certificates={certificates} />
      </Reveal>
    </div>
  );
}
