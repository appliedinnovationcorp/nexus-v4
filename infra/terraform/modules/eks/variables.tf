/**
 * Nexus Workspace - EKS Module Variables
 */

variable "environment" {
  description = "The environment name (e.g. staging, production)"
  type        = string
}

variable "cluster_name" {
  description = "The name of the EKS cluster"
  type        = string
  default     = ""
}

variable "cluster_version" {
  description = "The Kubernetes version to use for the EKS cluster"
  type        = string
  default     = "1.28"
}

variable "vpc_id" {
  description = "The ID of the VPC where the EKS cluster will be created"
  type        = string
}

variable "subnet_ids" {
  description = "The IDs of the subnets where the EKS cluster will be created"
  type        = list(string)
}

variable "node_groups" {
  description = "Map of EKS managed node group definitions to create"
  type = map(object({
    instance_types = list(string)
    min_size       = number
    max_size       = number
    desired_size   = number
    disk_size      = number
    capacity_type  = optional(string)
    taints         = optional(list(object({
      key    = string
      value  = string
      effect = string
    })))
    labels         = optional(map(string))
  }))
  default = {
    default = {
      instance_types = ["t3.medium"]
      min_size       = 1
      max_size       = 3
      desired_size   = 2
      disk_size      = 50
    }
  }
}

variable "map_roles" {
  description = "Additional IAM roles to add to the aws-auth configmap"
  type = list(object({
    rolearn  = string
    username = string
    groups   = list(string)
  }))
  default = []
}

variable "map_users" {
  description = "Additional IAM users to add to the aws-auth configmap"
  type = list(object({
    userarn  = string
    username = string
    groups   = list(string)
  }))
  default = []
}
