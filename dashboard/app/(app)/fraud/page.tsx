"use client";

import { useCertificates } from "@/lib/hooks/use-certificates";
import { StatCard } from "@/components/dashboard/stat-card";
import { RiskDistributionChart } from "@/components/fraud/risk-distribution-chart";
import { HighRiskList } from "@/components/fraud/high-risk-list";
import { Skeleton } from "@/components/ui/skeleton";
import { FRAUD_FLAG_THRESHOLD } from "@/lib/types";

export default function FraudPage() {
  const { data: certificates, isLoading, isError } = useCertificates();

  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
        <Skeleton className="col-span-full h-72 rounded-xl" />
      </div>
    );
  }

  if (isError || !certificates) {
    return (
      <div className="glass glass-risk p-6 text-sm text-recon-ink">
        Couldn&apos;t load fraud data. Check that the backend is running and reachable.
      </div>
    );
  }

  const flagged = certificates.filter((c) => c.fraud_score >= FRAUD_FLAG_THRESHOLD);
  const avgScore = certificates.length
    ? Math.round(certificates.reduce((sum, c) => sum + c.fraud_score, 0) / certificates.length)
    : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Fraud analytics</h1>
        <p className="text-sm text-recon-ink-dim">Risk distribution across every certificate on this registry.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Total certificates" value={certificates.length} />
        <StatCard label="Flagged high-risk" value={flagged.length} accent={flagged.length > 0 ? "risk" : "neutral"} />
        <StatCard label="Average fraud score" value={avgScore} suffix="/ 100" accent="gold" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <RiskDistributionChart certificates={certificates} />
        <HighRiskList certificates={certificates} />
      </div>
    </div>
  );
}
