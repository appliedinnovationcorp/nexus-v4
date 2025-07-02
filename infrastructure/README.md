# Nexus Workspace - Infrastructure as Code

This directory contains the Infrastructure as Code (IaC) configuration for the Nexus Workspace production environment using Terraform.

## 🏗️ Architecture Overview

The infrastructure is designed for a production-ready, scalable, and secure deployment on AWS:

```
┌─────────────────────────────────────────────────────────────┐
│                        AWS Cloud                            │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────┐ │
│  │   CloudFront    │  │   Route 53      │  │     ACM      │ │
│  │   (CDN)         │  │   (DNS)         │  │   (SSL)      │ │
│  └─────────────────┘  └─────────────────┘  └──────────────┘ │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────┐ │
│  │                    VPC                                  │ │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐ │ │
│  │  │   Public    │  │   Private   │  │    Database     │ │ │
│  │  │   Subnets   │  │   Subnets   │  │    Subnets      │ │ │
│  │  │             │  │             │  │                 │ │ │
│  │  │ ┌─────────┐ │  │ ┌─────────┐ │  │ ┌─────────────┐ │ │ │
│  │  │ │   ALB   │ │  │ │   EKS   │ │  │ │     RDS     │ │ │ │
│  │  │ │         │ │  │ │ Cluster │ │  │ │ PostgreSQL  │ │ │ │
│  │  │ └─────────┘ │  │ │         │ │  │ │             │ │ │ │
│  │  │             │  │ │ ┌─────┐ │ │  │ └─────────────┘ │ │ │
│  │  │             │  │ │ │Nodes│ │ │  │                 │ │ │
│  │  │             │  │ │ └─────┘ │ │  │ ┌─────────────┐ │ │ │
│  │  │             │  │ └─────────┘ │  │ │ ElastiCache │ │ │ │
│  │  │             │  │             │  │ │    Redis    │ │ │ │
│  │  │             │  │             │  │ └─────────────┘ │ │ │
│  │  └─────────────┘  └─────────────┘  └─────────────────┘ │ │
│  └─────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │     S3      │  │ CloudWatch  │  │   Secrets Manager   │ │
│  │  (Storage)  │  │(Monitoring) │  │    (Secrets)        │ │
│  └─────────────┘  └─────────────┘  └─────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## 📁 Directory Structure

```
infrastructure/
├── terraform/
│   ├── main.tf              # Main Terraform configuration
│   ├── variables.tf         # Variable definitions
│   ├── outputs.tf           # Output definitions
│   ├── vpc.tf              # VPC and networking
│   ├── eks.tf              # EKS cluster configuration
│   ├── rds.tf              # PostgreSQL database
│   ├── redis.tf            # ElastiCache Redis
│   ├── s3.tf               # S3 storage buckets
│   ├── monitoring.tf       # CloudWatch monitoring
│   ├── templates/
│   │   └── kubeconfig.tpl  # Kubernetes config template
│   └── terraform.tfvars.example # Example variables
├── kubernetes/             # Kubernetes manifests (future)
├── helm/                   # Helm charts (future)
└── README.md              # This file
```

## 🚀 Infrastructure Components

### Core Infrastructure
- **VPC**: Multi-AZ setup with public, private, and database subnets
- **EKS Cluster**: Managed Kubernetes cluster with auto-scaling node groups
- **RDS PostgreSQL**: Managed database with read replicas and automated backups
- **ElastiCache Redis**: In-memory caching and session storage
- **S3 Buckets**: Object storage for assets, backups, and logs

### Security & Compliance
- **KMS Encryption**: All data encrypted at rest and in transit
- **Secrets Manager**: Secure storage for database credentials and API keys
- **Security Groups**: Network-level security controls
- **IAM Roles**: Least-privilege access controls
- **VPC Endpoints**: Private connectivity to AWS services

### Monitoring & Observability
- **CloudWatch**: Comprehensive monitoring and alerting
- **CloudWatch Logs**: Centralized log aggregation
- **CloudWatch Dashboards**: Real-time infrastructure metrics
- **SNS Alerts**: Automated alerting for critical events
- **X-Ray**: Distributed tracing (optional)

### Performance & Scalability
- **Auto Scaling**: Automatic scaling based on demand
- **CloudFront CDN**: Global content delivery
- **Multi-AZ Deployment**: High availability across availability zones
- **Read Replicas**: Database read scaling
- **Spot Instances**: Cost-optimized compute resources

## 🛠️ Prerequisites

### Required Tools
- [Terraform](https://www.terraform.io/downloads.html) >= 1.0
- [AWS CLI](https://aws.amazon.com/cli/) >= 2.0
- [kubectl](https://kubernetes.io/docs/tasks/tools/) >= 1.28
- [Helm](https://helm.sh/docs/intro/install/) >= 3.0

### AWS Permissions
Your AWS credentials need the following permissions:
- EC2 (VPC, Security Groups, etc.)
- EKS (Cluster management)
- RDS (Database management)
- ElastiCache (Redis management)
- S3 (Bucket management)
- IAM (Role and policy management)
- KMS (Key management)
- CloudWatch (Monitoring)
- Secrets Manager (Secret management)

## 🚀 Quick Start

### 1. Clone and Setup
```bash
cd infrastructure/terraform
cp terraform.tfvars.example terraform.tfvars
```

### 2. Configure Variables
Edit `terraform.tfvars` with your specific configuration:

```hcl
# Basic Configuration
aws_region     = "us-west-2"
environment    = "production"
project_name   = "nexus-workspace"

# Customize other variables as needed
```

### 3. Initialize Terraform
```bash
terraform init
```

### 4. Plan Deployment
```bash
terraform plan
```

### 5. Deploy Infrastructure
```bash
terraform apply
```

### 6. Configure kubectl
```bash
# Get the kubeconfig
terraform output -raw kubectl_config > ~/.kube/config-nexus

# Set KUBECONFIG
export KUBECONFIG=~/.kube/config-nexus

# Verify connection
kubectl get nodes
```

## 📋 Configuration Options

### Environment Sizing

#### Development/Staging
```hcl
# Smaller, cost-optimized configuration
db_instance_class = "db.t3.micro"
redis_node_type = "cache.t3.micro"
node_group_desired_size = 2
node_group_max_size = 5
```

#### Production
```hcl
# Production-ready configuration
db_instance_class = "db.r6g.large"
redis_node_type = "cache.r6g.large"
node_group_desired_size = 3
node_group_max_size = 20
```

### Security Configuration
```hcl
# Restrict access to specific IP ranges
allowed_cidr_blocks = ["10.0.0.0/8", "172.16.0.0/12"]

# Enable additional security features
enable_irsa = true
deletion_protection = true
```

### Monitoring Configuration
```hcl
# Enable comprehensive monitoring
enable_monitoring = true
log_retention_days = 90

# Configure alerting
# Add SNS topic subscriptions for alerts
```

## 🔐 Security Best Practices

### Network Security
- Private subnets for application workloads
- Database subnets isolated from public access
- Security groups with minimal required access
- VPC endpoints for private AWS service access

### Data Protection
- Encryption at rest for all storage services
- Encryption in transit for all communications
- KMS key rotation enabled
- Secrets stored in AWS Secrets Manager

### Access Control
- IAM roles with least-privilege access
- IRSA (IAM Roles for Service Accounts) for pod-level permissions
- No hardcoded credentials in configuration

### Monitoring & Compliance
- CloudTrail logging enabled
- VPC Flow Logs for network monitoring
- CloudWatch monitoring for all services
- Automated alerting for security events

## 📊 Monitoring & Alerting

### Key Metrics Monitored
- **EKS Cluster**: Node health, pod status, resource utilization
- **RDS**: CPU, memory, connections, query performance
- **Redis**: Memory usage, connections, hit rate
- **Application**: Error rates, response times, throughput

### Alert Conditions
- High CPU/memory utilization (>80%)
- Database connection limits approaching
- Application error rates exceeding thresholds
- Infrastructure component failures

### Dashboards
Access your CloudWatch dashboard:
```bash
terraform output cloudwatch_dashboard_url
```

## 💾 Backup & Disaster Recovery

### Automated Backups
- **RDS**: Daily automated backups with 7-day retention
- **EKS**: Persistent volume snapshots
- **S3**: Cross-region replication for critical data

### Recovery Procedures
1. **Database Recovery**: Point-in-time recovery from RDS backups
2. **Application Recovery**: Redeploy from container images
3. **Configuration Recovery**: Restore from Terraform state

## 💰 Cost Optimization

### Cost-Saving Features
- **Spot Instances**: For non-critical workloads
- **S3 Lifecycle Policies**: Automatic data archiving
- **Right-Sizing**: Appropriate instance types for workloads
- **Reserved Instances**: For predictable workloads

### Cost Monitoring
```bash
# View estimated monthly costs
aws ce get-cost-and-usage \
  --time-period Start=2024-01-01,End=2024-01-31 \
  --granularity MONTHLY \
  --metrics BlendedCost
```

## 🔧 Maintenance

### Regular Tasks
- **Security Updates**: Keep EKS and node AMIs updated
- **Backup Verification**: Test backup restoration procedures
- **Cost Review**: Monthly cost analysis and optimization
- **Security Audit**: Quarterly security configuration review

### Scaling Operations
```bash
# Scale EKS node group
aws eks update-nodegroup-config \
  --cluster-name nexus-workspace-production \
  --nodegroup-name primary \
  --scaling-config minSize=2,maxSize=10,desiredSize=5
```

## 🚨 Troubleshooting

### Common Issues

#### EKS Nodes Not Joining
```bash
# Check node group status
aws eks describe-nodegroup \
  --cluster-name nexus-workspace-production \
  --nodegroup-name primary

# Check CloudWatch logs
aws logs describe-log-groups \
  --log-group-name-prefix /aws/eks/nexus-workspace-production
```

#### Database Connection Issues
```bash
# Test database connectivity
aws rds describe-db-instances \
  --db-instance-identifier nexus-workspace-production-db

# Check security group rules
aws ec2 describe-security-groups \
  --group-ids sg-xxxxxxxxx
```

#### High Costs
```bash
# Identify cost drivers
aws ce get-dimension-values \
  --dimension SERVICE \
  --time-period Start=2024-01-01,End=2024-01-31
```

## 📚 Additional Resources

- [AWS EKS Best Practices](https://aws.github.io/aws-eks-best-practices/)
- [Terraform AWS Provider Documentation](https://registry.terraform.io/providers/hashicorp/aws/latest/docs)
- [Kubernetes Documentation](https://kubernetes.io/docs/)
- [AWS Well-Architected Framework](https://aws.amazon.com/architecture/well-architected/)

## 🤝 Contributing

1. Create a feature branch
2. Make your changes
3. Test with `terraform plan`
4. Submit a pull request
5. Ensure all checks pass

## 📞 Support

For infrastructure-related issues:
1. Check CloudWatch logs and metrics
2. Review Terraform state and configuration
3. Consult AWS documentation
4. Contact the infrastructure team

---

**Note**: This infrastructure configuration is designed for production use. Always test changes in a development environment first.
