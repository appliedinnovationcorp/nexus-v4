#!/bin/bash

# Deploy Monitoring Stack Script
# This script deploys the complete monitoring stack including Prometheus, Grafana, and Datadog

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
NAMESPACE="monitoring"
DATADOG_NAMESPACE="datadog"
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo -e "${BLUE}🚀 Deploying Monitoring Stack${NC}"
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

# Deploy Prometheus and Grafana
deploy_prometheus_grafana() {
    echo -e "\n${BLUE}📊 Deploying Prometheus and Grafana${NC}"
    
    create_namespace $NAMESPACE
    
    # Deploy Prometheus
    echo -e "${BLUE}🔍 Deploying Prometheus...${NC}"
    kubectl apply -f k8s/monitoring/prometheus.yaml
    wait_for_deployment $NAMESPACE prometheus
    
    # Deploy Grafana
    echo -e "${BLUE}📈 Deploying Grafana...${NC}"
    
    # Set Grafana admin password if not provided
    if [ -z "$GRAFANA_ADMIN_PASSWORD" ]; then
        GRAFANA_ADMIN_PASSWORD=$(openssl rand -base64 32)
        echo -e "${YELLOW}⚠️  Generated Grafana admin password: $GRAFANA_ADMIN_PASSWORD${NC}"
        echo -e "${YELLOW}   Please save this password securely${NC}"
    fi
    
    # Create Grafana secret
    kubectl create secret generic grafana-secret \
        --from-literal=admin-password="$GRAFANA_ADMIN_PASSWORD" \
        -n $NAMESPACE \
        --dry-run=client -o yaml | kubectl apply -f -
    
    kubectl apply -f k8s/monitoring/grafana.yaml
    kubectl apply -f k8s/monitoring/grafana-dashboards.yaml
    wait_for_deployment $NAMESPACE grafana
    
    echo -e "${GREEN}✅ Prometheus and Grafana deployed successfully${NC}"
}

# Deploy Datadog Agent
deploy_datadog() {
    if [ -z "$DATADOG_API_KEY" ]; then
        echo -e "${YELLOW}⚠️  DATADOG_API_KEY not provided, skipping Datadog deployment${NC}"
        echo -e "${YELLOW}   Set DATADOG_API_KEY environment variable to deploy Datadog${NC}"
        return 0
    fi
    
    echo -e "\n${BLUE}🐕 Deploying Datadog Agent${NC}"
    
    create_namespace $DATADOG_NAMESPACE
    
    # Create Datadog secret
    kubectl create secret generic datadog-secret \
        --from-literal=api-key="$DATADOG_API_KEY" \
        -n $DATADOG_NAMESPACE \
        --dry-run=client -o yaml | kubectl apply -f -
    
    # Deploy Datadog Agent
    kubectl apply -f k8s/monitoring/datadog-agent.yaml
    
    # Wait for DaemonSet to be ready
    echo -e "${YELLOW}⏳ Waiting for Datadog Agent DaemonSet...${NC}"
    kubectl rollout status daemonset/datadog-agent -n $DATADOG_NAMESPACE --timeout=300s
    
    echo -e "${GREEN}✅ Datadog Agent deployed successfully${NC}"
}

# Configure application monitoring
configure_app_monitoring() {
    echo -e "\n${BLUE}⚙️  Configuring Application Monitoring${NC}"
    
    # Add Prometheus annotations to application deployments
    if kubectl get deployment nexus-workspace &> /dev/null; then
        echo -e "${BLUE}📝 Adding Prometheus annotations to application deployment${NC}"
        
        kubectl patch deployment nexus-workspace -p '{
            "spec": {
                "template": {
                    "metadata": {
                        "annotations": {
                            "prometheus.io/scrape": "true",
                            "prometheus.io/port": "3000",
                            "prometheus.io/path": "/metrics"
                        }
                    }
                }
            }
        }'
        
        echo -e "${GREEN}✅ Application monitoring configured${NC}"
    else
        echo -e "${YELLOW}⚠️  Application deployment not found, skipping annotation${NC}"
    fi
}

# Get access information
get_access_info() {
    echo -e "\n${BLUE}🔗 Access Information${NC}"
    echo "=================================="
    
    # Prometheus access
    echo -e "${GREEN}📊 Prometheus:${NC}"
    echo "   Port forward: kubectl port-forward svc/prometheus 9090:9090 -n $NAMESPACE"
    echo "   Then access: http://localhost:9090"
    
    # Grafana access
    echo -e "\n${GREEN}📈 Grafana:${NC}"
    echo "   Port forward: kubectl port-forward svc/grafana 3000:3000 -n $NAMESPACE"
    echo "   Then access: http://localhost:3000"
    echo "   Username: admin"
    echo "   Password: $GRAFANA_ADMIN_PASSWORD"
    
    # Get LoadBalancer IPs if available
    GRAFANA_EXTERNAL_IP=$(kubectl get svc grafana -n $NAMESPACE -o jsonpath='{.status.loadBalancer.ingress[0].ip}' 2>/dev/null || echo "")
    if [ -n "$GRAFANA_EXTERNAL_IP" ]; then
        echo "   External IP: http://$GRAFANA_EXTERNAL_IP:3000"
    fi
    
    # Datadog information
    if [ -n "$DATADOG_API_KEY" ]; then
        echo -e "\n${GREEN}🐕 Datadog:${NC}"
        echo "   Dashboard: https://app.datadoghq.com/dashboard/lists"
        echo "   Logs: https://app.datadoghq.com/logs"
        echo "   Metrics: https://app.datadoghq.com/metric/explorer"
    fi
    
    echo -e "\n${BLUE}📋 Useful Commands:${NC}"
    echo "   Check Prometheus targets: kubectl port-forward svc/prometheus 9090:9090 -n $NAMESPACE"
    echo "   View Grafana logs: kubectl logs -f deployment/grafana -n $NAMESPACE"
    echo "   View Datadog Agent logs: kubectl logs -f daemonset/datadog-agent -n $DATADOG_NAMESPACE"
    echo "   Restart monitoring stack: kubectl rollout restart deployment/prometheus deployment/grafana -n $NAMESPACE"
}

# Health check
health_check() {
    echo -e "\n${BLUE}🏥 Running Health Checks${NC}"
    echo "=================================="
    
    # Check Prometheus
    if kubectl get deployment prometheus -n $NAMESPACE &> /dev/null; then
        if kubectl get pods -n $NAMESPACE -l app=prometheus | grep -q "Running"; then
            echo -e "${GREEN}✅ Prometheus is running${NC}"
        else
            echo -e "${RED}❌ Prometheus is not running${NC}"
        fi
    fi
    
    # Check Grafana
    if kubectl get deployment grafana -n $NAMESPACE &> /dev/null; then
        if kubectl get pods -n $NAMESPACE -l app=grafana | grep -q "Running"; then
            echo -e "${GREEN}✅ Grafana is running${NC}"
        else
            echo -e "${RED}❌ Grafana is not running${NC}"
        fi
    fi
    
    # Check Datadog
    if kubectl get daemonset datadog-agent -n $DATADOG_NAMESPACE &> /dev/null; then
        DESIRED=$(kubectl get daemonset datadog-agent -n $DATADOG_NAMESPACE -o jsonpath='{.status.desiredNumberScheduled}')
        READY=$(kubectl get daemonset datadog-agent -n $DATADOG_NAMESPACE -o jsonpath='{.status.numberReady}')
        
        if [ "$DESIRED" = "$READY" ] && [ "$READY" -gt 0 ]; then
            echo -e "${GREEN}✅ Datadog Agent is running on all nodes ($READY/$DESIRED)${NC}"
        else
            echo -e "${YELLOW}⚠️  Datadog Agent: $READY/$DESIRED nodes ready${NC}"
        fi
    fi
}

# Cleanup function
cleanup() {
    echo -e "\n${YELLOW}🧹 Cleaning up monitoring stack...${NC}"
    
    kubectl delete -f k8s/monitoring/grafana-dashboards.yaml --ignore-not-found=true
    kubectl delete -f k8s/monitoring/grafana.yaml --ignore-not-found=true
    kubectl delete -f k8s/monitoring/prometheus.yaml --ignore-not-found=true
    kubectl delete -f k8s/monitoring/datadog-agent.yaml --ignore-not-found=true
    
    kubectl delete namespace $NAMESPACE --ignore-not-found=true
    kubectl delete namespace $DATADOG_NAMESPACE --ignore-not-found=true
    
    echo -e "${GREEN}✅ Monitoring stack cleaned up${NC}"
}

# Main execution
main() {
    case "${1:-deploy}" in
        "deploy")
            deploy_prometheus_grafana
            deploy_datadog
            configure_app_monitoring
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
        *)
            echo "Usage: $0 [deploy|cleanup|health|info]"
            echo "  deploy  - Deploy the complete monitoring stack (default)"
            echo "  cleanup - Remove the monitoring stack"
            echo "  health  - Check the health of monitoring components"
            echo "  info    - Show access information"
            exit 1
            ;;
    esac
}

# Handle script interruption
trap cleanup EXIT

# Run main function
main "$@"

echo -e "\n${GREEN}🎉 Monitoring deployment completed!${NC}"
