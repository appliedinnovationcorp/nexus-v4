/**
 * Nexus Workspace - EKS Module Outputs
 */

output "cluster_name" {
  description = "The name of the EKS cluster"
  value       = module.eks.cluster_name
}

output "cluster_arn" {
  description = "The Amazon Resource Name (ARN) of the EKS cluster"
  value       = module.eks.cluster_arn
}

output "cluster_endpoint" {
  description = "The endpoint for the EKS Kubernetes API server"
  value       = module.eks.cluster_endpoint
}

output "cluster_certificate_authority_data" {
  description = "Base64 encoded certificate data required to communicate with the cluster"
  value       = module.eks.cluster_certificate_authority_data
}

output "cluster_oidc_issuer_url" {
  description = "The URL on the EKS cluster for the OpenID Connect identity provider"
  value       = module.eks.cluster_oidc_issuer_url
}

output "oidc_provider_arn" {
  description = "The ARN of the OIDC Provider"
  value       = aws_iam_openid_connect_provider.eks.arn
}

output "cluster_security_group_id" {
  description = "The security group ID attached to the EKS cluster"
  value       = module.eks.cluster_security_group_id
}

output "node_security_group_id" {
  description = "The security group ID attached to the EKS nodes"
  value       = module.eks.node_security_group_id
}

output "eks_managed_node_groups" {
  description = "Map of EKS managed node groups"
  value       = module.eks.eks_managed_node_groups
}

output "aws_auth_configmap_yaml" {
  description = "Formatted yaml output for aws-auth configmap"
  value       = module.eks.aws_auth_configmap_yaml
}

output "load_balancer_controller_role_arn" {
  description = "ARN of the IAM role for AWS Load Balancer Controller"
  value       = module.lb_controller_role.iam_role_arn
}

output "external_dns_role_arn" {
  description = "ARN of the IAM role for External DNS"
  value       = module.external_dns_role.iam_role_arn
}

output "cluster_autoscaler_role_arn" {
  description = "ARN of the IAM role for Cluster Autoscaler"
  value       = module.cluster_autoscaler_role.iam_role_arn
}

output "ebs_csi_role_arn" {
  description = "ARN of the IAM role for EBS CSI Driver"
  value       = module.ebs_csi_role.iam_role_arn
}

output "load_balancer_hostname" {
  description = "Hostname of the load balancer"
  value       = "api.${var.environment}.nexus-workspace.com"
}

output "load_balancer_zone_id" {
  description = "Zone ID of the load balancer"
  value       = "Z2FDTNDATAQYW2" # Default CloudFront hosted zone ID
}
