# Staging Environment Main Configuration
# This file imports all the modules from the parent directory

# Configure the AWS Provider
terraform {
  required_version = ">= 1.0"
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
  }
}

# Configure AWS Provider
provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Environment = var.environment
      Project     = var.project_name
      Owner       = var.project_owner
      ManagedBy   = "terraform"
    }
  }
}

# Import all infrastructure modules from parent directory
module "vpc" {
  source = "../../"
  
  # Pass all variables to the main module
  aws_region                    = var.aws_region
  environment                   = var.environment
  project_name                  = var.project_name
  project_owner                 = var.project_owner
  kubernetes_version            = var.kubernetes_version
  node_group_instance_types     = var.node_group_instance_types
  node_group_desired_size       = var.node_group_desired_size
  node_group_max_size           = var.node_group_max_size
  node_group_min_size           = var.node_group_min_size
  db_instance_class             = var.db_instance_class
  db_allocated_storage          = var.db_allocated_storage
  db_max_allocated_storage      = var.db_max_allocated_storage
  db_engine_version             = var.db_engine_version
  db_backup_retention_period    = var.db_backup_retention_period
  db_backup_window              = var.db_backup_window
  db_maintenance_window         = var.db_maintenance_window
  redis_node_type               = var.redis_node_type
  redis_num_cache_nodes         = var.redis_num_cache_nodes
  redis_engine_version          = var.redis_engine_version
  s3_versioning_enabled         = var.s3_versioning_enabled
  s3_lifecycle_enabled          = var.s3_lifecycle_enabled
  enable_monitoring             = var.enable_monitoring
  log_retention_days            = var.log_retention_days
  allowed_cidr_blocks           = var.allowed_cidr_blocks
  enable_irsa                   = var.enable_irsa
  domain_name                   = var.domain_name
  create_route53_zone           = var.create_route53_zone
  ssl_certificate_arn           = var.ssl_certificate_arn
  enable_automated_backups      = var.enable_automated_backups
  backup_schedule               = var.backup_schedule
}
