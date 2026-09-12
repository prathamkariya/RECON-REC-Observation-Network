"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import type { CertificateListItem } from "@/lib/types";
import { RiskBadge } from "@/components/certificate/risk-badge";
import { formatMwh, formatRelative, truncateAddress } from "@/lib/format";

export function RecentCertificates({ certificates }: { certificates: CertificateListItem[] }) {
  const recent = certificates.slice(0, 6);

  return (
    <div className="glass glass-thin p-5">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs tracking-wide text-recon-ink-dim">Recent certificates</p>
        <Link href="/issue" className="text-xs text-gold hover:underline">
          Issue new
        </Link>
      </div>

      {recent.length === 0 ? (
        <p className="text-sm text-recon-ink-dim">No certificates yet.</p>
      ) : (
        <ul className="divide-y divide-border">
          {recent.map((cert, i) => (
            <motion.li
              key={cert.token_id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 + i * 0.05, duration: 0.35 }}
            >
              <Link
                href={`/certificates/${cert.token_id}`}
                className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0 hover:opacity-90"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-recon-ink">
                    #{cert.token_id} · {cert.plant_id}
                  </p>
                  <p className="text-xs text-recon-ink-dim">
                    {formatMwh(cert.energy_mwh)} · {truncateAddress(cert.owner_address)} ·{" "}
                    {formatRelative(cert.created_at)}
                  </p>
                </div>
                <RiskBadge score={cert.fraud_score} className="shrink-0" />
              </Link>
            </motion.li>
          ))}
        </ul>
      )}
    </div>
  );
}
