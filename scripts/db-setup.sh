#!/bin/bash

# =============================================================================
# Nexus Database Setup Script
# =============================================================================
# This script sets up the local database environment using Docker Compose

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo -e "${BLUE}🗄️  Nexus Database Setup${NC}"
echo "=================================="

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}❌ Docker is not running. Please start Docker and try again.${NC}"
    exit 1
fi

# Check if Docker Compose is available
if ! command -v docker-compose > /dev/null 2>&1 && ! docker compose version > /dev/null 2>&1; then
    echo -e "${RED}❌ Docker Compose is not available. Please install Docker Compose and try again.${NC}"
    exit 1
fi

# Use docker compose if available, otherwise fall back to docker-compose
DOCKER_COMPOSE_CMD="docker compose"
if ! docker compose version > /dev/null 2>&1; then
    DOCKER_COMPOSE_CMD="docker-compose"
fi

# Change to project root
cd "$PROJECT_ROOT"

# Check if .env file exists
if [ ! -f .env ]; then
    echo -e "${YELLOW}⚠️  .env file not found. Creating from .env.example...${NC}"
    if [ -f .env.example ]; then
        cp .env.example .env
        echo -e "${GREEN}✅ .env file created. Please review and customize the values.${NC}"
    else
        echo -e "${RED}❌ .env.example file not found. Please create .env file manually.${NC}"
        exit 1
    fi
fi

# Function to wait for service to be healthy
wait_for_service() {
    local service_name=$1
    local max_attempts=30
    local attempt=1
    
    echo -e "${YELLOW}⏳ Waiting for $service_name to be healthy...${NC}"
    
    while [ $attempt -le $max_attempts ]; do
        if $DOCKER_COMPOSE_CMD ps --format json | jq -r ".[] | select(.Service == \"$service_name\") | .Health" | grep -q "healthy"; then
            echo -e "${GREEN}✅ $service_name is healthy!${NC}"
            return 0
        fi
        
        echo -n "."
        sleep 2
        attempt=$((attempt + 1))
    done
    
    echo -e "${RED}❌ $service_name failed to become healthy within $((max_attempts * 2)) seconds${NC}"
    return 1
}

# Function to check service status
check_service_status() {
    local service_name=$1
    local status=$($DOCKER_COMPOSE_CMD ps --format json | jq -r ".[] | select(.Service == \"$service_name\") | .State")
    
    if [ "$status" = "running" ]; then
        echo -e "${GREEN}✅ $service_name is running${NC}"
        return 0
    else
        echo -e "${RED}❌ $service_name is not running (status: $status)${NC}"
        return 1
    fi
}

# Parse command line arguments
COMMAND=${1:-"up"}

case $COMMAND in
    "up"|"start")
        echo -e "${BLUE}🚀 Starting database services...${NC}"
        
        # Pull latest images
        echo -e "${YELLOW}📥 Pulling latest Docker images...${NC}"
        $DOCKER_COMPOSE_CMD pull
        
        # Start services
        $DOCKER_COMPOSE_CMD up -d postgres mongodb redis
        
        # Wait for core services to be healthy
        wait_for_service "postgres"
        wait_for_service "mongodb" 
        wait_for_service "redis"
        
        echo -e "${BLUE}🔧 Starting management tools...${NC}"
        
        # Start management tools
        $DOCKER_COMPOSE_CMD up -d pgadmin mongo-express redis-commander
        
        echo ""
        echo -e "${GREEN}🎉 Database environment is ready!${NC}"
        echo ""
        echo -e "${BLUE}📊 Service Status:${NC}"
        check_service_status "postgres"
        check_service_status "mongodb"
        check_service_status "redis"
        check_service_status "pgadmin"
        check_service_status "mongo-express"
        check_service_status "redis-commander"
        
        echo ""
        echo -e "${BLUE}🔗 Access URLs:${NC}"
        echo -e "  PostgreSQL:     ${GREEN}localhost:5432${NC}"
        echo -e "  MongoDB:        ${GREEN}localhost:27017${NC}"
        echo -e "  Redis:          ${GREEN}localhost:6379${NC}"
        echo -e "  pgAdmin:        ${GREEN}http://localhost:5050${NC}"
        echo -e "  Mongo Express:  ${GREEN}http://localhost:8081${NC}"
        echo -e "  Redis Commander: ${GREEN}http://localhost:8082${NC}"
        
        echo ""
        echo -e "${BLUE}📋 Default Credentials:${NC}"
        echo -e "  PostgreSQL: nexus_user / nexus_password"
        echo -e "  MongoDB: admin / admin_password"
        echo -e "  Redis: redis_password"
        echo -e "  pgAdmin: admin@nexus.local / admin_password"
        echo -e "  Mongo Express: admin / admin_password"
        echo -e "  Redis Commander: admin / admin_password"
        ;;
        
    "down"|"stop")
        echo -e "${YELLOW}🛑 Stopping database services...${NC}"
        $DOCKER_COMPOSE_CMD down
        echo -e "${GREEN}✅ Database services stopped${NC}"
        ;;
        
    "restart")
        echo -e "${YELLOW}🔄 Restarting database services...${NC}"
        $DOCKER_COMPOSE_CMD restart
        echo -e "${GREEN}✅ Database services restarted${NC}"
        ;;
        
    "logs")
        SERVICE=${2:-""}
        if [ -n "$SERVICE" ]; then
            echo -e "${BLUE}📋 Showing logs for $SERVICE...${NC}"
            $DOCKER_COMPOSE_CMD logs -f "$SERVICE"
        else
            echo -e "${BLUE}📋 Showing logs for all database services...${NC}"
            $DOCKER_COMPOSE_CMD logs -f postgres mongodb redis
        fi
        ;;
        
    "status")
        echo -e "${BLUE}📊 Database Services Status:${NC}"
        echo ""
        $DOCKER_COMPOSE_CMD ps
        ;;
        
    "clean")
        echo -e "${YELLOW}🧹 Cleaning up database environment...${NC}"
        echo -e "${RED}⚠️  This will remove all containers and volumes (data will be lost)${NC}"
        read -p "Are you sure? (y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            $DOCKER_COMPOSE_CMD down -v --remove-orphans
            docker system prune -f
            echo -e "${GREEN}✅ Database environment cleaned${NC}"
        else
            echo -e "${YELLOW}❌ Cleanup cancelled${NC}"
        fi
        ;;
        
    "backup")
        echo -e "${BLUE}💾 Creating database backups...${NC}"
        
        # Create backup directory
        mkdir -p database/postgres/backups
        mkdir -p database/mongodb/backups
        
        # PostgreSQL backup
        echo -e "${YELLOW}📦 Backing up PostgreSQL...${NC}"
        $DOCKER_COMPOSE_CMD exec -T postgres pg_dump -U nexus_user -d nexus_dev > "database/postgres/backups/nexus_dev_$(date +%Y%m%d_%H%M%S).sql"
        
        # MongoDB backup
        echo -e "${YELLOW}📦 Backing up MongoDB...${NC}"
        $DOCKER_COMPOSE_CMD exec -T mongodb mongodump --username admin --password admin_password --authenticationDatabase admin --db nexus_nosql --out /backups/
        
        echo -e "${GREEN}✅ Backups created successfully${NC}"
        ;;
        
    "restore")
        BACKUP_FILE=${2:-""}
        if [ -z "$BACKUP_FILE" ]; then
            echo -e "${RED}❌ Please specify a backup file to restore${NC}"
            echo -e "${BLUE}Usage: $0 restore <backup_file>${NC}"
            exit 1
        fi
        
        echo -e "${BLUE}🔄 Restoring database from backup...${NC}"
        echo -e "${RED}⚠️  This will overwrite existing data${NC}"
        read -p "Are you sure? (y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            # Restore based on file extension
            if [[ "$BACKUP_FILE" == *.sql ]]; then
                echo -e "${YELLOW}🔄 Restoring PostgreSQL backup...${NC}"
                $DOCKER_COMPOSE_CMD exec -T postgres psql -U nexus_user -d nexus_dev < "$BACKUP_FILE"
            else
                echo -e "${RED}❌ Unsupported backup file format${NC}"
                exit 1
            fi
            echo -e "${GREEN}✅ Database restored successfully${NC}"
        else
            echo -e "${YELLOW}❌ Restore cancelled${NC}"
        fi
        ;;
        
    "reset")
        echo -e "${YELLOW}🔄 Resetting database environment...${NC}"
        echo -e "${RED}⚠️  This will recreate all containers and reinitialize data${NC}"
        read -p "Are you sure? (y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            $DOCKER_COMPOSE_CMD down -v
            $DOCKER_COMPOSE_CMD up -d --force-recreate
            echo -e "${GREEN}✅ Database environment reset${NC}"
        else
            echo -e "${YELLOW}❌ Reset cancelled${NC}"
        fi
        ;;
        
    "help"|"-h"|"--help")
        echo -e "${BLUE}Nexus Database Setup Script${NC}"
        echo ""
        echo -e "${YELLOW}Usage:${NC}"
        echo "  $0 [command] [options]"
        echo ""
        echo -e "${YELLOW}Commands:${NC}"
        echo "  up, start          Start database services (default)"
        echo "  down, stop         Stop database services"
        echo "  restart            Restart database services"
        echo "  status             Show service status"
        echo "  logs [service]     Show logs (optionally for specific service)"
        echo "  backup             Create database backups"
        echo "  restore <file>     Restore database from backup"
        echo "  reset              Reset database environment (recreate containers)"
        echo "  clean              Clean up containers and volumes (removes all data)"
        echo "  help               Show this help message"
        echo ""
        echo -e "${YELLOW}Examples:${NC}"
        echo "  $0 up              # Start all database services"
        echo "  $0 logs postgres   # Show PostgreSQL logs"
        echo "  $0 backup          # Create backups of all databases"
        echo "  $0 clean           # Remove all containers and data"
        ;;
        
    *)
        echo -e "${RED}❌ Unknown command: $COMMAND${NC}"
        echo -e "${BLUE}Use '$0 help' to see available commands${NC}"
        exit 1
        ;;
esac
