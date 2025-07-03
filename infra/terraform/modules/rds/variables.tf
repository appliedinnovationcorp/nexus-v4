/**
 * Nexus Workspace - RDS Module Variables
 */

variable "environment" {
  description = "The environment name (e.g. staging, production)"
  type        = string
}

variable "vpc_id" {
  description = "The ID of the VPC where the RDS instance will be created"
  type        = string
}

variable "subnet_ids" {
  description = "The IDs of the subnets where the RDS instance will be created"
  type        = list(string)
}

variable "allowed_security_groups" {
  description = "List of security group IDs allowed to connect to the RDS instance"
  type        = list(string)
  default     = []
}

variable "engine" {
  description = "The database engine to use"
  type        = string
  default     = "postgres"
}

variable "engine_version" {
  description = "The version of the database engine to use"
  type        = string
  default     = "15.4"
}

variable "parameter_group_family" {
  description = "The family of the DB parameter group"
  type        = string
  default     = "postgres15"
}

variable "instance_class" {
  description = "The instance type of the RDS instance"
  type        = string
  default     = "db.t3.medium"
}

variable "allocated_storage" {
  description = "The amount of allocated storage in gibibytes"
  type        = number
  default     = 20
}

variable "max_allocated_storage" {
  description = "The upper limit to which Amazon RDS can automatically scale the storage of the DB instance"
  type        = number
  default     = 100
}

variable "storage_encrypted" {
  description = "Specifies whether the DB instance is encrypted"
  type        = bool
  default     = true
}

variable "kms_key_id" {
  description = "The ARN for the KMS encryption key"
  type        = string
  default     = null
}

variable "database_name" {
  description = "The name of the database to create when the DB instance is created"
  type        = string
  default     = "nexus"
}

variable "database_username" {
  description = "Username for the master DB user"
  type        = string
  default     = "nexus_app"
}

variable "multi_az" {
  description = "Specifies if the RDS instance is multi-AZ"
  type        = bool
  default     = false
}

variable "backup_retention_period" {
  description = "The days to retain backups for"
  type        = number
  default     = 7
}

variable "backup_window" {
  description = "The daily time range during which automated backups are created"
  type        = string
  default     = "03:00-04:00"
}

variable "maintenance_window" {
  description = "The window to perform maintenance in"
  type        = string
  default     = "sun:04:00-sun:05:00"
}

variable "monitoring_interval" {
  description = "The interval, in seconds, between points when Enhanced Monitoring metrics are collected for the DB instance"
  type        = number
  default     = 60
}

variable "auto_minor_version_upgrade" {
  description = "Indicates that minor engine upgrades will be applied automatically to the DB instance during the maintenance window"
  type        = bool
  default     = true
}

variable "apply_immediately" {
  description = "Specifies whether any database modifications are applied immediately, or during the next maintenance window"
  type        = bool
  default     = false
}

variable "deletion_protection" {
  description = "If the DB instance should have deletion protection enabled"
  type        = bool
  default     = true
}

variable "skip_final_snapshot" {
  description = "Determines whether a final DB snapshot is created before the DB instance is deleted"
  type        = bool
  default     = false
}

variable "performance_insights_enabled" {
  description = "Specifies whether Performance Insights are enabled"
  type        = bool
  default     = true
}

variable "performance_insights_retention_period" {
  description = "The amount of time in days to retain Performance Insights data"
  type        = number
  default     = 7
}

variable "performance_insights_kms_key_id" {
  description = "The ARN for the KMS key to encrypt Performance Insights data"
  type        = string
  default     = null
}

variable "db_parameters" {
  description = "A list of DB parameters to apply"
  type = list(object({
    name  = string
    value = string
  }))
  default = [
    {
      name  = "log_statement"
      value = "none"
    },
    {
      name  = "log_min_duration_statement"
      value = "1000"
    }
  ]
}
