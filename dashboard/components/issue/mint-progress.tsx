"use client";

import { motion } from "framer-motion";
import { Blocks, FileBadge2 } from "lucide-react";

/** A pulse traveling certificate -> chain, looping only while the real mint
 * request is in flight. Its duration is whatever the actual transaction
 * takes — this never resolves on a timer, only on the real response. */
export function MintProgress() {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-gold/25 bg-gold/10 text-gold shadow-[inset_0_1px_0_#fff]">
        <FileBadge2 className="h-5 w-5" aria-hidden />
      </div>
      <div className="relative h-0.5 w-24 overflow-hidden rounded-full bg-recon-ink/10">
        <motion.div
          className="absolute inset-y-0 w-8 bg-gradient-to-r from-transparent via-gold to-transparent"
          animate={{ x: ["-2rem", "8rem"] }}
          transition={{ duration: 1.1, repeat: Infinity, ease: "linear" }}
        />
      </div>
      <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-recon-ink/10 bg-white/70 text-recon-ink shadow-[inset_0_1px_0_#fff]">
        <Blocks className="h-5 w-5" aria-hidden />
      </div>
    </div>
  );
}
