# GitHub Actions Setup Guide

This guide explains how to configure the required secrets and settings for the GitHub Actions CI/CD pipeline.

## 🔐 Required Secrets

### GitHub Repository Secrets

Navigate to your repository → Settings → Secrets and variables → Actions, then add these secrets:

#### **AWS Configuration**
```
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=us-west-2
EKS_CLUSTER_NAME=nexus-workspace-production
```

#### **Vercel Configuration**
```
VERCEL_TOKEN=...
VERCEL_ORG_ID=...
VERCEL_PROJECT_ID=...
```

#### **Application URLs**
```
BACKEND_URL=https://api.nexus-workspace.com
FRONTEND_URL=https://nexus-workspace.com
BACKEND_DOMAIN=api.nexus-workspace.com
NEXT_PUBLIC_API_URL=https://api.nexus-workspace.com
NEXT_PUBLIC_API_URL_STAGING=https://api-staging.nexus-workspace.com
NEXTAUTH_URL=https://nexus-workspace.com
NEXTAUTH_SECRET=your-nextauth-secret-here
```

#### **Security & Monitoring**
```
SNYK_TOKEN=...
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...
```

## 🚀 Workflow Overview

### Main Deployment Workflow (`.github/workflows/deploy.yml`)

**Triggers:**
- Push to `main` branch
- Manual workflow dispatch

**Jobs:**
1. **Build and Test** - Builds monorepo and runs tests
2. **Build Backend** - Creates Docker image and pushes to GHCR
3. **Security Scan** - Scans Docker image for vulnerabilities
4. **Deploy Frontend** - Deploys to Vercel
5. **Deploy Backend** - Deploys to Kubernetes via Helm
6. **Update Infrastructure** - Applies Terraform changes if needed
7. **Integration Tests** - Tests deployed applications
8. **Notify** - Sends deployment notifications
9. **Cleanup** - Removes old container images

### PR Preview Workflow (`.github/workflows/pr-preview.yml`)

**Triggers:**
- Pull request opened/updated against `main`

**Jobs:**
1. **Build and Test** - Validates PR changes
2. **Build Preview** - Creates preview Docker images
3. **Deploy Previews** - Deploys to preview environments
4. **Test Previews** - Runs smoke tests
5. **Comment PR** - Adds preview links to PR
6. **Cleanup** - Removes preview resources when PR closes

### Security Workflow (`.github/workflows/security.yml`)

**Triggers:**
- Push to `main`/`develop`
- Pull requests
- Daily schedule (2 AM UTC)

**Jobs:**
1. **CodeQL Analysis** - Static code analysis
2. **Dependency Scan** - Vulnerability scanning
3. **Secret Scan** - Detects exposed secrets
4. **Infrastructure Scan** - Terraform security analysis
5. **Docker Scan** - Container image vulnerabilities
6. **SAST** - Static application security testing
7. **License Check** - License compliance verification

## 📋 Setup Checklist

### 1. AWS Setup
- [ ] Create IAM user with appropriate permissions
- [ ] Configure EKS cluster access
- [ ] Set up ECR repository (optional, using GHCR)
- [ ] Configure Route53 for domain management

### 2. Vercel Setup
- [ ] Create Vercel account and project
- [ ] Generate Vercel token
- [ ] Configure custom domains
- [ ] Set up environment variables in Vercel

### 3. GitHub Setup
- [ ] Enable GitHub Container Registry
- [ ] Configure repository secrets
- [ ] Set up branch protection rules
- [ ] Enable security features (Dependabot, CodeQL)

### 4. Kubernetes Setup
- [ ] Install NGINX Ingress Controller
- [ ] Install cert-manager for SSL certificates
- [ ] Configure DNS records
- [ ] Set up monitoring (Prometheus/Grafana)

### 5. Security Setup
- [ ] Configure Snyk account
- [ ] Set up Slack notifications
- [ ] Enable security scanning
- [ ] Configure secret scanning

## 🔧 Configuration Files

### Helm Values Override

Create environment-specific values files:

```yaml
# values-production.yaml
replicaCount: 3
resources:
  requests:
    cpu: 500m
    memory: 512Mi
  limits:
    cpu: 1000m
    memory: 1Gi
ingress:
  hosts:
    - host: api.nexus-workspace.com
```

### Kubernetes Secrets

Create secrets for your application:

```bash
# Database credentials
kubectl create secret generic nexus-backend-secrets \
  --from-literal=DATABASE_URL="postgresql://user:pass@host:5432/db" \
  --from-literal=REDIS_URL="redis://host:6379" \
  --from-literal=JWT_SECRET="your-jwt-secret" \
  --from-literal=JWT_REFRESH_SECRET="your-refresh-secret"
```

## 🌐 Domain Configuration

### DNS Records

Set up these DNS records:

```
# Production
api.nexus-workspace.com     → EKS Load Balancer
nexus-workspace.com         → Vercel

# Staging
api-staging.nexus-workspace.com → EKS Load Balancer
staging.nexus-workspace.com    → Vercel

# PR Previews
*.nexus-workspace.com       → EKS Load Balancer (wildcard)
```

### SSL Certificates

Configure cert-manager for automatic SSL:

```yaml
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: admin@nexus-workspace.com
    privateKeySecretRef:
      name: letsencrypt-prod
    solvers:
    - http01:
        ingress:
          class: nginx
```

## 🔍 Monitoring & Observability

### Application Monitoring

The workflows include monitoring for:
- Deployment success/failure
- Application health checks
- Performance metrics
- Security vulnerabilities
- Cost optimization

### Notifications

Configure Slack notifications:

```yaml
# Slack webhook format
{
  "channel": "#deployments",
  "username": "GitHub Actions",
  "text": "Deployment Status",
  "attachments": [...]
}
```

## 🚨 Troubleshooting

### Common Issues

#### 1. **Docker Build Failures**
```bash
# Check build logs
docker build -t test-image .

# Test locally
docker run -p 3000:3000 test-image
```

#### 2. **Kubernetes Deployment Issues**
```bash
# Check pod status
kubectl get pods -n nexus-production

# View logs
kubectl logs -f deployment/nexus-backend -n nexus-production

# Describe resources
kubectl describe deployment nexus-backend -n nexus-production
```

#### 3. **Vercel Deployment Issues**
```bash
# Test build locally
cd apps/frontend
npm run build

# Check Vercel logs
vercel logs
```

#### 4. **Secret Management Issues**
```bash
# Verify secrets exist
kubectl get secrets -n nexus-production

# Check secret contents (base64 encoded)
kubectl get secret nexus-backend-secrets -o yaml
```

## 📈 Performance Optimization

### Build Optimization
- Docker layer caching
- pnpm cache optimization
- Parallel job execution
- Conditional job execution based on file changes

### Deployment Optimization
- Rolling updates with zero downtime
- Health checks and readiness probes
- Resource limits and requests
- Horizontal pod autoscaling

## 🔒 Security Best Practices

### Implemented Security Measures
- Container image scanning
- Dependency vulnerability scanning
- Secret scanning
- Static code analysis
- Infrastructure security scanning
- License compliance checking

### Additional Recommendations
- Regular security updates
- Principle of least privilege
- Network policies
- Pod security policies
- Regular security audits

## 📚 Additional Resources

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Kubernetes Documentation](https://kubernetes.io/docs/)
- [Helm Documentation](https://helm.sh/docs/)
- [Vercel Documentation](https://vercel.com/docs)
- [AWS EKS Documentation](https://docs.aws.amazon.com/eks/)

---

This setup provides a production-ready CI/CD pipeline with comprehensive security scanning, monitoring, and deployment automation.
