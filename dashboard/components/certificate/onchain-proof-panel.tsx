"use client";

import { AlertTriangle, CheckCircle2, ExternalLink, Loader2 } from "lucide-react";
import { etherscanAddressUrl, etherscanTxUrl, truncateAddress, truncateHash } from "@/lib/format";
import { contractAddress } from "@/lib/contract";
import { useOnChainCertificate } from "@/lib/use-onchain-certificate";
import { activeChain } from "@/lib/wagmi";
import type { OnChainCertificate } from "@/lib/types";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b border-verified/15 py-2.5 text-sm last:border-0">
      <span className="text-recon-ink-dim">{label}</span>
      <span className="text-recon-ink">{children}</span>
    </div>
  );
}

/**
 * Independent verification banner. The rows below it come from our API; this
 * banner comes from reading the contract directly in the visitor's browser, so
 * it's the only part of the page that isn't just us repeating ourselves.
 */
function VerificationBanner({ certificate }: { certificate: OnChainCertificate }) {
  const { status, checks, error } = useOnChainCertificate(certificate);

  if (status === "unavailable") return null;

  if (status === "loading") {
    return (
      <div className="mb-4 flex items-center gap-2 rounded-md bg-verified/10 px-3 py-2 text-xs text-recon-ink-dim">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Reading the contract directly from {activeChain.name}…
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="mb-4 rounded-md bg-recon-ink/5 px-3 py-2 text-xs text-recon-ink-dim">
        Couldn&apos;t reach {activeChain.name} to verify independently. The details below are
        from the RECON API and have not been re-checked against the chain.
        {error && <span className="mt-1 block opacity-60">{error}</span>}
      </div>
    );
  }

  if (status === "mismatch") {
    const failed = checks.filter((c) => !c.matches);
    return (
      <div className="mb-4 rounded-md bg-red-500/10 px-3 py-2 text-xs text-red-300">
        <p className="flex items-center gap-2 font-medium">
          <AlertTriangle className="h-3.5 w-3.5" />
          On-chain data does not match our records
        </p>
        <ul className="mt-1.5 space-y-0.5">
          {failed.map((c) => (
            <li key={c.label}>
              {c.label}: chain says <strong>{c.chainValue}</strong>, we show{" "}
              <strong>{c.apiValue}</strong>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div className="mb-4 flex items-center gap-2 rounded-md bg-verified/10 px-3 py-2 text-xs text-verified">
      <CheckCircle2 className="h-3.5 w-3.5" />
      Verified independently against {activeChain.name} — all {checks.length} fields match.
    </div>
  );
}

export function OnChainProofPanel({ certificate }: { certificate: OnChainCertificate }) {
  return (
    <div className="glass glass-verified glass-thick p-6">
      <p className="mb-1 text-xs tracking-wide text-verified">Proven on-chain</p>
      <p className="mb-4 text-xs text-recon-ink-dim">
        Only this section is guaranteed by the blockchain — the uniqueness of this generation record.
      </p>

      <VerificationBanner certificate={certificate} />

      <Row label="Network">{activeChain.name}</Row>
      <Row label="Token ID">#{certificate.token_id}</Row>
      <Row label="Owner">
        <a
          href={etherscanAddressUrl(certificate.owner_address)}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1 hover:text-verified"
        >
          {truncateAddress(certificate.owner_address)}
          <ExternalLink className="h-3 w-3" />
        </a>
      </Row>
      {contractAddress && (
        <Row label="Contract">
          <a
            href={etherscanAddressUrl(contractAddress)}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 hover:text-verified"
          >
            {truncateAddress(contractAddress)}
            <ExternalLink className="h-3 w-3" />
          </a>
        </Row>
      )}
      <Row label="Mint transaction">
        <a
          href={etherscanTxUrl(certificate.mint_tx_hash)}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1 hover:text-verified"
        >
          {truncateHash(certificate.mint_tx_hash)}
          <ExternalLink className="h-3 w-3" />
        </a>
      </Row>
      <Row label="Retired on-chain">{certificate.retired_on_chain ? "Yes" : "No"}</Row>
    </div>
  );
}
