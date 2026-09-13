#!/bin/sh
# Start the node, deploy RECRegistry to it, then hand the node the foreground.
set -e

ARTIFACT_DIR=/chain-artifacts
READY_MARKER="$ARTIFACT_DIR/.ready"

# The volume outlives the container, but a Hardhat node starts from an empty
# chain every time. Clear the previous run's artifacts first so nothing can
# read an address from a chain that no longer exists; the healthcheck waits
# for READY_MARKER, which is only written once the new deployment is recorded.
mkdir -p "$ARTIFACT_DIR"
rm -f "$READY_MARKER" "$ARTIFACT_DIR/RECRegistry.json" "$ARTIFACT_DIR/contract-artifact.json"

# --hostname 0.0.0.0 so the port is reachable from other containers; Hardhat
# binds 127.0.0.1 by default, which inside a container means nothing else can
# connect to it.
npx hardhat node --hostname 0.0.0.0 --port 8545 &
NODE_PID=$!

# Forward stop signals to the node so `docker compose down` exits promptly.
trap 'kill -TERM $NODE_PID 2>/dev/null' TERM INT

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
export BACKEND_ARTIFACT_PATH="$ARTIFACT_DIR/RECRegistry.json"
export DASHBOARD_ARTIFACT_PATH="$ARTIFACT_DIR/contract-artifact.json"
npx hardhat run scripts/deploy.js --network localhost
chmod -R a+r "$ARTIFACT_DIR"
touch "$READY_MARKER"

echo "Chain ready on :8545"
wait $NODE_PID
