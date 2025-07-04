# @nexus/tech-radar

Comprehensive technology radar and API versioning strategy for managing planned obsolescence and deprecation. Create and maintain a formal "Tech Radar" that documents which technologies are being adopted, trialed, and crucially, deprecated.

## Features

### 🎯 **Technology Radar**
- **Four-quadrant radar** (Languages & Frameworks, Tools, Platforms, Techniques)
- **Four-ring adoption model** (Adopt, Trial, Assess, Hold)
- **Technology lifecycle management** with automated deprecation workflows
- **Visual radar generation** (SVG, PNG, HTML with interactivity)
- **Snapshot versioning** and historical tracking

### 📊 **API Versioning Strategy**
- **Multiple versioning strategies** (Semantic, Date-based, Sequential, Header-based)
- **Automated deprecation timelines** with sunset and removal dates
- **Usage metrics tracking** (active clients, request rates, error rates)
- **Migration guidance** and breaking change documentation
- **Notification scheduling** for deprecation warnings

### 🔄 **Planned Obsolescence Management**
- **Formal deprecation process** with approval workflows
- **Automated notification system** for stakeholders
- **Migration path documentation** and replacement recommendations
- **Impact assessment** and risk evaluation
- **Compliance tracking** and acknowledgment management

### 📈 **Analytics & Reporting**
- **Technology adoption metrics** and trend analysis
- **API usage analytics** and performance monitoring
- **Deprecation timeline reporting** and compliance dashboards
- **Business impact assessment** and strategic value tracking
- **Historical trend analysis** and benchmarking

## Installation

```bash
npm install @nexus/tech-radar
# or
pnpm add @nexus/tech-radar
# or
yarn add @nexus/tech-radar
```

## Quick Start

### CLI Usage

```bash
# Initialize configuration
npx tech-radar init

# Add a technology to the radar
npx tech-radar tech add \
  --name "React" \
  --description "JavaScript library for building user interfaces" \
  --quadrant languages-frameworks \
  --ring adopt \
  --strategic-value high

# Move a technology to a different ring
npx tech-radar tech move \
  --id tech-123 \
  --ring hold \
  --rationale "Superseded by newer framework"

# Deprecate a technology
npx tech-radar tech deprecate \
  --id tech-123 \
  --reason "End of life announced by vendor" \
  --migration-path "https://docs.company.com/migration-guide"

# List technologies
npx tech-radar tech list --ring hold --status deprecated

# Create API version
npx tech-radar api create \
  --name "user-service" \
  --version "2.1.0" \
  --strategy semantic

# Deprecate API version
npx tech-radar api deprecate \
  --id api-456 \
  --reason "Security vulnerabilities in dependencies" \
  --migration-guide "https://api.company.com/v3/migration"

# Generate radar visualization
npx tech-radar radar generate \
  --title "Q1 2024 Technology Radar" \
  --format html \
  --publish
```

### Programmatic Usage

```typescript
import { TechRadarManager, APIVersionManager, RadarGenerator } from '@nexus/tech-radar';

const config = {
  title: 'Company Technology Radar',
  organization: 'Your Company',
  visualization: {
    width: 1200,
    height: 800,
    showLegend: true,
    showLabels: true,
  },
  reviewProcess: {
    reviewCycle: 'quarterly',
    approvalRequired: true,
    votingThreshold: 0.6,
  },
  apiVersioning: {
    defaultStrategy: 'semantic',
    deprecationPeriod: 365, // 1 year
    sunsetPeriod: 180,      // 6 months
    notificationPeriods: [90, 30, 7], // Warning periods
  },
  notifications: {
    deprecationWarnings: ['tech-team@company.com'],
    radarUpdates: ['leadership@company.com'],
  },
};

// Technology Management
const radarManager = new TechRadarManager(config);

// Add a new technology
const technology = {
  name: 'TypeScript',
  description: 'Typed superset of JavaScript',
  quadrant: 'languages-frameworks' as const,
  ring: 'adopt' as const,
  businessImpact: {
    strategicValue: 'high' as const,
    riskLevel: 'low' as const,
    costImpact: 'medium' as const,
    timeToValue: 'short' as const,
  },
  assessment: {
    maturity: 5,
    community: 5,
    documentation: 5,
    performance: 4,
    security: 4,
    maintenance: 4,
    learningCurve: 3,
    overallScore: 4.3,
  },
  rationale: {
    pros: ['Type safety', 'Better IDE support', 'Large community'],
    cons: ['Learning curve', 'Build complexity'],
    tradeoffs: ['Development speed vs runtime performance'],
    decisionFactors: ['Team expertise', 'Project requirements'],
    keyStakeholders: ['Frontend Team', 'Architecture Team'],
  },
  createdBy: 'tech-lead',
  updatedBy: 'tech-lead',
};

const result = await radarManager.addTechnology(technology);
if (result.success) {
  console.log(`Technology added: ${result.data.id}`);
}

// Move technology to different ring
await radarManager.moveTechnology(
  result.data.id,
  'trial',
  'Moving to trial for broader evaluation',
  'tech-lead'
);

// Create radar snapshot
const snapshot = await radarManager.createSnapshot(
  'Q1 2024 Technology Radar',
  'tech-lead',
  true // publish
);

// Generate visualization
const generator = new RadarGenerator(config);
const html = await generator.generateHTML(snapshot.data);

// API Version Management
const apiManager = new APIVersionManager(config);

// Create API version
const apiVersion = await apiManager.createAPIVersion(
  'user-service',
  '2.1.0',
  'semantic',
  'api-team'
);

// Update usage metrics
await apiManager.updateUsageMetrics(apiVersion.data.id, {
  activeClients: 150,
  requestsPerDay: 50000,
  errorRate: 0.02,
  averageResponseTime: 120,
});

// Deprecate API version
const deprecationNotice = await apiManager.deprecateAPIVersion(
  apiVersion.data.id,
  'Security vulnerabilities in dependencies',
  'https://api.company.com/v3/migration',
  ['Breaking change in authentication', 'Removed deprecated endpoints']
);
```

## Configuration

### Complete Configuration File

Create `.tech-radar/config.yaml`:

```yaml
title: "Technology Radar"
subtitle: "Our technology adoption strategy"
organization: "Your Company"

visualization:
  width: 1200
  height: 800
  colors:
    adopt: "#5cb85c"
    trial: "#f0ad4e"
    assess: "#5bc0de"
    hold: "#d9534f"
  showLegend: true
  showLabels: true

quadrants:
  languages-frameworks:
    name: "Languages & Frameworks"
    description: "Programming languages, frameworks, and libraries"
  tools:
    name: "Tools"
    description: "Development tools, IDEs, and utilities"
  platforms:
    name: "Platforms"
    description: "Infrastructure, cloud platforms, and services"
  techniques:
    name: "Techniques"
    description: "Methods, practices, and architectural patterns"

rings:
  adopt:
    name: "Adopt"
    description: "Technologies we have high confidence in and actively use"
    color: "#5cb85c"
  trial:
    name: "Trial"
    description: "Technologies worth pursuing with a goal to understand their impact"
    color: "#f0ad4e"
  assess:
    name: "Assess"
    description: "Technologies to explore with the goal of understanding their fit"
    color: "#5bc0de"
  hold:
    name: "Hold"
    description: "Technologies to avoid or phase out"
    color: "#d9534f"

reviewProcess:
  reviewCycle: quarterly
  reviewers:
    - tech-lead@company.com
    - architect@company.com
  approvalRequired: true
  votingThreshold: 0.6

apiVersioning:
  defaultStrategy: semantic
  deprecationPeriod: 365  # 1 year
  sunsetPeriod: 180       # 6 months after deprecation
  notificationPeriods: [90, 30, 7]  # Warning periods in days
  supportLevels:
    full: 730           # 2 years
    maintenance: 365    # 1 year
    securityOnly: 180   # 6 months

integrations:
  github:
    enabled: true
    repository: "company/tech-radar"
    branch: "main"
    path: "tech-radar"
  
  confluence:
    enabled: true
    baseUrl: "https://company.atlassian.net"
    spaceKey: "TECH"
    pageId: "123456789"
  
  slack:
    enabled: true
    webhookUrl: ${SLACK_WEBHOOK_URL}
    channels:
      announcements: "#tech-radar"
      discussions: "#architecture"

notifications:
  deprecationWarnings:
    - tech-team@company.com
    - platform-team@company.com
  radarUpdates:
    - leadership@company.com
    - architecture-team@company.com
  reviewReminders:
    - tech-leads@company.com
```

## Technology Radar Concepts

### Quadrants

1. **Languages & Frameworks**: Programming languages, web frameworks, libraries
2. **Tools**: Development tools, IDEs, build systems, testing frameworks
3. **Platforms**: Infrastructure, cloud services, databases, operating systems
4. **Techniques**: Methods, practices, architectural patterns, processes

### Rings (Adoption Stages)

1. **Adopt** 🟢: Technologies we have high confidence in and actively use
   - Proven in production
   - Well-understood risks and benefits
   - Recommended for new projects

2. **Trial** 🟡: Technologies worth pursuing with a goal to understand their impact
   - Promising but need more evaluation
   - Pilot projects and experiments
   - Limited production use

3. **Assess** 🔵: Technologies to explore with the goal of understanding their fit
   - Emerging technologies
   - Research and proof-of-concepts
   - No production use yet

4. **Hold** 🔴: Technologies to avoid or phase out
   - Deprecated or problematic
   - Security or performance issues
   - Better alternatives available

### Movement Indicators

- **↗️ Moving In**: Technology is gaining adoption
- **↘️ Moving Out**: Technology is losing favor
- **➡️ No Change**: Technology position is stable

## API Versioning Strategies

### Semantic Versioning
```
v1.2.3 (MAJOR.MINOR.PATCH)
- MAJOR: Breaking changes
- MINOR: New features (backward compatible)
- PATCH: Bug fixes (backward compatible)
```

### Date-based Versioning
```
2024.03.15 (YEAR.MONTH.DAY)
- Clear timeline indication
- Good for regular releases
```

### Sequential Versioning
```
v1, v2, v3...
- Simple incrementing
- Clear major version boundaries
```

### Header-based Versioning
```
API-Version: 2024-03-15
Accept-Version: v2
- Version specified in HTTP headers
- URL remains clean
```

## Deprecation Process

### 1. Assessment Phase
- Evaluate technology/API usage
- Identify replacement options
- Assess migration complexity
- Calculate business impact

### 2. Announcement Phase
- Create deprecation notice
- Notify all stakeholders
- Publish migration guides
- Set timeline milestones

### 3. Migration Phase
- Provide migration support
- Monitor adoption of replacements
- Track usage metrics
- Send periodic reminders

### 4. Sunset Phase
- Reduce support level
- Stop new feature development
- Security fixes only
- Final migration push

### 5. Removal Phase
- Complete shutdown
- Archive documentation
- Remove from systems
- Post-mortem analysis

## CLI Commands Reference

### Technology Management

```bash
# Add technology
tech-radar tech add \
  --name "Technology Name" \
  --description "Description" \
  --quadrant <quadrant> \
  --ring <ring> \
  --strategic-value <value> \
  --tags "tag1,tag2" \
  --url "https://example.com"

# Move technology
tech-radar tech move \
  --id <tech-id> \
  --ring <new-ring> \
  --rationale "Reason for move"

# Deprecate technology
tech-radar tech deprecate \
  --id <tech-id> \
  --reason "Deprecation reason" \
  --migration-path "https://migration-guide.com" \
  --replacement <replacement-tech-id>

# List technologies
tech-radar tech list \
  --quadrant <quadrant> \
  --ring <ring> \
  --status <active|deprecated|all> \
  --tags "tag1,tag2"
```

### API Version Management

```bash
# Create API version
tech-radar api create \
  --name "api-name" \
  --version "1.2.3" \
  --strategy <semantic|date-based|sequential|header-based>

# Deprecate API version
tech-radar api deprecate \
  --id <api-version-id> \
  --reason "Deprecation reason" \
  --migration-guide "https://migration.com" \
  --breaking-changes "change1,change2"

# List API versions
tech-radar api list \
  --name "api-name" \
  --status <development|beta|stable|deprecated> \
  --deprecated \
  --active-only
```

### Radar Generation

```bash
# Generate radar
tech-radar radar generate \
  --title "Radar Title" \
  --format <svg|png|html|all> \
  --output ./output \
  --publish

# Initialize configuration
tech-radar init \
  --output .tech-radar/config.yaml \
  --overwrite
```

## Integration Examples

### GitHub Actions Workflow

```yaml
name: Tech Radar Update

on:
  schedule:
    - cron: '0 0 1 */3 *' # Quarterly
  workflow_dispatch:

jobs:
  update-radar:
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
      
      - name: Generate Tech Radar
        run: |
          npx tech-radar radar generate \
            --title "Q$(date +%q) $(date +%Y) Technology Radar" \
            --format all \
            --output ./radar-output \
            --publish
      
      - name: Upload artifacts
        uses: actions/upload-artifact@v4
        with:
          name: tech-radar
          path: radar-output/
      
      - name: Update GitHub Pages
        uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./radar-output
```

### Slack Integration

```typescript
import { TechRadarManager } from '@nexus/tech-radar';

const manager = new TechRadarManager(config);

// Listen for technology changes
manager.on('technology_deprecated', async (event) => {
  await sendSlackNotification({
    channel: '#tech-radar',
    message: `🚨 Technology Deprecated: ${event.payload.technologyName}
    
Reason: ${event.payload.reason}
Migration Guide: ${event.payload.migrationPath}
Sunset Date: ${event.payload.sunsetDate}`,
  });
});

manager.on('radar_published', async (event) => {
  await sendSlackNotification({
    channel: '#announcements',
    message: `📊 New Technology Radar Published: ${event.payload.title}
    
View the radar: https://company.github.io/tech-radar/`,
  });
});
```

### Confluence Integration

```typescript
import { RadarGenerator } from '@nexus/tech-radar';

const generator = new RadarGenerator(config);

// Generate and publish to Confluence
const snapshot = await radarManager.createSnapshot('Q1 2024 Radar', 'system', true);
const html = await generator.generateHTML(snapshot.data);

await publishToConfluence({
  spaceKey: 'TECH',
  pageId: '123456789',
  title: snapshot.data.title,
  content: html,
});
```

## Best Practices

### Technology Assessment

1. **Comprehensive Evaluation**
   - Technical maturity and stability
   - Community support and ecosystem
   - Documentation quality
   - Performance characteristics
   - Security considerations
   - Maintenance requirements

2. **Business Impact Analysis**
   - Strategic value alignment
   - Risk assessment
   - Cost implications
   - Time to value
   - Team expertise requirements

3. **Decision Documentation**
   - Clear rationale for placement
   - Pros and cons analysis
   - Trade-off considerations
   - Key stakeholder input
   - Success criteria definition

### API Versioning

1. **Version Strategy Selection**
   - Semantic versioning for libraries
   - Date-based for regular releases
   - Sequential for major milestones
   - Header-based for clean URLs

2. **Deprecation Planning**
   - Adequate notice periods
   - Clear migration paths
   - Comprehensive documentation
   - Support during transition
   - Usage monitoring

3. **Communication Strategy**
   - Multi-channel notifications
   - Regular status updates
   - Migration assistance
   - Feedback collection
   - Success measurement

### Radar Maintenance

1. **Regular Reviews**
   - Quarterly assessment cycles
   - Cross-team collaboration
   - Evidence-based decisions
   - Stakeholder involvement
   - Continuous improvement

2. **Change Management**
   - Formal approval process
   - Impact assessment
   - Communication planning
   - Timeline management
   - Success tracking

## Troubleshooting

### Common Issues

1. **Configuration Errors**
   - Validate YAML syntax
   - Check required fields
   - Verify file permissions
   - Review path specifications

2. **Visualization Problems**
   - Check canvas dependencies
   - Verify output directory permissions
   - Review image generation logs
   - Test with smaller datasets

3. **API Integration Issues**
   - Validate authentication
   - Check network connectivity
   - Review API rate limits
   - Verify endpoint URLs

### Debug Mode

Enable debug logging:

```bash
DEBUG=tech-radar:* npx tech-radar radar generate --title "Debug Test"
```

### Health Checks

```bash
# Validate configuration
npx tech-radar validate-config

# Check system dependencies
npx tech-radar system-check

# Test integrations
npx tech-radar test-integrations
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
