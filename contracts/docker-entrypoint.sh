#!/bin/sh
# Start the node, deploy RECRegistry to it, then hand the node the foreground.
set -e

# --hostname 0.0.0.0 so the port is reachable from other containers; Hardhat
# binds 127.0.0.1 by default, which inside a container means nothing else can
# connect to it.
npx hardhat node --hostname 0.0.0.0 --port 8545 &
NODE_PID=$!

echo "Waiting for the JSON-RPC endpoint..."
i=0
until node -e "fetch('http://127.0.0.1:8545',{method:'POST',headers:{'content-type':'application/json'},body:'{\"jsonrpc\":\"2.0\",\"method\":\"eth_chainId\",\"params\":[],\"id\":1}'}).then(r=>r.json()).then(j=>process.exit(j.result?0:1)).catch(()=>process.exit(1))" 2>/dev/null; do
  i=$((i+1))
  if [ "$i" -gt 60 ]; then
    echo "Node did not become ready in 60s" >&2
    kill $NODE_PID 2>/dev/null || true
    exit 1
  fi
  sleep 1
done

echo "Deploying RECRegistry..."
# Publish the artifact into the shared volume so the backend reads the exact
# address this container just deployed, rather than one committed in the repo
# from somebody else's node.
export BACKEND_ARTIFACT_PATH=/chain-artifacts/RECRegistry.json
export DASHBOARD_ARTIFACT_PATH=/chain-artifacts/contract-artifact.json
mkdir -p /chain-artifacts
npx hardhat run scripts/deploy.js --network localhost
chmod -R a+r /chain-artifacts

echo "Chain ready on :8545"
wait $NODE_PID
