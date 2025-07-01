#!/bin/bash

# =============================================================================
# Docker Deployment Script for Nexus Workspace
# =============================================================================
# This script deploys the Nexus workspace using Docker Compose
# with proper environment setup, health checks, and rollback capabilities.

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

echo -e "${BLUE}🚀 Nexus Docker Deployment Script${NC}"
echo "=================================="

# Change to project root
cd "$PROJECT_ROOT"

# Default values
ENVIRONMENT=${ENVIRONMENT:-"production"}
COMPOSE_FILE=${COMPOSE_FILE:-"docker-compose.prod.yml"}
BUILD=${BUILD:-false}
PULL=${PULL:-true}
BACKUP=${BACKUP:-true}
WAIT_TIMEOUT=${WAIT_TIMEOUT:-300}

# Parse command line arguments
COMMAND=${1:-"deploy"}

case $COMMAND in
    "deploy"|"up")
        ACTION="deploy"
        ;;
    "down"|"stop")
        ACTION="stop"
        ;;
    "restart")
        ACTION="restart"
        ;;
    "status")
        ACTION="status"
        ;;
    "logs")
        ACTION="logs"
        SERVICE=${2:-""}
        ;;
    "health")
        ACTION="health"
        ;;
    "backup")
        ACTION="backup"
        ;;
    "rollback")
        ACTION="rollback"
        BACKUP_ID=${2:-""}
        ;;
    "clean")
        ACTION="clean"
        ;;
    "help"|"-h"|"--help")
        echo -e "${BLUE}Nexus Docker Deployment Script${NC}"
        echo ""
        echo -e "${YELLOW}Usage:${NC}"
        echo "  $0 [command] [options]"
        echo ""
        echo -e "${YELLOW}Commands:${NC}"
        echo "  deploy, up            Deploy the application (default)"
        echo "  down, stop            Stop the application"
        echo "  restart               Restart the application"
        echo "  status                Show service status"
        echo "  logs [service]        Show logs (optionally for specific service)"
        echo "  health                Check application health"
        echo "  backup                Create database backup"
        echo "  rollback [backup_id]  Rollback to previous backup"
        echo "  clean                 Clean up unused resources"
        echo "  help                  Show this help message"
        echo ""
        echo -e "${YELLOW}Environment Variables:${NC}"
        echo "  ENVIRONMENT           Deployment environment (default: production)"
        echo "  COMPOSE_FILE          Docker Compose file (default: docker-compose.prod.yml)"
        echo "  BUILD                 Build images before deploy (default: false)"
        echo "  PULL                  Pull latest images (default: true)"
        echo "  BACKUP                Create backup before deploy (default: true)"
        echo "  WAIT_TIMEOUT          Health check timeout in seconds (default: 300)"
        echo ""
        echo -e "${YELLOW}Examples:${NC}"
        echo "  $0 deploy                    # Deploy with default settings"
        echo "  BUILD=true $0 deploy         # Build and deploy"
        echo "  $0 logs backend              # Show backend logs"
        echo "  $0 rollback backup_20240101  # Rollback to specific backup"
        exit 0
        ;;
    *)
        echo -e "${RED}❌ Unknown command: $COMMAND${NC}"
        echo -e "${BLUE}Use '$0 help' to see available commands${NC}"
        exit 1
        ;;
esac

# Function to check if Docker Compose is available
check_docker_compose() {
    if command -v docker-compose > /dev/null 2>&1; then
        DOCKER_COMPOSE="docker-compose"
    elif docker compose version > /dev/null 2>&1; then
        DOCKER_COMPOSE="docker compose"
    else
        echo -e "${RED}❌ Docker Compose is not available${NC}"
        exit 1
    fi
}

# Function to wait for service health
wait_for_health() {
    local service=$1
    local timeout=${2:-$WAIT_TIMEOUT}
    local elapsed=0
    
    echo -e "${YELLOW}⏳ Waiting for $service to be healthy...${NC}"
    
    while [ $elapsed -lt $timeout ]; do
        if $DOCKER_COMPOSE -f "$COMPOSE_FILE" ps --format json | jq -r ".[] | select(.Service == \"$service\") | .Health" | grep -q "healthy"; then
            echo -e "${GREEN}✅ $service is healthy${NC}"
            return 0
        fi
        
        sleep 5
        elapsed=$((elapsed + 5))
        echo -n "."
    done
    
    echo -e "${RED}❌ $service failed to become healthy within ${timeout}s${NC}"
    return 1
}

# Function to create backup
create_backup() {
    if [ "$BACKUP" != true ]; then
        return 0
    fi
    
    echo -e "${BLUE}💾 Creating database backup...${NC}"
    
    local backup_id="backup_$(date +%Y%m%d_%H%M%S)"
    local backup_dir="backups/$backup_id"
    
    mkdir -p "$backup_dir"
    
    # PostgreSQL backup
    if $DOCKER_COMPOSE -f "$COMPOSE_FILE" ps postgres | grep -q "Up"; then
        echo -e "${YELLOW}📦 Backing up PostgreSQL...${NC}"
        $DOCKER_COMPOSE -f "$COMPOSE_FILE" exec -T postgres pg_dump -U "${POSTGRES_USER:-nexus_user}" -d "${POSTGRES_DB:-nexus_prod}" > "$backup_dir/postgres.sql"
    fi
    
    # MongoDB backup
    if $DOCKER_COMPOSE -f "$COMPOSE_FILE" ps mongodb | grep -q "Up"; then
        echo -e "${YELLOW}📦 Backing up MongoDB...${NC}"
        $DOCKER_COMPOSE -f "$COMPOSE_FILE" exec -T mongodb mongodump --username "${MONGO_ROOT_USER:-admin}" --password "${MONGO_ROOT_PASSWORD}" --authenticationDatabase admin --db "${MONGO_DB:-nexus_nosql}" --archive > "$backup_dir/mongodb.archive"
    fi
    
    # Create backup metadata
    cat > "$backup_dir/metadata.json" << EOF
{
  "id": "$backup_id",
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "environment": "$ENVIRONMENT",
  "compose_file": "$COMPOSE_FILE",
  "services": $(docker-compose -f "$COMPOSE_FILE" config --services | jq -R . | jq -s .)
}
EOF
    
    echo -e "${GREEN}✅ Backup created: $backup_id${NC}"
    echo "$backup_id" > .last_backup
}

# Function to perform rollback
perform_rollback() {
    local backup_id=$1
    
    if [ -z "$backup_id" ]; then
        if [ -f .last_backup ]; then
            backup_id=$(cat .last_backup)
        else
            echo -e "${RED}❌ No backup ID specified and no last backup found${NC}"
            exit 1
        fi
    fi
    
    local backup_dir="backups/$backup_id"
    
    if [ ! -d "$backup_dir" ]; then
        echo -e "${RED}❌ Backup not found: $backup_id${NC}"
        exit 1
    fi
    
    echo -e "${YELLOW}🔄 Rolling back to backup: $backup_id${NC}"
    echo -e "${RED}⚠️  This will overwrite current data${NC}"
    read -p "Are you sure? (y/N): " -n 1 -r
    echo
    
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${YELLOW}❌ Rollback cancelled${NC}"
        exit 0
    fi
    
    # Stop services
    echo -e "${BLUE}🛑 Stopping services...${NC}"
    $DOCKER_COMPOSE -f "$COMPOSE_FILE" down
    
    # Restore PostgreSQL
    if [ -f "$backup_dir/postgres.sql" ]; then
        echo -e "${YELLOW}🔄 Restoring PostgreSQL...${NC}"
        $DOCKER_COMPOSE -f "$COMPOSE_FILE" up -d postgres
        wait_for_health postgres 60
        $DOCKER_COMPOSE -f "$COMPOSE_FILE" exec -T postgres psql -U "${POSTGRES_USER:-nexus_user}" -d "${POSTGRES_DB:-nexus_prod}" < "$backup_dir/postgres.sql"
    fi
    
    # Restore MongoDB
    if [ -f "$backup_dir/mongodb.archive" ]; then
        echo -e "${YELLOW}🔄 Restoring MongoDB...${NC}"
        $DOCKER_COMPOSE -f "$COMPOSE_FILE" up -d mongodb
        wait_for_health mongodb 60
        $DOCKER_COMPOSE -f "$COMPOSE_FILE" exec -T mongodb mongorestore --username "${MONGO_ROOT_USER:-admin}" --password "${MONGO_ROOT_PASSWORD}" --authenticationDatabase admin --db "${MONGO_DB:-nexus_nosql}" --archive < "$backup_dir/mongodb.archive"
    fi
    
    echo -e "${GREEN}✅ Rollback completed${NC}"
}

# Function to check application health
check_health() {
    echo -e "${BLUE}🏥 Checking application health...${NC}"
    
    local all_healthy=true
    
    # Check each service
    for service in frontend backend postgres mongodb redis; do
        if $DOCKER_COMPOSE -f "$COMPOSE_FILE" ps "$service" | grep -q "Up"; then
            local health=$($DOCKER_COMPOSE -f "$COMPOSE_FILE" ps --format json | jq -r ".[] | select(.Service == \"$service\") | .Health")
            
            case $health in
                "healthy")
                    echo -e "  ✅ $service: ${GREEN}healthy${NC}"
                    ;;
                "unhealthy")
                    echo -e "  ❌ $service: ${RED}unhealthy${NC}"
                    all_healthy=false
                    ;;
                "starting")
                    echo -e "  🔄 $service: ${YELLOW}starting${NC}"
                    ;;
                *)
                    echo -e "  ❓ $service: ${YELLOW}unknown${NC}"
                    ;;
            esac
        else
            echo -e "  ⭕ $service: ${RED}not running${NC}"
            all_healthy=false
        fi
    done
    
    if [ "$all_healthy" = true ]; then
        echo -e "${GREEN}🎉 All services are healthy${NC}"
        return 0
    else
        echo -e "${RED}⚠️  Some services are not healthy${NC}"
        return 1
    fi
}

# Pre-deployment checks
echo -e "${BLUE}🔍 Pre-deployment checks...${NC}"

# Check Docker Compose
check_docker_compose

# Check if compose file exists
if [ ! -f "$COMPOSE_FILE" ]; then
    echo -e "${RED}❌ Compose file not found: $COMPOSE_FILE${NC}"
    exit 1
fi

# Check environment file
if [ ! -f .env ]; then
    echo -e "${YELLOW}⚠️  .env file not found. Using default values.${NC}"
fi

# Execute action
case $ACTION in
    "deploy")
        echo -e "${BLUE}🚀 Deploying Nexus Workspace...${NC}"
        
        # Create backup
        create_backup
        
        # Pull images if requested
        if [ "$PULL" = true ]; then
            echo -e "${YELLOW}📥 Pulling latest images...${NC}"
            $DOCKER_COMPOSE -f "$COMPOSE_FILE" pull
        fi
        
        # Build images if requested
        if [ "$BUILD" = true ]; then
            echo -e "${YELLOW}🔨 Building images...${NC}"
            ./scripts/docker-build.sh all
        fi
        
        # Deploy services
        echo -e "${YELLOW}🚀 Starting services...${NC}"
        $DOCKER_COMPOSE -f "$COMPOSE_FILE" up -d
        
        # Wait for services to be healthy
        echo -e "${BLUE}⏳ Waiting for services to be ready...${NC}"
        wait_for_health postgres 60
        wait_for_health mongodb 60
        wait_for_health redis 30
        wait_for_health backend 120
        wait_for_health frontend 60
        
        # Final health check
        if check_health; then
            echo -e "${GREEN}🎉 Deployment completed successfully!${NC}"
            echo ""
            echo -e "${BLUE}🔗 Application URLs:${NC}"
            echo "  Frontend: http://localhost:${FRONTEND_PORT:-3000}"
            echo "  Backend:  http://localhost:${BACKEND_PORT:-3001}"
            echo "  API Docs: http://localhost:${BACKEND_PORT:-3001}/api"
        else
            echo -e "${RED}❌ Deployment completed with issues${NC}"
            exit 1
        fi
        ;;
        
    "stop")
        echo -e "${YELLOW}🛑 Stopping Nexus Workspace...${NC}"
        $DOCKER_COMPOSE -f "$COMPOSE_FILE" down
        echo -e "${GREEN}✅ Services stopped${NC}"
        ;;
        
    "restart")
        echo -e "${YELLOW}🔄 Restarting Nexus Workspace...${NC}"
        $DOCKER_COMPOSE -f "$COMPOSE_FILE" restart
        
        # Wait for services to be healthy
        sleep 10
        if check_health; then
            echo -e "${GREEN}✅ Services restarted successfully${NC}"
        else
            echo -e "${RED}❌ Some services failed to restart properly${NC}"
            exit 1
        fi
        ;;
        
    "status")
        echo -e "${BLUE}📊 Service Status:${NC}"
        $DOCKER_COMPOSE -f "$COMPOSE_FILE" ps
        echo ""
        check_health
        ;;
        
    "logs")
        if [ -n "$SERVICE" ]; then
            echo -e "${BLUE}📋 Showing logs for $SERVICE...${NC}"
            $DOCKER_COMPOSE -f "$COMPOSE_FILE" logs -f "$SERVICE"
        else
            echo -e "${BLUE}📋 Showing logs for all services...${NC}"
            $DOCKER_COMPOSE -f "$COMPOSE_FILE" logs -f
        fi
        ;;
        
    "health")
        check_health
        ;;
        
    "backup")
        BACKUP=true
        create_backup
        ;;
        
    "rollback")
        perform_rollback "$BACKUP_ID"
        ;;
        
    "clean")
        echo -e "${YELLOW}🧹 Cleaning up unused resources...${NC}"
        docker system prune -f
        docker volume prune -f
        echo -e "${GREEN}✅ Cleanup completed${NC}"
        ;;
esac
