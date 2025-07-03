/**
 * Nexus Workspace - Network Module Outputs
 */

output "vpc_id" {
  description = "The ID of the VPC"
  value       = module.vpc.vpc_id
}

output "vpc_cidr_block" {
  description = "The CIDR block of the VPC"
  value       = module.vpc.vpc_cidr_block
}

output "private_subnets" {
  description = "List of IDs of private subnets"
  value       = module.vpc.private_subnets
}

output "private_subnet_cidr_blocks" {
  description = "List of CIDR blocks of private subnets"
  value       = module.vpc.private_subnets_cidr_blocks
}

output "public_subnets" {
  description = "List of IDs of public subnets"
  value       = module.vpc.public_subnets
}

output "public_subnet_cidr_blocks" {
  description = "List of CIDR blocks of public subnets"
  value       = module.vpc.public_subnets_cidr_blocks
}

output "database_subnets" {
  description = "List of IDs of database subnets"
  value       = module.vpc.database_subnets
}

output "database_subnet_cidr_blocks" {
  description = "List of CIDR blocks of database subnets"
  value       = module.vpc.database_subnets_cidr_blocks
}

output "database_subnet_group_name" {
  description = "Name of database subnet group"
  value       = module.vpc.database_subnet_group_name
}

output "nat_public_ips" {
  description = "List of public Elastic IPs created for AWS NAT Gateway"
  value       = module.vpc.nat_public_ips
}

output "private_route_table_ids" {
  description = "List of IDs of private route tables"
  value       = module.vpc.private_route_table_ids
}

output "public_route_table_ids" {
  description = "List of IDs of public route tables"
  value       = module.vpc.public_route_table_ids
}

output "vpc_endpoint_s3_id" {
  description = "The ID of the VPC endpoint for S3"
  value       = var.create_vpc_endpoints ? aws_vpc_endpoint.s3[0].id : null
}

output "vpc_endpoint_dynamodb_id" {
  description = "The ID of the VPC endpoint for DynamoDB"
  value       = var.create_vpc_endpoints ? aws_vpc_endpoint.dynamodb[0].id : null
}

output "vpc_endpoints_security_group_id" {
  description = "The ID of the security group for VPC endpoints"
  value       = var.create_vpc_endpoints ? aws_security_group.vpc_endpoints[0].id : null
}
