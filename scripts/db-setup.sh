#!/bin/bash

# Database setup script for Nexus Workspace
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
DB_NAME="nexus_dev"
DB_USER="nexus_user"
DB_PASSWORD="nexus_password"
DB_HOST="localhost"
DB_PORT="5432"

# Redis configuration
REDIS_HOST="localhost"
REDIS_PORT="6379"

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to check if PostgreSQL is running
check_postgres() {
    if command_exists psql; then
        if pg_isready -h $DB_HOST -p $DB_PORT >/dev/null 2>&1; then
            return 0
        fi
    fi
    return 1
}

# Function to check if Redis is running
check_redis() {
    if command_exists redis-cli; then
        if redis-cli -h $REDIS_HOST -p $REDIS_PORT ping >/dev/null 2>&1; then
            return 0
        fi
    fi
    return 1
}

# Function to start services with Docker Compose
start_services() {
    print_status "Starting database services with Docker Compose..."
    
    if [ -f "docker-compose.yml" ]; then
        docker-compose up -d postgres redis
        
        # Wait for services to be ready
        print_status "Waiting for PostgreSQL to be ready..."
        for i in {1..30}; do
            if check_postgres; then
                print_status "PostgreSQL is ready!"
                break
            fi
            sleep 2
        done
        
        print_status "Waiting for Redis to be ready..."
        for i in {1..30}; do
            if check_redis; then
                print_status "Redis is ready!"
                break
            fi
            sleep 2
        done
    else
        print_error "docker-compose.yml not found. Please ensure you're in the project root."
        exit 1
    fi
}

# Function to setup database
setup_database() {
    print_status "Setting up PostgreSQL database..."
    
    # Create database if it doesn't exist
    if ! psql -h $DB_HOST -p $DB_PORT -U postgres -lqt | cut -d \| -f 1 | grep -qw $DB_NAME; then
        print_status "Creating database: $DB_NAME"
        createdb -h $DB_HOST -p $DB_PORT -U postgres $DB_NAME
    else
        print_status "Database $DB_NAME already exists"
    fi
    
    # Create user if it doesn't exist
    if ! psql -h $DB_HOST -p $DB_PORT -U postgres -t -c "SELECT 1 FROM pg_roles WHERE rolname='$DB_USER'" | grep -q 1; then
        print_status "Creating database user: $DB_USER"
        psql -h $DB_HOST -p $DB_PORT -U postgres -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASSWORD';"
        psql -h $DB_HOST -p $DB_PORT -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;"
    else
        print_status "Database user $DB_USER already exists"
    fi
}

# Function to run database migrations
run_migrations() {
    print_status "Running database migrations..."
    
    if [ -d "services/backend" ]; then
        cd services/backend
        if [ -f "package.json" ]; then
            pnpm db:migrate
            print_status "Database migrations completed"
        else
            print_warning "Backend package.json not found, skipping migrations"
        fi
        cd ../..
    else
        print_warning "Backend service not found, skipping migrations"
    fi
}

# Function to seed database
seed_database() {
    print_status "Seeding database with initial data..."
    
    if [ -d "services/backend" ]; then
        cd services/backend
        if [ -f "package.json" ]; then
            pnpm db:seed
            print_status "Database seeding completed"
        else
            print_warning "Backend package.json not found, skipping seeding"
        fi
        cd ../..
    else
        print_warning "Backend service not found, skipping seeding"
    fi
}

# Function to reset database
reset_database() {
    print_warning "Resetting database - this will delete all data!"
    read -p "Are you sure you want to continue? (y/N): " -n 1 -r
    echo
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        print_status "Resetting database..."
        
        if [ -d "services/backend" ]; then
            cd services/backend
            if [ -f "package.json" ]; then
                pnpm db:reset
                print_status "Database reset completed"
            fi
            cd ../..
        fi
    else
        print_status "Database reset cancelled"
    fi
}

# Function to stop services
stop_services() {
    print_status "Stopping database services..."
    
    if [ -f "docker-compose.yml" ]; then
        docker-compose stop postgres redis
        print_status "Services stopped"
    fi
}

# Function to show database status
show_status() {
    print_status "Database Status:"
    echo "=================="
    
    if check_postgres; then
        echo -e "PostgreSQL: ${GREEN}Running${NC} (${DB_HOST}:${DB_PORT})"
    else
        echo -e "PostgreSQL: ${RED}Not Running${NC}"
    fi
    
    if check_redis; then
        echo -e "Redis: ${GREEN}Running${NC} (${REDIS_HOST}:${REDIS_PORT})"
    else
        echo -e "Redis: ${RED}Not Running${NC}"
    fi
    
    echo "=================="
}

# Main script logic
case "$1" in
    "up"|"start")
        start_services
        setup_database
        run_migrations
        seed_database
        show_status
        ;;
    "stop")
        stop_services
        ;;
    "reset")
        reset_database
        ;;
    "migrate")
        run_migrations
        ;;
    "seed")
        seed_database
        ;;
    "status")
        show_status
        ;;
    *)
        echo "Usage: $0 {up|start|stop|reset|migrate|seed|status}"
        echo ""
        echo "Commands:"
        echo "  up/start  - Start database services and setup"
        echo "  stop      - Stop database services"
        echo "  reset     - Reset database (WARNING: deletes all data)"
        echo "  migrate   - Run database migrations"
        echo "  seed      - Seed database with initial data"
        echo "  status    - Show database status"
        exit 1
        ;;
esac
