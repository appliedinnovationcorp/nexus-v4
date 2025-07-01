#!/bin/bash

# =============================================================================
# Docker Build Script for Nexus Workspace
# =============================================================================
# This script builds Docker images for the Nexus workspace applications
# with proper tagging, caching, and multi-architecture support.

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

echo -e "${BLUE}🐳 Nexus Docker Build Script${NC}"
echo "=================================="

# Change to project root
cd "$PROJECT_ROOT"

# Default values
REGISTRY=${REGISTRY:-"nexus"}
TAG=${TAG:-"latest"}
PLATFORM=${PLATFORM:-"linux/amd64,linux/arm64"}
PUSH=${PUSH:-false}
CACHE=${CACHE:-true}
PARALLEL=${PARALLEL:-true}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --registry)
            REGISTRY="$2"
            shift 2
            ;;
        --tag)
            TAG="$2"
            shift 2
            ;;
        --platform)
            PLATFORM="$2"
            shift 2
            ;;
        --push)
            PUSH=true
            shift
            ;;
        --no-cache)
            CACHE=false
            shift
            ;;
        --sequential)
            PARALLEL=false
            shift
            ;;
        --help|-h)
            echo -e "${BLUE}Usage: $0 [OPTIONS] [TARGETS]${NC}"
            echo ""
            echo -e "${YELLOW}Options:${NC}"
            echo "  --registry REGISTRY    Docker registry (default: nexus)"
            echo "  --tag TAG             Image tag (default: latest)"
            echo "  --platform PLATFORMS  Target platforms (default: linux/amd64,linux/arm64)"
            echo "  --push                Push images to registry"
            echo "  --no-cache            Disable build cache"
            echo "  --sequential          Build images sequentially"
            echo "  --help, -h            Show this help message"
            echo ""
            echo -e "${YELLOW}Targets:${NC}"
            echo "  frontend              Build frontend image only"
            echo "  backend               Build backend image only"
            echo "  all                   Build all images (default)"
            echo ""
            echo -e "${YELLOW}Examples:${NC}"
            echo "  $0                                    # Build all images"
            echo "  $0 frontend                           # Build frontend only"
            echo "  $0 --registry myregistry.com --push   # Build and push to registry"
            echo "  $0 --tag v1.0.0 --platform linux/amd64 # Build specific version for AMD64"
            exit 0
            ;;
        *)
            TARGETS+=("$1")
            shift
            ;;
    esac
done

# Set default targets if none specified
if [ ${#TARGETS[@]} -eq 0 ]; then
    TARGETS=("all")
fi

# Build configuration
FRONTEND_IMAGE="${REGISTRY}/frontend:${TAG}"
BACKEND_IMAGE="${REGISTRY}/backend:${TAG}"
WORKSPACE_IMAGE="${REGISTRY}/workspace:${TAG}"

# Cache configuration
if [ "$CACHE" = true ]; then
    CACHE_FROM="--cache-from=type=local,src=/tmp/.buildx-cache"
    CACHE_TO="--cache-to=type=local,dest=/tmp/.buildx-cache-new,mode=max"
else
    CACHE_FROM=""
    CACHE_TO=""
fi

# Push configuration
if [ "$PUSH" = true ]; then
    PUSH_FLAG="--push"
else
    PUSH_FLAG="--load"
fi

# Function to build image
build_image() {
    local name=$1
    local dockerfile=$2
    local context=$3
    local image=$4
    local target=${5:-""}
    
    echo -e "${BLUE}🔨 Building $name image...${NC}"
    echo "  Image: $image"
    echo "  Dockerfile: $dockerfile"
    echo "  Context: $context"
    echo "  Platform: $PLATFORM"
    
    local target_flag=""
    if [ -n "$target" ]; then
        target_flag="--target $target"
    fi
    
    docker buildx build \
        --platform "$PLATFORM" \
        --file "$dockerfile" \
        --tag "$image" \
        $target_flag \
        $CACHE_FROM \
        $CACHE_TO \
        $PUSH_FLAG \
        "$context"
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Successfully built $name image${NC}"
    else
        echo -e "${RED}❌ Failed to build $name image${NC}"
        exit 1
    fi
}

# Function to build frontend
build_frontend() {
    echo -e "${YELLOW}📦 Building Frontend Application${NC}"
    build_image "frontend" "apps/frontend/Dockerfile" "." "$FRONTEND_IMAGE" "runner"
}

# Function to build backend
build_backend() {
    echo -e "${YELLOW}🚀 Building Backend Application${NC}"
    build_image "backend" "services/backend/Dockerfile" "." "$BACKEND_IMAGE" "runner"
}

# Function to build workspace
build_workspace() {
    echo -e "${YELLOW}🏗️ Building Complete Workspace${NC}"
    build_image "workspace" "Dockerfile" "." "$WORKSPACE_IMAGE"
}

# Setup buildx if not exists
if ! docker buildx ls | grep -q "nexus-builder"; then
    echo -e "${YELLOW}🔧 Setting up Docker Buildx...${NC}"
    docker buildx create --name nexus-builder --use
    docker buildx inspect --bootstrap
fi

# Pre-build checks
echo -e "${BLUE}🔍 Pre-build checks...${NC}"

# Check if .env file exists
if [ ! -f .env ]; then
    echo -e "${YELLOW}⚠️  .env file not found. Some environment variables may not be available.${NC}"
fi

# Check Docker daemon
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}❌ Docker daemon is not running${NC}"
    exit 1
fi

# Check available disk space
AVAILABLE_SPACE=$(df . | tail -1 | awk '{print $4}')
if [ "$AVAILABLE_SPACE" -lt 2097152 ]; then # 2GB in KB
    echo -e "${YELLOW}⚠️  Low disk space. Available: $(($AVAILABLE_SPACE / 1024))MB${NC}"
fi

# Build images based on targets
for target in "${TARGETS[@]}"; do
    case $target in
        "frontend")
            build_frontend
            ;;
        "backend")
            build_backend
            ;;
        "workspace")
            build_workspace
            ;;
        "all")
            if [ "$PARALLEL" = true ]; then
                echo -e "${BLUE}🔄 Building all images in parallel...${NC}"
                build_frontend &
                FRONTEND_PID=$!
                build_backend &
                BACKEND_PID=$!
                
                wait $FRONTEND_PID
                FRONTEND_STATUS=$?
                wait $BACKEND_PID
                BACKEND_STATUS=$?
                
                if [ $FRONTEND_STATUS -ne 0 ] || [ $BACKEND_STATUS -ne 0 ]; then
                    echo -e "${RED}❌ One or more builds failed${NC}"
                    exit 1
                fi
            else
                echo -e "${BLUE}🔄 Building all images sequentially...${NC}"
                build_frontend
                build_backend
            fi
            ;;
        *)
            echo -e "${RED}❌ Unknown target: $target${NC}"
            echo -e "${BLUE}Available targets: frontend, backend, workspace, all${NC}"
            exit 1
            ;;
    esac
done

# Cache management
if [ "$CACHE" = true ] && [ -d "/tmp/.buildx-cache-new" ]; then
    echo -e "${BLUE}🗂️ Updating build cache...${NC}"
    rm -rf /tmp/.buildx-cache
    mv /tmp/.buildx-cache-new /tmp/.buildx-cache
fi

# Summary
echo ""
echo -e "${GREEN}🎉 Build completed successfully!${NC}"
echo ""
echo -e "${BLUE}📊 Built Images:${NC}"

for target in "${TARGETS[@]}"; do
    case $target in
        "frontend"|"all")
            echo "  📦 Frontend: $FRONTEND_IMAGE"
            ;;
        "backend"|"all")
            echo "  🚀 Backend: $BACKEND_IMAGE"
            ;;
        "workspace")
            echo "  🏗️ Workspace: $WORKSPACE_IMAGE"
            ;;
    esac
done

if [ "$PUSH" = true ]; then
    echo ""
    echo -e "${GREEN}📤 Images pushed to registry: $REGISTRY${NC}"
else
    echo ""
    echo -e "${YELLOW}💡 To push images to registry, use --push flag${NC}"
fi

echo ""
echo -e "${BLUE}🚀 Next steps:${NC}"
echo "  • Test images: docker run --rm -p 3000:3000 $FRONTEND_IMAGE"
echo "  • Deploy: docker-compose -f docker-compose.prod.yml up -d"
echo "  • Monitor: docker stats"
