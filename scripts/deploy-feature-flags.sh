#!/bin/bash

# Deploy Feature Flag System Script
# This script deploys Unleash feature flag server and configures the system

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
NAMESPACE="feature-flags"
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo -e "${BLUE}🚀 Deploying Feature Flag System${NC}"
echo "=================================="

# Check if kubectl is available
if ! command -v kubectl &> /dev/null; then
    echo -e "${RED}❌ kubectl is not installed or not in PATH${NC}"
    exit 1
fi

# Check if we can connect to the cluster
if ! kubectl cluster-info &> /dev/null; then
    echo -e "${RED}❌ Cannot connect to Kubernetes cluster${NC}"
    echo "Please ensure your kubeconfig is properly configured"
    exit 1
fi

echo -e "${GREEN}✅ Kubernetes cluster connection verified${NC}"

# Function to wait for deployment
wait_for_deployment() {
    local namespace=$1
    local deployment=$2
    local timeout=${3:-300}
    
    echo -e "${YELLOW}⏳ Waiting for deployment $deployment in namespace $namespace...${NC}"
    
    if kubectl wait --for=condition=available --timeout=${timeout}s deployment/$deployment -n $namespace; then
        echo -e "${GREEN}✅ Deployment $deployment is ready${NC}"
    else
        echo -e "${RED}❌ Deployment $deployment failed to become ready${NC}"
        return 1
    fi
}

# Function to create namespace if it doesn't exist
create_namespace() {
    local namespace=$1
    
    if kubectl get namespace $namespace &> /dev/null; then
        echo -e "${YELLOW}⚠️  Namespace $namespace already exists${NC}"
    else
        echo -e "${BLUE}📦 Creating namespace $namespace${NC}"
        kubectl create namespace $namespace
        echo -e "${GREEN}✅ Namespace $namespace created${NC}"
    fi
}

# Deploy Unleash
deploy_unleash() {
    echo -e "\n${BLUE}🎯 Deploying Unleash Feature Flag Server${NC}"
    
    create_namespace $NAMESPACE
    
    # Deploy Unleash
    echo -e "${BLUE}📊 Deploying Unleash...${NC}"
    kubectl apply -f k8s/feature-flags/unleash.yaml
    
    # Wait for PostgreSQL first
    wait_for_deployment $NAMESPACE unleash-postgres
    
    # Wait for Unleash
    wait_for_deployment $NAMESPACE unleash
    
    echo -e "${GREEN}✅ Unleash deployed successfully${NC}"
}

# Configure initial feature flags
configure_initial_flags() {
    echo -e "\n${BLUE}⚙️  Configuring Initial Feature Flags${NC}"
    
    # Get Unleash service URL
    UNLEASH_URL="http://$(kubectl get svc unleash -n $NAMESPACE -o jsonpath='{.spec.clusterIP}'):4242"
    
    # Wait for Unleash to be fully ready
    echo -e "${YELLOW}⏳ Waiting for Unleash API to be ready...${NC}"
    sleep 30
    
    # Port forward to access Unleash API
    kubectl port-forward svc/unleash 4242:4242 -n $NAMESPACE &
    PORT_FORWARD_PID=$!
    
    # Wait for port forward to be ready
    sleep 5
    
    # Create initial feature flags using Unleash API
    echo -e "${BLUE}🎛️  Creating initial feature flags...${NC}"
    
    # Function to create a feature flag
    create_flag() {
        local flag_name=$1
        local description=$2
        local enabled=${3:-false}
        
        curl -X POST "http://localhost:4242/api/admin/projects/default/features" \
            -H "Content-Type: application/json" \
            -H "Authorization: default:development.unleash-insecure-api-token" \
            -d "{
                \"name\": \"$flag_name\",
                \"description\": \"$description\",
                \"type\": \"release\",
                \"enabled\": $enabled
            }" \
            --silent --show-error || echo "Flag $flag_name may already exist"
    }
    
    # Create initial flags
    create_flag "new-dashboard" "Enable the new dashboard UI" false
    create_flag "dark-mode" "Enable dark mode theme" true
    create_flag "advanced-search" "Enable advanced search functionality" false
    create_flag "beta-features" "Enable beta features for testing" false
    create_flag "premium-features" "Enable premium features" false
    create_flag "analytics-dashboard" "Enable analytics dashboard" true
    create_flag "export-functionality" "Enable data export functionality" false
    create_flag "collaboration-tools" "Enable collaboration tools" false
    create_flag "new-api-version" "Enable new API version" false
    create_flag "enhanced-security" "Enable enhanced security features" true
    create_flag "performance-optimizations" "Enable performance optimizations" true
    create_flag "experimental-features" "Enable experimental features" false
    create_flag "checkout-flow-v2" "A/B test for checkout flow" false
    create_flag "onboarding-flow-v2" "A/B test for onboarding flow" false
    create_flag "pricing-page-v2" "A/B test for pricing page" false
    create_flag "maintenance-mode" "Enable maintenance mode" false
    create_flag "read-only-mode" "Enable read-only mode" false
    create_flag "rate-limiting" "Enable rate limiting" true
    create_flag "debug-mode" "Enable debug mode" false
    
    # Kill port forward
    kill $PORT_FORWARD_PID 2>/dev/null || true
    
    echo -e "${GREEN}✅ Initial feature flags configured${NC}"
}

# Configure application environment
configure_application() {
    echo -e "\n${BLUE}⚙️  Configuring Application Environment${NC}"
    
    # Create ConfigMap for feature flag configuration
    kubectl create configmap feature-flag-config \
        --from-literal=FEATURE_FLAG_PROVIDER=unleash \
        --from-literal=UNLEASH_URL=http://unleash.feature-flags.svc.cluster.local:4242/api \
        --from-literal=UNLEASH_APP_NAME=nexus-workspace \
        --from-literal=UNLEASH_CLIENT_KEY=default:development.unleash-insecure-api-token \
        -n default \
        --dry-run=client -o yaml | kubectl apply -f -
    
    echo -e "${GREEN}✅ Application environment configured${NC}"
}

# Get access information
get_access_info() {
    echo -e "\n${BLUE}🔗 Access Information${NC}"
    echo "=================================="
    
    # Unleash access
    echo -e "${GREEN}🎯 Unleash Feature Flag Dashboard:${NC}"
    echo "   Port forward: kubectl port-forward svc/unleash 4242:4242 -n $NAMESPACE"
    echo "   Then access: http://localhost:4242"
    echo "   Username: admin"
    echo "   Password: unleash4all"
    
    # Get LoadBalancer IP if available
    UNLEASH_EXTERNAL_IP=$(kubectl get svc unleash -n $NAMESPACE -o jsonpath='{.status.loadBalancer.ingress[0].ip}' 2>/dev/null || echo "")
    if [ -n "$UNLEASH_EXTERNAL_IP" ]; then
        echo "   External IP: http://$UNLEASH_EXTERNAL_IP:4242"
    fi
    
    # API endpoints
    echo -e "\n${GREEN}🔌 Feature Flag API Endpoints:${NC}"
    echo "   All flags: GET /api/feature-flags/all"
    echo "   Single flag: GET /api/feature-flags/{flagKey}"
    echo "   Flag variant: GET /api/feature-flags/{flagKey}/variant"
    echo "   Evaluate flags: POST /api/feature-flags/evaluate"
    
    echo -e "\n${BLUE}📋 Useful Commands:${NC}"
    echo "   View Unleash logs: kubectl logs -f deployment/unleash -n $NAMESPACE"
    echo "   View PostgreSQL logs: kubectl logs -f deployment/unleash-postgres -n $NAMESPACE"
    echo "   Restart Unleash: kubectl rollout restart deployment/unleash -n $NAMESPACE"
    echo "   Access Unleash shell: kubectl exec -it deployment/unleash -n $NAMESPACE -- sh"
}

# Health check
health_check() {
    echo -e "\n${BLUE}🏥 Running Health Checks${NC}"
    echo "=================================="
    
    # Check PostgreSQL
    if kubectl get deployment unleash-postgres -n $NAMESPACE &> /dev/null; then
        if kubectl get pods -n $NAMESPACE -l app=unleash-postgres | grep -q "Running"; then
            echo -e "${GREEN}✅ PostgreSQL is running${NC}"
        else
            echo -e "${RED}❌ PostgreSQL is not running${NC}"
        fi
    fi
    
    # Check Unleash
    if kubectl get deployment unleash -n $NAMESPACE &> /dev/null; then
        if kubectl get pods -n $NAMESPACE -l app=unleash | grep -q "Running"; then
            echo -e "${GREEN}✅ Unleash is running${NC}"
            
            # Test API endpoint
            kubectl port-forward svc/unleash 4242:4242 -n $NAMESPACE &
            PORT_FORWARD_PID=$!
            sleep 3
            
            if curl -s "http://localhost:4242/health" > /dev/null; then
                echo -e "${GREEN}✅ Unleash API is responding${NC}"
            else
                echo -e "${YELLOW}⚠️  Unleash API not responding yet${NC}"
            fi
            
            kill $PORT_FORWARD_PID 2>/dev/null || true
        else
            echo -e "${RED}❌ Unleash is not running${NC}"
        fi
    fi
}

# Cleanup function
cleanup() {
    echo -e "\n${YELLOW}🧹 Cleaning up feature flag system...${NC}"
    
    kubectl delete -f k8s/feature-flags/unleash.yaml --ignore-not-found=true
    kubectl delete configmap feature-flag-config -n default --ignore-not-found=true
    kubectl delete namespace $NAMESPACE --ignore-not-found=true
    
    echo -e "${GREEN}✅ Feature flag system cleaned up${NC}"
}

# Demo feature flag toggle
demo_toggle() {
    echo -e "\n${BLUE}🎭 Feature Flag Demo${NC}"
    echo "=================================="
    
    # Port forward to Unleash
    kubectl port-forward svc/unleash 4242:4242 -n $NAMESPACE &
    PORT_FORWARD_PID=$!
    sleep 3
    
    echo -e "${YELLOW}Toggling 'new-dashboard' feature flag...${NC}"
    
    # Toggle the flag
    curl -X POST "http://localhost:4242/api/admin/projects/default/features/new-dashboard/environments/development/on" \
        -H "Authorization: default:development.unleash-insecure-api-token" \
        --silent
    
    echo -e "${GREEN}✅ Feature flag 'new-dashboard' enabled${NC}"
    echo -e "${BLUE}Check your application to see the new dashboard!${NC}"
    
    sleep 5
    
    echo -e "${YELLOW}Disabling 'new-dashboard' feature flag...${NC}"
    
    curl -X POST "http://localhost:4242/api/admin/projects/default/features/new-dashboard/environments/development/off" \
        -H "Authorization: default:development.unleash-insecure-api-token" \
        --silent
    
    echo -e "${GREEN}✅ Feature flag 'new-dashboard' disabled${NC}"
    echo -e "${BLUE}The application should now show the old dashboard!${NC}"
    
    kill $PORT_FORWARD_PID 2>/dev/null || true
}

# Main execution
main() {
    case "${1:-deploy}" in
        "deploy")
            deploy_unleash
            configure_initial_flags
            configure_application
            health_check
            get_access_info
            ;;
        "cleanup")
            cleanup
            ;;
        "health")
            health_check
            ;;
        "info")
            get_access_info
            ;;
        "demo")
            demo_toggle
            ;;
        *)
            echo "Usage: $0 [deploy|cleanup|health|info|demo]"
            echo "  deploy  - Deploy the complete feature flag system (default)"
            echo "  cleanup - Remove the feature flag system"
            echo "  health  - Check the health of feature flag components"
            echo "  info    - Show access information"
            echo "  demo    - Demo feature flag toggling"
            exit 1
            ;;
    esac
}

# Handle script interruption
trap 'kill $PORT_FORWARD_PID 2>/dev/null || true' EXIT

# Run main function
main "$@"

echo -e "\n${GREEN}🎉 Feature flag system deployment completed!${NC}"
