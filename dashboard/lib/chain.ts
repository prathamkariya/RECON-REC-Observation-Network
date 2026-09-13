import { hardhat, sepolia } from "wagmi/chains";
import { contractChainId } from "@/lib/contract";

/**
 * The chain this build verifies against, resolved from NEXT_PUBLIC_CHAIN_ID
 * (or the deployment artifact's default). Everything that names the network
 * or links to an explorer reads from here, so pointing a build at another
 * deployment never leaves a stale label behind.
 */
export const activeChain = contractChainId === hardhat.id ? hardhat : sepolia;

export const chainName = contractChainId === hardhat.id ? "Local chain" : activeChain.name;

const explorerBase = activeChain.blockExplorers?.default.url;

/** Explorer link for a transaction, or null when the chain has no public explorer (local node). */
export function explorerTxUrl(txHash: string): string | null {
  return explorerBase ? `${explorerBase}/tx/${txHash}` : null;
}

/** Explorer link for an address, or null when the chain has no public explorer (local node). */
export function explorerAddressUrl(address: string): string | null {
  return explorerBase ? `${explorerBase}/address/${address}` : null;
}
