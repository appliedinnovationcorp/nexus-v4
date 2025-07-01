#!/bin/bash

# =============================================================================
# Backend Service Docker Build Script
# =============================================================================
# Builds the NestJS backend service with multi-stage optimization

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Building NestJS Backend Service${NC}"
echo "=================================="

# Script directory (services/backend)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# Project root (two levels up)
PROJECT_ROOT="$(dirname "$(dirname "$SCRIPT_DIR")")"

# Change to project root for build context
cd "$PROJECT_ROOT"

# Default values
IMAGE_NAME=${IMAGE_NAME:-"nexus/backend"}
TAG=${TAG:-"latest"}
PLATFORM=${PLATFORM:-"linux/amd64"}
PUSH=${PUSH:-false}
NO_CACHE=${NO_CACHE:-false}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --image)
            IMAGE_NAME="$2"
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
            NO_CACHE=true
            shift
            ;;
        --help|-h)
            echo -e "${BLUE}Usage: $0 [OPTIONS]${NC}"
            echo ""
            echo -e "${YELLOW}Options:${NC}"
            echo "  --image IMAGE     Docker image name (default: nexus/backend)"
            echo "  --tag TAG         Image tag (default: latest)"
            echo "  --platform ARCH   Target platform (default: linux/amd64)"
            echo "  --push            Push image to registry"
            echo "  --no-cache        Build without cache"
            echo "  --help, -h        Show this help message"
            echo ""
            echo -e "${YELLOW}Examples:${NC}"
            echo "  $0                                    # Build with defaults"
            echo "  $0 --tag v1.0.0 --push              # Build and push specific version"
            echo "  $0 --platform linux/arm64 --no-cache # Build for ARM64 without cache"
            exit 0
            ;;
        *)
            echo -e "${RED}❌ Unknown option: $1${NC}"
            echo -e "${BLUE}Use '$0 --help' to see available options${NC}"
            exit 1
            ;;
    esac
done

# Build configuration
FULL_IMAGE_NAME="${IMAGE_NAME}:${TAG}"

# Cache configuration
CACHE_FLAGS=""
if [ "$NO_CACHE" = false ]; then
    CACHE_FLAGS="--cache-from=type=local,src=/tmp/.buildx-cache-backend --cache-to=type=local,dest=/tmp/.buildx-cache-backend-new,mode=max"
fi

# Push configuration
if [ "$PUSH" = true ]; then
    PUSH_FLAG="--push"
else
    PUSH_FLAG="--load"
fi

echo -e "${BLUE}📋 Build Configuration:${NC}"
echo "  Image: $FULL_IMAGE_NAME"
echo "  Platform: $PLATFORM"
echo "  Context: $PROJECT_ROOT"
echo "  Dockerfile: services/backend/Dockerfile"
echo "  Push: $PUSH"
echo "  Cache: $([ "$NO_CACHE" = true ] && echo "disabled" || echo "enabled")"
echo ""

# Pre-build checks
echo -e "${BLUE}🔍 Pre-build checks...${NC}"

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}❌ Docker is not running${NC}"
    exit 1
fi

# Check if Dockerfile exists
if [ ! -f "services/backend/Dockerfile" ]; then
    echo -e "${RED}❌ Dockerfile not found: services/backend/Dockerfile${NC}"
    exit 1
fi

# Check if package.json exists
if [ ! -f "services/backend/package.json" ]; then
    echo -e "${RED}❌ package.json not found: services/backend/package.json${NC}"
    exit 1
fi

# Setup buildx if not exists
if ! docker buildx ls | grep -q "backend-builder"; then
    echo -e "${YELLOW}🔧 Setting up Docker Buildx...${NC}"
    docker buildx create --name backend-builder --use
    docker buildx inspect --bootstrap
fi

# Build the image
echo -e "${BLUE}🔨 Building backend image...${NC}"

docker buildx build \
    --platform "$PLATFORM" \
    --file services/backend/Dockerfile \
    --tag "$FULL_IMAGE_NAME" \
    $CACHE_FLAGS \
    $PUSH_FLAG \
    .

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Successfully built backend image${NC}"
else
    echo -e "${RED}❌ Failed to build backend image${NC}"
    exit 1
fi

# Update cache
if [ "$NO_CACHE" = false ] && [ -d "/tmp/.buildx-cache-backend-new" ]; then
    echo -e "${BLUE}🗂️ Updating build cache...${NC}"
    rm -rf /tmp/.buildx-cache-backend
    mv /tmp/.buildx-cache-backend-new /tmp/.buildx-cache-backend
fi

# Show image info
echo ""
echo -e "${GREEN}🎉 Build completed successfully!${NC}"
echo ""
echo -e "${BLUE}📊 Image Information:${NC}"
if [ "$PUSH" = false ]; then
    docker images "$IMAGE_NAME" --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}\t{{.CreatedAt}}"
fi

echo ""
echo -e "${BLUE}🚀 Next steps:${NC}"
echo "  • Test the image: docker run --rm -p 3001:3001 $FULL_IMAGE_NAME"
echo "  • Run with compose: docker-compose -f services/backend/docker-compose.yml up"
echo "  • Check health: curl http://localhost:3001/health/live"

if [ "$PUSH" = true ]; then
    echo "  • Image pushed to registry: $FULL_IMAGE_NAME"
else
    echo "  • Push to registry: $0 --push"
fi
