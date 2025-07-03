/**
 * Nexus Workspace - Kubernetes Applications Module Outputs
 */

output "ingress_nginx_status" {
  description = "Status of the ingress-nginx installation"
  value       = local.install_ingress_nginx ? "Installed" : "Not installed"
}

output "cert_manager_status" {
  description = "Status of the cert-manager installation"
  value       = local.install_cert_manager ? "Installed" : "Not installed"
}

output "prometheus_status" {
  description = "Status of the Prometheus installation"
  value       = local.install_prometheus ? "Installed" : "Not installed"
}

output "grafana_status" {
  description = "Status of the Grafana installation"
  value       = local.install_grafana ? "Installed" : "Not installed"
}

output "external_dns_status" {
  description = "Status of the External DNS installation"
  value       = local.install_external_dns ? "Installed" : "Not installed"
}

output "argocd_status" {
  description = "Status of the ArgoCD installation"
  value       = local.install_argocd ? "Installed" : "Not installed"
}

output "grafana_admin_password" {
  description = "The admin password for Grafana"
  value       = local.install_grafana ? var.grafana.values.adminPassword : null
  sensitive   = true
}

output "argocd_url" {
  description = "The URL for ArgoCD"
  value       = local.install_argocd ? "https://argocd.${var.environment}.${var.domain_name}" : null
}

output "monitoring_namespace" {
  description = "The namespace for monitoring tools"
  value       = local.install_prometheus || local.install_grafana ? kubernetes_namespace.monitoring[0].metadata[0].name : null
}

output "ingress_nginx_namespace" {
  description = "The namespace for ingress-nginx"
  value       = local.install_ingress_nginx ? kubernetes_namespace.ingress_nginx[0].metadata[0].name : null
}

output "cert_manager_namespace" {
  description = "The namespace for cert-manager"
  value       = local.install_cert_manager ? kubernetes_namespace.cert_manager[0].metadata[0].name : null
}

output "argocd_namespace" {
  description = "The namespace for ArgoCD"
  value       = local.install_argocd ? kubernetes_namespace.argocd[0].metadata[0].name : null
}
