#!/bin/bash

# Bootstrap script for Staging Environment
# This script creates the necessary S3 bucket and DynamoDB table for Terraform state management

set -e

# Configuration
AWS_REGION="us-west-2"
PROJECT_NAME="nexus-workspace"
ENVIRONMENT="staging"
S3_BUCKET="${PROJECT_NAME}-terraform-state-${ENVIRONMENT}"
DYNAMODB_TABLE="${PROJECT_NAME}-terraform-locks-${ENVIRONMENT}"

echo "🚀 Bootstrapping Terraform backend for ${ENVIRONMENT} environment..."

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
    echo "❌ AWS CLI is not installed. Please install it first."
    exit 1
fi

# Check if AWS credentials are configured
if ! aws sts get-caller-identity &> /dev/null; then
    echo "❌ AWS credentials are not configured. Please run 'aws configure' first."
    exit 1
fi

echo "✅ AWS CLI is configured"

# Create S3 bucket for Terraform state
echo "📦 Creating S3 bucket: ${S3_BUCKET}"
if aws s3api head-bucket --bucket "${S3_BUCKET}" 2>/dev/null; then
    echo "✅ S3 bucket ${S3_BUCKET} already exists"
else
    aws s3api create-bucket \
        --bucket "${S3_BUCKET}" \
        --region "${AWS_REGION}" \
        --create-bucket-configuration LocationConstraint="${AWS_REGION}"
    
    # Enable versioning
    aws s3api put-bucket-versioning \
        --bucket "${S3_BUCKET}" \
        --versioning-configuration Status=Enabled
    
    # Enable server-side encryption
    aws s3api put-bucket-encryption \
        --bucket "${S3_BUCKET}" \
        --server-side-encryption-configuration '{
            "Rules": [
                {
                    "ApplyServerSideEncryptionByDefault": {
                        "SSEAlgorithm": "AES256"
                    }
                }
            ]
        }'
    
    # Block public access
    aws s3api put-public-access-block \
        --bucket "${S3_BUCKET}" \
        --public-access-block-configuration \
        BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true
    
    echo "✅ S3 bucket ${S3_BUCKET} created and configured"
fi

# Create DynamoDB table for Terraform locks
echo "🔒 Creating DynamoDB table: ${DYNAMODB_TABLE}"
if aws dynamodb describe-table --table-name "${DYNAMODB_TABLE}" --region "${AWS_REGION}" &>/dev/null; then
    echo "✅ DynamoDB table ${DYNAMODB_TABLE} already exists"
else
    aws dynamodb create-table \
        --table-name "${DYNAMODB_TABLE}" \
        --attribute-definitions AttributeName=LockID,AttributeType=S \
        --key-schema AttributeName=LockID,KeyType=HASH \
        --provisioned-throughput ReadCapacityUnits=5,WriteCapacityUnits=5 \
        --region "${AWS_REGION}"
    
    echo "⏳ Waiting for DynamoDB table to be active..."
    aws dynamodb wait table-exists --table-name "${DYNAMODB_TABLE}" --region "${AWS_REGION}"
    echo "✅ DynamoDB table ${DYNAMODB_TABLE} created"
fi

echo ""
echo "🎉 Bootstrap completed successfully!"
echo ""
echo "Next steps:"
echo "1. cd infrastructure/terraform/environments/staging"
echo "2. terraform init"
echo "3. terraform plan"
echo "4. terraform apply"
echo ""
echo "Resources created:"
echo "- S3 Bucket: ${S3_BUCKET}"
echo "- DynamoDB Table: ${DYNAMODB_TABLE}"
