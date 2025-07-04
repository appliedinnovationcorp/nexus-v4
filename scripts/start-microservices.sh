#!/bin/bash

# Nexus Microservices Startup Script
# This script orchestrates the startup of all Nexus microservices

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
WORKSPACE_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DOCKER_COMPOSE_FILE="docker-compose.microservices.yml"
ENV_FILE=".env"

# Functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_step() {
    echo -e "${PURPLE}[STEP]${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    log_step "Checking prerequisites..."
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed. Please install Docker first."
        exit 1
    fi
    
    # Check Docker Compose
    if ! command -v docker-compose &> /dev/null; then
        log_error "Docker Compose is not installed. Please install Docker Compose first."
        exit 1
    fi
    
    # Check pnpm
    if ! command -v pnpm &> /dev/null; then
        log_error "pnpm is not installed. Please install pnpm first."
        exit 1
    fi
    
    # Check Node.js
    if ! command -v node &> /dev/null; then
        log_error "Node.js is not installed. Please install Node.js first."
        exit 1
    fi
    
    log_success "All prerequisites are installed"
}

# Setup environment
setup_environment() {
    log_step "Setting up environment..."
    
    cd "$WORKSPACE_ROOT"
    
    # Create .env file if it doesn't exist
    if [ ! -f "$ENV_FILE" ]; then
        log_info "Creating .env file from template..."
        cat > "$ENV_FILE" << EOF
# Nexus Microservices Environment Configuration

# Database
DATABASE_URL=postgresql://nexus:nexus_password@localhost:5432/nexus

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# JWT
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRES_IN=24h

# API Gateway
API_GATEWAY_PORT=3000
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001,http://localhost:3002

# Services
BACKEND_SERVICE_URL=http://localhost:3001
ANALYTICS_SERVICE_URL=http://localhost:3003
NOTIFICATION_SERVICE_URL=http://localhost:3004

# External Services (Optional - configure as needed)
SENTRY_DSN=
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
FIREBASE_PROJECT_ID=
SLACK_BOT_TOKEN=
DISCORD_BOT_TOKEN=

# Frontend
NEXT_PUBLIC_API_URL=http://localhost:3000
NEXT_PUBLIC_WS_URL=ws://localhost:3000
EOF
        log_success "Created .env file. Please configure external service credentials as needed."
    else
        log_info ".env file already exists"
    fi
}

# Install dependencies
install_dependencies() {
    log_step "Installing dependencies..."
    
    cd "$WORKSPACE_ROOT"
    
    # Install workspace dependencies
    log_info "Installing workspace dependencies..."
    pnpm install
    
    # Build shared packages
    log_info "Building shared packages..."
    pnpm build --filter="@nexus/shared-*"
    pnpm build --filter="@nexus/event-bus"
    
    log_success "Dependencies installed and shared packages built"
}

# Build services
build_services() {
    log_step "Building microservices..."
    
    cd "$WORKSPACE_ROOT"
    
    # Build all services
    log_info "Building backend service..."
    pnpm build --filter="@nexus/backend"
    
    log_info "Building analytics service..."
    pnpm build --filter="@nexus/analytics-service"
    
    log_info "Building notification service..."
    pnpm build --filter="@nexus/notification-service"
    
    log_info "Building API gateway..."
    pnpm build --filter="@nexus/api-gateway"
    
    log_info "Building copilot demo..."
    pnpm build --filter="@nexus/copilot-demo"
    
    log_info "Building frontend..."
    pnpm build --filter="@nexus/frontend"
    
    log_success "All services built successfully"
}

# Create Docker images
create_docker_images() {
    log_step "Creating Docker images..."
    
    cd "$WORKSPACE_ROOT"
    
    # Create Dockerfiles for services that don't have them
    create_dockerfile_if_missing "services/analytics" "analytics-service"
    create_dockerfile_if_missing "services/notification" "notification-service"
    create_dockerfile_if_missing "services/api-gateway" "api-gateway"
    
    log_success "Docker images prepared"
}

create_dockerfile_if_missing() {
    local service_path=$1
    local service_name=$2
    
    if [ ! -f "$service_path/Dockerfile" ]; then
        log_info "Creating Dockerfile for $service_name..."
        cat > "$service_path/Dockerfile" << EOF
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY pnpm-lock.yaml ./

# Install pnpm
RUN npm install -g pnpm

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Build the application
RUN pnpm build

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \\
  CMD curl -f http://localhost:3000/health || exit 1

# Start the application
CMD ["pnpm", "start:prod"]
EOF
    fi
}

# Start infrastructure services
start_infrastructure() {
    log_step "Starting infrastructure services..."
    
    cd "$WORKSPACE_ROOT"
    
    # Start Redis, PostgreSQL, and Elasticsearch
    docker-compose -f "$DOCKER_COMPOSE_FILE" up -d redis postgres elasticsearch
    
    # Wait for services to be healthy
    log_info "Waiting for infrastructure services to be ready..."
    sleep 15
    
    # Check if services are healthy
    if docker-compose -f "$DOCKER_COMPOSE_FILE" ps redis | grep -q "healthy"; then
        log_success "Redis is ready"
    else
        log_warning "Redis might not be fully ready yet"
    fi
    
    if docker-compose -f "$DOCKER_COMPOSE_FILE" ps postgres | grep -q "healthy"; then
        log_success "PostgreSQL is ready"
    else
        log_warning "PostgreSQL might not be fully ready yet"
    fi
    
    if docker-compose -f "$DOCKER_COMPOSE_FILE" ps elasticsearch | grep -q "healthy"; then
        log_success "Elasticsearch is ready"
    else
        log_warning "Elasticsearch might not be fully ready yet"
    fi
        log_warning "PostgreSQL might not be fully ready yet"
    fi
}

# Run database migrations
run_migrations() {
    log_step "Running database migrations..."
    
    cd "$WORKSPACE_ROOT/services/backend"
    
    # Generate Prisma client
    pnpm prisma generate
    
    # Run migrations
    pnpm prisma migrate deploy
    
    # Seed database (optional)
    if [ -f "prisma/seed.ts" ]; then
        log_info "Seeding database..."
        pnpm prisma db seed
    fi
    
    log_success "Database migrations completed"
}

# Start microservices
start_microservices() {
    log_step "Starting microservices..."
    
    cd "$WORKSPACE_ROOT"
    
    # Start core services first
    docker-compose -f "$DOCKER_COMPOSE_FILE" up -d backend analytics notification api-gateway
    
    # Wait for core services to start
    log_info "Waiting for core microservices to start..."
    sleep 15
    
    # Start additional business services
    docker-compose -f "$DOCKER_COMPOSE_FILE" up -d file-storage iam payment search email mobile-api ai-ml advanced-reporting
    
    # Wait for additional services to start
    log_info "Waiting for additional microservices to start..."
    sleep 10
    
    # Start frontend and demo apps
    docker-compose -f "$DOCKER_COMPOSE_FILE" up -d frontend copilot-demo
    
    log_success "All microservices started"
}

# Start monitoring services
start_monitoring() {
    log_step "Starting monitoring services..."
    
    cd "$WORKSPACE_ROOT"
    
    # Start monitoring stack
    docker-compose -f "$DOCKER_COMPOSE_FILE" up -d prometheus grafana jaeger redis-commander pgadmin
    
    log_success "Monitoring services started"
}

# Display service status
show_status() {
    log_step "Service Status:"
    
    cd "$WORKSPACE_ROOT"
    
    echo ""
    echo -e "${CYAN}🚀 Nexus Microservices Status${NC}"
    echo "=================================="
    
    # Core Services
    echo -e "${YELLOW}Core Services:${NC}"
    echo "• API Gateway:      http://localhost:3000"
    echo "• Backend Service:  http://localhost:3001"
    echo "• Frontend App:     http://localhost:3002"
    echo "• Analytics:        http://localhost:3003"
    echo "• Notifications:    http://localhost:3004"
    echo "• Copilot Demo:     http://localhost:3005"
    echo ""
    
    echo -e "${YELLOW}Business Services:${NC}"
    echo "• File Storage:     http://localhost:3006"
    echo "• IAM Service:      http://localhost:3007"
    echo "• Payment Service:  http://localhost:3008"
    echo "• Search Service:   http://localhost:3009"
    echo "• Email Service:    http://localhost:3010"
    echo "• Mobile API:       http://localhost:3011"
    echo "• AI/ML Service:    http://localhost:3012"
    echo "• Reporting:        http://localhost:3013"
    echo ""
    
    # Monitoring
    echo -e "${YELLOW}Monitoring & Admin:${NC}"
    echo "• Grafana:          http://localhost:3006 (admin/admin)"
    echo "• Prometheus:       http://localhost:9090"
    echo "• Jaeger:           http://localhost:16686"
    echo "• Elasticsearch:    http://localhost:9200"
    echo "• Redis Commander:  http://localhost:8081"
    echo "• pgAdmin:          http://localhost:8080 (admin@nexus.dev/admin)"
    echo ""
    
    # API Documentation
    echo -e "${YELLOW}API Documentation:${NC}"
    echo "• API Gateway Docs: http://localhost:3000/api/docs"
    echo "• Backend API Docs: http://localhost:3001/api/docs"
    echo "• Analytics Docs:   http://localhost:3003/api/docs"
    echo ""
    
    # Health Checks
    echo -e "${YELLOW}Health Checks:${NC}"
    echo "• API Gateway:      http://localhost:3000/health"
    echo "• Backend:          http://localhost:3001/health"
    echo "• Analytics:        http://localhost:3003/health"
    echo "• Notifications:    http://localhost:3004/health"
    echo ""
    
    # Docker status
    echo -e "${YELLOW}Docker Services:${NC}"
    docker-compose -f "$DOCKER_COMPOSE_FILE" ps
}

# Cleanup function
cleanup() {
    log_step "Cleaning up..."
    cd "$WORKSPACE_ROOT"
    docker-compose -f "$DOCKER_COMPOSE_FILE" down
}

# Main execution
main() {
    echo -e "${CYAN}"
    echo "╔══════════════════════════════════════════════════════════════╗"
    echo "║                    Nexus Microservices                       ║"
    echo "║                     Startup Script                           ║"
    echo "╚══════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
    
    # Parse command line arguments
    case "${1:-start}" in
        "start")
            check_prerequisites
            setup_environment
            install_dependencies
            build_services
            create_docker_images
            start_infrastructure
            sleep 5
            run_migrations
            start_microservices
            start_monitoring
            show_status
            ;;
        "stop")
            log_step "Stopping all services..."
            cleanup
            log_success "All services stopped"
            ;;
        "restart")
            log_step "Restarting all services..."
            cleanup
            sleep 2
            main start
            ;;
        "status")
            show_status
            ;;
        "logs")
            cd "$WORKSPACE_ROOT"
            docker-compose -f "$DOCKER_COMPOSE_FILE" logs -f "${2:-}"
            ;;
        "build")
            check_prerequisites
            install_dependencies
            build_services
            create_docker_images
            log_success "Build completed"
            ;;
        *)
            echo "Usage: $0 {start|stop|restart|status|logs [service]|build}"
            echo ""
            echo "Commands:"
            echo "  start    - Start all microservices (default)"
            echo "  stop     - Stop all microservices"
            echo "  restart  - Restart all microservices"
            echo "  status   - Show service status and URLs"
            echo "  logs     - Show logs for all services or specific service"
            echo "  build    - Build all services without starting"
            exit 1
            ;;
    esac
}

# Trap cleanup on script exit
trap cleanup EXIT

# Run main function
main "$@"
