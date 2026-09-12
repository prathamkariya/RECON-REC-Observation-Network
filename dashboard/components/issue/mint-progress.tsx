"use client";

import { motion } from "framer-motion";

/** A pulse traveling certificate -> chain, looping only while the real mint
 * request is in flight. Its duration is whatever the actual transaction
 * takes — this never resolves on a timer, only on the real response. */
export function MintProgress() {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-gold/40 bg-gold/10 text-lg">
        📜
      </div>
      <div className="relative h-px w-24 overflow-hidden bg-border">
        <motion.div
          className="absolute inset-y-0 w-8 bg-gradient-to-r from-transparent via-gold to-transparent"
          animate={{ x: ["-2rem", "8rem"] }}
          transition={{ duration: 1.1, repeat: Infinity, ease: "linear" }}
        />
      </div>
      <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-border bg-secondary text-lg">
        ⛓
      </div>
    </div>
  );
}
