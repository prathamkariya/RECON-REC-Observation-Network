/**
 * Direct, read-only access to the RECRegistry contract from the browser.
 *
 * The point is independence: the certificate detail page already has every
 * field from our own API, so re-reading it from the API proves nothing. These
 * reads go straight to a public node, so a visitor can see that the chain
 * agrees with what we told them — and see it disagree if it ever doesn't.
 *
 * contract-artifact.json is written by contracts/scripts/deploy.js and holds a
 * deployment per chain id, so local and Sepolia coexist. Never edit it by
 * hand; a stale address or ABI means silent verification failures.
 */
import artifact from "./contract-artifact.json";

export const RECRegistryAbi = artifact.abi;

type Deployment = {
  address: string;
  network: string;
  chainId: number;
  deployTxHash: string;
  deployedAt: string;
};

const deployments = artifact.deployments as Record<string, Deployment>;

/** Which chain the UI verifies against. NEXT_PUBLIC_CHAIN_ID wins so one build
 *  can be pointed at a different deployment without regenerating the artifact. */
export const contractChainId = Number(
  process.env.NEXT_PUBLIC_CHAIN_ID || artifact.defaultChainId,
);

export const deployment: Deployment | undefined =
  deployments[String(contractChainId)];

/** Env var wins so a deployed frontend can point at a different instance than
 *  whatever was last deployed; the artifact is the zero-config default. */
export const contractAddress = (process.env.NEXT_PUBLIC_CONTRACT_ADDRESS ||
  deployment?.address) as `0x${string}` | undefined;

export type OnChainCertificateRead = {
  plantId: string;
  energyMWh: bigint;
  generationTimestamp: bigint;
  fraudScore: bigint;
  retired: boolean;
};
