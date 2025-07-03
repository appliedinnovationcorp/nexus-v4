/**
 * Nexus Workspace - Network Module
 * 
 * This module creates a VPC with public, private, and database subnets,
 * along with NAT gateways, internet gateways, and route tables.
 */

terraform {
  required_version = ">= 1.0.0"
  
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

locals {
  name = "nexus-${var.environment}"
}

module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "~> 5.0"

  name = local.name
  cidr = var.vpc_cidr

  azs              = var.availability_zones
  private_subnets  = var.private_subnets
  public_subnets   = var.public_subnets
  database_subnets = var.database_subnets

  create_database_subnet_group = true
  
  enable_nat_gateway     = var.enable_nat_gateway
  single_nat_gateway     = var.single_nat_gateway
  one_nat_gateway_per_az = !var.single_nat_gateway
  
  enable_vpn_gateway = var.enable_vpn_gateway
  
  enable_dns_hostnames = true
  enable_dns_support   = true

  # Public subnet configuration
  public_subnet_tags = {
    "kubernetes.io/role/elb" = "1"
  }

  # Private subnet configuration
  private_subnet_tags = {
    "kubernetes.io/role/internal-elb" = "1"
  }

  # VPC Flow Logs
  enable_flow_log                      = var.enable_flow_log
  create_flow_log_cloudwatch_log_group = var.enable_flow_log
  create_flow_log_cloudwatch_iam_role  = var.enable_flow_log
  flow_log_max_aggregation_interval    = 60

  tags = {
    Environment = var.environment
    Name        = local.name
  }
}

# Security group for the VPC endpoints
resource "aws_security_group" "vpc_endpoints" {
  count = var.create_vpc_endpoints ? 1 : 0
  
  name        = "${local.name}-vpc-endpoints"
  description = "Security group for VPC endpoints"
  vpc_id      = module.vpc.vpc_id

  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = [var.vpc_cidr]
  }

  tags = {
    Name        = "${local.name}-vpc-endpoints"
    Environment = var.environment
  }
}

# VPC Endpoints for AWS services
resource "aws_vpc_endpoint" "s3" {
  count = var.create_vpc_endpoints ? 1 : 0
  
  vpc_id            = module.vpc.vpc_id
  service_name      = "com.amazonaws.${var.aws_region}.s3"
  vpc_endpoint_type = "Gateway"
  route_table_ids   = concat(module.vpc.private_route_table_ids, module.vpc.public_route_table_ids)

  tags = {
    Name        = "${local.name}-s3-endpoint"
    Environment = var.environment
  }
}

resource "aws_vpc_endpoint" "dynamodb" {
  count = var.create_vpc_endpoints ? 1 : 0
  
  vpc_id            = module.vpc.vpc_id
  service_name      = "com.amazonaws.${var.aws_region}.dynamodb"
  vpc_endpoint_type = "Gateway"
  route_table_ids   = concat(module.vpc.private_route_table_ids, module.vpc.public_route_table_ids)

  tags = {
    Name        = "${local.name}-dynamodb-endpoint"
    Environment = var.environment
  }
}

# Interface endpoints for other AWS services
locals {
  interface_endpoints = var.create_vpc_endpoints ? [
    "ecr.api",
    "ecr.dkr",
    "logs",
    "secretsmanager",
    "ssm",
    "sqs",
    "elasticloadbalancing",
    "cloudwatch"
  ] : []
}

resource "aws_vpc_endpoint" "interface_endpoints" {
  for_each = var.create_vpc_endpoints ? toset(local.interface_endpoints) : toset([])
  
  vpc_id              = module.vpc.vpc_id
  service_name        = "com.amazonaws.${var.aws_region}.${each.value}"
  vpc_endpoint_type   = "Interface"
  subnet_ids          = module.vpc.private_subnets
  security_group_ids  = [aws_security_group.vpc_endpoints[0].id]
  private_dns_enabled = true

  tags = {
    Name        = "${local.name}-${each.value}-endpoint"
    Environment = var.environment
  }
}
