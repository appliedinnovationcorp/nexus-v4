#!/bin/bash

# =============================================================================
# Prisma Setup Script for Nexus Backend
# =============================================================================
# This script sets up Prisma ORM with the PostgreSQL database

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
BACKEND_DIR="$PROJECT_ROOT/services/backend"

echo -e "${BLUE}🔧 Prisma Setup for Nexus Backend${NC}"
echo "=================================="

# Change to backend directory
cd "$BACKEND_DIR"

# Check if .env file exists
if [ ! -f "$PROJECT_ROOT/.env" ]; then
    echo -e "${RED}❌ .env file not found in project root. Please run database setup first.${NC}"
    echo -e "${YELLOW}Run: ./scripts/db-setup.sh up${NC}"
    exit 1
fi

# Parse command line arguments
COMMAND=${1:-"setup"}

case $COMMAND in
    "setup"|"init")
        echo -e "${BLUE}🚀 Setting up Prisma...${NC}"
        
        # Install dependencies
        echo -e "${YELLOW}📦 Installing dependencies...${NC}"
        pnpm install
        
        # Generate Prisma client
        echo -e "${YELLOW}🔄 Generating Prisma client...${NC}"
        pnpm db:generate
        
        # Push schema to database (for development)
        echo -e "${YELLOW}📊 Pushing schema to database...${NC}"
        pnpm db:push
        
        # Seed the database
        echo -e "${YELLOW}🌱 Seeding database...${NC}"
        pnpm db:seed
        
        echo -e "${GREEN}✅ Prisma setup completed successfully!${NC}"
        echo ""
        echo -e "${BLUE}📋 What was set up:${NC}"
        echo "  - Prisma client generated"
        echo "  - Database schema synchronized"
        echo "  - Sample data seeded"
        echo ""
        echo -e "${BLUE}🔗 Available commands:${NC}"
        echo "  pnpm db:generate    - Generate Prisma client"
        echo "  pnpm db:push        - Push schema changes"
        echo "  pnpm db:migrate     - Create and run migrations"
        echo "  pnpm db:seed        - Seed database with sample data"
        echo "  pnpm db:studio      - Open Prisma Studio"
        echo "  pnpm db:reset       - Reset database and reseed"
        ;;
        
    "migrate")
        echo -e "${BLUE}🔄 Creating and running migration...${NC}"
        
        MIGRATION_NAME=${2:-"init"}
        
        # Create and run migration
        pnpm db:migrate --name "$MIGRATION_NAME"
        
        echo -e "${GREEN}✅ Migration completed successfully!${NC}"
        ;;
        
    "generate")
        echo -e "${BLUE}🔄 Generating Prisma client...${NC}"
        pnpm db:generate
        echo -e "${GREEN}✅ Prisma client generated!${NC}"
        ;;
        
    "push")
        echo -e "${BLUE}📊 Pushing schema to database...${NC}"
        pnpm db:push
        echo -e "${GREEN}✅ Schema pushed to database!${NC}"
        ;;
        
    "seed")
        echo -e "${BLUE}🌱 Seeding database...${NC}"
        pnpm db:seed
        echo -e "${GREEN}✅ Database seeded successfully!${NC}"
        ;;
        
    "reset")
        echo -e "${YELLOW}🔄 Resetting database...${NC}"
        echo -e "${RED}⚠️  This will delete all data and reseed the database${NC}"
        read -p "Are you sure? (y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            pnpm db:reset
            echo -e "${GREEN}✅ Database reset and reseeded!${NC}"
        else
            echo -e "${YELLOW}❌ Reset cancelled${NC}"
        fi
        ;;
        
    "studio")
        echo -e "${BLUE}🎨 Opening Prisma Studio...${NC}"
        echo -e "${YELLOW}Prisma Studio will open at http://localhost:5555${NC}"
        pnpm db:studio
        ;;
        
    "status")
        echo -e "${BLUE}📊 Prisma Status${NC}"
        echo ""
        
        # Check if Prisma client is generated
        if [ -d "node_modules/.prisma/client" ]; then
            echo -e "${GREEN}✅ Prisma client: Generated${NC}"
        else
            echo -e "${RED}❌ Prisma client: Not generated${NC}"
        fi
        
        # Check database connection
        echo -e "${YELLOW}🔍 Testing database connection...${NC}"
        if pnpm db:generate > /dev/null 2>&1; then
            echo -e "${GREEN}✅ Database: Connected${NC}"
        else
            echo -e "${RED}❌ Database: Connection failed${NC}"
        fi
        
        # Show migration status
        echo -e "${YELLOW}📋 Migration status:${NC}"
        if [ -d "prisma/migrations" ]; then
            echo "  Migrations directory exists"
            MIGRATION_COUNT=$(find prisma/migrations -name "*.sql" | wc -l)
            echo "  Migration files: $MIGRATION_COUNT"
        else
            echo "  No migrations directory (using db push mode)"
        fi
        ;;
        
    "format")
        echo -e "${BLUE}💅 Formatting Prisma schema...${NC}"
        pnpm db:format
        echo -e "${GREEN}✅ Schema formatted!${NC}"
        ;;
        
    "help"|"-h"|"--help")
        echo -e "${BLUE}Prisma Setup Script${NC}"
        echo ""
        echo -e "${YELLOW}Usage:${NC}"
        echo "  $0 [command] [options]"
        echo ""
        echo -e "${YELLOW}Commands:${NC}"
        echo "  setup, init           Set up Prisma (generate, push, seed)"
        echo "  migrate [name]        Create and run migration"
        echo "  generate              Generate Prisma client"
        echo "  push                  Push schema to database"
        echo "  seed                  Seed database with sample data"
        echo "  reset                 Reset database and reseed"
        echo "  studio                Open Prisma Studio"
        echo "  status                Show Prisma status"
        echo "  format                Format Prisma schema"
        echo "  help                  Show this help message"
        echo ""
        echo -e "${YELLOW}Examples:${NC}"
        echo "  $0 setup              # Complete Prisma setup"
        echo "  $0 migrate init       # Create initial migration"
        echo "  $0 studio             # Open Prisma Studio"
        echo "  $0 reset              # Reset and reseed database"
        ;;
        
    *)
        echo -e "${RED}❌ Unknown command: $COMMAND${NC}"
        echo -e "${BLUE}Use '$0 help' to see available commands${NC}"
        exit 1
        ;;
esac
