require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

// Sepolia config is optional — the local flow needs no env vars at all.
// Credentials live in contracts/.env (gitignored), never in this file.
const SEPOLIA_RPC_URL = process.env.SEPOLIA_RPC_URL || "";
const DEPLOYER_PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY || "";
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY || "";

module.exports = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: { enabled: true, runs: 200 },
    },
  },
  networks: {
    // `npx hardhat node` serves this; matches the backend's default RPC_URL.
    localhost: {
      url: "http://127.0.0.1:8545",
    },
    ...(SEPOLIA_RPC_URL && DEPLOYER_PRIVATE_KEY
      ? {
          sepolia: {
            url: SEPOLIA_RPC_URL,
            accounts: [DEPLOYER_PRIVATE_KEY],
            chainId: 11155111,
          },
        }
      : {}),
  },
  // Etherscan API v2 takes one key for all networks; the per-network map is
  // the deprecated v1 shape and is rejected outright.
  etherscan: {
    apiKey: ETHERSCAN_API_KEY,
  },
  sourcify: { enabled: false },
  paths: {
    sources: "./contracts",
    tests: "./test",
    artifacts: "./artifacts",
  },
};
