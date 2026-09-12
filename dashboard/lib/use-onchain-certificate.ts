"use client";

import { useReadContracts } from "wagmi";
import {
  RECRegistryAbi,
  contractAddress,
  contractChainId,
  type OnChainCertificateRead,
} from "@/lib/contract";
import type { OnChainCertificate } from "@/lib/types";

export type VerificationStatus =
  | "unavailable" // no contract configured / no RPC — we simply can't check
  | "loading"
  | "error" // the read failed; not the same as a mismatch
  | "verified" // chain agrees with the API
  | "mismatch"; // chain disagrees — the interesting case

export type FieldCheck = {
  label: string;
  apiValue: string;
  chainValue: string;
  matches: boolean;
};

export type OnChainVerification = {
  status: VerificationStatus;
  checks: FieldCheck[];
  error?: string;
};

/**
 * Reads the certificate straight from the chain and diffs it against what the
 * API returned. A mismatch is surfaced rather than swallowed: it means the
 * off-chain database and the chain have diverged, which is exactly the failure
 * the on-chain registry exists to make visible.
 */
export function useOnChainCertificate(
  certificate: OnChainCertificate,
): OnChainVerification {
  const enabled = Boolean(contractAddress);

  const { data, isLoading, isError, error } = useReadContracts({
    contracts: [
      {
        address: contractAddress,
        abi: RECRegistryAbi,
        functionName: "getCertificate",
        args: [BigInt(certificate.token_id)],
        chainId: contractChainId,
      },
      {
        address: contractAddress,
        abi: RECRegistryAbi,
        functionName: "ownerOf",
        args: [BigInt(certificate.token_id)],
        chainId: contractChainId,
      },
    ],
    query: { enabled, staleTime: 30_000 },
  });

  if (!enabled) return { status: "unavailable", checks: [] };
  if (isLoading) return { status: "loading", checks: [] };

  const certResult = data?.[0];
  const ownerResult = data?.[1];

  if (isError || certResult?.status !== "success" || ownerResult?.status !== "success") {
    return {
      status: "error",
      checks: [],
      error:
        error?.message ??
        (certResult?.status === "failure"
          ? String(certResult.error?.message ?? "on-chain read reverted")
          : "on-chain read failed"),
    };
  }

  const onChain = certResult.result as unknown as OnChainCertificateRead;
  const onChainOwner = ownerResult.result as string;

  const checks: FieldCheck[] = [
    {
      label: "Plant ID",
      apiValue: certificate.plant_id,
      chainValue: onChain.plantId,
      matches: certificate.plant_id === onChain.plantId,
    },
    {
      label: "Energy (MWh)",
      apiValue: String(Math.round(certificate.energy_mwh)),
      chainValue: onChain.energyMWh.toString(),
      matches: BigInt(Math.round(certificate.energy_mwh)) === onChain.energyMWh,
    },
    {
      label: "Fraud score",
      apiValue: String(certificate.fraud_score),
      chainValue: onChain.fraudScore.toString(),
      matches: BigInt(certificate.fraud_score) === onChain.fraudScore,
    },
    {
      label: "Retired",
      apiValue: certificate.retired_on_chain ? "Yes" : "No",
      chainValue: onChain.retired ? "Yes" : "No",
      matches: certificate.retired_on_chain === onChain.retired,
    },
    {
      label: "Owner",
      apiValue: certificate.owner_address,
      chainValue: onChainOwner,
      matches:
        certificate.owner_address.toLowerCase() === onChainOwner.toLowerCase(),
    },
  ];

  return {
    status: checks.every((c) => c.matches) ? "verified" : "mismatch",
    checks,
  };
}
