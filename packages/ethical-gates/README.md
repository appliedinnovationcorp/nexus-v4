# @nexus/ethical-gates

Automated accessibility and carbon footprint compliance checks for ethical and sustainable software development. Treat accessibility (WCAG compliance) and environmental impact as first-class quality metrics in your CI/CD pipeline.

## Features

### ♿ **Accessibility Compliance**
- **WCAG 2.1 Level A/AA/AAA** compliance checking
- **Multiple audit tools**: Axe, Lighthouse, Pa11y integration
- **Comprehensive reporting** with HTML, JSON, CSV, and JUnit formats
- **Quality gates** with configurable violation thresholds
- **Real-time feedback** in pull requests and CI/CD pipelines

### 🌱 **Carbon Footprint Estimation**
- **Website carbon analysis** using Website Carbon API
- **Performance-based estimation** via Lighthouse metrics
- **Infrastructure carbon calculation** for cloud resources
- **Sustainability recommendations** with actionable insights
- **Carbon budgets** and quality gates for environmental compliance

### 🔄 **CI/CD Integration**
- **GitHub Actions** with automated PR comments and issue creation
- **Quality gates** that fail builds for non-compliance
- **Historical tracking** and trend analysis
- **Slack and email notifications** for violations and improvements
- **JIRA integration** for issue management

### 📊 **Comprehensive Reporting**
- **Combined ethical score** (accessibility + sustainability)
- **Detailed breakdowns** by component and impact
- **Action items** with priority and effort estimates
- **Trend analysis** and benchmarking
- **Executive dashboards** with key metrics

## Installation

```bash
npm install @nexus/ethical-gates
# or
pnpm add @nexus/ethical-gates
# or
yarn add @nexus/ethical-gates
```

## Quick Start

### CLI Usage

```bash
# Initialize configuration
npx ethical-gates init

# Run comprehensive audit
npx ethical-gates audit --targets https://example.com

# Accessibility-only audit
npx ethical-gates accessibility --targets https://example.com --wcag-level AA

# Carbon footprint estimation
npx ethical-gates carbon --url https://example.com

# Validate configuration
npx ethical-gates validate
```

### Programmatic Usage

```typescript
import { EthicalGatesManager } from '@nexus/ethical-gates';

const config = {
  enabled: true,
  enforceInCI: true,
  accessibility: {
    wcagLevel: 'AA' as const,
    tools: {
      axe: { enabled: true },
      lighthouse: { enabled: true, threshold: 90 },
      pa11y: { enabled: true, standard: 'WCAG2AA' },
    },
    targets: [
      { name: 'Homepage', url: 'https://example.com' },
      { name: 'Dashboard', url: 'https://example.com/dashboard' },
    ],
    qualityGates: {
      failOnViolations: true,
      maxViolations: { critical: 0, serious: 0, moderate: 5, minor: 10 },
      minScore: 90,
    },
  },
  carbonFootprint: {
    methods: {
      websiteCarbon: { enabled: true },
      lighthouse: { enabled: true },
    },
    application: {
      traffic: {
        monthlyPageViews: 100000,
        averageSessionDuration: 180,
      },
    },
    qualityGates: {
      maxCarbonPerPageView: 5, // grams CO2
      maxCarbonPerMonth: 1000, // grams CO2
    },
  },
  integrations: {
    github: { enabled: true, createIssues: true, addComments: true },
  },
  notifications: {
    onViolation: ['team@company.com'],
  },
};

const manager = new EthicalGatesManager(config);

// Run comprehensive audit
const result = await manager.runEthicalAudit({
  targets: ['https://example.com'],
  environment: 'production',
  branch: 'main',
});

if (result.success && result.data) {
  console.log(`Overall Score: ${result.data.overall.score}/100`);
  console.log(`Grade: ${result.data.overall.grade}`);
  console.log(`Compliant: ${result.data.overall.isCompliant}`);
  
  // Accessibility results
  console.log(`Accessibility Score: ${result.data.accessibility.summary.overallScore}/100`);
  console.log(`WCAG Level: ${result.data.accessibility.summary.wcagLevel}`);
  console.log(`Violations: ${result.data.accessibility.summary.totalViolations}`);
  
  // Carbon footprint results
  console.log(`Carbon per Page: ${result.data.carbonFootprint.estimates.perPageView.carbonGrams}g CO2`);
  console.log(`Monthly Carbon: ${result.data.carbonFootprint.estimates.monthly.carbonKg}kg CO2`);
  
  // Action items
  console.log(`Action Items: ${result.data.actionItems.length}`);
  result.data.actionItems.slice(0, 3).forEach(item => {
    console.log(`- ${item.title} (${item.priority})`);
  });
}
```

## GitHub Actions Integration

Add to your workflow:

```yaml
name: Ethical Quality Gates

on:
  pull_request:
    branches: [main, develop]
  push:
    branches: [main]

jobs:
  ethical-gates:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Run Ethical Gates
        uses: ./packages/ethical-gates/src/github-actions
        with:
          targets: 'https://staging.example.com,https://example.com'
          wcag-level: 'AA'
          fail-on-violation: 'true'
          create-pr-comment: 'true'
          create-github-issues: 'true'
          github-token: ${{ secrets.GITHUB_TOKEN }}
          website-carbon-api-key: ${{ secrets.WEBSITE_CARBON_API_KEY }}
```

## Configuration

### Complete Configuration File

Create `.ethical-gates/config.yaml`:

```yaml
enabled: true
enforceInCI: true

accessibility:
  wcagLevel: AA
  includeExperimental: false
  
  tools:
    axe:
      enabled: true
      rules:
        color-contrast: enabled
        keyboard-navigation: enabled
      tags: [wcag2a, wcag2aa]
    
    lighthouse:
      enabled: true
      categories: [accessibility]
      threshold: 90
    
    pa11y:
      enabled: true
      standard: WCAG2AA
      includeNotices: false
      includeWarnings: true
  
  targets:
    - name: Homepage
      url: https://example.com
      viewport:
        width: 1920
        height: 1080
      authentication:
        type: none
      waitFor:
        selector: '[data-testid="main-content"]'
        timeout: 5000
    
    - name: Dashboard
      url: https://example.com/dashboard
      authentication:
        type: bearer
        credentials:
          token: ${AUTH_TOKEN}
  
  reporting:
    formats: [json, html, csv, junit]
    outputDir: ./accessibility-reports
    includeScreenshots: true
    generateSummary: true
  
  qualityGates:
    failOnViolations: true
    maxViolations:
      critical: 0
      serious: 0
      moderate: 5
      minor: 10
    minScore: 90

carbonFootprint:
  methods:
    websiteCarbon:
      enabled: true
      apiKey: ${WEBSITE_CARBON_API_KEY}
    
    lighthouse:
      enabled: true
      includeNetworkPayload: true
    
    custom:
      enabled: false
  
  infrastructure:
    cloudProvider: aws
    region: us-east-1
    
    servers:
      - name: web-server
        type: compute
        specifications:
          cpu:
            cores: 4
            architecture: x86_64
            tdp: 65
          memory:
            size: 16
            type: DDR4
          storage:
            size: 100
            type: ssd
        utilizationRate: 0.7
        hoursPerMonth: 744
      
      - name: database
        type: database
        specifications:
          cpu:
            cores: 8
            tdp: 95
          memory:
            size: 32
          storage:
            size: 500
            type: ssd
        utilizationRate: 0.5
        hoursPerMonth: 744
    
    cdn:
      enabled: true
      provider: cloudflare
      locations: [us-east, us-west, eu-west]
      cacheHitRate: 0.85
  
  application:
    traffic:
      monthlyPageViews: 100000
      averageSessionDuration: 180
      bounceRate: 0.4
      peakTrafficMultiplier: 2
    
    performance:
      averagePageSize: 2048
      averageLoadTime: 2.5
      cacheEfficiency: 0.8
      compressionRatio: 0.75
  
  reporting:
    formats: [json, html, csv]
    outputDir: ./carbon-reports
    includeComparisons: true
    includeRecommendations: true
  
  qualityGates:
    maxCarbonPerPageView: 5.0
    maxCarbonPerMonth: 1000
    maxEnergyPerPageView: 0.01
    improvementThreshold: 0.05

integrations:
  github:
    enabled: true
    createIssues: true
    addComments: true
    labels: [accessibility, sustainability, ethical-gates]
  
  slack:
    enabled: true
    webhookUrl: ${SLACK_WEBHOOK_URL}
    channels:
      violations: '#quality-alerts'
      improvements: '#team-updates'
  
  jira:
    enabled: false
    serverUrl: https://company.atlassian.net
    projectKey: ETHICS
    issueType: Bug

notifications:
  onViolation:
    - team@company.com
    - accessibility@company.com
  onImprovement:
    - team@company.com
  onThresholdExceeded:
    - management@company.com

tracking:
  enabled: true
  retentionDays: 90
  trendAnalysis: true
  benchmarking: true
```

## Accessibility Features

### WCAG Compliance Levels

- **Level A**: Basic accessibility features
- **Level AA**: Standard compliance (recommended)
- **Level AAA**: Enhanced accessibility (strict)

### Supported Audit Tools

1. **Axe-core**: Industry-standard accessibility testing
2. **Lighthouse**: Google's web quality auditing
3. **Pa11y**: Command-line accessibility testing

### Quality Gates

```typescript
const accessibilityGates = {
  failOnViolations: true,
  maxViolations: {
    critical: 0,    // Must fix immediately
    serious: 0,     // Must fix before release
    moderate: 5,    // Should fix soon
    minor: 10,      // Can fix in next iteration
  },
  minScore: 90,     // Minimum overall score
};
```

### Common Accessibility Checks

- **Color contrast** ratios (WCAG AA: 4.5:1, AAA: 7:1)
- **Keyboard navigation** support
- **Screen reader** compatibility
- **Focus management** and indicators
- **Alternative text** for images
- **Form labels** and error messages
- **Semantic HTML** structure
- **ARIA attributes** usage

## Carbon Footprint Features

### Estimation Methods

1. **Website Carbon API**: Real-world carbon data
2. **Lighthouse Performance**: Performance-based estimation
3. **Infrastructure Analysis**: Server and cloud resource calculation

### Carbon Metrics

```typescript
interface CarbonMetrics {
  perPageView: {
    carbonGrams: number;    // CO2 emissions per page view
    energyKwh: number;      // Energy consumption per page view
  };
  monthly: {
    carbonKg: number;       // Monthly CO2 emissions
    energyKwh: number;      // Monthly energy consumption
  };
  annual: {
    carbonKg: number;       // Annual CO2 emissions
    equivalents: {
      treesRequired: number;    // Trees needed to offset
      carMiles: number;         // Equivalent car miles
      homeEnergyDays: number;   // Days of home energy use
    };
  };
}
```

### Sustainability Recommendations

- **Image optimization** (WebP, compression, responsive images)
- **Caching strategies** (browser, CDN, server-side)
- **Code splitting** and lazy loading
- **Third-party script** reduction
- **Green hosting** providers
- **Server optimization** and right-sizing

## Quality Gates

### Combined Scoring

The overall ethical score combines:
- **60% Accessibility Score** (WCAG compliance, violations)
- **40% Sustainability Score** (carbon efficiency, performance)

### Grade System

| Score | Grade | Description |
|-------|-------|-------------|
| 97-100 | A+ | Exceptional ethical standards |
| 93-96 | A | Excellent compliance |
| 90-92 | B+ | Good compliance |
| 87-89 | B | Acceptable compliance |
| 83-86 | C+ | Needs improvement |
| 80-82 | C | Significant issues |
| 70-79 | D | Major compliance problems |
| 0-69 | F | Failing ethical standards |

### Failure Conditions

The build fails if:
- Critical accessibility violations > 0
- Serious accessibility violations > 0
- Carbon footprint > threshold
- Overall score < minimum threshold
- Quality gates explicitly failed

## CI/CD Integration Examples

### GitHub Actions Workflow

```yaml
name: Ethical Quality Gates

on:
  pull_request:
  push:
    branches: [main]
  schedule:
    - cron: '0 6 * * 1' # Weekly Monday 6 AM

jobs:
  ethical-audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Build application
        run: npm run build
      
      - name: Start application
        run: |
          npm start &
          sleep 30 # Wait for app to start
      
      - name: Run Ethical Gates
        uses: ./packages/ethical-gates/src/github-actions
        with:
          targets: 'http://localhost:3000'
          config-path: '.ethical-gates/config.yaml'
          fail-on-violation: 'true'
          create-pr-comment: 'true'
          github-token: ${{ secrets.GITHUB_TOKEN }}
        
      - name: Upload reports
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: ethical-gates-reports
          path: |
            accessibility-reports/
            carbon-reports/
            ethical-gates-report.html
```

### GitLab CI Integration

```yaml
ethical-gates:
  stage: quality
  image: node:20
  script:
    - npm ci
    - npm run build
    - npm start &
    - sleep 30
    - npx ethical-gates audit --targets http://localhost:3000 --fail-on-violation
  artifacts:
    reports:
      junit: accessibility-reports/*.xml
    paths:
      - accessibility-reports/
      - carbon-reports/
    expire_in: 1 week
  only:
    - merge_requests
    - main
```

### Jenkins Pipeline

```groovy
pipeline {
    agent any
    
    stages {
        stage('Build') {
            steps {
                sh 'npm ci'
                sh 'npm run build'
            }
        }
        
        stage('Start Application') {
            steps {
                sh 'npm start &'
                sh 'sleep 30'
            }
        }
        
        stage('Ethical Gates') {
            steps {
                sh 'npx ethical-gates audit --targets http://localhost:3000'
            }
            post {
                always {
                    publishHTML([
                        allowMissing: false,
                        alwaysLinkToLastBuild: true,
                        keepAll: true,
                        reportDir: 'accessibility-reports',
                        reportFiles: '*.html',
                        reportName: 'Accessibility Report'
                    ])
                    
                    archiveArtifacts artifacts: 'carbon-reports/*.html', fingerprint: true
                    
                    junit 'accessibility-reports/*.xml'
                }
            }
        }
    }
}
```

## API Reference

### EthicalGatesManager

Main class for running ethical audits.

#### Methods

- `runEthicalAudit(options?)` - Run comprehensive ethical audit
- `runAccessibilityAudit(targets?)` - Run accessibility audit only
- `runCarbonEstimation(url?)` - Run carbon footprint estimation only

### AccessibilityAuditor

Specialized class for accessibility auditing.

#### Methods

- `runAudit(targets?)` - Run accessibility audit
- `validateWCAG(level)` - Validate WCAG compliance
- `generateReport(format)` - Generate accessibility report

### CarbonFootprintEstimator

Specialized class for carbon footprint estimation.

#### Methods

- `estimateCarbonFootprint(url?)` - Estimate carbon footprint
- `calculateInfrastructureCarbon()` - Calculate infrastructure carbon
- `generateRecommendations()` - Generate sustainability recommendations

## Best Practices

### Accessibility

1. **Start Early**: Integrate accessibility testing from the beginning
2. **Test with Real Users**: Include people with disabilities in testing
3. **Use Semantic HTML**: Proper HTML structure is the foundation
4. **Keyboard Navigation**: Ensure all functionality is keyboard accessible
5. **Color Contrast**: Meet or exceed WCAG contrast requirements
6. **Alternative Text**: Provide meaningful alt text for images
7. **Form Labels**: Always label form inputs properly
8. **Focus Management**: Manage focus for dynamic content

### Sustainability

1. **Optimize Images**: Use modern formats and compression
2. **Minimize JavaScript**: Reduce bundle sizes and third-party scripts
3. **Implement Caching**: Use browser, CDN, and server-side caching
4. **Choose Green Hosting**: Select providers using renewable energy
5. **Monitor Performance**: Fast sites consume less energy
6. **Lazy Loading**: Load content only when needed
7. **Efficient Code**: Write performant, optimized code
8. **Regular Audits**: Monitor carbon footprint continuously

### CI/CD Integration

1. **Quality Gates**: Set appropriate thresholds for your context
2. **Incremental Improvement**: Allow gradual improvement over time
3. **Clear Reporting**: Provide actionable feedback to developers
4. **Automated Fixes**: Implement automated remediation where possible
5. **Team Training**: Educate team on accessibility and sustainability
6. **Regular Reviews**: Review and update standards regularly

## Troubleshooting

### Common Issues

1. **Accessibility Audit Fails**
   - Check target URLs are accessible
   - Verify authentication configuration
   - Review WCAG level requirements
   - Check for dynamic content loading

2. **Carbon Estimation Errors**
   - Verify Website Carbon API key
   - Check network connectivity
   - Review infrastructure configuration
   - Validate traffic assumptions

3. **CI/CD Integration Issues**
   - Ensure proper permissions for GitHub token
   - Check application startup timing
   - Verify configuration file path
   - Review quality gate thresholds

### Debug Mode

Enable debug logging:

```bash
DEBUG=ethical-gates:* npx ethical-gates audit
```

### Configuration Validation

```bash
npx ethical-gates validate --config .ethical-gates/config.yaml
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
- Join our community discussions

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for a list of changes and updates.
