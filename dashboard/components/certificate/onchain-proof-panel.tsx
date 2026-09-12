import { ExternalLink } from "lucide-react";
import { etherscanAddressUrl, etherscanTxUrl, truncateAddress, truncateHash } from "@/lib/format";
import type { OnChainCertificate } from "@/lib/types";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b border-verified/15 py-2.5 text-sm last:border-0">
      <span className="text-recon-ink-dim">{label}</span>
      <span className="text-recon-ink">{children}</span>
    </div>
  );
}

export function OnChainProofPanel({ certificate }: { certificate: OnChainCertificate }) {
  const contractAddress = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS;

  return (
    <div className="glass glass-verified glass-thick p-6">
      <p className="mb-1 text-xs tracking-wide text-verified">Proven on-chain</p>
      <p className="mb-4 text-xs text-recon-ink-dim">
        Only this section is guaranteed by the blockchain — the uniqueness of this generation record.
      </p>

      <Row label="Network">Ethereum Sepolia</Row>
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
