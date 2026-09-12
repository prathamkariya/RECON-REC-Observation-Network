# Dashboard image (Next.js 16, standalone output).
#
# Build from the dashboard/ directory:
#     docker build -t recon-dashboard ./dashboard
#
# NEXT_PUBLIC_* values are inlined into the client bundle at BUILD time, not
# read at runtime — so they are build args here, and changing one means
# rebuilding the image rather than restarting the container. Nothing secret
# belongs in them: they ship to every browser that loads the page.

# --- Stage 1: dependencies --------------------------------------------------
FROM node:22-alpine AS deps

# Next.js on Alpine needs the glibc compatibility shim.
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Only the manifests, so the install layer is cached until they change.
COPY package.json package-lock.json ./
RUN npm ci


# --- Stage 2: build ---------------------------------------------------------
FROM node:22-alpine AS builder

RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Public, non-secret configuration baked into the client bundle.
# NEXT_PUBLIC_API_URL is the URL the *browser* uses, so it is a host-reachable
# address (http://localhost:8000), never the compose service name — the fetch
# runs in the user's browser, not inside this container.
ARG NEXT_PUBLIC_API_URL=http://localhost:8000
ARG NEXT_PUBLIC_USE_MOCK_DATA=true
ARG NEXT_PUBLIC_FIREBASE_API_KEY=
ARG NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
ARG NEXT_PUBLIC_FIREBASE_PROJECT_ID=
ARG NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
ARG NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
ARG NEXT_PUBLIC_FIREBASE_APP_ID=
ARG NEXT_PUBLIC_SEPOLIA_RPC_URL=https://rpc.sepolia.org
ARG NEXT_PUBLIC_CONTRACT_ADDRESS=

ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_PUBLIC_USE_MOCK_DATA=$NEXT_PUBLIC_USE_MOCK_DATA \
    NEXT_PUBLIC_FIREBASE_API_KEY=$NEXT_PUBLIC_FIREBASE_API_KEY \
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=$NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN \
    NEXT_PUBLIC_FIREBASE_PROJECT_ID=$NEXT_PUBLIC_FIREBASE_PROJECT_ID \
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=$NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET \
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=$NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID \
    NEXT_PUBLIC_FIREBASE_APP_ID=$NEXT_PUBLIC_FIREBASE_APP_ID \
    NEXT_PUBLIC_SEPOLIA_RPC_URL=$NEXT_PUBLIC_SEPOLIA_RPC_URL \
    NEXT_PUBLIC_CONTRACT_ADDRESS=$NEXT_PUBLIC_CONTRACT_ADDRESS \
    NEXT_TELEMETRY_DISABLED=1

RUN npm run build


# --- Stage 3: runtime -------------------------------------------------------
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nextjs

# `output: "standalone"` traces the modules actually reached at runtime and
# emits a self-contained server, so only these three paths are needed — the
# full node_modules tree never enters this image.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

USER nextjs

EXPOSE 3000

# Node 18+ has a global fetch, so the healthcheck needs no extra package.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:3000/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
