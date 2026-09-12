"use client";

import { useEffect, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import Link from "next/link";
import { AlertOctagon, CheckCircle2, Copy, ExternalLink } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { api } from "@/lib/api";
import { ApiError } from "@/lib/api-error";
import { logActivity } from "@/lib/activity-log";
import { etherscanTxUrl, formatDateTime, formatMwh, truncateHash } from "@/lib/format";
import type { CertificateIssueRequest } from "@/lib/types";
import { MintProgress } from "@/components/issue/mint-progress";

export function Step3Mint({
  request,
  onBack,
  onRestart,
}: {
  request: CertificateIssueRequest;
  onBack: () => void;
  onRestart: () => void;
}) {
  const requestKey = useRef<string | null>(null);
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: () => api.issueCertificate(request),
    onSuccess: (result) => {
      logActivity({
        type: "minted",
        tokenId: result.token_id,
        plantId: result.plant_id,
        message: `Certificate #${result.token_id} minted for ${result.plant_id}`,
      });
      queryClient.invalidateQueries({ queryKey: ["certificates"] });
    },
    onError: (error) => {
      if (error instanceof ApiError && error.isDuplicate) {
        logActivity({
          type: "duplicate_rejected",
          plantId: request.plant.id,
          message: `Duplicate rejected on-chain: ${request.plant.id} · ${formatMwh(request.generation.mwh_claimed)}`,
        });
      }
    },
  });

  useEffect(() => {
    const key = JSON.stringify(request);
    if (requestKey.current === key) return;
    requestKey.current = key;
    mutation.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request]);

  if (mutation.isPending || mutation.isIdle) {
    return (
      <div className="glass glass-gold flex flex-col items-center gap-6 p-12 text-center">
        <MintProgress />
        <div>
          <p className="font-medium text-recon-ink">Submitting to Sepolia…</p>
          <p className="text-sm text-recon-ink-dim">
            Signing the mint transaction and waiting for it to confirm. This usually takes a few seconds.
          </p>
        </div>
      </div>
    );
  }

  // ---- The duplicate-rejection moment ----------------------------------
  if (mutation.isError && mutation.error instanceof ApiError && mutation.error.isDuplicate) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.35 }}
        className="glass glass-risk p-8"
      >
        <div className="flex items-start gap-4">
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.1, type: "spring", stiffness: 300, damping: 18 }}
          >
            <AlertOctagon className="h-9 w-9 text-risk" />
          </motion.div>
          <div className="space-y-3">
            <div>
              <p className="font-display text-2xl font-semibold text-recon-ink">Already certified</p>
              <p className="mt-1 text-sm text-recon-ink-dim">
                The smart contract rejected this mint on-chain — not our server, the contract itself.
              </p>
            </div>

            <div className="rounded-lg border border-risk/30 bg-risk/5 p-4 text-sm">
              <p className="text-recon-ink">
                This exact generation record has already been certified:
              </p>
              <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs text-recon-ink-dim">
                <dt>Plant</dt>
                <dd className="text-recon-ink">{request.plant.id}</dd>
                <dt>Energy</dt>
                <dd className="text-recon-ink">{formatMwh(request.generation.mwh_claimed)}</dd>
                <dt>Generation time</dt>
                <dd className="text-recon-ink">{formatDateTime(request.generation.start)}</dd>
              </dl>
            </div>

            <p className="text-sm text-recon-ink-dim">
              This is the one rule the blockchain enforces: the same (plant, energy, timestamp) triple
              can never be minted into more than one certificate. Someone already holds this one.
            </p>

            <div className="flex gap-3 pt-2">
              <Button variant="outline" onClick={onBack}>
                Back
              </Button>
              <Button onClick={onRestart}>Try different generation data</Button>
            </div>
          </div>
        </div>
      </motion.div>
    );
  }

  if (mutation.isError) {
    const message = mutation.error instanceof Error ? mutation.error.message : "Minting failed.";
    return (
      <div className="glass glass-risk flex flex-col items-center gap-4 p-12 text-center">
        <AlertOctagon className="h-6 w-6 text-risk" />
        <p className="text-sm text-recon-ink">{message}</p>
        <div className="flex gap-3">
          <Button variant="outline" onClick={onBack}>
            Back
          </Button>
          <Button onClick={() => mutation.mutate()}>Try again</Button>
        </div>
      </div>
    );
  }

  const result = mutation.data;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass glass-verified p-8 text-center"
    >
      <motion.div
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 16 }}
        className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-verified/15"
      >
        <CheckCircle2 className="h-8 w-8 text-verified" />
      </motion.div>

      <p className="mt-4 font-display text-2xl font-semibold">Certificate minted</p>
      <p className="mt-1 font-display text-4xl font-semibold text-gold">#{result.token_id}</p>

      <div className="mx-auto mt-6 max-w-sm space-y-2 text-left text-sm">
        <div className="flex items-center justify-between">
          <span className="text-recon-ink-dim">Transaction</span>
          <a
            href={etherscanTxUrl(result.tx_hash)}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 text-verified hover:underline"
          >
            {truncateHash(result.tx_hash)}
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
        <button
          type="button"
          onClick={() => navigator.clipboard?.writeText(result.tx_hash)}
          className="flex items-center gap-1 text-xs text-recon-ink-dim hover:text-recon-ink"
        >
          <Copy className="h-3 w-3" /> Copy full hash
        </button>
      </div>

      <div className="mt-8 flex justify-center gap-3">
        <Button variant="outline" onClick={onRestart}>
          Issue another
        </Button>
        <Link href={`/certificates/${result.token_id}`} className={buttonVariants({})}>
          View certificate
        </Link>
      </div>
    </motion.div>
  );
}
