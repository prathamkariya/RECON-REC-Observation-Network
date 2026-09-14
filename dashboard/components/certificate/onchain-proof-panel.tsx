"use client";

import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { ExplorerLink } from "@/components/certificate/explorer-link";
import { chainName } from "@/lib/chain";
import { contractAddress } from "@/lib/contract";
import { useOnChainCertificate } from "@/lib/use-onchain-certificate";
import type { OnChainCertificate } from "@/lib/types";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-verified/15 py-2.5 text-sm last:border-0">
      <span className="text-recon-ink-dim">{label}</span>
      <span className="text-right text-recon-ink">{children}</span>
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
        Reading the contract directly from {chainName}…
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="mb-4 rounded-md bg-recon-ink/5 px-3 py-2 text-xs text-recon-ink-dim">
        Couldn&apos;t reach {chainName} to verify independently. The details below come from the registry API and haven&apos;t been
        re-checked against the chain.
        {error && <span className="mt-1 block opacity-60">{error}</span>}
      </div>
    );
  }

  if (status === "mismatch") {
    const failed = checks.filter((c) => !c.matches);
    return (
      <div className="mb-4 rounded-md border border-risk/20 bg-risk/[0.07] px-3 py-2 text-xs text-risk">
        <p className="flex items-center gap-2 font-medium">
          <AlertTriangle className="h-3.5 w-3.5" />
          On-chain data does not match our records
        </p>
        <ul className="mt-1.5 space-y-0.5">
          {failed.map((c) => (
            <li key={c.label}>
              {c.label}: chain says <strong>{c.chainValue}</strong>, we show <strong>{c.apiValue}</strong>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div className="mb-4 flex items-center gap-2 rounded-md bg-verified/10 px-3 py-2 text-xs text-verified">
      <CheckCircle2 className="h-3.5 w-3.5" />
      Verified directly against {chainName} — all {checks.length} fields match.
    </div>
  );
}

export function OnChainProofPanel({ certificate }: { certificate: OnChainCertificate }) {
  return (
    <div className="glass glass-verified cap-verified h-full p-6">
      <p className="label-caps mb-1 text-verified">Proven on-chain</p>
      <p className="mb-4 text-xs text-recon-ink-dim">The blockchain guarantees this generation record was certified exactly once.</p>

      <VerificationBanner certificate={certificate} />

      <Row label="Network">{chainName}</Row>
      <Row label="Token ID">#{certificate.token_id}</Row>
      <Row label="Owner">
        <ExplorerLink kind="address" value={certificate.owner_address} />
      </Row>
      {contractAddress && (
        <Row label="Contract">
          <ExplorerLink kind="address" value={contractAddress} />
        </Row>
      )}
      <Row label="Mint transaction">
        <ExplorerLink kind="tx" value={certificate.mint_tx_hash} />
      </Row>
      {certificate.retire_tx_hash && (
        <Row label="Retire transaction">
          <ExplorerLink kind="tx" value={certificate.retire_tx_hash} />
        </Row>
      )}
      <Row label="Retired on-chain">{certificate.retired_on_chain ? "Yes" : "No"}</Row>
    </div>
  );
}
