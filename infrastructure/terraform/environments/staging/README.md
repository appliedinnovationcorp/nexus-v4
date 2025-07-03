# Staging Environment

This directory contains the Terraform configuration for the **staging environment** that mirrors the production infrastructure with cost-optimized sizing.

## 🎯 Purpose

The staging environment serves as a production-like testing ground where:
- All code changes are deployed and verified before production
- End-to-end tests are executed in a production-like environment
- Performance and integration testing occurs
- Database migrations are tested
- Infrastructure changes are validated

## 🏗️ Architecture

The staging environment mirrors the production architecture but with smaller, cost-optimized resources:

### Infrastructure Components

| Component | Production | Staging | Purpose |
|-----------|------------|---------|---------|
| **EKS Nodes** | t3.medium/large (3-10 nodes) | t3.small/medium (2-5 nodes) | Container orchestration |
| **RDS PostgreSQL** | db.t3.micro+ | db.t3.micro | Database |
| **ElastiCache Redis** | cache.t3.micro+ | cache.t3.micro | Caching layer |
| **Log Retention** | 30 days | 7 days | Cost optimization |
| **Backup Retention** | 7 days | 3 days | Cost optimization |

### Key Differences from Production

1. **Smaller Instance Sizes**: Cost-optimized for testing workloads
2. **Reduced Redundancy**: Single AZ for non-critical components where appropriate
3. **Shorter Retention Periods**: Logs and backups retained for shorter periods
4. **Relaxed Security**: May allow broader access for testing (configure carefully)

## 🚀 Quick Start

### Prerequisites

- AWS CLI configured with appropriate permissions
- Terraform >= 1.0 installed
- kubectl installed
- Docker installed (for container builds)

### 1. Bootstrap Backend Resources

First, create the S3 bucket and DynamoDB table for Terraform state:

```bash
# From project root
./infrastructure/scripts/bootstrap-staging.sh
```

This creates:
- S3 bucket: `nexus-workspace-terraform-state-staging`
- DynamoDB table: `nexus-workspace-terraform-locks-staging`

### 2. Deploy Infrastructure

```bash
# Navigate to staging directory
cd infrastructure/terraform/environments/staging

# Initialize Terraform
terraform init

# Review the plan
terraform plan

# Apply the configuration
terraform apply
```

### 3. Configure kubectl

```bash
# Get cluster credentials
aws eks update-kubeconfig --region us-west-2 --name $(terraform output -raw cluster_id) --alias staging

# Verify connection
kubectl get nodes --context staging
```

### 4. Deploy Applications

```bash
# From project root
./infrastructure/scripts/deploy-staging.sh
```

## 📋 Configuration

### Environment Variables

The staging environment uses these key configurations:

```hcl
# Basic Configuration
environment    = "staging"
aws_region     = "us-west-2"
project_name   = "nexus-workspace"

# Cost-optimized sizing
node_group_desired_size = 2
node_group_max_size     = 5
db_instance_class       = "db.t3.micro"
redis_node_type         = "cache.t3.micro"

# Shorter retention periods
log_retention_days           = 7
db_backup_retention_period   = 3
```

### Customization

To customize the staging environment, edit `terraform.tfvars`:

```bash
# Copy and edit the configuration
cp terraform.tfvars.example terraform.tfvars
vim terraform.tfvars
```

## 🔄 CI/CD Integration

### Automated Deployment

The staging environment is automatically deployed when:
- Code is pushed to `develop` or `staging` branches
- Pull requests are opened against `main` branch

### Deployment Pipeline

1. **Build & Test**: Unit tests, linting, type checking
2. **Infrastructure Deployment**: Terraform apply for staging
3. **Container Build**: Build and push Docker images
4. **Application Deployment**: Deploy to Kubernetes
5. **E2E Testing**: Run Playwright tests against staging
6. **Smoke Tests**: Health checks and basic functionality tests

### Production Gate

Production deployments **require** successful staging validation:
- Staging environment must be healthy
- All E2E tests must pass
- Health checks must succeed
- Recent deployment must exist (within 24 hours)

## 🧪 Testing

### End-to-End Tests

E2E tests run automatically against staging:

```bash
# Run E2E tests locally against staging
BASE_URL=http://$(terraform output -raw alb_dns_name) pnpm test:e2e
```

### Manual Testing

Access the staging environment:

```bash
# Get the staging URL
terraform output alb_dns_name

# Example: http://staging-alb-123456789.us-west-2.elb.amazonaws.com
```

### Database Testing

Test database migrations and data operations:

```bash
# Connect to staging database (through bastion or kubectl port-forward)
kubectl port-forward service/postgresql 5432:5432 --context staging

# Run migrations
kubectl exec -it deployment/app --context staging -- npm run migrate
```

## 📊 Monitoring

### CloudWatch Dashboards

Access staging metrics:

```bash
# Get dashboard URL
terraform output cloudwatch_dashboard_url
```

### Key Metrics to Monitor

- **Application Health**: Response times, error rates
- **Infrastructure Health**: CPU, memory, disk usage
- **Database Performance**: Connection count, query performance
- **Cost**: Daily spend tracking

### Alerts

Staging alerts are configured for:
- Application errors > 5%
- High resource utilization > 80%
- Database connection issues
- Infrastructure failures

## 💰 Cost Management

### Cost Optimization Features

1. **Right-sized Instances**: Smaller instances for testing workloads
2. **Spot Instances**: Where appropriate for non-critical workloads
3. **Shorter Retention**: Reduced log and backup retention
4. **Auto-scaling**: Scale down during off-hours

### Cost Monitoring

```bash
# Check staging costs
aws ce get-cost-and-usage \
  --time-period Start=2024-01-01,End=2024-01-31 \
  --granularity MONTHLY \
  --metrics BlendedCost \
  --group-by Type=DIMENSION,Key=SERVICE \
  --filter file://staging-cost-filter.json
```

### Scheduled Scaling

Consider implementing scheduled scaling for cost savings:

```bash
# Scale down during nights/weekends
kubectl scale deployment app --replicas=1 --context staging

# Scale up during business hours
kubectl scale deployment app --replicas=3 --context staging
```

## 🔧 Maintenance

### Regular Tasks

1. **Weekly**: Review costs and optimize resources
2. **Monthly**: Update AMIs and security patches
3. **Quarterly**: Review and update Terraform modules

### Cleanup

To destroy the staging environment:

```bash
# Destroy applications first
kubectl delete all --all --context staging

# Destroy infrastructure
terraform destroy
```

**⚠️ Warning**: This will permanently delete all staging resources and data.

## 🚨 Troubleshooting

### Common Issues

#### Terraform State Lock

```bash
# If state is locked
terraform force-unlock <LOCK_ID>
```

#### EKS Access Issues

```bash
# Update kubeconfig
aws eks update-kubeconfig --region us-west-2 --name staging-cluster

# Check IAM permissions
aws sts get-caller-identity
```

#### Application Deployment Failures

```bash
# Check pod status
kubectl get pods --context staging

# Check logs
kubectl logs -f deployment/app --context staging

# Check events
kubectl get events --sort-by=.metadata.creationTimestamp --context staging
```

#### Database Connection Issues

```bash
# Check RDS status
aws rds describe-db-instances --db-instance-identifier staging-db

# Test connectivity from pod
kubectl exec -it deployment/app --context staging -- nc -zv <db-endpoint> 5432
```

### Getting Help

1. Check CloudWatch logs for detailed error messages
2. Review Terraform state for resource status
3. Consult AWS documentation for service-specific issues
4. Check GitHub Actions logs for CI/CD pipeline issues

## 📚 Additional Resources

- [Production Infrastructure README](../../README.md)
- [Deployment Scripts](../../scripts/)
- [Kubernetes Manifests](../../../../k8s/staging/)
- [CI/CD Workflows](../../../../.github/workflows/)

## 🤝 Contributing

When making changes to staging infrastructure:

1. Test changes in a development environment first
2. Create a pull request with infrastructure changes
3. Ensure staging deployment succeeds before merging
4. Document any breaking changes or migration steps

---

**Note**: The staging environment should closely mirror production to ensure reliable testing. Any significant differences should be documented and justified.
