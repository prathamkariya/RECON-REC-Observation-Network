"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useAuth } from "@/lib/auth-context";
import { StepIndicator } from "@/components/issue/step-indicator";
import { Step1GenerationForm } from "@/components/issue/step1-generation-form";
import { Step2Analysis } from "@/components/issue/step2-analysis";
import { Step3Mint } from "@/components/issue/step3-mint";
import { toIssueRequest, type GenerationFormValues } from "@/components/issue/schema";
import type { CertificateIssueRequest } from "@/lib/types";

export default function IssuePage() {
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [formValues, setFormValues] = useState<GenerationFormValues | undefined>();
  const [issueRequest, setIssueRequest] = useState<CertificateIssueRequest | null>(null);

  function handleStep1Submit(values: GenerationFormValues) {
    setFormValues(values);
    setIssueRequest(toIssueRequest(values, user?.email ?? "unknown-issuer"));
    setStep(2);
  }

  function restart() {
    setStep(1);
    setIssueRequest(null);
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Issue a certificate</h1>
        <p className="text-sm text-recon-ink-dim">
          Submit generation data, review the AI&apos;s fraud analysis, then mint on Sepolia.
        </p>
      </div>

      <StepIndicator current={step} />

      <AnimatePresence mode="wait">
        {step === 1 && (
          <motion.div key="step1" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <Step1GenerationForm defaultValues={formValues} onSubmit={handleStep1Submit} />
          </motion.div>
        )}

        {step === 2 && issueRequest && (
          <motion.div key="step2" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <Step2Analysis request={issueRequest} onComplete={() => setStep(3)} onBack={() => setStep(1)} />
          </motion.div>
        )}

        {step === 3 && issueRequest && (
          <motion.div key="step3" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <Step3Mint request={issueRequest} onBack={() => setStep(2)} onRestart={restart} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
