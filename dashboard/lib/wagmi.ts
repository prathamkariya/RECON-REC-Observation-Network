import { createConfig, http } from "wagmi";
import { hardhat, sepolia } from "wagmi/chains";
import { contractChainId } from "@/lib/contract";

// Read-only: used to verify certificates against the chain directly from the
// browser. No connector is configured — this app never asks anyone to connect
// a wallet to view or issue a certificate; the backend mints with its own
// authorized wallet.
//
// Both chains are registered so a local Hardhat deployment and a Sepolia one
// both work without a rebuild; the active one is whichever chain id the
// deployed artifact (or NEXT_PUBLIC_CHAIN_ID) names.
export const activeChain = contractChainId === hardhat.id ? hardhat : sepolia;

export const wagmiConfig = createConfig({
  chains: [sepolia, hardhat],
  connectors: [],
  transports: {
    [sepolia.id]: http(process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL),
    [hardhat.id]: http(process.env.NEXT_PUBLIC_LOCAL_RPC_URL || "http://127.0.0.1:8545"),
  },
});
