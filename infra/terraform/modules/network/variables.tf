/**
 * Nexus Workspace - Network Module Variables
 */

variable "environment" {
  description = "The environment name (e.g. staging, production)"
  type        = string
}

variable "aws_region" {
  description = "The AWS region to deploy resources to"
  type        = string
  default     = "us-west-2"
}

variable "vpc_cidr" {
  description = "The CIDR block for the VPC"
  type        = string
}

variable "availability_zones" {
  description = "The availability zones to use for subnets"
  type        = list(string)
}

variable "private_subnets" {
  description = "The CIDR blocks for the private subnets"
  type        = list(string)
}

variable "public_subnets" {
  description = "The CIDR blocks for the public subnets"
  type        = list(string)
}

variable "database_subnets" {
  description = "The CIDR blocks for the database subnets"
  type        = list(string)
}

variable "enable_nat_gateway" {
  description = "Whether to enable NAT gateways for private subnets"
  type        = bool
  default     = true
}

variable "single_nat_gateway" {
  description = "Whether to use a single NAT gateway for all private subnets"
  type        = bool
  default     = false
}

variable "enable_vpn_gateway" {
  description = "Whether to enable a VPN gateway"
  type        = bool
  default     = false
}

variable "enable_flow_log" {
  description = "Whether to enable VPC flow logs"
  type        = bool
  default     = true
}

variable "create_vpc_endpoints" {
  description = "Whether to create VPC endpoints for AWS services"
  type        = bool
  default     = true
}
