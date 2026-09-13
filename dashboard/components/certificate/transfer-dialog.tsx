"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { ApiError } from "@/lib/api-error";
import { logActivity } from "@/lib/activity-log";
import { truncateAddress } from "@/lib/format";

const ADDRESS_PATTERN = /^0x[a-fA-F0-9]{40}$/;

/**
 * Transfers the certificate NFT to another wallet.
 *
 * Retired certificates are refused by the contract, so this is only offered
 * while the certificate is still live — but the 409 is still handled, because
 * someone else could retire it between this page loading and the click.
 */
export function TransferButton({ onClick }: { onClick: () => void }) {
  return (
    <Button variant="outline" onClick={onClick}>
      <Send className="mr-2 h-3.5 w-3.5" />
      Transfer
    </Button>
  );
}

export function TransferPanel({ tokenId, onClose }: { tokenId: number; onClose: () => void }) {
  const [address, setAddress] = useState("");
  const queryClient = useQueryClient();

  const isValid = ADDRESS_PATTERN.test(address.trim());

  const mutation = useMutation({
    mutationFn: () => api.transferCertificate(tokenId, address.trim()),
    onSuccess: (result) => {
      logActivity({
        type: "transferred",
        tokenId,
        message: `Certificate #${tokenId} transferred to ${truncateAddress(result.owner_address)}`,
      });
      queryClient.invalidateQueries({ queryKey: ["certificate", tokenId] });
      queryClient.invalidateQueries({ queryKey: ["certificates"] });
      setAddress("");
    },
  });

  function errorMessage(error: unknown): string {
    if (error instanceof ApiError) {
      if (error.status === 409) return "This certificate is retired and can no longer be transferred.";
      if (error.status === 403) return "The platform wallet doesn't hold this certificate, so it can't sign the transfer. The current owner must transfer it from their own wallet.";
      if (error.status === 404) return "This certificate no longer exists on-chain.";
    }
    return error instanceof Error ? error.message : "Transfer failed.";
  }

  return (
    <div className="glass glass-thin space-y-3 p-4">
      <label htmlFor="transfer-address" className="label-caps block text-recon-steel">
        Recipient wallet address
      </label>
      <input
        id="transfer-address"
        value={address}
        onChange={(event) => setAddress(event.target.value)}
        placeholder="0x…"
        spellCheck={false}
        autoComplete="off"
        className="w-full rounded-lg border border-recon-ink/15 bg-white/70 px-3 py-2 font-mono text-sm text-recon-ink outline-none focus:border-gold focus:ring-2 focus:ring-gold/15"
      />
      {address.length > 0 && !isValid && (
        <p className="text-xs text-risk">That isn&apos;t a valid wallet address (0x followed by 40 hex characters).</p>
      )}

      <p className="text-xs text-recon-ink-dim">
        Transfers are final and recorded on-chain. The new owner becomes the only account able to retire this certificate.
      </p>

      <div className="flex gap-2">
        <Button onClick={() => mutation.mutate()} disabled={!isValid || mutation.isPending}>
          {mutation.isPending ? "Transferring…" : "Confirm transfer"}
        </Button>
        <Button variant="ghost" onClick={onClose} disabled={mutation.isPending}>
          Cancel
        </Button>
      </div>

      {mutation.isError && (
        <p className="flex items-start gap-2 text-sm text-risk">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          {errorMessage(mutation.error)}
        </p>
      )}
      {mutation.isSuccess && (
        <p className="flex items-center gap-2 text-sm text-verified">
          <CheckCircle2 className="h-4 w-4" />
          Transferred to {truncateAddress(mutation.data.owner_address)}.
        </p>
      )}
    </div>
  );
}
