# @nexus/finops

Comprehensive FinOps and cost management tools for cloud resources with automated tagging, cost monitoring, alerting, and CI/CD pipeline cost estimation.

## Features

### 🏷️ **Resource Tagging Management**
- Automated resource tagging with compliance validation
- Required tag enforcement and custom validation rules
- Tag compliance reporting and remediation
- Auto-tagging for new resources

### 💰 **Cost Monitoring & Alerting**
- Real-time cost tracking and anomaly detection
- Budget management with threshold alerts
- Cost trend analysis and forecasting
- Multi-dimensional cost breakdowns

### 📊 **Cost Estimation & Analysis**
- Infrastructure change cost impact analysis
- CI/CD pipeline cost estimation
- Resource cost optimization recommendations
- Right-sizing and Reserved Instance suggestions

### 🔄 **CI/CD Integration**
- Terraform plan cost analysis
- CloudFormation template cost estimation
- Pull request cost impact comments
- Automated cost threshold enforcement

## Installation

```bash
npm install @nexus/finops
# or
pnpm add @nexus/finops
# or
yarn add @nexus/finops
```

## Quick Start

### Basic Setup

```typescript
import { FinOpsManager } from '@nexus/finops';

const config = {
  aws: {
    region: 'us-east-1',
    costExplorerEnabled: true,
    budgetsEnabled: true,
  },
  tagging: {
    enforceRequiredTags: true,
    requiredTags: ['Environment', 'Project', 'Owner', 'CostCenter'],
    tagValidationRules: {
      Environment: /^(production|staging|development|test)$/,
      Owner: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
    },
    autoTagging: {
      enabled: true,
      defaultTags: {
        CreatedBy: 'finops-system',
        ManagedBy: 'terraform',
      },
    },
  },
  costMonitoring: {
    anomalyDetection: {
      enabled: true,
      sensitivity: 'MEDIUM',
      minimumImpact: 100,
    },
    budgetAlerts: {
      enabled: true,
      defaultThresholds: [50, 80, 100],
    },
  },
};

const finops = new FinOpsManager(config);
await finops.initialize();
```

### Resource Tagging

```typescript
import { ResourceTaggingManager } from '@nexus/finops';

const taggingManager = new ResourceTaggingManager(config);

// Get all resources with their tags
const resources = await taggingManager.getAllResources();

// Validate resource tags
const validation = await taggingManager.validateResourceTags(
  'arn:aws:ec2:us-east-1:123456789012:instance/i-1234567890abcdef0',
  {
    Environment: 'production',
    Project: 'web-app',
    Owner: 'team@company.com',
    CostCenter: 'engineering',
  }
);

// Apply tags to resources
const result = await taggingManager.tagResources(
  ['arn:aws:ec2:us-east-1:123456789012:instance/i-1234567890abcdef0'],
  {
    Environment: 'production',
    Project: 'web-app',
    Owner: 'team@company.com',
    CostCenter: 'engineering',
  }
);

// Get compliance report
const complianceReport = await taggingManager.getTagComplianceReport();
console.log(`Compliance: ${complianceReport.compliancePercentage}%`);
```

### Cost Monitoring

```typescript
import { CostMonitoringManager } from '@nexus/finops';

const costMonitoring = new CostMonitoringManager(config);

// Get cost and usage data
const costData = await costMonitoring.getCostAndUsage({
  startDate: '2024-01-01',
  endDate: '2024-01-31',
  granularity: 'DAILY',
  groupBy: [{ type: 'DIMENSION', key: 'SERVICE' }],
});

// Create budget
await costMonitoring.createBudget({
  id: 'monthly-budget',
  name: 'Monthly Development Budget',
  budgetLimit: 5000,
  currency: 'USD',
  timeUnit: 'MONTHLY',
  timePeriod: {
    start: '2024-01-01',
  },
  budgetType: 'COST',
  alertThresholds: [
    {
      threshold: 80,
      thresholdType: 'PERCENTAGE',
      comparisonOperator: 'GREATER_THAN',
      notificationState: 'ALARM',
      subscribers: ['team@company.com'],
    },
  ],
});

// Get cost anomalies
const anomalies = await costMonitoring.getCostAnomalies({
  startDate: '2024-01-01',
  endDate: '2024-01-31',
});

// Get cost trends
const trends = await costMonitoring.getCostTrends({
  startDate: '2024-01-01',
  endDate: '2024-01-31',
  granularity: 'DAILY',
  service: 'Amazon EC2',
});
```

### Cost Estimation

```typescript
import { CostEstimationEngine } from '@nexus/finops';

const costEngine = new CostEstimationEngine(config);

// Estimate single resource cost
const estimate = await costEngine.estimateResourceCost(
  'AWS::EC2::Instance',
  {
    instanceType: 't3.medium',
    region: 'us-east-1',
  },
  'us-east-1',
  {
    utilizationRate: 0.8,
    hoursPerDay: 24,
    daysPerMonth: 30,
  }
);

console.log(`Monthly cost: $${estimate.monthlyCost}`);

// Estimate infrastructure changes
const changes = [
  {
    type: 'CREATE' as const,
    resourceType: 'AWS::EC2::Instance',
    configuration: { instanceType: 't3.large' },
    region: 'us-east-1',
  },
  {
    type: 'UPDATE' as const,
    resourceType: 'AWS::RDS::DBInstance',
    resourceId: 'my-database',
    configuration: { dbInstanceClass: 'db.t3.medium' },
    region: 'us-east-1',
  },
];

const impactAnalysis = await costEngine.estimateInfrastructureChanges(changes);
console.log(`Cost impact: $${impactAnalysis.costDifference}/month`);
```

### CI/CD Integration

```typescript
import { CostImpactAnalyzer } from '@nexus/finops';

const analyzer = new CostImpactAnalyzer(config);

// Analyze Terraform plan
const report = await analyzer.analyzeTerraformPlan(
  './terraform-plan.json',
  {
    pullRequestId: '123',
    branch: 'feature/new-infrastructure',
    commit: 'abc123',
  }
);

// Generate PR comment
const comment = analyzer.generatePullRequestComment(report);
console.log(comment);

// Generate CI report
await analyzer.generateCIReport(
  ['./terraform-plan.json'],
  './cost-analysis-report.md',
  {
    format: 'markdown',
    pullRequestId: '123',
  }
);
```

## React Hooks

For React applications, use the provided hooks:

```typescript
import { useCostMonitoring, useCostEstimation, useResourceTagging } from '@nexus/finops/react';

function CostDashboard() {
  const { dashboardData, loading, error, refresh } = useCostMonitoring(config);
  const { complianceReport } = useResourceTagging(config);
  const { estimation, estimateCost } = useCostEstimation(config);

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div>
      <h1>Cost Dashboard</h1>
      <div>
        <h2>Monthly Spend: ${dashboardData?.costSummary.currentMonth}</h2>
        <h3>Trend: {dashboardData?.costSummary.trend}</h3>
      </div>
      <div>
        <h2>Tagging Compliance: {complianceReport?.compliancePercentage}%</h2>
      </div>
      <button onClick={refresh}>Refresh</button>
    </div>
  );
}
```

## GitHub Actions Integration

Add the cost analysis action to your workflow:

```yaml
name: Infrastructure Cost Analysis

on:
  pull_request:
    paths:
      - '**/*.tf'
      - '**/*.yaml'
      - '**/*.yml'

jobs:
  cost-analysis:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Run Cost Analysis
        uses: ./packages/finops/src/github-actions
        with:
          terraform-plan-path: './terraform-plan.json'
          aws-region: 'us-east-1'
          cost-threshold: '500'
          enable-pr-comments: 'true'
          github-token: ${{ secrets.GITHUB_TOKEN }}
```

## Configuration

### FinOps Configuration File

Create a `.finops/config.yaml` file:

```yaml
aws:
  region: us-east-1
  costExplorerEnabled: true
  budgetsEnabled: true

tagging:
  enforceRequiredTags: true
  requiredTags:
    - Environment
    - Project
    - Owner
    - CostCenter
  tagValidationRules:
    Environment: "^(production|staging|development|test)$"
    Owner: "^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$"
  autoTagging:
    enabled: true
    defaultTags:
      CreatedBy: finops-system
      ManagedBy: terraform

costMonitoring:
  anomalyDetection:
    enabled: true
    sensitivity: MEDIUM
    minimumImpact: 100
  budgetAlerts:
    enabled: true
    defaultThresholds: [50, 80, 100]

optimization:
  autoRecommendations: true
  recommendationTypes:
    - RIGHT_SIZING
    - RESERVED_INSTANCES
    - UNUSED_RESOURCES
  implementationApproval: MANUAL

notifications:
  slack:
    enabled: true
    webhookUrl: ${SLACK_WEBHOOK_URL}
  email:
    enabled: true
```

### Environment Variables

```bash
# AWS Credentials
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_REGION=us-east-1

# Notification Settings
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...

# GitHub Token (for PR comments)
GITHUB_TOKEN=your-github-token
```

## API Reference

### FinOpsManager

Main class that orchestrates all FinOps operations.

#### Methods

- `initialize()` - Initialize the FinOps system
- `getDashboardData()` - Get comprehensive dashboard data
- `runCostOptimization()` - Run cost optimization analysis
- `estimateInfrastructureCost(changes)` - Estimate cost impact of changes
- `getTaggingManager()` - Get resource tagging manager
- `getCostMonitoring()` - Get cost monitoring manager
- `getCostEstimation()` - Get cost estimation engine
- `getCostAnalyzer()` - Get cost impact analyzer

### ResourceTaggingManager

Manages resource tagging and compliance.

#### Methods

- `getAllResources(filters?)` - Get all resources with tags
- `validateResourceTags(arn, tags)` - Validate resource tags
- `tagResources(arns, tags)` - Apply tags to resources
- `untagResources(arns, tagKeys)` - Remove tags from resources
- `autoTagResources(arns)` - Auto-tag resources
- `getTagComplianceReport(filters?)` - Get compliance report

### CostMonitoringManager

Handles cost monitoring and alerting.

#### Methods

- `getCostAndUsage(options)` - Get cost and usage data
- `createAnomalyDetector(config)` - Create anomaly detector
- `getCostAnomalies(options)` - Get cost anomalies
- `createBudget(config)` - Create budget
- `updateBudget(config)` - Update budget
- `getBudgetStatus(name)` - Get budget status
- `getCostTrends(options)` - Get cost trends

### CostEstimationEngine

Provides cost estimation capabilities.

#### Methods

- `estimateResourceCost(type, config, region, options?)` - Estimate single resource cost
- `estimateInfrastructureChanges(changes)` - Estimate infrastructure changes
- `generateCIPipelineReport(changes, prId?, branch?)` - Generate CI pipeline report

### CostImpactAnalyzer

Analyzes cost impact for CI/CD pipelines.

#### Methods

- `analyzeTerraformPlan(path, options?)` - Analyze Terraform plan
- `analyzeCloudFormationTemplate(path, options?)` - Analyze CloudFormation template
- `generatePullRequestComment(report)` - Generate PR comment
- `generateCIReport(files, output, options?)` - Generate CI report

## Best Practices

### Resource Tagging

1. **Enforce Required Tags**: Always enforce required tags for cost allocation
2. **Use Consistent Naming**: Follow consistent tag naming conventions
3. **Automate Tagging**: Use auto-tagging for new resources
4. **Regular Audits**: Run regular compliance audits

### Cost Monitoring

1. **Set Budgets**: Create budgets for different environments and projects
2. **Monitor Anomalies**: Enable anomaly detection for early warning
3. **Track Trends**: Monitor cost trends to identify patterns
4. **Alert Thresholds**: Set appropriate alert thresholds

### Cost Optimization

1. **Right-Size Resources**: Regularly review and right-size resources
2. **Use Reserved Instances**: Purchase RIs for predictable workloads
3. **Implement Auto-Scaling**: Use auto-scaling to optimize costs
4. **Clean Up Unused Resources**: Regularly clean up unused resources

### CI/CD Integration

1. **Cost Gates**: Implement cost gates in CI/CD pipelines
2. **PR Comments**: Enable PR comments for cost visibility
3. **Threshold Enforcement**: Set cost thresholds for deployments
4. **Regular Reports**: Generate regular cost reports

## Troubleshooting

### Common Issues

1. **AWS Permissions**: Ensure proper IAM permissions for Cost Explorer and Budgets
2. **Region Configuration**: Verify AWS region configuration
3. **Tag Validation**: Check tag validation rules and formats
4. **Cost Data Delay**: AWS cost data may have 24-48 hour delay

### Debug Mode

Enable debug logging:

```typescript
process.env.DEBUG = 'finops:*';
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For support and questions:

- Create an issue on GitHub
- Check the documentation
- Review the examples in the `/examples` directory

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for a list of changes and updates.
