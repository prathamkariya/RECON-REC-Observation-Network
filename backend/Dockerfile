# Backend API image.
#
# IMPORTANT: build from the repository root, not from backend/:
#     docker build -f backend/Dockerfile -t recon-backend .
# The app imports sibling packages (graph_explain, ledger_cloud) and reads
# Role 1's ML handoff, so the build context has to be the whole repo.

# --- Stage 1: build the virtualenv -----------------------------------------
FROM python:3.13-slim AS builder

ENV PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /build

# Only the requirements files, so `docker build` reuses the cached dependency
# layer whenever application code changes but dependencies don't.
COPY backend/requirements.txt ./requirements.txt

RUN python -m venv /opt/venv \
    && /opt/venv/bin/pip install --upgrade pip \
    && /opt/venv/bin/pip install -r requirements.txt


# --- Stage 2: runtime -------------------------------------------------------
FROM python:3.13-slim AS runtime

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PATH="/opt/venv/bin:$PATH"

# curl is used by the container healthcheck below.
RUN apt-get update \
    && apt-get install --no-install-recommends -y curl \
    && rm -rf /var/lib/apt/lists/*

# Run as a non-root user: a container process that doesn't need root shouldn't
# have it, so a code-execution bug can't write to the image or mounted volumes.
RUN useradd --create-home --uid 10001 recon

COPY --from=builder /opt/venv /opt/venv

WORKDIR /app

# Each COPY is scoped to exactly what the service imports or reads at runtime,
# rather than `COPY . .` — that would drag in .venv, node_modules, the Next.js
# build and the ML training artifacts, for a far larger image.
COPY backend/ ./backend/
COPY graph_explain/ ./graph_explain/
COPY ledger_cloud/ ./ledger_cloud/
# Role 1's precomputed Isolation Forest scores (USE_REAL_ML).
COPY ml/handoff/ ./ml/handoff/
# Certificate/transaction CSVs the auditor chat grounds its answers in.
COPY data/ ./data/

# Writable location for the default SQLite database, owned by the app user.
# In compose this is a named volume; with DATABASE_URL set to Postgres it goes
# unused.
RUN mkdir -p /app/backend/data && chown -R recon:recon /app

USER recon

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD curl -fsS http://localhost:8000/health || exit 1

# No --reload: it watches the filesystem and restarts on change, which is a
# development convenience and a liability in a container.
CMD ["uvicorn", "backend.app.main:app", "--host", "0.0.0.0", "--port", "8000"]
