# Common workflows. `make help` lists them.
.DEFAULT_GOAL := help
.PHONY: help install test test-cov test-fast run run-dashboard lint build up down logs ps clean

PY ?= .venv/bin/python
PIP ?= .venv/bin/pip

help: ## Show this help
	@grep -hE '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) \
		| awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-16s\033[0m %s\n", $$1, $$2}'

# --- Local development ------------------------------------------------------

install: ## Create the venv and install backend + dev dependencies
	python3 -m venv .venv
	$(PIP) install --upgrade pip
	$(PIP) install -r backend/requirements.txt -r backend/requirements-dev.txt
	cd dashboard && npm install

test: ## Run the backend test suite
	$(PY) -m pytest

test-cov: ## Run the tests with a coverage report
	$(PY) -m pytest --cov=backend/app --cov=ledger_cloud --cov-report=term-missing

test-fast: ## Run only the tests that don't need the in-process EVM
	$(PY) -m pytest -m "not chain"

run: ## Start the backend API on :8000 with reload
	.venv/bin/uvicorn backend.app.main:app --reload --port 8000

run-dashboard: ## Start the dashboard on :3000
	cd dashboard && npm run dev

lint: ## Lint the dashboard
	cd dashboard && npm run lint

# --- Docker -----------------------------------------------------------------

build: ## Build both Docker images
	docker compose build

up: ## Start the whole stack (Postgres + API + dashboard)
	docker compose up -d --build
	@echo ""
	@echo "  Dashboard  http://localhost:3000"
	@echo "  API docs   http://localhost:8000/docs"

down: ## Stop the stack (keeps the database volume)
	docker compose down

logs: ## Follow logs from every service
	docker compose logs -f

ps: ## Show service status
	docker compose ps

clean: ## Stop the stack and DELETE the database volume
	docker compose down -v
