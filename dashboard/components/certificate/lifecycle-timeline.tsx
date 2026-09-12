"use client";

import { motion } from "framer-motion";
import { formatDateTime } from "@/lib/format";
import type { OnChainCertificate } from "@/lib/types";

export function LifecycleTimeline({ certificate }: { certificate: OnChainCertificate }) {
  const steps = [
    { label: "Generated", detail: formatDateTime(certificate.generation_timestamp), done: true },
    { label: "AI analyzed", detail: `Fraud score ${certificate.fraud_score}/100`, done: true },
    { label: "Certified on-chain", detail: formatDateTime(certificate.created_at), done: true },
    { label: "Verifiable publicly", detail: "Anyone can verify this certificate", done: true },
    {
      label: "Retired",
      detail: certificate.status === "retired" ? "Redeemed, can't be reused" : "Not yet retired",
      done: certificate.status === "retired",
    },
  ];

  return (
    <div className="glass glass-thin p-6">
      <p className="mb-6 text-xs tracking-wide text-recon-ink-dim">Lifecycle</p>
      <ol className="relative space-y-6 pl-8">
        <div className="absolute top-1 bottom-1 left-[11px] w-px bg-border" />
        {steps.map((step, i) => (
          <motion.li
            key={step.label}
            initial={{ opacity: 0, x: -10 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{ delay: i * 0.12, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="relative"
          >
            <span
              className={
                "absolute -left-8 flex h-6 w-6 items-center justify-center rounded-full border text-[11px] font-medium " +
                (step.done ? "border-gold bg-gold text-recon-gold-ink" : "border-border text-recon-ink-dim")
              }
            >
              {i + 1}
            </span>
            <p className="text-sm font-medium text-recon-ink">{step.label}</p>
            <p className="text-xs text-recon-ink-dim">{step.detail}</p>
          </motion.li>
        ))}
      </ol>
    </div>
  );
}
