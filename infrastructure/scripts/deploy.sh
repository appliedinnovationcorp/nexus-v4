#!/bin/bash

# Nexus Workspace Infrastructure Deployment Script
# This script automates the deployment of the Nexus Workspace infrastructure

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TERRAFORM_DIR="${SCRIPT_DIR}/../terraform"
ENVIRONMENT="${ENVIRONMENT:-production}"
AWS_REGION="${AWS_REGION:-us-west-2}"

# Functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check if required tools are installed
    local tools=("terraform" "aws" "kubectl")
    for tool in "${tools[@]}"; do
        if ! command -v "$tool" &> /dev/null; then
            log_error "$tool is not installed or not in PATH"
            exit 1
        fi
    done
    
    # Check AWS credentials
    if ! aws sts get-caller-identity &> /dev/null; then
        log_error "AWS credentials not configured or invalid"
        exit 1
    fi
    
    # Check Terraform version
    local tf_version=$(terraform version -json | jq -r '.terraform_version')
    log_info "Terraform version: $tf_version"
    
    # Check AWS CLI version
    local aws_version=$(aws --version | cut -d/ -f2 | cut -d' ' -f1)
    log_info "AWS CLI version: $aws_version"
    
    log_success "Prerequisites check passed"
}

setup_backend() {
    log_info "Setting up Terraform backend..."
    
    local state_bucket="nexus-terraform-state-${AWS_REGION}"
    local lock_table="nexus-terraform-locks"
    
    # Create S3 bucket for state if it doesn't exist
    if ! aws s3 ls "s3://${state_bucket}" &> /dev/null; then
        log_info "Creating S3 bucket for Terraform state: ${state_bucket}"
        aws s3 mb "s3://${state_bucket}" --region "${AWS_REGION}"
        
        # Enable versioning
        aws s3api put-bucket-versioning \
            --bucket "${state_bucket}" \
            --versioning-configuration Status=Enabled
        
        # Enable encryption
        aws s3api put-bucket-encryption \
            --bucket "${state_bucket}" \
            --server-side-encryption-configuration '{
                "Rules": [{
                    "ApplyServerSideEncryptionByDefault": {
                        "SSEAlgorithm": "AES256"
                    }
                }]
            }'
        
        # Block public access
        aws s3api put-public-access-block \
            --bucket "${state_bucket}" \
            --public-access-block-configuration \
            BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true
    fi
    
    # Create DynamoDB table for locking if it doesn't exist
    if ! aws dynamodb describe-table --table-name "${lock_table}" &> /dev/null; then
        log_info "Creating DynamoDB table for Terraform locks: ${lock_table}"
        aws dynamodb create-table \
            --table-name "${lock_table}" \
            --attribute-definitions AttributeName=LockID,AttributeType=S \
            --key-schema AttributeName=LockID,KeyType=HASH \
            --provisioned-throughput ReadCapacityUnits=5,WriteCapacityUnits=5 \
            --region "${AWS_REGION}"
        
        # Wait for table to be active
        aws dynamodb wait table-exists --table-name "${lock_table}" --region "${AWS_REGION}"
    fi
    
    log_success "Terraform backend setup completed"
}

validate_terraform() {
    log_info "Validating Terraform configuration..."
    
    cd "${TERRAFORM_DIR}"
    
    # Initialize Terraform
    terraform init -upgrade
    
    # Validate configuration
    terraform validate
    
    # Format check
    if ! terraform fmt -check; then
        log_warning "Terraform files are not properly formatted. Running terraform fmt..."
        terraform fmt
    fi
    
    log_success "Terraform validation passed"
}

plan_deployment() {
    log_info "Creating Terraform plan..."
    
    cd "${TERRAFORM_DIR}"
    
    # Create plan
    terraform plan -out=tfplan -var="environment=${ENVIRONMENT}" -var="aws_region=${AWS_REGION}"
    
    log_success "Terraform plan created successfully"
    
    # Ask for confirmation
    echo
    read -p "Do you want to proceed with the deployment? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log_info "Deployment cancelled by user"
        exit 0
    fi
}

deploy_infrastructure() {
    log_info "Deploying infrastructure..."
    
    cd "${TERRAFORM_DIR}"
    
    # Apply the plan
    terraform apply tfplan
    
    log_success "Infrastructure deployment completed"
}

configure_kubectl() {
    log_info "Configuring kubectl..."
    
    cd "${TERRAFORM_DIR}"
    
    # Get cluster name
    local cluster_name=$(terraform output -raw cluster_name)
    
    # Update kubeconfig
    aws eks update-kubeconfig --region "${AWS_REGION}" --name "${cluster_name}"
    
    # Test connection
    if kubectl get nodes &> /dev/null; then
        log_success "kubectl configured successfully"
        kubectl get nodes
    else
        log_error "Failed to connect to EKS cluster"
        exit 1
    fi
}

display_outputs() {
    log_info "Deployment outputs:"
    
    cd "${TERRAFORM_DIR}"
    
    echo
    echo "=== Infrastructure Information ==="
    terraform output -json | jq -r '
        "Cluster Name: " + .cluster_name.value,
        "Cluster Endpoint: " + .cluster_endpoint.value,
        "VPC ID: " + .vpc_id.value,
        "RDS Endpoint: " + .db_instance_endpoint.value,
        "Redis Endpoint: " + .redis_endpoint.value,
        "S3 Assets Bucket: " + .s3_bucket_app_assets.value,
        "CloudFront Domain: " + .cloudfront_distribution_domain_name.value
    '
    
    if terraform output -raw cloudwatch_dashboard_url &> /dev/null; then
        echo "CloudWatch Dashboard: $(terraform output -raw cloudwatch_dashboard_url)"
    fi
    
    echo
    echo "=== Next Steps ==="
    echo "1. Deploy your applications to the EKS cluster"
    echo "2. Configure DNS records if using a custom domain"
    echo "3. Set up monitoring alerts and notifications"
    echo "4. Review security configurations"
    echo
}

cleanup_on_error() {
    log_error "Deployment failed. Cleaning up..."
    
    cd "${TERRAFORM_DIR}"
    
    # Remove plan file
    rm -f tfplan
    
    log_info "Cleanup completed"
}

main() {
    log_info "Starting Nexus Workspace infrastructure deployment"
    log_info "Environment: ${ENVIRONMENT}"
    log_info "AWS Region: ${AWS_REGION}"
    
    # Set up error handling
    trap cleanup_on_error ERR
    
    # Run deployment steps
    check_prerequisites
    setup_backend
    validate_terraform
    plan_deployment
    deploy_infrastructure
    configure_kubectl
    display_outputs
    
    log_success "Deployment completed successfully!"
    
    # Cleanup
    cd "${TERRAFORM_DIR}"
    rm -f tfplan
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -e|--environment)
            ENVIRONMENT="$2"
            shift 2
            ;;
        -r|--region)
            AWS_REGION="$2"
            shift 2
            ;;
        -h|--help)
            echo "Usage: $0 [OPTIONS]"
            echo "Options:"
            echo "  -e, --environment    Environment name (default: production)"
            echo "  -r, --region         AWS region (default: us-west-2)"
            echo "  -h, --help          Show this help message"
            exit 0
            ;;
        *)
            log_error "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Run main function
main "$@"
