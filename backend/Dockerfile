# Build context is the REPO ROOT, not backend/ -- imports throughout this
# service are anchored there (see backend/README.md) so real client
# branches can reach sibling packages: ml/, graph_explain/, ledger_cloud/.
# Build from the repo root:
#   docker build -f backend/Dockerfile -t recon-backend .
# (docker-compose.yml already sets this up correctly.)
FROM python:3.11-slim

WORKDIR /app

# build-essential is a safety net for any of the four requirements files
# that don't ship a prebuilt wheel for the target platform (rare, but
# cheaper to always have than to debug a platform-specific build failure).
RUN apt-get update \
    && apt-get install -y --no-install-recommends build-essential \
    && rm -rf /var/lib/apt/lists/*

# All four requirements files: app/routers/audit.py unconditionally imports
# pandas and graph_explain.llm.audit_chat at module load (not behind a
# USE_REAL_* flag like the other client adapters), so the app cannot boot
# without ml/'s and graph_explain's dependencies installed even in the
# otherwise-fully-mocked default configuration.
COPY backend/requirements.txt backend/requirements.txt
COPY ml/requirements.txt ml/requirements.txt
COPY graph_explain/requirements.txt graph_explain/requirements.txt
COPY ledger_cloud/requirements.txt ledger_cloud/requirements.txt
RUN pip install --no-cache-dir \
    -r backend/requirements.txt \
    -r ml/requirements.txt \
    -r graph_explain/requirements.txt \
    -r ledger_cloud/requirements.txt

COPY backend/ backend/
COPY ml/ ml/
COPY graph_explain/ graph_explain/
COPY ledger_cloud/ ledger_cloud/
COPY data/ data/

# The default SQLite DATABASE_URL (see app/config.py) lands next to the
# code in backend/ -- docker-compose.yml overrides it to this path instead,
# so a named volume here persists the db without shadowing source code.
RUN mkdir -p /app/data-volume

EXPOSE 8000

CMD ["uvicorn", "backend.app.main:app", "--host", "0.0.0.0", "--port", "8000"]
