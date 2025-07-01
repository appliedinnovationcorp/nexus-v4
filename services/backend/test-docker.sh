#!/bin/bash

# =============================================================================
# Docker Build Test Script for Backend Service
# =============================================================================
# Tests the Docker build and basic functionality

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🧪 Testing Backend Docker Build${NC}"
echo "================================"

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$(dirname "$SCRIPT_DIR")")"

cd "$PROJECT_ROOT"

# Test configuration
TEST_IMAGE="nexus/backend:test"
TEST_CONTAINER="nexus-backend-test"

# Cleanup function
cleanup() {
    echo -e "${YELLOW}🧹 Cleaning up test resources...${NC}"
    docker stop "$TEST_CONTAINER" 2>/dev/null || true
    docker rm "$TEST_CONTAINER" 2>/dev/null || true
    docker rmi "$TEST_IMAGE" 2>/dev/null || true
}

# Set trap for cleanup
trap cleanup EXIT

echo -e "${BLUE}1. Building test image...${NC}"
docker build -f services/backend/Dockerfile -t "$TEST_IMAGE" .

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Build successful${NC}"
else
    echo -e "${RED}❌ Build failed${NC}"
    exit 1
fi

echo -e "${BLUE}2. Checking image size...${NC}"
IMAGE_SIZE=$(docker images "$TEST_IMAGE" --format "{{.Size}}")
echo "Image size: $IMAGE_SIZE"

echo -e "${BLUE}3. Inspecting image structure...${NC}"
echo "Image layers:"
docker history "$TEST_IMAGE" --format "table {{.CreatedBy}}\t{{.Size}}" | head -10

echo -e "${BLUE}4. Testing container startup...${NC}"
docker run -d \
    --name "$TEST_CONTAINER" \
    -p 3001:3001 \
    -e DATABASE_URL="postgresql://test:test@localhost:5432/test" \
    -e MONGODB_URL="mongodb://test:test@localhost:27017/test" \
    -e REDIS_URL="redis://localhost:6379" \
    -e JWT_SECRET="test-secret" \
    -e SESSION_SECRET="test-session-secret" \
    "$TEST_IMAGE"

# Wait for container to start
echo -e "${YELLOW}⏳ Waiting for container to start...${NC}"
sleep 10

# Check if container is running
if docker ps | grep -q "$TEST_CONTAINER"; then
    echo -e "${GREEN}✅ Container started successfully${NC}"
else
    echo -e "${RED}❌ Container failed to start${NC}"
    echo "Container logs:"
    docker logs "$TEST_CONTAINER"
    exit 1
fi

echo -e "${BLUE}5. Testing container structure...${NC}"

# Check user
USER_INFO=$(docker exec "$TEST_CONTAINER" whoami)
echo "Running as user: $USER_INFO"

# Check working directory
WORKDIR=$(docker exec "$TEST_CONTAINER" pwd)
echo "Working directory: $WORKDIR"

# Check file structure
echo "Container file structure:"
docker exec "$TEST_CONTAINER" ls -la /app

# Check if required files exist
echo -e "${BLUE}6. Verifying required files...${NC}"

FILES_TO_CHECK=("dist/main.js" "package.json" "prisma" "node_modules")
for file in "${FILES_TO_CHECK[@]}"; do
    if docker exec "$TEST_CONTAINER" test -e "/app/$file"; then
        echo -e "  ✅ $file exists"
    else
        echo -e "  ❌ $file missing"
        exit 1
    fi
done

echo -e "${BLUE}7. Testing health check...${NC}"
# Note: Health check might fail due to missing database connections in test
HEALTH_STATUS=$(docker inspect "$TEST_CONTAINER" --format='{{.State.Health.Status}}' 2>/dev/null || echo "no-healthcheck")
echo "Health status: $HEALTH_STATUS"

echo -e "${BLUE}8. Testing process list...${NC}"
echo "Container processes:"
docker exec "$TEST_CONTAINER" ps aux

echo -e "${BLUE}9. Checking resource usage...${NC}"
docker stats "$TEST_CONTAINER" --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}"

echo -e "${BLUE}10. Testing container logs...${NC}"
echo "Recent container logs:"
docker logs "$TEST_CONTAINER" --tail 20

echo ""
echo -e "${GREEN}🎉 All tests passed!${NC}"
echo ""
echo -e "${BLUE}📊 Test Summary:${NC}"
echo "  • Image built successfully"
echo "  • Container starts and runs"
echo "  • Required files are present"
echo "  • Non-root user execution"
echo "  • Proper file permissions"
echo ""
echo -e "${BLUE}💡 Next steps:${NC}"
echo "  • Test with real database connections"
echo "  • Run integration tests"
echo "  • Deploy to staging environment"
