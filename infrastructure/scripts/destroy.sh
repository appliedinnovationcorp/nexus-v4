#!/bin/bash

# Nexus Workspace Infrastructure Destruction Script
# This script safely destroys the Nexus Workspace infrastructure

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
FORCE_DESTROY="${FORCE_DESTROY:-false}"

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
    
    log_success "Prerequisites check passed"
}

backup_critical_data() {
    log_info "Creating backup of critical data..."
    
    cd "${TERRAFORM_DIR}"
    
    # Check if infrastructure exists
    if ! terraform show &> /dev/null; then
        log_warning "No Terraform state found. Skipping backup."
        return
    fi
    
    # Get resource information
    local cluster_name=$(terraform output -raw cluster_name 2>/dev/null || echo "")
    local db_endpoint=$(terraform output -raw db_instance_endpoint 2>/dev/null || echo "")
    local s3_bucket=$(terraform output -raw s3_bucket_backups 2>/dev/null || echo "")
    
    if [[ -n "$cluster_name" ]]; then
        log_info "Backing up Kubernetes resources..."
        
        # Create backup directory
        local backup_dir="./backups/$(date +%Y%m%d_%H%M%S)"
        mkdir -p "$backup_dir"
        
        # Backup all Kubernetes resources
        kubectl get all --all-namespaces -o yaml > "$backup_dir/k8s-resources.yaml" 2>/dev/null || true
        kubectl get configmaps --all-namespaces -o yaml > "$backup_dir/k8s-configmaps.yaml" 2>/dev/null || true
        kubectl get secrets --all-namespaces -o yaml > "$backup_dir/k8s-secrets.yaml" 2>/dev/null || true
        kubectl get pv -o yaml > "$backup_dir/k8s-persistent-volumes.yaml" 2>/dev/null || true
        kubectl get pvc --all-namespaces -o yaml > "$backup_dir/k8s-persistent-volume-claims.yaml" 2>/dev/null || true
        
        log_success "Kubernetes resources backed up to $backup_dir"
    fi
    
    if [[ -n "$db_endpoint" ]]; then
        log_info "Database backup should be handled by RDS automated backups"
        log_info "Manual backup recommended before destruction if needed"
    fi
    
    if [[ -n "$s3_bucket" ]]; then
        log_info "S3 data will be preserved in backup bucket: $s3_bucket"
    fi
}

confirm_destruction() {
    log_warning "⚠️  DANGER: This will destroy ALL infrastructure resources!"
    log_warning "This action cannot be undone."
    
    if [[ "$FORCE_DESTROY" == "true" ]]; then
        log_warning "Force destroy mode enabled. Skipping confirmation."
        return
    fi
    
    echo
    echo "Resources that will be destroyed:"
    echo "- EKS Cluster and all workloads"
    echo "- RDS Database (with final snapshot)"
    echo "- ElastiCache Redis cluster"
    echo "- S3 buckets (with data)"
    echo "- VPC and all networking components"
    echo "- CloudWatch logs and metrics"
    echo "- All associated IAM roles and policies"
    echo
    
    read -p "Type 'destroy' to confirm destruction: " -r
    if [[ "$REPLY" != "destroy" ]]; then
        log_info "Destruction cancelled by user"
        exit 0
    fi
    
    echo
    read -p "Are you absolutely sure? Type 'yes' to proceed: " -r
    if [[ "$REPLY" != "yes" ]]; then
        log_info "Destruction cancelled by user"
        exit 0
    fi
}

drain_kubernetes_nodes() {
    log_info "Draining Kubernetes nodes..."
    
    cd "${TERRAFORM_DIR}"
    
    # Check if cluster exists
    local cluster_name=$(terraform output -raw cluster_name 2>/dev/null || echo "")
    if [[ -z "$cluster_name" ]]; then
        log_warning "No cluster found. Skipping node drain."
        return
    fi
    
    # Update kubeconfig
    aws eks update-kubeconfig --region "${AWS_REGION}" --name "${cluster_name}" 2>/dev/null || true
    
    # Get all nodes
    local nodes=$(kubectl get nodes -o name 2>/dev/null || echo "")
    if [[ -z "$nodes" ]]; then
        log_warning "No nodes found or cluster not accessible"
        return
    fi
    
    # Drain each node
    for node in $nodes; do
        log_info "Draining $node..."
        kubectl drain "$node" --ignore-daemonsets --delete-emptydir-data --force --timeout=300s 2>/dev/null || true
    done
    
    log_success "Kubernetes nodes drained"
}

destroy_infrastructure() {
    log_info "Destroying infrastructure..."
    
    cd "${TERRAFORM_DIR}"
    
    # Initialize Terraform
    terraform init
    
    # Create destroy plan
    log_info "Creating destruction plan..."
    terraform plan -destroy -out=destroy.tfplan -var="environment=${ENVIRONMENT}" -var="aws_region=${AWS_REGION}"
    
    # Apply destroy plan
    log_info "Applying destruction plan..."
    terraform apply destroy.tfplan
    
    # Clean up plan file
    rm -f destroy.tfplan
    
    log_success "Infrastructure destruction completed"
}

cleanup_remaining_resources() {
    log_info "Cleaning up any remaining resources..."
    
    # Clean up any remaining ELBs (sometimes not cleaned up automatically)
    local elbs=$(aws elbv2 describe-load-balancers --query "LoadBalancers[?contains(LoadBalancerName, 'nexus-workspace-${ENVIRONMENT}')].LoadBalancerArn" --output text 2>/dev/null || echo "")
    for elb in $elbs; do
        if [[ -n "$elb" ]]; then
            log_info "Cleaning up remaining ELB: $elb"
            aws elbv2 delete-load-balancer --load-balancer-arn "$elb" 2>/dev/null || true
        fi
    done
    
    # Clean up any remaining security groups
    local vpc_id=$(aws ec2 describe-vpcs --filters "Name=tag:Name,Values=nexus-workspace-${ENVIRONMENT}-vpc" --query "Vpcs[0].VpcId" --output text 2>/dev/null || echo "")
    if [[ "$vpc_id" != "None" && -n "$vpc_id" ]]; then
        local sgs=$(aws ec2 describe-security-groups --filters "Name=vpc-id,Values=$vpc_id" "Name=group-name,Values=*nexus-workspace-${ENVIRONMENT}*" --query "SecurityGroups[].GroupId" --output text 2>/dev/null || echo "")
        for sg in $sgs; do
            if [[ -n "$sg" ]]; then
                log_info "Cleaning up remaining security group: $sg"
                aws ec2 delete-security-group --group-id "$sg" 2>/dev/null || true
            fi
        done
    fi
    
    log_success "Cleanup completed"
}

display_summary() {
    log_info "Destruction Summary:"
    
    echo
    echo "=== Destroyed Resources ==="
    echo "✓ EKS Cluster and node groups"
    echo "✓ RDS Database (with final snapshot)"
    echo "✓ ElastiCache Redis cluster"
    echo "✓ S3 buckets and contents"
    echo "✓ VPC and networking components"
    echo "✓ CloudWatch logs and alarms"
    echo "✓ IAM roles and policies"
    echo "✓ KMS keys and aliases"
    echo
    
    echo "=== Important Notes ==="
    echo "• Database final snapshot created (if enabled)"
    echo "• S3 bucket contents may be retained based on lifecycle policies"
    echo "• CloudWatch logs may be retained based on retention settings"
    echo "• Some AWS resources may take time to fully terminate"
    echo
    
    echo "=== Cost Impact ==="
    echo "• All recurring charges should stop within 24 hours"
    echo "• Storage costs may continue for retained snapshots/backups"
    echo "• Monitor AWS billing for complete cost cessation"
    echo
}

main() {
    log_info "Starting Nexus Workspace infrastructure destruction"
    log_info "Environment: ${ENVIRONMENT}"
    log_info "AWS Region: ${AWS_REGION}"
    
    # Run destruction steps
    check_prerequisites
    backup_critical_data
    confirm_destruction
    drain_kubernetes_nodes
    destroy_infrastructure
    cleanup_remaining_resources
    display_summary
    
    log_success "Infrastructure destruction completed!"
    log_warning "Please verify in AWS Console that all resources have been terminated"
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
        --force)
            FORCE_DESTROY="true"
            shift
            ;;
        -h|--help)
            echo "Usage: $0 [OPTIONS]"
            echo "Options:"
            echo "  -e, --environment    Environment name (default: production)"
            echo "  -r, --region         AWS region (default: us-west-2)"
            echo "  --force              Skip confirmation prompts (DANGEROUS)"
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
