"use client";

import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { RiskBadge } from "@/components/certificate/risk-badge";
import { formatDateTime, formatMwh, truncateAddress } from "@/lib/format";
import { FRAUD_FLAG_THRESHOLD, type CertificateListItem } from "@/lib/types";

export function HighRiskList({ certificates }: { certificates: CertificateListItem[] }) {
  const highRisk = certificates
    .filter((c) => c.fraud_score >= FRAUD_FLAG_THRESHOLD)
    .sort((a, b) => b.fraud_score - a.fraud_score);

  return (
    <div className="glass glass-risk p-5">
      <p className="mb-3 flex items-center gap-2 text-xs tracking-wide text-risk">
        <AlertTriangle className="h-3.5 w-3.5" /> High-risk certificates
      </p>

      {highRisk.length === 0 ? (
        <p className="text-sm text-recon-ink-dim">No certificates currently flagged high-risk.</p>
      ) : (
        <ul className="divide-y divide-risk/15">
          {highRisk.map((c) => (
            <li key={c.token_id}>
              <Link
                href={`/certificates/${c.token_id}`}
                className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0 hover:opacity-90"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-recon-ink">
                    #{c.token_id} · {c.plant_id}
                  </p>
                  <p className="text-xs text-recon-ink-dim">
                    {formatMwh(c.energy_mwh)} · {truncateAddress(c.owner_address)} · {formatDateTime(c.created_at)}
                  </p>
                </div>
                <RiskBadge score={c.fraud_score} className="shrink-0" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
