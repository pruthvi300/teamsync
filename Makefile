# ============================================================================
# TeamSync — Makefile
# ============================================================================
# Standardized developer commands. Run `make help` to see all commands.
#
# Why a Makefile?
#   - Every developer runs the same commands (no "it works on my machine")
#   - Self-documenting (make help lists all commands)
#   - Shorter than remembering docker-compose flags
# ============================================================================

.PHONY: help dev down logs clean test lint setup

# ── Default target: show help ──
help: ## Show this help message
	@echo "╔══════════════════════════════════════════════╗"
	@echo "║        TeamSync — Developer Commands         ║"
	@echo "╚══════════════════════════════════════════════╝"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2}'

# ── Development ──
setup: ## First-time setup: copy .env and install dependencies
	@cp -n .env.example .env 2>/dev/null || true
	@echo "✅ .env file ready (edit with your values)"
	cd frontend && npm install
	@echo "✅ Frontend dependencies installed"
	cd api && pip install -r requirements.txt
	@echo "✅ Backend dependencies installed"

dev: ## Start all services (docker-compose up --build)
	docker-compose up --build

dev-d: ## Start all services in background (detached)
	docker-compose up --build -d

down: ## Stop all services
	docker-compose down

restart: ## Restart all services
	docker-compose down && docker-compose up --build -d

# ── Logs ──
logs: ## Follow all service logs
	docker-compose logs -f

logs-api: ## Follow API logs only
	docker-compose logs -f api

logs-frontend: ## Follow frontend logs only
	docker-compose logs -f frontend

# ── Database ──
db-shell: ## Open PostgreSQL shell
	docker-compose exec postgres psql -U teamsync -d teamsync_db

db-reset: ## Reset database (WARNING: deletes all data)
	docker-compose down -v
	docker-compose up --build -d

# ── Testing ──
test-api: ## Run backend tests
	cd api && python -m pytest tests/ -v

test-frontend: ## Run frontend tests
	cd frontend && npm test

test: test-api test-frontend ## Run all tests

# ── Code Quality ──
lint-api: ## Lint backend code
	cd api && python -m flake8 app/ --max-line-length=120

lint-frontend: ## Lint frontend code
	cd frontend && npm run lint

lint: lint-api lint-frontend ## Lint all code

# ── Cleanup ──
clean: ## Remove all containers, volumes, and build artifacts
	docker-compose down -v --remove-orphans
	rm -rf frontend/node_modules frontend/dist
	find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
	@echo "✅ Cleaned up everything"
