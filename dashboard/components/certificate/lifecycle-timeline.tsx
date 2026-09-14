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
    <div className="glass glass-medium h-full p-6">
      <p className="label-caps mb-6 text-recon-steel">Lifecycle</p>
      {/* The rail is a pseudo-element: a <div> isn't a valid child of <ol>. */}
      <ol className="relative space-y-6 pl-8 before:absolute before:top-1 before:bottom-1 before:left-[11px] before:w-px before:bg-recon-ink/10">
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
                (step.done ? "border-gold bg-gold text-recon-gold-ink shadow-[0_4px_10px_-4px_rgba(60,100,80,0.6)]" : "border-recon-ink/15 bg-white/70 text-recon-ink-dim")
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
