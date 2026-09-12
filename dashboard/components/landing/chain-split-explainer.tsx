"use client";

import { motion } from "framer-motion";
import { Database, Link2 } from "lucide-react";

export function ChainSplitExplainer() {
  return (
    <section className="mx-auto max-w-4xl px-6 py-24">
      <div className="mb-12 text-center">
        <p className="text-xs tracking-wide text-recon-ink-dim">The one idea that matters</p>
        <h2 className="font-display mt-2 text-3xl font-semibold sm:text-4xl">
          The blockchain proves one thing. The database explains everything else.
        </h2>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.4 }}
          className="glass glass-verified p-6"
        >
          <Link2 className="h-6 w-6 text-verified" />
          <p className="mt-3 font-medium text-recon-ink">Proven on-chain</p>
          <p className="mt-1 text-sm text-recon-ink-dim">
            This exact generation record -- this plant, this energy amount, this timestamp -- has never been
            minted into a certificate before. Nothing else. The contract enforces it unconditionally; no one,
            including us, can override it.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16, filter: "blur(4px)" }}
          whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.5, delay: 0.15 }}
          className="glass glass-gold p-6"
        >
          <Database className="h-6 w-6 text-gold" />
          <p className="mt-3 font-medium text-recon-ink">Explained off-chain</p>
          <p className="mt-1 text-sm text-recon-ink-dim">
            Plant details, the fraud score, and the AI&apos;s reasoning live in a database, not the chain --
            because that data needs to be readable, queryable, and correctable, not just tamper-proof. Only
            the uniqueness claim needed a blockchain.
          </p>
        </motion.div>
      </div>
    </section>
  );
}
