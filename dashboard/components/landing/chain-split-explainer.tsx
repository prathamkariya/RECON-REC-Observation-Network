"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Database, Link2 } from "lucide-react";
import { chainName } from "@/lib/chain";

export function ChainSplitExplainer() {
  const reduce = useReducedMotion();
  return (
    <section className="mx-auto max-w-6xl px-4 py-24 sm:px-6 sm:py-28">
      <div className="mb-12 text-center">
        <p className="label-caps text-gold">The one idea that matters</p>
        <h2 className="font-display mx-auto mt-3 max-w-3xl text-[34px] leading-[1.08] font-bold tracking-[-0.03em] text-recon-ink sm:text-5xl">
          The blockchain proves one thing. <span className="text-recon-steel">The database explains everything else.</span>
        </h2>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 32, filter: "blur(6px)" }}
          whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="glass glass-verified cap-verified rounded-[28px] p-7 sm:p-9"
        >
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-verified/12 text-verified">
            <Link2 className="h-6 w-6" />
          </span>
          <p className="label-caps mt-6 text-verified">On-chain · {chainName} · ERC-721</p>
          <p className="font-display mt-2 text-2xl font-bold text-recon-ink">Proven uniqueness</p>
          <p className="mt-3 text-[15px] leading-7 text-recon-ink-dim">
            This exact generation record — this plant, this energy amount, this timestamp — has never been minted into a certificate
            before. Nothing else. The contract enforces it unconditionally; no one, including us, can override it.
          </p>
          <p className="mono-micro mt-6 rounded-xl border border-white/80 bg-white/55 px-3 py-2 break-all text-recon-ink-soft">
            require(!isRecordUsed(plantId, energyMWh, generationTimestamp))
          </p>
        </motion.div>

        <motion.div
          initial={reduce ? false : { opacity: 0, y: 32, filter: "blur(6px)" }}
          whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.8, delay: 0.12, ease: [0.16, 1, 0.3, 1] }}
          className="glass glass-medium cap-ink rounded-[28px] p-7 sm:p-9"
        >
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-recon-ink/[0.07] text-recon-ink">
            <Database className="h-6 w-6" />
          </span>
          <p className="label-caps mt-6 text-recon-steel">Off-chain · explainable</p>
          <p className="font-display mt-2 text-2xl font-bold text-recon-ink">Explained evidence</p>
          <p className="mt-3 text-[15px] leading-7 text-recon-ink-dim">
            Plant details, the fraud score and the reasoning behind it live in a database, not the chain — because that data needs to be
            readable, queryable and correctable, not just tamper-proof. Only the uniqueness claim needed a blockchain.
          </p>
          <p className="mono-micro mt-6 rounded-xl border border-white/80 bg-white/55 px-3 py-2 break-all text-recon-ink-soft">
            {"{ fraud_score, risk_reasons, explanation, raw_record }"}
          </p>
        </motion.div>
      </div>
    </section>
  );
}
