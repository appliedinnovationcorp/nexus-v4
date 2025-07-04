# @nexus/chaos-engineering

Comprehensive chaos engineering platform for proactive system resilience testing. Intentionally inject failures into staging and production environments to discover weaknesses before they cause outages.

## Features

### 🎯 **Fault Injection**
- CPU, memory, disk, and network stress testing
- Service shutdown and process termination
- Container and pod killing for Kubernetes
- Database connection failures and timeouts
- Lambda function errors and timeouts
- Custom fault injection capabilities

### 🔄 **Experiment Management**
- Pre-built experiment templates for common scenarios
- Steady-state hypothesis validation
- Automatic rollback mechanisms
- Blast radius controls and safety limits
- Comprehensive experiment lifecycle management

### 📅 **Scheduling & Automation**
- Cron-based experiment scheduling
- Business hours constraints
- Rate limiting and circuit breakers
- Concurrent execution limits
- Automated safety checks

### 🔗 **Integrations**
- **Gremlin** integration for enterprise chaos engineering
- **AWS** native fault injection
- **Kubernetes** pod and container chaos
- **Prometheus** metrics integration
- **Slack** and email notifications

### 🛡️ **Safety & Governance**
- Environment-specific controls
- Approval workflows for production
- Circuit breakers for repeated failures
- Blast radius limitations
- Real-time monitoring and alerts

## Installation

```bash
npm install @nexus/chaos-engineering
# or
pnpm add @nexus/chaos-engineering
# or
yarn add @nexus/chaos-engineering
```

## Quick Start

### Basic Setup

```typescript
import { ChaosEngine, ExperimentLibrary } from '@nexus/chaos-engineering';

const config = {
  global: {
    enabled: true,
    dryRun: false,
    maxConcurrentExperiments: 3,
  },
  environments: {
    staging: {
      enabled: true,
      approvalRequired: false,
      maxImpactLevel: 'high',
      allowedFaultTypes: ['cpu_stress', 'memory_stress', 'network_latency'],
    },
    production: {
      enabled: true,
      approvalRequired: true,
      maxImpactLevel: 'medium',
      allowedFaultTypes: ['network_latency', 'service_shutdown'],
      businessHours: {
        enabled: true,
        timezone: 'UTC',
        start: '09:00',
        end: '17:00',
        days: [1, 2, 3, 4, 5], // Monday to Friday
      },
    },
  },
  aws: {
    region: 'us-east-1',
  },
  safety: {
    circuitBreaker: {
      enabled: true,
      failureThreshold: 3,
      recoveryTimeout: 300,
    },
    blastRadius: {
      maxTargetPercentage: 25,
      maxTargetCount: 10,
    },
  },
  notifications: {
    slack: {
      enabled: true,
      webhookUrl: process.env.SLACK_WEBHOOK_URL,
    },
  },
};

const chaosEngine = new ChaosEngine(config);
```

### Running Experiments

#### Using Pre-built Templates

```typescript
// Create a CPU stress experiment
const cpuStressExperiment = ExperimentLibrary.createCpuStressExperiment({
  name: 'API Server CPU Stress Test',
  environment: 'staging',
  targetSelector: {
    type: 'service',
    filters: { service: ['api-server'] },
    percentage: 50,
  },
  cpuPercentage: 80,
  duration: 300, // 5 minutes
});

// Execute the experiment
const result = await chaosEngine.executeExperiment(cpuStressExperiment);
if (result.success) {
  console.log(`Experiment started: ${result.data.id}`);
}
```

#### Custom Experiments

```typescript
const customExperiment = {
  id: 'network-latency-test',
  name: 'Database Connection Latency Test',
  description: 'Test application resilience to database latency',
  environment: 'staging',
  targetSelector: {
    type: 'service',
    filters: { component: ['database-proxy'] },
    percentage: 100,
  },
  faultType: 'network_latency',
  faultParameters: {
    delay: 200, // 200ms latency
    jitter: 50,  // ±50ms jitter
    duration: 600, // 10 minutes
  },
  duration: 600,
  steadyStateHypothesis: {
    title: 'Application handles database latency gracefully',
    probes: [
      {
        name: 'api_response_time',
        type: 'http',
        configuration: {
          url: 'https://api.example.com/health',
          method: 'GET',
          timeout: 5000,
        },
        tolerance: {
          maxResponseTime: 3000,
        },
      },
      {
        name: 'error_rate',
        type: 'metric',
        configuration: {
          query: 'rate(http_requests_total{status=~"5.."}[5m])',
          datasource: 'prometheus',
        },
        tolerance: {
          maxValue: 0.05, // 5% error rate
        },
      },
    ],
  },
  rollbackStrategy: {
    automatic: true,
    conditions: [
      {
        type: 'error_rate',
        configuration: {
          threshold: 10, // 10% error rate
          timeWindow: 120,
        },
      },
    ],
    actions: [
      {
        type: 'stop_experiment',
        configuration: {},
      },
    ],
  },
  notifications: {
    onStart: ['sre-team@company.com'],
    onComplete: ['sre-team@company.com'],
    onFailure: ['sre-team@company.com', 'on-call@company.com'],
  },
  createdBy: 'sre-team',
  createdAt: new Date(),
  updatedAt: new Date(),
};

await chaosEngine.executeExperiment(customExperiment);
```

### Experiment Scheduling

```typescript
import { ChaosScheduler } from '@nexus/chaos-engineering';

const scheduler = new ChaosScheduler(chaosEngine, config);

// Schedule a weekly resilience test
const weeklyTest = {
  ...cpuStressExperiment,
  schedule: {
    enabled: true,
    cron: '0 2 * * 1', // Every Monday at 2 AM
    timezone: 'UTC',
    maxConcurrentRuns: 1,
  },
};

await scheduler.scheduleExperiment(weeklyTest);
await scheduler.start();
```

### Monitoring Experiments

```typescript
// Get active executions
const activeExecutions = await chaosEngine.getActiveExecutions();
console.log(`Active experiments: ${activeExecutions.data?.length}`);

// Monitor specific execution
const executionId = 'exec-123';
const execution = await chaosEngine.getExecutionStatus(executionId);

if (execution.success && execution.data) {
  console.log(`Status: ${execution.data.status}`);
  console.log(`Targets affected: ${execution.data.targets.length}`);
  
  if (execution.data.results.weaknessesFound.length > 0) {
    console.log('Weaknesses found:');
    execution.data.results.weaknessesFound.forEach(weakness => {
      console.log(`- ${weakness.description} (${weakness.severity})`);
    });
  }
}

// Stop experiment if needed
await chaosEngine.stopExperiment(executionId, 'Manual intervention required');
```

## CLI Usage

The package includes a powerful CLI for managing chaos experiments:

### Installation

```bash
npm install -g @nexus/chaos-engineering
```

### Basic Commands

```bash
# Run an experiment
chaos-runner run --experiment ./experiments/cpu-stress.yaml

# Check experiment status
chaos-runner status --execution-id exec-123

# Stop a running experiment
chaos-runner stop --execution-id exec-123 --reason "Manual stop"

# List available templates
chaos-runner templates

# Generate experiment from template
chaos-runner generate --template "CPU Stress Test" --output ./my-experiment.yaml

# Validate experiment file
chaos-runner validate --experiment ./my-experiment.yaml

# Start scheduler
chaos-runner scheduler start
```

### Configuration File

Create `.chaos/config.yaml`:

```yaml
global:
  enabled: true
  dryRun: false
  maxConcurrentExperiments: 3

environments:
  staging:
    enabled: true
    approvalRequired: false
    maxImpactLevel: high
    allowedFaultTypes:
      - cpu_stress
      - memory_stress
      - network_latency
      - service_shutdown
  
  production:
    enabled: true
    approvalRequired: true
    maxImpactLevel: medium
    allowedFaultTypes:
      - network_latency
      - service_shutdown
    businessHours:
      enabled: true
      timezone: UTC
      start: "09:00"
      end: "17:00"
      days: [1, 2, 3, 4, 5]

aws:
  region: us-east-1

safety:
  circuitBreaker:
    enabled: true
    failureThreshold: 3
    recoveryTimeout: 300
  
  rateLimiting:
    enabled: true
    maxExperimentsPerHour: 10
    maxExperimentsPerDay: 50
  
  blastRadius:
    maxTargetPercentage: 25
    maxTargetCount: 10

notifications:
  slack:
    enabled: true
    webhookUrl: ${SLACK_WEBHOOK_URL}
  
  email:
    enabled: true
    recipients:
      - sre-team@company.com

integrations:
  gremlin:
    enabled: true
    apiKey: ${GREMLIN_API_KEY}
    teamId: ${GREMLIN_TEAM_ID}
```

## React Integration

For React applications, use the provided hooks:

```typescript
import { 
  useChaosEngine, 
  useChaosScheduler, 
  useExperimentTemplates,
  useExperimentMonitoring 
} from '@nexus/chaos-engineering/react';

function ChaosEngineeringDashboard() {
  const { 
    activeExecutions, 
    loading, 
    executeExperiment, 
    stopExperiment 
  } = useChaosEngine(config);
  
  const { templates, generateExperiment } = useExperimentTemplates();
  
  const handleRunExperiment = async (templateName: string) => {
    const experiment = generateExperiment(templateName, {
      name: 'Test Experiment',
      environment: 'staging',
      targetSelector: {
        type: 'service',
        filters: { environment: ['staging'] },
        percentage: 50,
      },
      duration: 300,
    });
    
    await executeExperiment(experiment);
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      <h1>Chaos Engineering Dashboard</h1>
      
      <section>
        <h2>Active Experiments</h2>
        {activeExecutions.map(execution => (
          <div key={execution.id}>
            <h3>{execution.experimentId}</h3>
            <p>Status: {execution.status}</p>
            <p>Started: {execution.startedAt.toLocaleString()}</p>
            <button onClick={() => stopExperiment(execution.id)}>
              Stop
            </button>
          </div>
        ))}
      </section>
      
      <section>
        <h2>Experiment Templates</h2>
        {templates.map(template => (
          <div key={template.name}>
            <h3>{template.name}</h3>
            <p>{template.description}</p>
            <button onClick={() => handleRunExperiment(template.name)}>
              Run Experiment
            </button>
          </div>
        ))}
      </section>
    </div>
  );
}
```

## Gremlin Integration

Integrate with Gremlin for enterprise chaos engineering:

```typescript
import { GremlinClient } from '@nexus/chaos-engineering';

const gremlinClient = new GremlinClient({
  apiKey: process.env.GREMLIN_API_KEY!,
  teamId: process.env.GREMLIN_TEAM_ID!,
});

// List available targets
const targets = await gremlinClient.listTargets({
  type: 'host',
  tags: { environment: 'staging' },
});

// Execute experiment via Gremlin
const attackId = await gremlinClient.executeExperiment(experiment, execution);

// Monitor attack status
const attackStatus = await gremlinClient.getAttackStatus(attackId);
console.log(`Attack status: ${attackStatus.status}`);
```

## Experiment Templates

### Available Templates

1. **CPU Stress Test** - Test system behavior under high CPU load
2. **Memory Stress Test** - Test system behavior under memory pressure
3. **Network Latency Injection** - Test resilience to network latency
4. **Service Shutdown** - Test failover mechanisms
5. **Container Kill** - Test Kubernetes pod recovery
6. **Database Connection Failure** - Test database resilience
7. **Lambda Timeout** - Test serverless function timeout handling

### Creating Custom Templates

```typescript
import { ExperimentLibrary } from '@nexus/chaos-engineering';

// Extend the experiment library
class CustomExperimentLibrary extends ExperimentLibrary {
  static createCustomExperiment(options: any) {
    return {
      id: `custom-${Date.now()}`,
      name: options.name,
      // ... experiment configuration
    };
  }
}
```

## Safety & Best Practices

### Safety Mechanisms

1. **Circuit Breakers** - Automatically disable experiments after repeated failures
2. **Blast Radius Controls** - Limit the percentage and number of targets
3. **Business Hours Constraints** - Prevent production experiments during business hours
4. **Approval Workflows** - Require approval for high-impact experiments
5. **Rate Limiting** - Prevent too many experiments from running simultaneously

### Best Practices

1. **Start Small** - Begin with low-impact experiments in staging
2. **Gradual Rollout** - Slowly increase blast radius and impact
3. **Monitor Closely** - Always monitor system behavior during experiments
4. **Document Findings** - Record weaknesses and improvements
5. **Automate Recovery** - Implement automatic rollback mechanisms
6. **Team Training** - Ensure team understands chaos engineering principles

### Production Readiness Checklist

- [ ] Comprehensive monitoring and alerting in place
- [ ] Rollback procedures tested and documented
- [ ] Team trained on chaos engineering practices
- [ ] Stakeholder approval for production experiments
- [ ] Business hours constraints configured
- [ ] Circuit breakers and safety limits enabled
- [ ] Incident response procedures updated

## Monitoring & Observability

### Metrics Integration

```typescript
// Prometheus metrics
const metrics = {
  experiments_total: 'counter',
  experiments_duration_seconds: 'histogram',
  weaknesses_found_total: 'counter',
  blast_radius_percentage: 'gauge',
};

// CloudWatch integration
const cloudwatchConfig = {
  enabled: true,
  namespace: 'ChaosEngineering',
  region: 'us-east-1',
};
```

### Alerting

```typescript
const alertingRules = [
  {
    name: 'ExperimentFailureRate',
    condition: 'rate(experiments_failed_total[5m]) > 0.1',
    severity: 'warning',
    message: 'High experiment failure rate detected',
  },
  {
    name: 'CriticalWeaknessFound',
    condition: 'weaknesses_found{severity="critical"} > 0',
    severity: 'critical',
    message: 'Critical system weakness discovered',
  },
];
```

## API Reference

### ChaosEngine

Main class for executing chaos experiments.

#### Methods

- `executeExperiment(experiment)` - Execute a chaos experiment
- `stopExperiment(executionId, reason?)` - Stop a running experiment
- `getExecutionStatus(executionId)` - Get execution status
- `getActiveExecutions()` - List active executions

### ChaosScheduler

Manages scheduled chaos experiments.

#### Methods

- `start()` - Start the scheduler
- `stop()` - Stop the scheduler
- `scheduleExperiment(experiment)` - Schedule an experiment
- `unscheduleExperiment(experimentId)` - Unschedule an experiment
- `getScheduledExperiments()` - List scheduled experiments

### ExperimentLibrary

Pre-built experiment templates.

#### Static Methods

- `createCpuStressExperiment(options)` - Create CPU stress experiment
- `createMemoryStressExperiment(options)` - Create memory stress experiment
- `createNetworkLatencyExperiment(options)` - Create network latency experiment
- `createServiceShutdownExperiment(options)` - Create service shutdown experiment
- `getAllTemplates()` - Get all available templates

### GremlinClient

Integration with Gremlin chaos engineering platform.

#### Methods

- `executeExperiment(experiment, execution)` - Execute via Gremlin
- `getAttackStatus(attackId)` - Get attack status
- `stopAttack(attackId)` - Stop Gremlin attack
- `listTargets(filters?)` - List available targets

## Troubleshooting

### Common Issues

1. **Experiment Won't Start**
   - Check environment configuration
   - Verify fault type is allowed
   - Check blast radius limits
   - Ensure no circuit breaker is open

2. **Automatic Rollback Triggered**
   - Review rollback conditions
   - Check system metrics during experiment
   - Verify steady-state hypothesis

3. **Gremlin Integration Issues**
   - Verify API key and team ID
   - Check network connectivity
   - Ensure targets are properly tagged

### Debug Mode

Enable debug logging:

```typescript
process.env.DEBUG = 'chaos:*';
```

### Health Checks

```typescript
// Check system health before experiments
const healthCheck = await chaosEngine.checkSystemHealth();
if (!healthCheck.healthy) {
  console.log('System not ready for chaos experiments');
}
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
- Join our Slack community

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for a list of changes and updates.
