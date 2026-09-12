import { createConfig, http } from "wagmi";
import { sepolia } from "wagmi/chains";

// Read-only: used only by the public /verify page for optional independent
// on-chain reads. No connector is configured — this app never asks anyone
// to connect a wallet to view or issue a certificate; the backend mints
// with its own authorized wallet.
export const wagmiConfig = createConfig({
  chains: [sepolia],
  connectors: [],
  transports: {
    [sepolia.id]: http(process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL),
  },
});
