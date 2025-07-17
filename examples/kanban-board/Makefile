# Makefile for Kanban Board MCP Server
# Provides convenient commands for Docker operations

.PHONY: help build dev prod mysql clean logs test shell

# Default target
help: ## Show this help message
	@echo "Kanban Board MCP Server - Docker Commands"
	@echo "==========================================="
	@awk 'BEGIN {FS = ":.*##"} /^[a-zA-Z_-]+:.*##/ {printf "\033[36m%-15s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)

# Development commands
build: ## Build the Docker image
	docker-compose build

dev: ## Start development environment with SQLite
	docker-compose up -d
	@echo "🚀 Development server starting..."
	@echo "📱 Frontend: http://localhost:5173"
	@echo "🔧 MCP API: http://localhost:3001/mcp"
	@echo "❤️  Health: http://localhost:3001/health"

dev-logs: ## Follow development logs
	docker-compose logs -f

dev-stop: ## Stop development environment
	docker-compose down

# Production commands
prod: ## Start production environment with PostgreSQL
	docker-compose -f docker-compose.prod.yml up -d
	@echo "🚀 Production server starting..."
	@echo "🌐 Application: http://localhost"
	@echo "🔧 MCP API: http://localhost/mcp"
	@echo "🗄️  Database: localhost:5432"

prod-logs: ## Follow production logs
	docker-compose -f docker-compose.prod.yml logs -f

prod-stop: ## Stop production environment
	docker-compose -f docker-compose.prod.yml down

# MySQL commands
mysql: ## Start environment with MySQL
	docker-compose -f docker-compose.mysql.yml up -d
	@echo "🚀 MySQL server starting..."
	@echo "🌐 Application: http://localhost:3001"
	@echo "🗄️  Database: localhost:3306"
	@echo "🖥️  phpMyAdmin: http://localhost:8080"

mysql-logs: ## Follow MySQL logs
	docker-compose -f docker-compose.mysql.yml logs -f

mysql-stop: ## Stop MySQL environment
	docker-compose -f docker-compose.mysql.yml down

# Database commands
db-shell-postgres: ## Connect to PostgreSQL database shell
	docker-compose -f docker-compose.prod.yml exec postgres psql -U kanban_user -d kanban_db

db-shell-mysql: ## Connect to MySQL database shell
	docker-compose -f docker-compose.mysql.yml exec mysql mysql -u kanban_user -pkanban_pass kanban_db

db-backup-postgres: ## Backup PostgreSQL database
	docker-compose -f docker-compose.prod.yml exec postgres pg_dump -U kanban_user kanban_db > backup_$(shell date +%Y%m%d_%H%M%S).sql

db-backup-mysql: ## Backup MySQL database
	docker-compose -f docker-compose.mysql.yml exec mysql mysqldump -u kanban_user -pkanban_pass kanban_db > backup_$(shell date +%Y%m%d_%H%M%S).sql

# Utility commands
logs: ## Show logs for all services
	docker-compose logs

shell: ## Get shell access to the application container
	docker-compose exec kanban-board sh

shell-prod: ## Get shell access to production container
	docker-compose -f docker-compose.prod.yml exec kanban-board sh

test: ## Run tests in container
	docker-compose exec kanban-board npm test

lint: ## Run linting in container
	docker-compose exec kanban-board npm run lint

typecheck: ## Run TypeScript checking in container
	docker-compose exec kanban-board npm run typecheck

# Cleanup commands
clean: ## Stop all containers and remove volumes
	docker-compose down -v
	docker-compose -f docker-compose.prod.yml down -v
	docker-compose -f docker-compose.mysql.yml down -v

clean-all: ## Remove all containers, volumes, and images
	docker-compose down -v --rmi all
	docker-compose -f docker-compose.prod.yml down -v --rmi all
	docker-compose -f docker-compose.mysql.yml down -v --rmi all

# Monitoring commands
stats: ## Show container resource usage
	docker stats

top: ## Show running processes in containers
	docker-compose top

# Health checks
health: ## Check health of all services
	@echo "Checking service health..."
	@curl -s http://localhost:3001/health || echo "❌ MCP Server not responding"
	@curl -s http://localhost:5173 > /dev/null && echo "✅ Frontend is running" || echo "❌ Frontend not responding"

health-prod: ## Check health of production services
	@echo "Checking production service health..."
	@curl -s http://localhost/health || echo "❌ Production server not responding"
	@docker-compose -f docker-compose.prod.yml exec postgres pg_isready -U kanban_user || echo "❌ PostgreSQL not ready"

# Quick setup commands
setup-dev: build dev ## Build and start development environment
	@echo "✅ Development environment is ready!"

setup-prod: ## Setup production environment
	docker-compose -f docker-compose.prod.yml up -d --build
	@echo "✅ Production environment is ready!"

setup-mysql: ## Setup MySQL environment
	docker-compose -f docker-compose.mysql.yml up -d --build
	@echo "✅ MySQL environment is ready!"