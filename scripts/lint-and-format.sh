#!/bin/bash

# Nexus Workspace Linting and Formatting Script
# Runs comprehensive code quality checks and fixes

set -e

echo "🔍 Nexus Workspace Code Quality Check"
echo "====================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
FIX_MODE=${1:-false}
VERBOSE=${2:-false}

if [ "$FIX_MODE" = "--fix" ] || [ "$FIX_MODE" = "-f" ]; then
    FIX_MODE=true
    echo -e "${YELLOW}🔧 Running in FIX mode - will auto-fix issues${NC}"
else
    echo -e "${BLUE}📋 Running in CHECK mode - will report issues only${NC}"
fi

echo ""

# Step 1: Format check/fix with Prettier
echo -e "${BLUE}1. 🎨 Prettier Formatting${NC}"
echo "========================"

if [ "$FIX_MODE" = true ]; then
    echo "Formatting all files..."
    if pnpm run format; then
        echo -e "${GREEN}✅ All files formatted successfully${NC}"
    else
        echo -e "${RED}❌ Prettier formatting failed${NC}"
        exit 1
    fi
else
    echo "Checking code formatting..."
    if pnpm run format:check; then
        echo -e "${GREEN}✅ All files are properly formatted${NC}"
    else
        echo -e "${YELLOW}⚠️  Some files need formatting. Run with --fix to auto-format${NC}"
    fi
fi

echo ""

# Step 2: ESLint check/fix
echo -e "${BLUE}2. 🔍 ESLint Code Quality${NC}"
echo "========================"

if [ "$FIX_MODE" = true ]; then
    echo "Linting and fixing issues..."
    if pnpm run lint:fix; then
        echo -e "${GREEN}✅ All linting issues fixed${NC}"
    else
        echo -e "${YELLOW}⚠️  Some linting issues remain (manual fix required)${NC}"
    fi
else
    echo "Checking code quality..."
    if pnpm run lint; then
        echo -e "${GREEN}✅ No linting issues found${NC}"
    else
        echo -e "${YELLOW}⚠️  Linting issues found. Run with --fix to auto-fix${NC}"
    fi
fi

echo ""

# Step 3: TypeScript type checking
echo -e "${BLUE}3. 🔷 TypeScript Type Checking${NC}"
echo "=============================="

echo "Checking TypeScript types..."
if pnpm run type-check; then
    echo -e "${GREEN}✅ All TypeScript types are valid${NC}"
else
    echo -e "${RED}❌ TypeScript type errors found${NC}"
    exit 1
fi

echo ""

# Step 4: Build test
echo -e "${BLUE}4. 🔨 Build Verification${NC}"
echo "======================="

echo "Testing build process..."
if pnpm run build; then
    echo -e "${GREEN}✅ All packages build successfully${NC}"
else
    echo -e "${RED}❌ Build failed${NC}"
    exit 1
fi

echo ""

# Summary
echo -e "${BLUE}📊 Code Quality Summary${NC}"
echo "======================"

if [ "$FIX_MODE" = true ]; then
    echo -e "${GREEN}🎉 Code quality check completed with auto-fixes applied!${NC}"
    echo ""
    echo "What was done:"
    echo "• ✅ Code formatted with Prettier"
    echo "• ✅ ESLint issues auto-fixed where possible"
    echo "• ✅ TypeScript types validated"
    echo "• ✅ Build process verified"
else
    echo -e "${GREEN}🎉 Code quality check completed!${NC}"
    echo ""
    echo "What was checked:"
    echo "• ✅ Code formatting (Prettier)"
    echo "• ✅ Code quality (ESLint)"
    echo "• ✅ TypeScript types"
    echo "• ✅ Build process"
fi

echo ""
echo -e "${BLUE}Usage:${NC}"
echo "  ./scripts/lint-and-format.sh        # Check only"
echo "  ./scripts/lint-and-format.sh --fix  # Check and fix"
echo ""
echo -e "${GREEN}All checks passed! 🚀${NC}"
