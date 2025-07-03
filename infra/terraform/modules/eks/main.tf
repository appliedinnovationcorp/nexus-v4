/**
 * Nexus Workspace - EKS Module
 * 
 * This module creates an EKS cluster with node groups and associated resources.
 */

terraform {
  required_version = ">= 1.0.0"
  
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.23"
    }
  }
}

locals {
  name = var.cluster_name != "" ? var.cluster_name : "nexus-${var.environment}"
  
  # EKS add-ons
  amazon_eks_aws_ebs_csi_driver_enabled = true
  amazon_eks_coredns_enabled            = true
  amazon_eks_kube_proxy_enabled         = true
  amazon_eks_vpc_cni_enabled            = true
  
  # Tags
  tags = {
    Environment = var.environment
    Name        = local.name
    ManagedBy   = "terraform"
  }
}

module "eks" {
  source  = "terraform-aws-modules/eks/aws"
  version = "~> 19.16"

  cluster_name                   = local.name
  cluster_version                = var.cluster_version
  cluster_endpoint_public_access = true

  # VPC configuration
  vpc_id     = var.vpc_id
  subnet_ids = var.subnet_ids

  # Cluster security group
  create_cluster_security_group = true
  create_node_security_group    = true

  # Cluster addons
  cluster_addons = {
    coredns = {
      most_recent = true
    }
    kube-proxy = {
      most_recent = true
    }
    vpc-cni = {
      most_recent = true
    }
    aws-ebs-csi-driver = {
      most_recent = true
    }
  }

  # EKS Managed Node Groups
  eks_managed_node_groups = {
    for name, config in var.node_groups : name => {
      name           = name
      instance_types = config.instance_types
      min_size       = config.min_size
      max_size       = config.max_size
      desired_size   = config.desired_size
      disk_size      = config.disk_size
      
      # Use latest Amazon Linux 2 AMI
      ami_type = "AL2_x86_64"
      
      # Taints and labels
      taints  = try(config.taints, [])
      labels  = try(config.labels, {})
      
      # Capacity type (ON_DEMAND or SPOT)
      capacity_type = try(config.capacity_type, "ON_DEMAND")
      
      # IAM role
      iam_role_additional_policies = {
        AmazonEBSCSIDriverPolicy = "arn:aws:iam::aws:policy/service-role/AmazonEBSCSIDriverPolicy"
        AmazonSSMManagedInstanceCore = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
      }
    }
  }

  # aws-auth configuration
  manage_aws_auth_configmap = true
  aws_auth_roles = concat(
    var.map_roles,
    [
      # Add cluster creator role
      {
        rolearn  = data.aws_caller_identity.current.arn
        username = "creator"
        groups   = ["system:masters"]
      }
    ]
  )
  aws_auth_users = var.map_users

  # Enable IRSA (IAM Roles for Service Accounts)
  enable_irsa = true

  # Tags
  tags = local.tags
}

# Get current AWS account ID
data "aws_caller_identity" "current" {}

# Create IAM OIDC provider for the cluster
data "tls_certificate" "eks" {
  url = module.eks.cluster_oidc_issuer_url
}

resource "aws_iam_openid_connect_provider" "eks" {
  client_id_list  = ["sts.amazonaws.com"]
  thumbprint_list = [data.tls_certificate.eks.certificates[0].sha1_fingerprint]
  url             = module.eks.cluster_oidc_issuer_url
}

# Create IAM role for AWS Load Balancer Controller
module "lb_controller_role" {
  source = "terraform-aws-modules/iam/aws//modules/iam-role-for-service-accounts-eks"
  version = "~> 5.30"

  role_name                              = "${local.name}-lb-controller"
  attach_load_balancer_controller_policy = true

  oidc_providers = {
    main = {
      provider_arn               = aws_iam_openid_connect_provider.eks.arn
      namespace_service_accounts = ["kube-system:aws-load-balancer-controller"]
    }
  }

  tags = local.tags
}

# Create IAM role for External DNS
module "external_dns_role" {
  source = "terraform-aws-modules/iam/aws//modules/iam-role-for-service-accounts-eks"
  version = "~> 5.30"

  role_name                     = "${local.name}-external-dns"
  attach_external_dns_policy    = true
  external_dns_hosted_zone_arns = ["*"] # Allow all hosted zones

  oidc_providers = {
    main = {
      provider_arn               = aws_iam_openid_connect_provider.eks.arn
      namespace_service_accounts = ["kube-system:external-dns"]
    }
  }

  tags = local.tags
}

# Create IAM role for Cluster Autoscaler
module "cluster_autoscaler_role" {
  source = "terraform-aws-modules/iam/aws//modules/iam-role-for-service-accounts-eks"
  version = "~> 5.30"

  role_name                        = "${local.name}-cluster-autoscaler"
  attach_cluster_autoscaler_policy = true
  cluster_autoscaler_cluster_names = [local.name]

  oidc_providers = {
    main = {
      provider_arn               = aws_iam_openid_connect_provider.eks.arn
      namespace_service_accounts = ["kube-system:cluster-autoscaler"]
    }
  }

  tags = local.tags
}

# Create IAM role for EBS CSI Driver
module "ebs_csi_role" {
  source = "terraform-aws-modules/iam/aws//modules/iam-role-for-service-accounts-eks"
  version = "~> 5.30"

  role_name             = "${local.name}-ebs-csi"
  attach_ebs_csi_policy = true

  oidc_providers = {
    main = {
      provider_arn               = aws_iam_openid_connect_provider.eks.arn
      namespace_service_accounts = ["kube-system:ebs-csi-controller-sa"]
    }
  }

  tags = local.tags
}
