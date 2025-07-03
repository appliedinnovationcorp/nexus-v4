# Terraform Backend Configuration for Staging Environment
# This ensures staging state is separate from production

terraform {
  backend "s3" {
    bucket         = "nexus-workspace-terraform-state-staging"
    key            = "staging/terraform.tfstate"
    region         = "us-west-2"
    encrypt        = true
    dynamodb_table = "nexus-workspace-terraform-locks-staging"
  }
}

# Note: You'll need to create these resources first:
# 1. S3 bucket: nexus-workspace-terraform-state-staging
# 2. DynamoDB table: nexus-workspace-terraform-locks-staging
# 
# Run the bootstrap script to create these resources automatically
