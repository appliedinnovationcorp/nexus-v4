/**
 * Nexus Workspace - Kubernetes Applications Module
 * 
 * This module installs and configures Kubernetes applications using Helm charts.
 */

terraform {
  required_version = ">= 1.0.0"
  
  required_providers {
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.23"
    }
    helm = {
      source  = "hashicorp/helm"
      version = "~> 2.11"
    }
  }
}

locals {
  name = "nexus-${var.environment}"
  
  # Determine which applications to install
  install_ingress_nginx = var.ingress_nginx != null ? var.ingress_nginx.enabled : false
  install_cert_manager  = var.cert_manager != null ? var.cert_manager.enabled : false
  install_prometheus    = var.prometheus != null ? var.prometheus.enabled : false
  install_grafana       = var.grafana != null ? var.grafana.enabled : false
  install_external_dns  = var.external_dns != null ? var.external_dns.enabled : false
  install_argocd        = var.argocd != null ? var.argocd.enabled : false
}

# Create namespace for monitoring
resource "kubernetes_namespace" "monitoring" {
  count = local.install_prometheus || local.install_grafana ? 1 : 0
  
  metadata {
    name = "monitoring"
    
    labels = {
      name        = "monitoring"
      environment = var.environment
    }
  }
}

# Create namespace for ingress-nginx
resource "kubernetes_namespace" "ingress_nginx" {
  count = local.install_ingress_nginx ? 1 : 0
  
  metadata {
    name = "ingress-nginx"
    
    labels = {
      name        = "ingress-nginx"
      environment = var.environment
    }
  }
}

# Create namespace for cert-manager
resource "kubernetes_namespace" "cert_manager" {
  count = local.install_cert_manager ? 1 : 0
  
  metadata {
    name = "cert-manager"
    
    labels = {
      name        = "cert-manager"
      environment = var.environment
    }
  }
}

# Create namespace for ArgoCD
resource "kubernetes_namespace" "argocd" {
  count = local.install_argocd ? 1 : 0
  
  metadata {
    name = "argocd"
    
    labels = {
      name        = "argocd"
      environment = var.environment
    }
  }
}

# Install ingress-nginx
resource "helm_release" "ingress_nginx" {
  count = local.install_ingress_nginx ? 1 : 0
  
  name       = "ingress-nginx"
  repository = "https://kubernetes.github.io/ingress-nginx"
  chart      = "ingress-nginx"
  version    = var.ingress_nginx.chart_version
  namespace  = kubernetes_namespace.ingress_nginx[0].metadata[0].name
  
  values = [
    yamlencode(var.ingress_nginx.values)
  ]
  
  set {
    name  = "controller.service.annotations.service\\.beta\\.kubernetes\\.io/aws-load-balancer-type"
    value = "nlb"
  }
  
  set {
    name  = "controller.service.annotations.service\\.beta\\.kubernetes\\.io/aws-load-balancer-cross-zone-load-balancing-enabled"
    value = "true"
  }
  
  set {
    name  = "controller.service.annotations.service\\.beta\\.kubernetes\\.io/aws-load-balancer-ssl-cert"
    value = var.acm_certificate_arn
  }
  
  set {
    name  = "controller.service.annotations.service\\.beta\\.kubernetes\\.io/aws-load-balancer-ssl-ports"
    value = "https"
  }
  
  set {
    name  = "controller.service.annotations.service\\.beta\\.kubernetes\\.io/aws-load-balancer-backend-protocol"
    value = "http"
  }
  
  set {
    name  = "controller.service.annotations.service\\.beta\\.kubernetes\\.io/aws-load-balancer-ssl-negotiation-policy"
    value = "ELBSecurityPolicy-TLS-1-2-2017-01"
  }
  
  set {
    name  = "controller.service.annotations.service\\.beta\\.kubernetes\\.io/aws-load-balancer-connection-idle-timeout"
    value = "60"
  }
}

# Install cert-manager
resource "helm_release" "cert_manager" {
  count = local.install_cert_manager ? 1 : 0
  
  name       = "cert-manager"
  repository = "https://charts.jetstack.io"
  chart      = "cert-manager"
  version    = var.cert_manager.chart_version
  namespace  = kubernetes_namespace.cert_manager[0].metadata[0].name
  
  values = [
    yamlencode(var.cert_manager.values)
  ]
  
  set {
    name  = "installCRDs"
    value = "true"
  }
  
  depends_on = [helm_release.ingress_nginx]
}

# Install Prometheus
resource "helm_release" "prometheus" {
  count = local.install_prometheus ? 1 : 0
  
  name       = "prometheus"
  repository = "https://prometheus-community.github.io/helm-charts"
  chart      = "prometheus"
  version    = var.prometheus.chart_version
  namespace  = kubernetes_namespace.monitoring[0].metadata[0].name
  
  values = [
    yamlencode(var.prometheus.values)
  ]
  
  set {
    name  = "alertmanager.persistentVolume.storageClass"
    value = "gp2"
  }
  
  set {
    name  = "server.persistentVolume.storageClass"
    value = "gp2"
  }
}

# Install Grafana
resource "helm_release" "grafana" {
  count = local.install_grafana ? 1 : 0
  
  name       = "grafana"
  repository = "https://grafana.github.io/helm-charts"
  chart      = "grafana"
  version    = var.grafana.chart_version
  namespace  = kubernetes_namespace.monitoring[0].metadata[0].name
  
  values = [
    yamlencode(var.grafana.values)
  ]
  
  set {
    name  = "persistence.storageClassName"
    value = "gp2"
  }
  
  set {
    name  = "persistence.enabled"
    value = "true"
  }
  
  set {
    name  = "adminPassword"
    value = var.grafana.values.adminPassword
  }
  
  set {
    name  = "datasources.datasources\\.yaml.apiVersion"
    value = "1"
  }
  
  set {
    name  = "datasources.datasources\\.yaml.datasources[0].name"
    value = "Prometheus"
  }
  
  set {
    name  = "datasources.datasources\\.yaml.datasources[0].type"
    value = "prometheus"
  }
  
  set {
    name  = "datasources.datasources\\.yaml.datasources[0].url"
    value = "http://prometheus-server.monitoring.svc.cluster.local"
  }
  
  set {
    name  = "datasources.datasources\\.yaml.datasources[0].access"
    value = "proxy"
  }
  
  set {
    name  = "datasources.datasources\\.yaml.datasources[0].isDefault"
    value = "true"
  }
  
  depends_on = [helm_release.prometheus]
}

# Install External DNS
resource "helm_release" "external_dns" {
  count = local.install_external_dns ? 1 : 0
  
  name       = "external-dns"
  repository = "https://charts.bitnami.com/bitnami"
  chart      = "external-dns"
  version    = var.external_dns.chart_version
  namespace  = "kube-system"
  
  values = [
    yamlencode(var.external_dns.values)
  ]
  
  set {
    name  = "provider"
    value = "aws"
  }
  
  set {
    name  = "aws.region"
    value = var.aws_region
  }
  
  set {
    name  = "aws.zoneType"
    value = "public"
  }
  
  set {
    name  = "serviceAccount.annotations.eks\\.amazonaws\\.com/role-arn"
    value = var.external_dns_role_arn
  }
  
  set {
    name  = "policy"
    value = "sync"
  }
  
  set {
    name  = "txtOwnerId"
    value = var.environment
  }
}

# Install ArgoCD
resource "helm_release" "argocd" {
  count = local.install_argocd ? 1 : 0
  
  name       = "argocd"
  repository = "https://argoproj.github.io/argo-helm"
  chart      = "argo-cd"
  version    = var.argocd.chart_version
  namespace  = kubernetes_namespace.argocd[0].metadata[0].name
  
  values = [
    yamlencode(var.argocd.values)
  ]
  
  set {
    name  = "server.service.type"
    value = "ClusterIP"
  }
  
  depends_on = [helm_release.ingress_nginx]
}

# Create ArgoCD Ingress
resource "kubernetes_ingress_v1" "argocd" {
  count = local.install_argocd ? 1 : 0
  
  metadata {
    name      = "argocd-server-ingress"
    namespace = kubernetes_namespace.argocd[0].metadata[0].name
    
    annotations = {
      "kubernetes.io/ingress.class"                    = "nginx"
      "nginx.ingress.kubernetes.io/force-ssl-redirect" = "true"
      "nginx.ingress.kubernetes.io/ssl-passthrough"    = "true"
      "nginx.ingress.kubernetes.io/backend-protocol"   = "HTTPS"
    }
  }
  
  spec {
    rule {
      host = "argocd.${var.environment}.${var.domain_name}"
      
      http {
        path {
          path      = "/"
          path_type = "Prefix"
          
          backend {
            service {
              name = "argocd-server"
              
              port {
                name = "https"
              }
            }
          }
        }
      }
    }
  }
  
  depends_on = [helm_release.argocd, helm_release.ingress_nginx]
}
