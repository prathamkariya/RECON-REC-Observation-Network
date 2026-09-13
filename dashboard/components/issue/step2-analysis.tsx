"use client";

import { useEffect, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import type { CertificateAnalyzeResponse, CertificateIssueRequest } from "@/lib/types";
import { riskLevel } from "@/lib/types";
import { FraudGauge } from "@/components/issue/fraud-gauge";
import { cn } from "cn";

export function Step2Analysis({
  request,
  onComplete,
  onBack,
}: {
  request: CertificateIssueRequest;
  onComplete: (result: CertificateAnalyzeResponse) => void;
  onBack: () => void;
}) {
  const requestKey = useRef<string | null>(null);
  const mutation = useMutation({
    mutationFn: () => api.analyzeCertificate(request),
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
      <div className="glass glass-thin flex flex-col items-center gap-4 p-12 text-center">
        <Loader2 className="h-6 w-6 animate-spin text-gold" />
        <p className="text-sm text-recon-ink-dim">Running fraud analysis against generation history and physical plausibility checks…</p>
      </div>
    );
  }

  if (mutation.isError) {
    return (
      <div className="glass glass-risk flex flex-col items-center gap-4 p-12 text-center">
        <AlertTriangle className="h-6 w-6 text-risk" />
        <p className="text-sm text-recon-ink">
          {mutation.error instanceof Error ? mutation.error.message : "Analysis failed."}
        </p>
        <Button variant="outline" onClick={() => mutation.mutate()}>
          Try again
        </Button>
      </div>
    );
  }

  const result = mutation.data;
  const level = riskLevel(result.fraud_score);

  return (
    <div
      className={cn(
        "glass p-8",
        level === "high" ? "glass-risk" : level === "low" ? "glass-verified" : "glass-gold",
      )}
    >
      <div className="grid gap-8 sm:grid-cols-[auto_1fr] sm:items-center">
        <FraudGauge score={result.fraud_score} />

        <div className="space-y-3">
          <p className="text-xs tracking-wide text-recon-ink-dim">Reasoning</p>
          {result.risk_reasons.length === 0 ? (
            <motion.p
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="flex items-center gap-2 text-sm text-verified"
            >
              <CheckCircle2 className="h-4 w-4" /> No fraud indicators found.
            </motion.p>
          ) : (
            <ul className="space-y-2">
              {result.risk_reasons.map((reason, i) => (
                <motion.li
                  key={reason}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 + i * 0.35, duration: 0.4 }}
                  className="flex items-start gap-2 text-sm text-recon-ink"
                >
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-risk" />
                  {reason}
                </motion.li>
              ))}
            </ul>
          )}

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 + result.risk_reasons.length * 0.35 }}
            className="pt-1 text-sm text-recon-ink-dim"
          >
            {result.explanation}
          </motion.p>
        </div>
      </div>

      <div className="mt-8 flex items-center justify-between border-t border-border pt-6">
        <Button variant="ghost" onClick={onBack}>
          Back
        </Button>
        <Button onClick={() => onComplete(result)}>
          {level === "high" ? "Mint anyway" : "Continue to mint"}
        </Button>
      </div>
    </div>
  );
}
