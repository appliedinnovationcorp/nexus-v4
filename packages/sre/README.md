# @nexus/sre - Site Reliability Engineering Toolkit

A comprehensive SRE toolkit implementing Service Level Objectives (SLOs), Error Budgets, and monitoring integrations to formalize the trade-off between reliability and feature velocity.

## 🎯 Overview

This package provides a complete SRE implementation following Google's SRE principles, enabling teams to:

- Define and track Service Level Objectives (SLOs)
- Calculate and monitor Error Budgets
- Implement burn rate alerting
- Generate comprehensive reliability reports
- Integrate with monitoring systems (Prometheus, Grafana, Datadog)
- Automate SLO compliance tracking

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   SLO Config    │    │  SLO Manager    │    │   Monitoring    │
│   (YAML/JSON)   │───▶│   (Core Logic)  │◀──▶│   Integration   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                              │
                              ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Error Budget   │    │   Alerting      │    │   Dashboards    │
│  Calculation    │    │   System        │    │   & Reports     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 🚀 Quick Start

### Installation

```bash
npm install @nexus/sre
# or
yarn add @nexus/sre
# or
pnpm add @nexus/sre
```

### Basic Usage

```typescript
import { SLOManager, PrometheusIntegration } from '@nexus/sre';

// Initialize SLO Manager
const sloManager = new SLOManager({
  monitoringBackend: 'prometheus',
  alertingEnabled: true,
  budgetCalculationInterval: 15 // minutes
});

// Register an SLO
const apiAvailabilitySLO = {
  id: 'api-availability',
  name: 'API Availability',
  service: 'nexus-api',
  tier: 'tier-0',
  target: 99.9,
  timeWindow: '30d',
  sli: {
    id: 'api-success-rate',
    type: 'availability',
    query: 'sum(rate(http_requests_total{code!~"5.."}[5m])) / sum(rate(http_requests_total[5m])) * 100'
  }
};

sloManager.registerSLO(apiAvailabilitySLO);

// Calculate error budget
const errorBudget = sloManager.calculateErrorBudget('api-availability', 99.95);
console.log(`Error budget remaining: ${errorBudget.remainingBudget}`);
```

## 📊 SLO Configuration

### YAML Configuration

```yaml
version: "1.0"

global:
  defaultTimeWindow: "30d"
  monitoringBackend: "prometheus"
  dashboards:
    autoGenerate: true
    platform: "grafana"

services:
  - name: "nexus-api"
    tier: "tier-0"
    owner: "backend-team"
    slos:
      - id: "api-availability"
        name: "API Availability"
        target: 99.9
        timeWindow: "30d"
        sli:
          type: "availability"
          query: |
            (sum(rate(http_requests_total{service="nexus-api",code!~"5.."}[5m])) /
             sum(rate(http_requests_total{service="nexus-api"}[5m]))) * 100
        alerting:
          burnRate:
            fast:
              threshold: 14.4  # 2% of budget in 1 hour
              window: "1h"
              severity: "critical"
            slow:
              threshold: 6     # 5% of budget in 6 hours
              window: "6h"
              severity: "warning"
```

### Service Tiers

- **Tier-0**: Critical services (99.9%+ availability)
- **Tier-1**: Important services (99.5%+ availability)
- **Tier-2**: Standard services (99.0%+ availability)
- **Tier-3**: Best-effort services (95.0%+ availability)

## 🔥 Error Budget Management

### Understanding Error Budgets

Error budgets quantify how much unreliability is acceptable within your SLO:

```typescript
// For a 99.9% SLO over 30 days:
// - Total time: 30 days = 43,200 minutes
// - Allowed downtime: 0.1% = 43.2 minutes
// - Error budget: 43.2 minutes of downtime

const budget = sloManager.getErrorBudget('api-availability');
console.log(`Budget status: ${budget.status}`);
console.log(`Consumption: ${budget.consumptionPercentage}%`);
console.log(`Burn rate: ${budget.burnRate}x`);
```

### Burn Rate Alerting

Burn rates indicate how quickly you're consuming your error budget:

- **1x burn rate**: Consuming budget at sustainable rate
- **14.4x burn rate**: Will exhaust 30-day budget in 2 hours (fast burn)
- **6x burn rate**: Will exhaust 30-day budget in 5 days (slow burn)

## 📈 Monitoring Integration

### Prometheus Integration

```typescript
import { PrometheusIntegration } from '@nexus/sre';

const prometheus = new PrometheusIntegration({
  prometheusUrl: 'https://prometheus.nexus.dev',
  alertmanagerUrl: 'https://alertmanager.nexus.dev'
});

// Calculate SLI from Prometheus
const sliValue = await prometheus.calculateSLI(sli, '5m');

// Generate alerting rules
const alertingRules = prometheus.generateAlertingRules(slos);

// Deploy rules to Prometheus
await prometheus.updatePrometheusRules(slos);
```

### Grafana Dashboards

The package automatically generates Grafana dashboards with:

- SLO compliance overview
- Error budget status tables
- Burn rate visualizations
- Service-specific SLO trends
- Alert status panels

## 📊 Reporting

### Generate SLO Reports

```bash
# Generate 30-day report
pnpm slo-report --days 30 --format html

# Generate report for specific services
pnpm slo-report --services nexus-api,nexus-database --format json

# Generate CSV report
pnpm slo-report --days 7 --format csv --output weekly-report.csv
```

### Report Formats

- **JSON**: Machine-readable format for automation
- **HTML**: Human-readable format with visualizations
- **CSV**: Spreadsheet-compatible format for analysis
- **YAML**: Configuration-friendly format

### Sample Report Structure

```json
{
  "metadata": {
    "reportId": "slo-report-1234567890",
    "period": {
      "start": "2024-01-01T00:00:00Z",
      "end": "2024-01-31T23:59:59Z"
    }
  },
  "summary": {
    "overallCompliance": 99.2,
    "slosMeetingTarget": 8,
    "totalSLOs": 10,
    "servicesAtRisk": ["nexus-frontend"]
  },
  "services": [
    {
      "name": "nexus-api",
      "status": "healthy",
      "slos": [
        {
          "name": "API Availability",
          "target": 99.9,
          "actualValue": 99.95,
          "targetMet": true
        }
      ]
    }
  ],
  "recommendations": [
    {
      "type": "warning",
      "title": "Frontend Performance Degradation",
      "actions": ["Optimize bundle size", "Implement CDN caching"]
    }
  ]
}
```

## 🚨 Alerting

### Alert Types

1. **Fast Burn Rate**: High error rate consuming budget quickly
2. **Slow Burn Rate**: Sustained error rate over longer period
3. **Budget Exhaustion**: Error budget consumption thresholds

### Alert Configuration

```yaml
alerting:
  burnRate:
    fast:
      threshold: 14.4    # Burn rate threshold
      window: "1h"       # Evaluation window
      severity: "critical"
    slow:
      threshold: 6
      window: "6h"
      severity: "warning"
  budgetExhaustion:
    thresholds:
      - percentage: 50   # Alert at 50% budget consumption
        severity: "info"
      - percentage: 75
        severity: "warning"
      - percentage: 90
        severity: "critical"
```

### Alert Handling

```typescript
// Check for burn rate violations
const alerts = sloManager.checkBurnRateAlerts('api-availability');

// Get active alerts
const activeAlerts = sloManager.getActiveAlerts('nexus-api');

// Resolve an alert
sloManager.resolveAlert('alert-id-123');
```

## 🔧 CLI Tools

### Validate SLO Configuration

```bash
pnpm validate-slos
```

### Calculate Error Budgets

```bash
pnpm calculate-budgets
pnpm calculate-budgets --check-violations
```

### Generate Dashboards

```bash
pnpm generate-dashboards
```

### SLO Report Generation

```bash
# Basic report
pnpm slo-report

# Advanced options
pnpm slo-report \
  --days 30 \
  --services nexus-api,nexus-database \
  --format html \
  --output monthly-report.html
```

## 🔄 CI/CD Integration

### GitHub Actions Workflow

The package includes automated workflows for:

- **SLO Validation**: Validate configuration on every change
- **Budget Monitoring**: Calculate budgets every 15 minutes
- **Report Generation**: Daily and weekly automated reports
- **Dashboard Updates**: Sync dashboards with configuration changes

```yaml
# .github/workflows/sre-monitoring.yml
name: SRE Monitoring
on:
  schedule:
    - cron: '*/15 * * * *'  # Every 15 minutes
jobs:
  calculate-slos:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Calculate Error Budgets
        run: |
          cd packages/sre
          pnpm calculate-budgets
```

### Error Budget Policy

When error budgets are exhausted:

1. **Stop feature releases** until budget is restored
2. **Focus on reliability improvements**
3. **Conduct blameless post-mortems**
4. **Adjust SLOs if consistently unrealistic**

## 📚 Best Practices

### SLO Definition

1. **Start Simple**: Begin with availability and latency SLOs
2. **User-Centric**: Define SLOs based on user experience
3. **Achievable**: Set realistic targets (not 100%)
4. **Measurable**: Use objective, quantifiable metrics

### Error Budget Management

1. **Regular Review**: Monitor budgets weekly
2. **Proactive Alerting**: Alert before budget exhaustion
3. **Clear Policies**: Define actions when budgets are consumed
4. **Team Alignment**: Ensure all teams understand the policy

### Monitoring Strategy

1. **Multi-Window Alerting**: Use both fast and slow burn rates
2. **Contextual Alerts**: Include runbook links and context
3. **Escalation Paths**: Define clear escalation procedures
4. **Regular Testing**: Test alerting and response procedures

## 🔗 Integration Examples

### Express.js Middleware

```typescript
import express from 'express';
import { SLOManager } from '@nexus/sre';

const app = express();
const sloManager = new SLOManager(config);

// SLO tracking middleware
app.use((req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    const success = res.statusCode < 500;
    
    // Update SLI metrics
    sloManager.recordRequest({
      service: 'nexus-api',
      success,
      duration,
      timestamp: new Date()
    });
  });
  
  next();
});
```

### React Error Boundary

```typescript
import React from 'react';
import { SLOManager } from '@nexus/sre';

class SLOErrorBoundary extends React.Component {
  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Record frontend error for SLO tracking
    sloManager.recordError({
      service: 'nexus-frontend',
      error: error.message,
      component: errorInfo.componentStack,
      timestamp: new Date()
    });
  }
  
  render() {
    if (this.state.hasError) {
      return <ErrorFallback />;
    }
    
    return this.props.children;
  }
}
```

## 🧪 Testing

### Unit Tests

```bash
pnpm test
pnpm test:watch
pnpm test:coverage
```

### Integration Tests

```bash
# Test with real Prometheus instance
PROMETHEUS_URL=http://localhost:9090 pnpm test:integration
```

### Load Testing

```bash
# Generate test load and verify SLO calculations
pnpm test:load
```

## 📖 Documentation

- [SLO Best Practices](docs/slo-best-practices.md)
- [Error Budget Policy](docs/error-budget-policy.md)
- [Monitoring Setup](docs/monitoring-setup.md)
- [Alerting Configuration](docs/alerting-config.md)
- [Dashboard Guide](docs/dashboard-guide.md)
- [Troubleshooting](docs/troubleshooting.md)

## 🤝 Contributing

1. **Fork the repository**
2. **Create a feature branch**: `git checkout -b feature/new-sli-type`
3. **Add tests** for new functionality
4. **Update documentation**
5. **Submit a pull request**

### Development Setup

```bash
# Clone repository
git clone https://github.com/nexus-team/nexus-workspace.git
cd nexus-workspace/packages/sre

# Install dependencies
pnpm install

# Run tests
pnpm test

# Start development
pnpm dev
```

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

## 🔗 Resources

- [Google SRE Book](https://sre.google/sre-book/table-of-contents/)
- [SLO Implementation Guide](https://cloud.google.com/blog/products/management-tools/practical-guide-to-setting-slos)
- [Error Budget Policy Template](https://sre.google/workbook/error-budget-policy/)
- [Prometheus SLO Guidelines](https://prometheus.io/docs/practices/rules/)
- [Grafana SLO Dashboards](https://grafana.com/docs/grafana/latest/dashboards/)

---

Built with ❤️ by the Nexus SRE Team

*"Hope is not a strategy. Reliability is."*
