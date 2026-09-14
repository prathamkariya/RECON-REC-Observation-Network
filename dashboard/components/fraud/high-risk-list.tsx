"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, ShieldAlert } from "lucide-react";
import { Panel, PanelHeader } from "@/components/glass/panel";
import { SignalBadge, severityLabel } from "@/components/glass/signal-badge";
import { formatMwh, truncateAddress } from "@/lib/format";
import { FRAUD_FLAG_THRESHOLD, type CertificateListItem } from "@/lib/types";

/** The investigation queue: every flagged certificate, worst first, as case cards. */
export function HighRiskList({ certificates }: { certificates: CertificateListItem[] }) {
  const highRisk = certificates
    .filter((c) => c.fraud_score >= FRAUD_FLAG_THRESHOLD)
    .sort((a, b) => b.fraud_score - a.fraud_score);

  return (
    <Panel cap={highRisk.length ? "risk" : "verified"}>
      <PanelHeader
        icon={ShieldAlert}
        eyebrow="Case queue"
        title="Open investigations"
        description="Flagged certificates ordered by severity. Each opens its forensic dossier."
        actions={<SignalBadge tone={highRisk.length ? "solid-risk" : "verified"}>{highRisk.length} open</SignalBadge>}
      />

      {highRisk.length === 0 ? (
        <p className="rounded-xl border border-dashed border-recon-ink/15 p-8 text-center text-sm text-recon-ink-dim">
          No certificates currently flagged. The queue is clear.
        </p>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {highRisk.map((c, i) => (
            <motion.li
              key={c.token_id}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            >
              <Link
                href={`/certificates/${c.token_id}`}
                className="group relative flex h-full flex-col overflow-hidden rounded-xl border border-white/80 bg-white/60 p-4 shadow-[inset_0_1px_0_#fff] transition-all duration-300 hover:-translate-y-0.5 hover:bg-white/80 hover:shadow-[inset_0_1px_0_#fff,0_14px_28px_-16px_rgba(19,27,46,0.35)]"
              >
                <span className="absolute top-0 bottom-0 left-0 w-[3px]" style={{ background: c.fraud_score >= 75 ? "var(--recon-risk)" : "var(--recon-warn)" }} />
                <div className="flex items-center justify-between gap-2">
                  <span className="mono-data font-semibold text-recon-ink">REC-{String(c.token_id).padStart(5, "0")}</span>
                  <SignalBadge tone={c.fraud_score >= 75 ? "solid-risk" : "risk"}>
                    {c.fraud_score} · {severityLabel(c.fraud_score)}
                  </SignalBadge>
                </div>
                <p className="mt-1 text-sm font-medium text-recon-ink-soft">{c.plant_id}</p>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-recon-ink/[0.06]">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: c.fraud_score >= 75 ? "var(--recon-risk)" : "var(--recon-warn)" }}
                    initial={{ width: 0 }}
                    whileInView={{ width: `${c.fraud_score}%` }}
                    viewport={{ once: true }}
                    transition={{ duration: 1, ease: [0.16, 1, 0.3, 1], delay: 0.1 + i * 0.05 }}
                  />
                </div>
                <div className="mt-3 flex items-end justify-between gap-2">
                  <span className="mono-micro text-recon-steel">
                    {formatMwh(c.energy_mwh).toUpperCase()} · {truncateAddress(c.owner_address)}
                    <br />
                    GEN {new Date(c.generation_timestamp).toISOString().slice(0, 16).replace("T", " ")} UTC
                  </span>
                  <span className="flex items-center gap-1 text-xs font-semibold text-recon-ink group-hover:text-gold">
                    Open <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                  </span>
                </div>
              </Link>
            </motion.li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
