"use client";

import { useCertificates } from "@/lib/hooks/use-certificates";
import { StatCard } from "@/components/dashboard/stat-card";
import { FRAUD_FLAG_THRESHOLD } from "@/lib/types";

/** Real numbers, not marketing copy -- the backend has no auth, so a public
 * page can call it directly, same as /verify does. */
export function PlatformStats() {
  const { data: certificates } = useCertificates();
  if (!certificates || certificates.length === 0) return null;

  const flagged = certificates.filter((c) => c.fraud_score >= FRAUD_FLAG_THRESHOLD);
  const totalEnergy = certificates.reduce((sum, c) => sum + c.energy_mwh, 0);

  return (
    <section className="mx-auto max-w-4xl px-6 pb-24">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Certificates issued" value={certificates.length} accent="gold" />
        <StatCard label="Energy certified" value={totalEnergy} suffix="MWh" decimals={1} accent="verified" />
        <StatCard label="Fraud caught" value={flagged.length} accent={flagged.length > 0 ? "risk" : "neutral"} />
      </div>
    </section>
  );
}
