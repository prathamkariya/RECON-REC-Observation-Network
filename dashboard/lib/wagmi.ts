import { createConfig, http } from "wagmi";
import { hardhat, sepolia } from "wagmi/chains";

// Read-only: used to verify certificates against the chain directly from the
// browser. No connector is configured — this app never asks anyone to connect
// a wallet to view or issue a certificate; the backend mints with its own
// authorized wallet.
//
// Both chains are registered so a local Hardhat deployment and a Sepolia one
// both work; the active one is resolved in lib/chain.ts.
export { activeChain } from "@/lib/chain";

export const wagmiConfig = createConfig({
  chains: [sepolia, hardhat],
  connectors: [],
  transports: {
    [sepolia.id]: http(process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL || undefined),
    [hardhat.id]: http(process.env.NEXT_PUBLIC_LOCAL_RPC_URL || "http://127.0.0.1:8545"),
  },
});
