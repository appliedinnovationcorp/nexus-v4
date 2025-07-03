/**
 * Nexus Workspace - Kubernetes Applications Module Variables
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

variable "domain_name" {
  description = "The domain name to use for the application"
  type        = string
  default     = "nexus-workspace.com"
}

variable "acm_certificate_arn" {
  description = "The ARN of the ACM certificate to use for the load balancer"
  type        = string
  default     = ""
}

variable "external_dns_role_arn" {
  description = "The ARN of the IAM role for External DNS"
  type        = string
  default     = ""
}

variable "ingress_nginx" {
  description = "Configuration for ingress-nginx"
  type = object({
    enabled       = bool
    chart_version = string
    values        = any
  })
  default = null
}

variable "cert_manager" {
  description = "Configuration for cert-manager"
  type = object({
    enabled       = bool
    chart_version = string
    values        = any
  })
  default = null
}

variable "prometheus" {
  description = "Configuration for Prometheus"
  type = object({
    enabled       = bool
    chart_version = string
    values        = any
  })
  default = null
}

variable "grafana" {
  description = "Configuration for Grafana"
  type = object({
    enabled       = bool
    chart_version = string
    values        = any
  })
  default = null
}

variable "external_dns" {
  description = "Configuration for External DNS"
  type = object({
    enabled       = bool
    chart_version = string
    values        = any
  })
  default = null
}

variable "argocd" {
  description = "Configuration for ArgoCD"
  type = object({
    enabled       = bool
    chart_version = string
    values        = any
  })
  default = null
}
