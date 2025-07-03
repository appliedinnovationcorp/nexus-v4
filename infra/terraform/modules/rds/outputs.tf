/**
 * Nexus Workspace - RDS Module Outputs
 */

output "instance_id" {
  description = "The ID of the RDS instance"
  value       = aws_db_instance.this.id
}

output "instance_arn" {
  description = "The ARN of the RDS instance"
  value       = aws_db_instance.this.arn
}

output "endpoint" {
  description = "The connection endpoint of the RDS instance"
  value       = aws_db_instance.this.endpoint
}

output "address" {
  description = "The hostname of the RDS instance"
  value       = aws_db_instance.this.address
}

output "port" {
  description = "The port of the RDS instance"
  value       = aws_db_instance.this.port
}

output "database_name" {
  description = "The name of the database"
  value       = aws_db_instance.this.db_name
}

output "username" {
  description = "The master username for the database"
  value       = aws_db_instance.this.username
}

output "password" {
  description = "The master password for the database"
  value       = random_password.db_password.result
  sensitive   = true
}

output "security_group_id" {
  description = "The ID of the security group for the RDS instance"
  value       = aws_security_group.rds.id
}

output "subnet_group_id" {
  description = "The ID of the DB subnet group"
  value       = aws_db_subnet_group.this.id
}

output "parameter_group_id" {
  description = "The ID of the DB parameter group"
  value       = aws_db_parameter_group.this.id
}

output "monitoring_role_arn" {
  description = "The ARN of the IAM role used for enhanced monitoring"
  value       = var.monitoring_interval > 0 ? aws_iam_role.rds_enhanced_monitoring[0].arn : null
}
