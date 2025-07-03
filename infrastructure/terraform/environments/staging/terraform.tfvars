# Staging Environment Configuration
# This mirrors production but with cost-optimized sizing

# Basic Configuration
aws_region     = "us-west-2"
environment    = "staging"
project_name   = "nexus-workspace"
project_owner  = "nexus-team"

# EKS Configuration - Smaller for staging
kubernetes_version         = "1.28"
node_group_instance_types  = ["t3.small", "t3.medium"]
node_group_desired_size    = 2
node_group_max_size        = 5
node_group_min_size        = 1

# Database Configuration - Smaller instance for staging
db_instance_class           = "db.t3.micro"
db_allocated_storage        = 20
db_max_allocated_storage    = 50
db_engine_version          = "15.4"
db_backup_retention_period = 3  # Shorter retention for staging
db_backup_window           = "03:00-04:00"
db_maintenance_window      = "sun:04:00-sun:05:00"

# Redis Configuration - Smaller for staging
redis_node_type         = "cache.t3.micro"
redis_num_cache_nodes   = 1
redis_engine_version    = "7.0"

# S3 Configuration
s3_versioning_enabled = true
s3_lifecycle_enabled  = true

# Monitoring Configuration
enable_monitoring    = true
log_retention_days   = 7  # Shorter retention for staging

# Security Configuration
allowed_cidr_blocks = ["0.0.0.0/0"] # Consider restricting to office/VPN IPs
enable_irsa         = true

# Domain Configuration (staging subdomain)
domain_name          = "staging.nexus-workspace.com"  # Update with your actual domain
create_route53_zone  = false
ssl_certificate_arn  = ""

# Backup Configuration
enable_automated_backups = true
backup_schedule         = "cron(0 3 * * ? *)"  # Daily at 3 AM UTC
