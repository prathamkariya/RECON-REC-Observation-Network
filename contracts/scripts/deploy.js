/**
 * Deploys RECRegistry and syncs the artifacts the backend and dashboard read.
 *
 * Those artifacts used to be hand-written, which meant a signature drift
 * between the deployed contract and the app surfaced only as a runtime
 * failure. They're generated now, and carry a `deployments` map keyed by chain
 * id rather than one address — so a local Hardhat deployment and a Sepolia one
 * coexist, and deploying to one never points the other at the wrong chain.
 * The app picks the entry matching the chain it's actually connected to.
 */
const fs = require("fs");
const path = require("path");
const hre = require("hardhat");

const REPO = path.join(__dirname, "..", "..");
// Overridable so the Docker chain container can publish its artifact into a
// shared volume the backend reads, instead of into a repo path that doesn't
// exist inside the image.
const BACKEND_ARTIFACT =
  process.env.BACKEND_ARTIFACT_PATH ||
  path.join(REPO, "backend", "app", "contracts", "RECRegistry.json");
const DASHBOARD_ARTIFACT =
  process.env.DASHBOARD_ARTIFACT_PATH ||
  path.join(REPO, "dashboard", "lib", "contract-artifact.json");

// Only the read functions the dashboard calls — it never writes.
const DASHBOARD_FUNCTIONS = [
  "getCertificate", "ownerOf", "isRecordUsed", "name", "symbol", "totalSupply",
];

function readExisting(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return {};
  }
}

const LOCAL_CHAIN_IDS = [31337];

function writeArtifact(file, abi, deployment, chainId) {
  const existing = readExisting(file);
  const deployments = { ...(existing.deployments || {}), [chainId]: deployment };

  // The chain used when nothing else says otherwise. A public deployment is
  // the better default for a shared build, so re-deploying locally must not
  // demote it — otherwise every local iteration silently points the dashboard
  // away from the demo chain. Connecting to a local node still wins at
  // runtime, because the address is resolved by *connected* chain id.
  const publicChainIds = Object.keys(deployments)
    .map(Number)
    .filter((id) => !LOCAL_CHAIN_IDS.includes(id));
  const defaultChainId =
    LOCAL_CHAIN_IDS.includes(chainId) && publicChainIds.length > 0
      ? publicChainIds[publicChainIds.length - 1]
      : chainId;

  const payload = {
    contractName: "RECRegistry",
    defaultChainId,
    deployments,
    abi,
  };
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(payload, null, 2) + "\n");
}

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const network = hre.network.name;
  const chainId = Number((await hre.ethers.provider.getNetwork()).chainId);
  const balance = await hre.ethers.provider.getBalance(deployer.address);

  console.log(`Network:  ${network} (chainId ${chainId})`);
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Balance:  ${hre.ethers.formatEther(balance)} ETH`);

  if (balance === 0n) {
    throw new Error(`Deployer ${deployer.address} has no ETH on ${network} — fund it before deploying.`);
  }

  const factory = await hre.ethers.getContractFactory("RECRegistry");
  const registry = await factory.deploy(deployer.address);
  await registry.waitForDeployment();

  const address = await registry.getAddress();
  const deployTx = registry.deploymentTransaction();
  console.log(`\nRECRegistry deployed to: ${address}`);
  console.log(`Deploy tx:               ${deployTx.hash}`);

  // The deployer is the owner and is auto-authorized by the constructor. The
  // backend signs with BACKEND_PRIVATE_KEY, the same account in the local flow
  // — but authorize it explicitly when it differs.
  const backendKey = process.env.BACKEND_PRIVATE_KEY;
  if (backendKey) {
    const backendWallet = new hre.ethers.Wallet(backendKey);
    if (backendWallet.address.toLowerCase() !== deployer.address.toLowerCase()) {
      console.log(`Authorizing backend issuer wallet ${backendWallet.address}...`);
      await (await registry.authorizeIssuer(backendWallet.address)).wait();
      console.log("Authorized.");
    }
  }

  const artifact = await hre.artifacts.readArtifact("RECRegistry");
  const deployment = {
    address,
    network,
    chainId,
    deployer: deployer.address,
    deployTxHash: deployTx.hash,
    deployedAt: new Date().toISOString(),
  };

  writeArtifact(BACKEND_ARTIFACT, artifact.abi, deployment, chainId);
  console.log(`\nWrote full ABI + address      -> ${BACKEND_ARTIFACT}`);

  const readAbi = artifact.abi.filter(
    (e) => e.type === "function" && DASHBOARD_FUNCTIONS.includes(e.name)
  );
  writeArtifact(DASHBOARD_ARTIFACT, readAbi, deployment, chainId);
  console.log(`Wrote read-only ABI + address -> ${DASHBOARD_ARTIFACT}`);

  if (network !== "localhost" && network !== "hardhat") {
    console.log(`\nVerify the source on the block explorer with:`);
    console.log(`  npx hardhat verify --network ${network} ${address} ${deployer.address}`);
  }

  console.log("\nConfig (optional — the artifact already records the address):");
  console.log(`  CONTRACT_ADDRESS=${address}`);
  console.log(`  NEXT_PUBLIC_CONTRACT_ADDRESS=${address}`);
  console.log(`  NEXT_PUBLIC_CHAIN_ID=${chainId}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
