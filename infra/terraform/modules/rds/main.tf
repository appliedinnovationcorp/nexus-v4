/**
 * Nexus Workspace - RDS Module
 * 
 * This module creates an RDS instance with associated security groups and parameter groups.
 */

terraform {
  required_version = ">= 1.0.0"
  
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.5"
    }
  }
}

locals {
  name = "nexus-${var.environment}"
  
  tags = {
    Environment = var.environment
    Name        = local.name
    ManagedBy   = "terraform"
  }
}

# Generate random password for database
resource "random_password" "db_password" {
  length           = 16
  special          = true
  override_special = "!#$%&*()-_=+[]{}<>:?"
}

# Security group for RDS
resource "aws_security_group" "rds" {
  name        = "${local.name}-rds"
  description = "Security group for ${local.name} RDS instance"
  vpc_id      = var.vpc_id

  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = var.allowed_security_groups
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(
    local.tags,
    {
      Name = "${local.name}-rds"
    }
  )
}

# RDS subnet group
resource "aws_db_subnet_group" "this" {
  name        = "${local.name}-subnet-group"
  description = "Subnet group for ${local.name} RDS instance"
  subnet_ids  = var.subnet_ids

  tags = merge(
    local.tags,
    {
      Name = "${local.name}-subnet-group"
    }
  )
}

# RDS parameter group
resource "aws_db_parameter_group" "this" {
  name        = "${local.name}-parameter-group"
  family      = var.parameter_group_family
  description = "Parameter group for ${local.name} RDS instance"

  dynamic "parameter" {
    for_each = var.db_parameters
    content {
      name  = parameter.value.name
      value = parameter.value.value
    }
  }

  tags = merge(
    local.tags,
    {
      Name = "${local.name}-parameter-group"
    }
  )
}

# RDS instance
resource "aws_db_instance" "this" {
  identifier = "${local.name}-db"
  
  # Engine configuration
  engine               = var.engine
  engine_version       = var.engine_version
  instance_class       = var.instance_class
  allocated_storage    = var.allocated_storage
  max_allocated_storage = var.max_allocated_storage
  storage_type         = "gp3"
  storage_encrypted    = var.storage_encrypted
  kms_key_id           = var.kms_key_id
  
  # Database configuration
  db_name              = var.database_name
  username             = var.database_username
  password             = random_password.db_password.result
  port                 = 5432
  
  # Network configuration
  db_subnet_group_name = aws_db_subnet_group.this.name
  vpc_security_group_ids = [aws_security_group.rds.id]
  multi_az             = var.multi_az
  publicly_accessible  = false
  
  # Backup and maintenance
  backup_retention_period = var.backup_retention_period
  backup_window           = var.backup_window
  maintenance_window      = var.maintenance_window
  
  # Monitoring
  monitoring_interval = var.monitoring_interval
  monitoring_role_arn = var.monitoring_interval > 0 ? aws_iam_role.rds_enhanced_monitoring[0].arn : null
  
  # Parameter group
  parameter_group_name = aws_db_parameter_group.this.name
  
  # Options
  auto_minor_version_upgrade = var.auto_minor_version_upgrade
  apply_immediately          = var.apply_immediately
  deletion_protection        = var.deletion_protection
  skip_final_snapshot        = var.skip_final_snapshot
  final_snapshot_identifier  = var.skip_final_snapshot ? null : "${local.name}-final-snapshot-${formatdate("YYYYMMDDHHmmss", timestamp())}"
  
  # Performance Insights
  performance_insights_enabled          = var.performance_insights_enabled
  performance_insights_retention_period = var.performance_insights_enabled ? var.performance_insights_retention_period : null
  performance_insights_kms_key_id       = var.performance_insights_enabled ? var.performance_insights_kms_key_id : null
  
  tags = merge(
    local.tags,
    {
      Name = "${local.name}-db"
    }
  )
}

# IAM role for RDS Enhanced Monitoring
resource "aws_iam_role" "rds_enhanced_monitoring" {
  count = var.monitoring_interval > 0 ? 1 : 0
  
  name = "${local.name}-rds-monitoring-role"
  
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "monitoring.rds.amazonaws.com"
        }
      }
    ]
  })
  
  managed_policy_arns = ["arn:aws:iam::aws:policy/service-role/AmazonRDSEnhancedMonitoringRole"]
  
  tags = local.tags
}
