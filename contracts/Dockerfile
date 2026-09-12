# A local EVM node with RECRegistry already deployed, so `docker compose up`
# yields a working chain instead of a dead RPC endpoint.
#
# The entrypoint starts Hardhat's node, waits for it, deploys the contract, and
# then keeps the node in the foreground as PID 1 — deploying in a separate
# service would race the node's startup, and deploying at build time would bake
# in a chain state that's discarded when the container starts.
FROM node:22-slim

WORKDIR /app

# Install deps first so edits to the contract don't re-run npm install.
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY hardhat.config.js ./
COPY contracts ./contracts
COPY scripts ./scripts

# Compile at build time: the artifact is deterministic, and a container that
# has to compile on boot takes ~30s longer to become useful.
RUN npx hardhat compile

COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

EXPOSE 8545
ENTRYPOINT ["./docker-entrypoint.sh"]
