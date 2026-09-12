"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import { ApiError } from "@/lib/api-error";
import { VerifyResult } from "@/components/verify/verify-result";

export default function VerifyPage() {
  const [tokenIdInput, setTokenIdInput] = useState("");
  const mutation = useMutation({
    mutationFn: (tokenId: number) => api.verifyCertificate(tokenId),
  });

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const tokenId = Number(tokenIdInput);
    if (Number.isFinite(tokenId)) mutation.mutate(tokenId);
  }

  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-4xl items-center justify-between px-6 py-6">
        <Link href="/" className="font-display text-lg font-semibold tracking-tight">
          Recon
        </Link>
        <Link href="/signin" className="text-sm text-recon-ink-dim hover:text-gold">
          Sign in
        </Link>
      </header>

      <main className="mx-auto max-w-4xl space-y-8 px-6 pb-24">
        <div className="space-y-2 text-center">
          <h1 className="text-3xl font-semibold">Verify a certificate</h1>
          <p className="text-sm text-recon-ink-dim">
            Enter a certificate&apos;s token ID. No account needed — this checks the chain directly.
          </p>
        </div>

        <form onSubmit={onSubmit} className="mx-auto flex max-w-sm items-end gap-2">
          <div className="flex-1 space-y-1.5">
            <Label htmlFor="tokenId">Token ID</Label>
            <Input
              id="tokenId"
              inputMode="numeric"
              placeholder="0"
              value={tokenIdInput}
              onChange={(e) => setTokenIdInput(e.target.value)}
            />
          </div>
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? "Checking…" : "Verify"}
          </Button>
        </form>

        {mutation.isSuccess && <VerifyResult certificate={mutation.data} />}

        {mutation.isError && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass glass-thin mx-auto flex max-w-md flex-col items-center gap-3 p-8 text-center"
          >
            <SearchX className="h-7 w-7 text-recon-ink-dim" />
            <p className="font-medium">
              {mutation.error instanceof ApiError && mutation.error.isNotFound
                ? "No certificate found for that token ID."
                : "Couldn't verify that certificate."}
            </p>
            <p className="text-sm text-recon-ink-dim">
              Double-check the token ID, or ask the issuer for the certificate link.
            </p>
          </motion.div>
        )}
      </main>
    </div>
  );
}
