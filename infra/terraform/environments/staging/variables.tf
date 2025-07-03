/**
 * Nexus Workspace - Staging Environment Variables
 * 
 * This file defines all variables used in the staging environment configuration.
 * These variables can be overridden using a terraform.tfvars file.
 */

variable "aws_region" {
  description = "The AWS region to deploy resources to"
  type        = string
  default     = "us-west-2"
}

variable "vpc_cidr" {
  description = "The CIDR block for the VPC"
  type        = string
  default     = "10.20.0.0/16"
}

variable "availability_zones" {
  description = "The availability zones to use for subnets"
  type        = list(string)
  default     = ["us-west-2a", "us-west-2b", "us-west-2c"]
}

variable "private_subnets" {
  description = "The CIDR blocks for the private subnets"
  type        = list(string)
  default     = ["10.20.1.0/24", "10.20.2.0/24", "10.20.3.0/24"]
}

variable "public_subnets" {
  description = "The CIDR blocks for the public subnets"
  type        = list(string)
  default     = ["10.20.101.0/24", "10.20.102.0/24", "10.20.103.0/24"]
}

variable "database_subnets" {
  description = "The CIDR blocks for the database subnets"
  type        = list(string)
  default     = ["10.20.201.0/24", "10.20.202.0/24", "10.20.203.0/24"]
}

variable "single_nat_gateway" {
  description = "Whether to use a single NAT gateway for all private subnets"
  type        = bool
  default     = true
}

variable "eks_cluster_version" {
  description = "The version of the EKS cluster"
  type        = string
  default     = "1.28"
}

variable "eks_map_roles" {
  description = "Additional IAM roles to add to the aws-auth configmap"
  type = list(object({
    rolearn  = string
    username = string
    groups   = list(string)
  }))
  default = []
}

variable "eks_map_users" {
  description = "Additional IAM users to add to the aws-auth configmap"
  type = list(object({
    userarn  = string
    username = string
    groups   = list(string)
  }))
  default = []
}

variable "domain_name" {
  description = "The domain name to use for the application"
  type        = string
  default     = "nexus-workspace.com"
}

variable "route53_zone_id" {
  description = "The Route53 zone ID to use for DNS records"
  type        = string
}

variable "cloudfront_cache_behaviors" {
  description = "Cache behaviors for the CloudFront distribution"
  type = list(object({
    path_pattern     = string
    target_origin_id = string
    allowed_methods  = list(string)
    cached_methods   = list(string)
    forwarded_values = object({
      query_string = bool
      cookies      = object({
        forward = string
      })
    })
    viewer_protocol_policy = string
    min_ttl                = number
    default_ttl            = number
    max_ttl                = number
  }))
  default = [
    {
      path_pattern     = "/api/*"
      target_origin_id = "api"
      allowed_methods  = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
      cached_methods   = ["GET", "HEAD"]
      forwarded_values = {
        query_string = true
        cookies      = {
          forward = "all"
        }
      }
      viewer_protocol_policy = "redirect-to-https"
      min_ttl                = 0
      default_ttl            = 0
      max_ttl                = 0
    },
    {
      path_pattern     = "/static/*"
      target_origin_id = "s3"
      allowed_methods  = ["GET", "HEAD", "OPTIONS"]
      cached_methods   = ["GET", "HEAD"]
      forwarded_values = {
        query_string = false
        cookies      = {
          forward = "none"
        }
      }
      viewer_protocol_policy = "redirect-to-https"
      min_ttl                = 0
      default_ttl            = 86400
      max_ttl                = 31536000
    }
  ]
}

variable "alert_email" {
  description = "Email address to send alerts to"
  type        = string
}

variable "grafana_admin_password" {
  description = "Admin password for Grafana"
  type        = string
  sensitive   = true
}
