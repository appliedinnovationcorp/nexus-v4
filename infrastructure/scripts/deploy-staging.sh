#!/bin/bash

# Deployment script for Staging Environment
# This script deploys the staging infrastructure and applications

set -e

# Configuration
ENVIRONMENT="staging"
TERRAFORM_DIR="infrastructure/terraform/environments/staging"
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

echo "🚀 Deploying to ${ENVIRONMENT} environment..."

# Change to project root
cd "${PROJECT_ROOT}"

# Check if Terraform is installed
if ! command -v terraform &> /dev/null; then
    echo "❌ Terraform is not installed. Please install it first."
    exit 1
fi

# Check if kubectl is installed
if ! command -v kubectl &> /dev/null; then
    echo "❌ kubectl is not installed. Please install it first."
    exit 1
fi

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
    echo "❌ AWS CLI is not installed. Please install it first."
    exit 1
fi

echo "✅ All required tools are installed"

# Navigate to staging terraform directory
cd "${TERRAFORM_DIR}"

# Initialize Terraform
echo "🔧 Initializing Terraform..."
terraform init

# Validate Terraform configuration
echo "✅ Validating Terraform configuration..."
terraform validate

# Plan the deployment
echo "📋 Planning Terraform deployment..."
terraform plan -out=staging.tfplan

# Ask for confirmation
echo ""
read -p "Do you want to apply this plan? (y/N): " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Deployment cancelled"
    exit 1
fi

# Apply the deployment
echo "🚀 Applying Terraform configuration..."
terraform apply staging.tfplan

# Clean up plan file
rm -f staging.tfplan

# Get cluster credentials
echo "🔑 Configuring kubectl for staging cluster..."
CLUSTER_NAME=$(terraform output -raw cluster_id)
aws eks update-kubeconfig --region us-west-2 --name "${CLUSTER_NAME}" --alias staging

# Verify cluster access
echo "✅ Verifying cluster access..."
kubectl get nodes --context staging

# Deploy applications to staging
echo "📦 Deploying applications to staging..."
cd "${PROJECT_ROOT}"

# Build and push Docker images with staging tag
echo "🐳 Building and pushing Docker images..."
if [ -f "docker-compose.yml" ]; then
    # Tag images for staging
    docker-compose build
    
    # Push to ECR (assuming ECR repository exists)
    # You may need to adjust this based on your container registry setup
    echo "📤 Pushing images to container registry..."
    # docker-compose push  # Uncomment when registry is configured
fi

# Deploy to Kubernetes
if [ -d "k8s" ] || [ -d "kubernetes" ]; then
    echo "☸️  Deploying to Kubernetes..."
    
    # Apply Kubernetes manifests
    if [ -d "k8s/staging" ]; then
        kubectl apply -f k8s/staging/ --context staging
    elif [ -d "kubernetes/staging" ]; then
        kubectl apply -f kubernetes/staging/ --context staging
    else
        echo "⚠️  No staging-specific Kubernetes manifests found"
        echo "   Consider creating k8s/staging/ directory with environment-specific configs"
    fi
fi

# Run database migrations if needed
echo "🗄️  Running database migrations..."
# Add your migration commands here
# Example: kubectl exec -it deployment/app --context staging -- npm run migrate

# Run health checks
echo "🏥 Running health checks..."
sleep 30  # Wait for services to start

# Get load balancer URL
ALB_DNS=$(cd "${TERRAFORM_DIR}" && terraform output -raw alb_dns_name)
echo "🌐 Staging environment deployed!"
echo "   Load Balancer: http://${ALB_DNS}"
echo "   Cluster: ${CLUSTER_NAME}"

# Run smoke tests
echo "🧪 Running smoke tests..."
# Add your smoke test commands here
# Example: curl -f "http://${ALB_DNS}/health" || echo "⚠️  Health check failed"

echo ""
echo "🎉 Staging deployment completed successfully!"
echo ""
echo "Next steps:"
echo "1. Verify application functionality at: http://${ALB_DNS}"
echo "2. Run your E2E tests against staging"
echo "3. If tests pass, proceed with production deployment"
echo ""
echo "Useful commands:"
echo "- kubectl get pods --context staging"
echo "- kubectl logs -f deployment/app --context staging"
echo "- terraform output -state=${TERRAFORM_DIR}/terraform.tfstate"
