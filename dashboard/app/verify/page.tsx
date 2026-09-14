"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { ArrowRight, Link2, ScanSearch, SearchX, ShieldCheck } from "lucide-react";
import { api } from "@/lib/api";
import { ApiError } from "@/lib/api-error";
import { VerifyResult } from "@/components/verify/verify-result";
import { PublicHeader } from "@/components/landing/public-header";
import { SiteFooter } from "@/components/landing/cta-band";
import { LiquidBackground } from "@/components/brand/liquid-background";

export default function VerifyPage() {
  const [tokenIdInput, setTokenIdInput] = useState("");
  const mutation = useMutation({
    mutationFn: (tokenId: number) => api.verifyCertificate(tokenId),
  });

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const tokenId = Number(tokenIdInput.trim().replace(/^rec-?0*/i, "") || "0");
    if (Number.isFinite(tokenId)) mutation.mutate(tokenId);
  }

  return (
    <div className="relative min-h-screen overflow-x-clip">
      <LiquidBackground variant="hero" />
      <PublicHeader current="verify" />

      <main className="mx-auto max-w-5xl space-y-10 px-4 pt-32 pb-24 sm:px-6 sm:pt-40">
        <motion.div
          initial={{ opacity: 0, y: 16, filter: "blur(6px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="space-y-4 text-center"
        >
          <p className="label-caps inline-flex items-center gap-2 rounded-full border border-white/80 bg-white/55 px-3 py-1.5 text-gold backdrop-blur">
            <ShieldCheck className="h-3.5 w-3.5" /> Public verification · no account needed
          </p>
          <h1 className="font-display text-[40px] leading-[1.05] font-bold tracking-[-0.03em] text-recon-ink sm:text-6xl">Verify a certificate.</h1>
          <p className="mx-auto max-w-xl text-[16px] leading-7 text-recon-ink-dim">
            Enter a certificate&apos;s token ID. The chain is read directly for proof of uniqueness; the database supplies the reasoning behind
            its score.
          </p>
        </motion.div>

        <motion.form
          onSubmit={onSubmit}
          initial={{ opacity: 0, y: 20, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.12, ease: [0.16, 1, 0.3, 1] }}
          className="glass glass-medium mx-auto flex max-w-xl flex-col gap-2 rounded-[22px] p-2 sm:flex-row"
        >
          <label htmlFor="tokenId" className="flex h-14 flex-1 items-center gap-3 rounded-2xl bg-white/60 px-4 shadow-[inset_0_1px_0_#fff]">
            <ScanSearch className="h-5 w-5 shrink-0 text-gold" />
            <span className="sr-only">Token ID</span>
            <span className="mono-data text-recon-steel">REC-</span>
            <input
              id="tokenId"
              inputMode="numeric"
              placeholder="00021"
              value={tokenIdInput}
              onChange={(e) => setTokenIdInput(e.target.value)}
              className="mono-data min-w-0 flex-1 bg-transparent !text-[18px] text-recon-ink outline-none placeholder:text-recon-titanium"
            />
          </label>
          <button
            type="submit"
            disabled={mutation.isPending}
            className="sheen group inline-flex h-14 items-center justify-center gap-2 rounded-2xl bg-recon-forest px-6 text-[15px] font-semibold text-white transition-colors hover:bg-[#1b4332] disabled:opacity-60"
          >
            {mutation.isPending ? "Reading chain…" : "Verify"}
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            <span className="sheen-bar" />
          </button>
        </motion.form>

        {!mutation.isSuccess && !mutation.isError && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4, duration: 0.8 }}
            className="mx-auto grid max-w-3xl gap-3 sm:grid-cols-3"
          >
            {[
              { icon: Link2, title: "Proven on-chain", body: "The token exists and its generation record was never minted before." },
              { icon: ScanSearch, title: "Explained off-chain", body: "Fraud score, reasons and plant data, straight from the registry." },
              { icon: ShieldCheck, title: "Retirement status", body: "Whether the certificate is still active or already consumed." },
            ].map(({ icon: Icon, title, body }) => (
              <div key={title} className="glass glass-thin rounded-2xl p-4">
                <Icon className="h-5 w-5 text-gold" />
                <p className="mt-3 text-sm font-semibold text-recon-ink">{title}</p>
                <p className="mt-1 text-[13px] leading-5 text-recon-ink-dim">{body}</p>
              </div>
            ))}
          </motion.div>
        )}

        {mutation.isSuccess && <VerifyResult certificate={mutation.data} />}

        {mutation.isError && (
          <motion.div
            role="alert"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass glass-medium cap-risk mx-auto flex max-w-md flex-col items-center gap-3 rounded-2xl p-8 text-center"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-risk/10 text-risk">
              <SearchX className="h-6 w-6" />
            </span>
            <p className="font-semibold text-recon-ink">
              {mutation.error instanceof ApiError && mutation.error.isNotFound ? "No certificate found for that token ID." : "Couldn't verify that certificate."}
            </p>
            <p className="text-sm text-recon-ink-dim">Double-check the token ID, or ask the issuer for the certificate link.</p>
          </motion.div>
        )}
      </main>

      <SiteFooter />
    </div>
  );
}
