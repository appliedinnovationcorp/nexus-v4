#!/bin/bash

# Deploy HashiCorp Vault for Secret Management
# This script deploys Vault and configures it for the Nexus Workspace

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
NAMESPACE="vault"
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo -e "${BLUE}🔐 Deploying HashiCorp Vault for Secret Management${NC}"
echo "================================================================"

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
    
    if kubectl wait --for=condition=available --timeout=${timeout}s deployment/$deployment -n $namespace 2>/dev/null; then
        echo -e "${GREEN}✅ Deployment $deployment is ready${NC}"
    else
        # For StatefulSet, check differently
        if kubectl get statefulset $deployment -n $namespace &> /dev/null; then
            echo -e "${YELLOW}⏳ Waiting for StatefulSet $deployment...${NC}"
            kubectl wait --for=condition=ready --timeout=${timeout}s pod -l app=$deployment -n $namespace
            echo -e "${GREEN}✅ StatefulSet $deployment is ready${NC}"
        else
            echo -e "${RED}❌ Deployment $deployment failed to become ready${NC}"
            return 1
        fi
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

# Deploy Vault
deploy_vault() {
    echo -e "\n${BLUE}🔐 Deploying HashiCorp Vault${NC}"
    
    create_namespace $NAMESPACE
    
    # Deploy Vault
    echo -e "${BLUE}📊 Deploying Vault StatefulSet...${NC}"
    kubectl apply -f k8s/secret-management/vault.yaml
    
    # Wait for Vault to be ready
    wait_for_deployment $NAMESPACE vault
    
    echo -e "${GREEN}✅ Vault deployed successfully${NC}"
}

# Initialize Vault
initialize_vault() {
    echo -e "\n${BLUE}🔧 Initializing Vault${NC}"
    
    # Wait for initialization job to complete
    echo -e "${YELLOW}⏳ Waiting for Vault initialization job...${NC}"
    kubectl wait --for=condition=complete --timeout=300s job/vault-init -n $NAMESPACE
    
    # Get initialization status
    if kubectl get job vault-init -n $NAMESPACE -o jsonpath='{.status.conditions[0].type}' | grep -q "Complete"; then
        echo -e "${GREEN}✅ Vault initialized successfully${NC}"
        
        # Get the root token (for initial setup only)
        ROOT_TOKEN=$(kubectl get secret vault-keys -n $NAMESPACE -o jsonpath='{.data.root-token}' | base64 -d)
        echo -e "${YELLOW}⚠️  Root token: $ROOT_TOKEN${NC}"
        echo -e "${YELLOW}   Please store this token securely and remove it from the cluster after setup${NC}"
    else
        echo -e "${RED}❌ Vault initialization failed${NC}"
        kubectl logs job/vault-init -n $NAMESPACE
        return 1
    fi
}

# Configure application secrets
configure_secrets() {
    echo -e "\n${BLUE}🔑 Configuring Application Secrets${NC}"
    
    # Port forward to Vault
    kubectl port-forward svc/vault 8200:8200 -n $NAMESPACE &
    PORT_FORWARD_PID=$!
    
    # Wait for port forward to be ready
    sleep 5
    
    # Get root token
    ROOT_TOKEN=$(kubectl get secret vault-keys -n $NAMESPACE -o jsonpath='{.data.root-token}' | base64 -d)
    
    # Set Vault address and token
    export VAULT_ADDR="http://localhost:8200"
    export VAULT_TOKEN="$ROOT_TOKEN"
    
    # Function to set a secret
    set_secret() {
        local path=$1
        local key=$2
        local value=$3
        
        echo "Setting secret: $path"
        curl -s -X POST \
            -H "X-Vault-Token: $VAULT_TOKEN" \
            -H "Content-Type: application/json" \
            -d "{\"data\":{\"$key\":\"$value\"}}" \
            "$VAULT_ADDR/v1/secret/data/nexus-workspace/$path" > /dev/null
    }
    
    # Generate and set initial secrets
    echo -e "${BLUE}🔐 Generating initial secrets...${NC}"
    
    # JWT secrets
    JWT_SECRET=$(openssl rand -base64 32)
    JWT_REFRESH_SECRET=$(openssl rand -base64 32)
    set_secret "auth/jwt-secret" "value" "$JWT_SECRET"
    set_secret "auth/jwt-refresh-secret" "value" "$JWT_REFRESH_SECRET"
    
    # Session secret
    SESSION_SECRET=$(openssl rand -base64 32)
    set_secret "auth/session-secret" "value" "$SESSION_SECRET"
    
    # Encryption keys
    ENCRYPTION_KEY=$(openssl rand -hex 32)
    BACKUP_ENCRYPTION_KEY=$(openssl rand -hex 32)
    set_secret "encryption/primary-key" "value" "$ENCRYPTION_KEY"
    set_secret "encryption/backup-key" "value" "$BACKUP_ENCRYPTION_KEY"
    
    # Database password (if not using external database)
    DB_PASSWORD=$(openssl rand -base64 32)
    set_secret "database/password" "value" "$DB_PASSWORD"
    
    # Redis password
    REDIS_PASSWORD=$(openssl rand -base64 32)
    set_secret "redis/password" "value" "$REDIS_PASSWORD"
    
    # Feature flag encryption key
    FF_ENCRYPTION_KEY=$(openssl rand -hex 32)
    set_secret "feature-flags/encryption-key" "value" "$FF_ENCRYPTION_KEY"
    
    # Kill port forward
    kill $PORT_FORWARD_PID 2>/dev/null || true
    
    echo -e "${GREEN}✅ Initial secrets configured${NC}"
}

# Configure application environment
configure_application() {
    echo -e "\n${BLUE}⚙️  Configuring Application Environment${NC}"
    
    # Create ConfigMap for secret management configuration
    kubectl create configmap secret-management-config \
        --from-literal=SECRET_MANAGER_PROVIDER=vault \
        --from-literal=VAULT_ENDPOINT=http://vault.vault.svc.cluster.local:8200 \
        --from-literal=VAULT_AUTH_METHOD=kubernetes \
        --from-literal=VAULT_KUBERNETES_ROLE=nexus-workspace \
        --from-literal=VAULT_MOUNT_PATH=secret \
        -n default \
        --dry-run=client -o yaml | kubectl apply -f -
    
    echo -e "${GREEN}✅ Application environment configured${NC}"
}

# Migrate existing secrets
migrate_secrets() {
    echo -e "\n${BLUE}🔄 Migrating Existing Secrets${NC}"
    
    # This function would migrate secrets from Kubernetes secrets or environment variables
    # to Vault. For now, we'll just create a migration script template.
    
    cat > migrate-secrets.sh << 'EOF'
#!/bin/bash
# Secret Migration Script
# This script migrates existing secrets to Vault

# Set Vault configuration
export VAULT_ADDR="http://localhost:8200"
export VAULT_TOKEN="your-vault-token"

# Function to migrate a Kubernetes secret to Vault
migrate_k8s_secret() {
    local k8s_secret_name=$1
    local vault_path=$2
    local namespace=${3:-default}
    
    echo "Migrating $k8s_secret_name to $vault_path"
    
    # Get secret data from Kubernetes
    kubectl get secret $k8s_secret_name -n $namespace -o json | \
    jq -r '.data | to_entries[] | "\(.key)=\(.value | @base64d)"' | \
    while IFS='=' read -r key value; do
        # Set in Vault
        vault kv put secret/nexus-workspace/$vault_path $key="$value"
    done
}

# Example migrations (uncomment and modify as needed)
# migrate_k8s_secret "database-secret" "database"
# migrate_k8s_secret "api-keys" "external"
# migrate_k8s_secret "ssl-certs" "ssl"

echo "Migration completed"
EOF
    
    chmod +x migrate-secrets.sh
    echo -e "${YELLOW}📝 Migration script created: migrate-secrets.sh${NC}"
    echo -e "${YELLOW}   Edit and run this script to migrate your existing secrets${NC}"
}

# Get access information
get_access_info() {
    echo -e "\n${BLUE}🔗 Access Information${NC}"
    echo "=================================="
    
    # Vault access
    echo -e "${GREEN}🔐 HashiCorp Vault:${NC}"
    echo "   Port forward: kubectl port-forward svc/vault 8200:8200 -n $NAMESPACE"
    echo "   Then access: http://localhost:8200"
    
    # Get root token
    ROOT_TOKEN=$(kubectl get secret vault-keys -n $NAMESPACE -o jsonpath='{.data.root-token}' | base64 -d 2>/dev/null || echo "Not available")
    echo "   Root token: $ROOT_TOKEN"
    echo -e "${YELLOW}   ⚠️  Store the root token securely and consider revoking it after setup${NC}"
    
    # Get LoadBalancer IP if available
    VAULT_EXTERNAL_IP=$(kubectl get svc vault -n $NAMESPACE -o jsonpath='{.status.loadBalancer.ingress[0].ip}' 2>/dev/null || echo "")
    if [ -n "$VAULT_EXTERNAL_IP" ]; then
        echo "   External IP: http://$VAULT_EXTERNAL_IP:8200"
    fi
    
    # API endpoints
    echo -e "\n${GREEN}🔌 Secret Management API Endpoints:${NC}"
    echo "   Health check: GET /api/secrets/health"
    echo "   Database config: GET /api/secrets/database/config"
    echo "   Set secret: PUT /api/secrets/{key}"
    echo "   Delete secret: DELETE /api/secrets/{key}"
    echo "   Rotate secret: POST /api/secrets/{key}/rotate"
    
    echo -e "\n${BLUE}📋 Useful Commands:${NC}"
    echo "   View Vault logs: kubectl logs -f statefulset/vault -n $NAMESPACE"
    echo "   Vault CLI: kubectl exec -it vault-0 -n $NAMESPACE -- vault status"
    echo "   Restart Vault: kubectl rollout restart statefulset/vault -n $NAMESPACE"
    echo "   Unseal Vault: kubectl exec -it vault-0 -n $NAMESPACE -- vault operator unseal"
    
    echo -e "\n${GREEN}🔧 Next Steps:${NC}"
    echo "1. Store the root token securely"
    echo "2. Create additional Vault policies for different services"
    echo "3. Set up secret rotation schedules"
    echo "4. Configure monitoring and alerting for Vault"
    echo "5. Run the migration script to move existing secrets"
}

# Health check
health_check() {
    echo -e "\n${BLUE}🏥 Running Health Checks${NC}"
    echo "=================================="
    
    # Check Vault StatefulSet
    if kubectl get statefulset vault -n $NAMESPACE &> /dev/null; then
        if kubectl get pods -n $NAMESPACE -l app=vault | grep -q "Running"; then
            echo -e "${GREEN}✅ Vault is running${NC}"
            
            # Test Vault API
            kubectl port-forward svc/vault 8200:8200 -n $NAMESPACE &
            PORT_FORWARD_PID=$!
            sleep 3
            
            if curl -s "http://localhost:8200/v1/sys/health" > /dev/null; then
                echo -e "${GREEN}✅ Vault API is responding${NC}"
            else
                echo -e "${YELLOW}⚠️  Vault API not responding yet${NC}"
            fi
            
            kill $PORT_FORWARD_PID 2>/dev/null || true
        else
            echo -e "${RED}❌ Vault is not running${NC}"
        fi
    fi
    
    # Check if Vault is initialized
    if kubectl get secret vault-keys -n $NAMESPACE &> /dev/null; then
        echo -e "${GREEN}✅ Vault is initialized${NC}"
    else
        echo -e "${YELLOW}⚠️  Vault initialization may be in progress${NC}"
    fi
    
    # Check service account
    if kubectl get serviceaccount nexus-workspace -n default &> /dev/null; then
        echo -e "${GREEN}✅ Application service account exists${NC}"
    else
        echo -e "${YELLOW}⚠️  Application service account not found${NC}"
    fi
}

# Cleanup function
cleanup() {
    echo -e "\n${YELLOW}🧹 Cleaning up Vault deployment...${NC}"
    
    kubectl delete -f k8s/secret-management/vault.yaml --ignore-not-found=true
    kubectl delete configmap secret-management-config -n default --ignore-not-found=true
    kubectl delete namespace $NAMESPACE --ignore-not-found=true
    
    echo -e "${GREEN}✅ Vault deployment cleaned up${NC}"
}

# Backup Vault data
backup_vault() {
    echo -e "\n${BLUE}💾 Creating Vault Backup${NC}"
    
    # Create backup directory
    BACKUP_DIR="vault-backup-$(date +%Y%m%d-%H%M%S)"
    mkdir -p "$BACKUP_DIR"
    
    # Backup Vault data
    kubectl cp vault/vault-0:/vault/data "$BACKUP_DIR/vault-data" 2>/dev/null || echo "Could not backup vault data"
    
    # Backup Vault keys
    kubectl get secret vault-keys -n $NAMESPACE -o yaml > "$BACKUP_DIR/vault-keys.yaml" 2>/dev/null || echo "Could not backup vault keys"
    
    # Backup configuration
    kubectl get configmap vault-config -n $NAMESPACE -o yaml > "$BACKUP_DIR/vault-config.yaml" 2>/dev/null || echo "Could not backup vault config"
    
    echo -e "${GREEN}✅ Vault backup created in $BACKUP_DIR${NC}"
}

# Main execution
main() {
    case "${1:-deploy}" in
        "deploy")
            deploy_vault
            initialize_vault
            configure_secrets
            configure_application
            migrate_secrets
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
        "backup")
            backup_vault
            ;;
        "migrate")
            migrate_secrets
            ;;
        *)
            echo "Usage: $0 [deploy|cleanup|health|info|backup|migrate]"
            echo "  deploy  - Deploy the complete Vault system (default)"
            echo "  cleanup - Remove the Vault system"
            echo "  health  - Check the health of Vault components"
            echo "  info    - Show access information"
            echo "  backup  - Create a backup of Vault data"
            echo "  migrate - Create migration script for existing secrets"
            exit 1
            ;;
    esac
}

# Handle script interruption
trap 'kill $PORT_FORWARD_PID 2>/dev/null || true' EXIT

# Run main function
main "$@"

echo -e "\n${GREEN}🎉 Vault deployment completed!${NC}"
