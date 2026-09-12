"use client";

import { motion } from "framer-motion";
import { AlertTriangle, ShieldCheck, ShieldOff } from "lucide-react";
import { OnChainProofPanel } from "@/components/certificate/onchain-proof-panel";
import { RiskBadge } from "@/components/certificate/risk-badge";
import { formatDateTime, formatMwh } from "@/lib/format";
import type { OnChainCertificate } from "@/lib/types";

export function VerifyResult({ certificate }: { certificate: OnChainCertificate }) {
  const retired = certificate.status === "retired";

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 20 }}
        className="flex items-center gap-3"
      >
        {retired ? (
          <ShieldOff className="h-7 w-7 text-recon-ink-dim" />
        ) : (
          <ShieldCheck className="h-7 w-7 text-verified" />
        )}
        <div>
          <p className="font-display text-xl font-semibold">
            {retired ? "Authentic — already retired" : "Authentic and active"}
          </p>
          <p className="text-sm text-recon-ink-dim">
            Certificate #{certificate.token_id} for {certificate.plant_id}
          </p>
        </div>
      </motion.div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* On-chain: a sharp, immediate "locked in" beat — this is the proven half. */}
        <motion.div
          initial={{ opacity: 0, scale: 0.94 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        >
          <OnChainProofPanel certificate={certificate} />
        </motion.div>

        {/* Off-chain: a slower, softer reveal — this is the explained half. */}
        <motion.div
          initial={{ opacity: 0, x: 16, filter: "blur(4px)" }}
          animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
          transition={{ duration: 0.6, delay: 0.25, ease: [0.16, 1, 0.3, 1] }}
          className="glass glass-gold p-6"
        >
          <p className="mb-1 text-xs tracking-wide text-gold">Explained off-chain</p>
          <p className="mb-4 text-xs text-recon-ink-dim">
            The database's account of this certificate — reasoning, not proof.
          </p>

          <div className="mb-4 flex items-center gap-2">
            <RiskBadge score={certificate.fraud_score} />
          </div>

          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            <dt className="text-recon-ink-dim">Energy</dt>
            <dd>{formatMwh(certificate.energy_mwh)}</dd>
            <dt className="text-recon-ink-dim">Generated</dt>
            <dd>{formatDateTime(certificate.generation_timestamp)}</dd>
            <dt className="text-recon-ink-dim">Issuer</dt>
            <dd>{certificate.raw_record.issuer_id}</dd>
          </dl>

          <div className="mt-4 border-t border-gold/20 pt-3">
            {certificate.risk_reasons.length > 0 ? (
              <ul className="space-y-1.5">
                {certificate.risk_reasons.map((reason) => (
                  <li key={reason} className="flex items-start gap-2 text-sm text-recon-ink">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-risk" />
                    {reason}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-verified">No fraud indicators found.</p>
            )}
            <p className="mt-2 text-sm text-recon-ink-dim">{certificate.explanation}</p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
