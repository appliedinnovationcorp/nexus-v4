/**
 * Nexus Workspace - Staging Environment
 * 
 * This Terraform configuration creates a complete staging environment that mirrors production.
 * All infrastructure components are defined here to ensure staging is an accurate representation
 * of the production environment.
 */

terraform {
  required_version = ">= 1.0.0"

  backend "s3" {
    bucket         = "nexus-terraform-state"
    key            = "environments/staging/terraform.tfstate"
    region         = "us-west-2"
    dynamodb_table = "nexus-terraform-locks"
    encrypt        = true
  }

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.23"
    }
    helm = {
      source  = "hashicorp/helm"
      version = "~> 2.11"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.5"
    }
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Environment = "staging"
      Project     = "nexus"
      ManagedBy   = "terraform"
    }
  }
}

# Import shared modules
module "network" {
  source = "../../modules/network"

  environment         = "staging"
  vpc_cidr            = var.vpc_cidr
  availability_zones  = var.availability_zones
  private_subnets     = var.private_subnets
  public_subnets      = var.public_subnets
  database_subnets    = var.database_subnets
  enable_nat_gateway  = true
  single_nat_gateway  = var.single_nat_gateway
  enable_vpn_gateway  = false
}

module "eks" {
  source = "../../modules/eks"

  environment       = "staging"
  cluster_name      = "nexus-staging"
  cluster_version   = var.eks_cluster_version
  vpc_id            = module.network.vpc_id
  subnet_ids        = module.network.private_subnets
  
  # Node groups configuration
  node_groups = {
    general = {
      name           = "general"
      instance_types = ["t3.medium"]
      min_size       = 2
      max_size       = 5
      desired_size   = 3
      disk_size      = 50
    }
    services = {
      name           = "services"
      instance_types = ["t3.large"]
      min_size       = 2
      max_size       = 5
      desired_size   = 2
      disk_size      = 50
      taints         = []
      labels = {
        role = "services"
      }
    }
  }

  # Auth configuration
  map_roles = var.eks_map_roles
  map_users = var.eks_map_users
}

module "rds" {
  source = "../../modules/rds"

  environment         = "staging"
  vpc_id              = module.network.vpc_id
  subnet_ids          = module.network.database_subnets
  engine              = "postgres"
  engine_version      = "15.4"
  instance_class      = "db.t3.medium"
  allocated_storage   = 20
  storage_encrypted   = true
  multi_az            = true
  database_name       = "nexus"
  database_username   = "nexus_app"
  deletion_protection = true
  backup_retention_period = 7
  
  # Security groups
  allowed_security_groups = [module.eks.node_security_group_id]
}

module "elasticache" {
  source = "../../modules/elasticache"

  environment       = "staging"
  vpc_id            = module.network.vpc_id
  subnet_ids        = module.network.private_subnets
  node_type         = "cache.t3.medium"
  num_cache_nodes   = 2
  engine_version    = "7.0"
  
  # Security groups
  allowed_security_groups = [module.eks.node_security_group_id]
}

module "s3" {
  source = "../../modules/s3"

  environment = "staging"
  buckets = {
    assets = {
      name        = "nexus-staging-assets"
      versioning  = true
      lifecycle_rules = [{
        id      = "expire-old-versions"
        enabled = true
        noncurrent_version_expiration = {
          days = 30
        }
      }]
    }
    uploads = {
      name        = "nexus-staging-uploads"
      versioning  = true
      lifecycle_rules = [{
        id      = "expire-old-versions"
        enabled = true
        noncurrent_version_expiration = {
          days = 30
        }
      }]
    }
    logs = {
      name        = "nexus-staging-logs"
      versioning  = false
      lifecycle_rules = [{
        id      = "expire-old-logs"
        enabled = true
        expiration = {
          days = 90
        }
      }]
    }
  }
}

module "cloudfront" {
  source = "../../modules/cloudfront"

  environment = "staging"
  domain_name = var.domain_name
  assets_bucket_name = module.s3.bucket_ids["assets"]
  logs_bucket_name   = module.s3.bucket_ids["logs"]
  
  # Certificate configuration
  certificate_arn = module.acm.certificate_arn
  
  # Cache behaviors
  cache_behaviors = var.cloudfront_cache_behaviors
}

module "acm" {
  source = "../../modules/acm"

  environment = "staging"
  domain_name = var.domain_name
  subject_alternative_names = [
    "*.${var.domain_name}",
    "api.${var.domain_name}",
    "admin.${var.domain_name}"
  ]
  zone_id     = var.route53_zone_id
  validate_certificate = true
}

module "route53" {
  source = "../../modules/route53"

  environment = "staging"
  domain_name = var.domain_name
  zone_id     = var.route53_zone_id
  
  records = [
    {
      name    = "staging"
      type    = "A"
      alias = {
        name                   = module.cloudfront.distribution_domain_name
        zone_id                = module.cloudfront.distribution_hosted_zone_id
        evaluate_target_health = false
      }
    },
    {
      name    = "api.staging"
      type    = "A"
      alias = {
        name                   = module.eks.load_balancer_hostname
        zone_id                = module.eks.load_balancer_zone_id
        evaluate_target_health = true
      }
    }
  ]
}

module "iam" {
  source = "../../modules/iam"

  environment = "staging"
  
  # Service accounts
  service_accounts = {
    "app" = {
      namespace = "default"
      policies = [
        "AmazonS3ReadOnlyAccess",
        "AmazonSQSFullAccess"
      ]
    },
    "ci-cd" = {
      namespace = "ci-cd"
      policies = [
        "AmazonECR-FullAccess",
        "AmazonS3FullAccess"
      ]
    }
  }
}

module "ecr" {
  source = "../../modules/ecr"

  environment = "staging"
  repositories = [
    "nexus-frontend",
    "nexus-backend",
    "nexus-worker"
  ]
  
  # Image scanning and lifecycle policies
  scan_on_push = true
  lifecycle_policy = {
    rules = [{
      rulePriority = 1
      description  = "Keep last 30 images"
      selection = {
        tagStatus     = "any"
        countType     = "imageCountMoreThan"
        countNumber   = 30
      }
      action = {
        type = "expire"
      }
    }]
  }
}

module "sqs" {
  source = "../../modules/sqs"

  environment = "staging"
  queues = {
    "default" = {
      name                      = "nexus-staging-default"
      delay_seconds             = 0
      max_message_size          = 262144
      message_retention_seconds = 345600
      receive_wait_time_seconds = 10
      visibility_timeout_seconds = 60
      redrive_policy = {
        maxReceiveCount     = 5
        deadLetterTargetArn = "nexus-staging-dead-letter"
      }
    },
    "dead-letter" = {
      name                      = "nexus-staging-dead-letter"
      delay_seconds             = 0
      max_message_size          = 262144
      message_retention_seconds = 1209600
      receive_wait_time_seconds = 10
    }
  }
}

module "cloudwatch" {
  source = "../../modules/cloudwatch"

  environment = "staging"
  
  # Log groups
  log_groups = {
    "application" = {
      name              = "/nexus/staging/application"
      retention_in_days = 30
    },
    "access" = {
      name              = "/nexus/staging/access"
      retention_in_days = 30
    },
    "error" = {
      name              = "/nexus/staging/error"
      retention_in_days = 90
    }
  }
  
  # Alarms
  alarms = {
    "high-error-rate" = {
      comparison_operator = "GreaterThanThreshold"
      evaluation_periods  = 2
      metric_name         = "ErrorCount"
      namespace           = "AWS/ApiGateway"
      period              = 300
      statistic           = "Sum"
      threshold           = 10
      alarm_description   = "High error rate detected"
      alarm_actions       = [module.sns.topic_arns["alerts"]]
    },
    "database-cpu" = {
      comparison_operator = "GreaterThanThreshold"
      evaluation_periods  = 3
      metric_name         = "CPUUtilization"
      namespace           = "AWS/RDS"
      period              = 300
      statistic           = "Average"
      threshold           = 80
      alarm_description   = "Database CPU utilization is high"
      alarm_actions       = [module.sns.topic_arns["alerts"]]
    }
  }
}

module "sns" {
  source = "../../modules/sns"

  environment = "staging"
  topics = {
    "alerts" = {
      name = "nexus-staging-alerts"
      subscriptions = [
        {
          protocol = "email"
          endpoint = var.alert_email
        }
      ]
    }
  }
}

module "secrets_manager" {
  source = "../../modules/secrets_manager"

  environment = "staging"
  secrets = {
    "database" = {
      name        = "nexus/staging/database"
      description = "Database credentials for staging environment"
      secret_string = jsonencode({
        username = module.rds.username
        password = module.rds.password
        host     = module.rds.endpoint
        port     = module.rds.port
        database = module.rds.database_name
      })
    },
    "jwt" = {
      name        = "nexus/staging/jwt"
      description = "JWT secrets for staging environment"
      secret_string = jsonencode({
        secret        = random_password.jwt_secret.result
        refresh_secret = random_password.jwt_refresh_secret.result
      })
    }
  }
}

# Generate secure random passwords
resource "random_password" "jwt_secret" {
  length  = 64
  special = true
}

resource "random_password" "jwt_refresh_secret" {
  length  = 64
  special = true
}

# Kubernetes resources
provider "kubernetes" {
  host                   = module.eks.cluster_endpoint
  cluster_ca_certificate = base64decode(module.eks.cluster_certificate_authority_data)
  exec {
    api_version = "client.authentication.k8s.io/v1beta1"
    args        = ["eks", "get-token", "--cluster-name", module.eks.cluster_name]
    command     = "aws"
  }
}

provider "helm" {
  kubernetes {
    host                   = module.eks.cluster_endpoint
    cluster_ca_certificate = base64decode(module.eks.cluster_certificate_authority_data)
    exec {
      api_version = "client.authentication.k8s.io/v1beta1"
      args        = ["eks", "get-token", "--cluster-name", module.eks.cluster_name]
      command     = "aws"
    }
  }
}

module "k8s_apps" {
  source = "../../modules/k8s_apps"
  
  environment = "staging"
  
  # Ingress controller
  ingress_nginx = {
    enabled     = true
    chart_version = "4.7.1"
    values = {
      controller = {
        replicaCount = 2
        service = {
          annotations = {
            "service.beta.kubernetes.io/aws-load-balancer-type" = "nlb"
            "service.beta.kubernetes.io/aws-load-balancer-cross-zone-load-balancing-enabled" = "true"
          }
        }
      }
    }
  }
  
  # Cert Manager
  cert_manager = {
    enabled       = true
    chart_version = "v1.13.1"
    values = {
      installCRDs = true
    }
  }
  
  # Prometheus and Grafana for monitoring
  prometheus = {
    enabled       = true
    chart_version = "25.1.0"
    values = {
      server = {
        retention = "15d"
        persistentVolume = {
          size = "50Gi"
        }
      }
      alertmanager = {
        enabled = true
        persistentVolume = {
          size = "10Gi"
        }
      }
    }
  }
  
  grafana = {
    enabled       = true
    chart_version = "6.58.9"
    values = {
      persistence = {
        enabled = true
        size    = "10Gi"
      }
      adminPassword = var.grafana_admin_password
    }
  }
  
  # External DNS for Route53 integration
  external_dns = {
    enabled       = true
    chart_version = "1.13.1"
    values = {
      provider = "aws"
      aws = {
        region = var.aws_region
        zoneType = "public"
      }
      domainFilters = [var.domain_name]
      policy = "sync"
    }
  }
}

# Output important information
output "vpc_id" {
  description = "The ID of the VPC"
  value       = module.network.vpc_id
}

output "eks_cluster_name" {
  description = "The name of the EKS cluster"
  value       = module.eks.cluster_name
}

output "eks_cluster_endpoint" {
  description = "The endpoint for the EKS cluster"
  value       = module.eks.cluster_endpoint
}

output "rds_endpoint" {
  description = "The endpoint of the RDS instance"
  value       = module.rds.endpoint
}

output "elasticache_endpoint" {
  description = "The endpoint of the ElastiCache cluster"
  value       = module.elasticache.endpoint
}

output "cloudfront_distribution_id" {
  description = "The ID of the CloudFront distribution"
  value       = module.cloudfront.distribution_id
}

output "cloudfront_domain_name" {
  description = "The domain name of the CloudFront distribution"
  value       = module.cloudfront.distribution_domain_name
}

output "s3_bucket_ids" {
  description = "The IDs of the S3 buckets"
  value       = module.s3.bucket_ids
}

output "ecr_repository_urls" {
  description = "The URLs of the ECR repositories"
  value       = module.ecr.repository_urls
}

output "sqs_queue_urls" {
  description = "The URLs of the SQS queues"
  value       = module.sqs.queue_urls
}

output "cloudwatch_log_group_names" {
  description = "The names of the CloudWatch log groups"
  value       = module.cloudwatch.log_group_names
}

output "secrets_manager_secret_arns" {
  description = "The ARNs of the Secrets Manager secrets"
  value       = module.secrets_manager.secret_arns
}

output "load_balancer_hostname" {
  description = "The hostname of the load balancer"
  value       = module.eks.load_balancer_hostname
}

output "staging_domain" {
  description = "The staging domain name"
  value       = "staging.${var.domain_name}"
}

output "api_domain" {
  description = "The API domain name"
  value       = "api.staging.${var.domain_name}"
}
