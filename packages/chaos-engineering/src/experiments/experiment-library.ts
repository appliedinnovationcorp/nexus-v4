import { ChaosExperiment } from '../types';

/**
 * Pre-built chaos experiments for common resilience testing scenarios
 */
export class ExperimentLibrary {
  /**
   * CPU stress experiments
   */
  static createCpuStressExperiment(options: {
    name: string;
    environment: 'staging' | 'production' | 'development';
    targetSelector: any;
    cpuPercentage: number;
    duration: number;
    description?: string;
  }): ChaosExperiment {
    return {
      id: `cpu-stress-${Date.now()}`,
      name: options.name,
      description: options.description || `CPU stress test at ${options.cpuPercentage}% for ${options.duration} seconds`,
      version: '1.0.0',
      tags: ['cpu', 'performance', 'stress-test'],
      environment: options.environment,
      targetSelector: options.targetSelector,
      faultType: 'cpu_stress',
      faultParameters: {
        percentage: options.cpuPercentage,
        duration: options.duration,
        workers: 0, // 0 means use all available cores
      },
      duration: options.duration,
      delay: 0,
      steadyStateHypothesis: {
        title: 'System remains responsive under CPU stress',
        probes: [
          {
            name: 'response_time_check',
            type: 'http',
            configuration: {
              url: '${TARGET_HEALTH_ENDPOINT}',
              method: 'GET',
              timeout: 5000,
              expectedStatus: 200,
            },
            tolerance: {
              maxResponseTime: 2000,
            },
          },
          {
            name: 'cpu_utilization_check',
            type: 'metric',
            configuration: {
              query: 'avg(cpu_usage_percent)',
              datasource: 'prometheus',
            },
            tolerance: {
              maxValue: 95,
            },
          },
        ],
      },
      rollbackStrategy: {
        automatic: true,
        conditions: [
          {
            type: 'metric_threshold',
            configuration: {
              metric: 'response_time',
              threshold: 5000,
              operator: 'gt',
            },
          },
          {
            type: 'error_rate',
            configuration: {
              threshold: 10,
              timeWindow: 60,
            },
          },
        ],
        actions: [
          {
            type: 'stop_experiment',
            configuration: {},
          },
          {
            type: 'alert',
            configuration: {
              severity: 'high',
              message: 'CPU stress experiment triggered rollback',
            },
          },
        ],
      },
      notifications: {
        onStart: ['chaos-engineering-team@company.com'],
        onComplete: ['chaos-engineering-team@company.com'],
        onFailure: ['chaos-engineering-team@company.com', 'sre-team@company.com'],
        onRollback: ['chaos-engineering-team@company.com', 'sre-team@company.com'],
      },
      createdBy: 'experiment-library',
      createdAt: new Date(),
      updatedAt: new Date(),
      enabled: true,
    };
  }

  /**
   * Memory stress experiments
   */
  static createMemoryStressExperiment(options: {
    name: string;
    environment: 'staging' | 'production' | 'development';
    targetSelector: any;
    memoryPercentage: number;
    duration: number;
    description?: string;
  }): ChaosExperiment {
    return {
      id: `memory-stress-${Date.now()}`,
      name: options.name,
      description: options.description || `Memory stress test at ${options.memoryPercentage}% for ${options.duration} seconds`,
      version: '1.0.0',
      tags: ['memory', 'performance', 'stress-test'],
      environment: options.environment,
      targetSelector: options.targetSelector,
      faultType: 'memory_stress',
      faultParameters: {
        percentage: options.memoryPercentage,
        duration: options.duration,
        fillMemory: true,
      },
      duration: options.duration,
      delay: 0,
      steadyStateHypothesis: {
        title: 'System handles memory pressure gracefully',
        probes: [
          {
            name: 'memory_usage_check',
            type: 'metric',
            configuration: {
              query: 'avg(memory_usage_percent)',
              datasource: 'prometheus',
            },
            tolerance: {
              maxValue: 90,
            },
          },
          {
            name: 'oom_killer_check',
            type: 'log',
            configuration: {
              query: 'OOM killer',
              source: 'system-logs',
              timeWindow: 300,
            },
            tolerance: {
              maxCount: 0,
            },
          },
          {
            name: 'application_health_check',
            type: 'http',
            configuration: {
              url: '${TARGET_HEALTH_ENDPOINT}',
              method: 'GET',
              timeout: 5000,
              expectedStatus: 200,
            },
            tolerance: {
              maxResponseTime: 3000,
            },
          },
        ],
      },
      rollbackStrategy: {
        automatic: true,
        conditions: [
          {
            type: 'metric_threshold',
            configuration: {
              metric: 'memory_usage_percent',
              threshold: 95,
              operator: 'gt',
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
        onStart: ['chaos-engineering-team@company.com'],
        onComplete: ['chaos-engineering-team@company.com'],
        onFailure: ['chaos-engineering-team@company.com', 'sre-team@company.com'],
        onRollback: ['chaos-engineering-team@company.com', 'sre-team@company.com'],
      },
      createdBy: 'experiment-library',
      createdAt: new Date(),
      updatedAt: new Date(),
      enabled: true,
    };
  }

  /**
   * Network latency experiments
   */
  static createNetworkLatencyExperiment(options: {
    name: string;
    environment: 'staging' | 'production' | 'development';
    targetSelector: any;
    latencyMs: number;
    jitterMs?: number;
    duration: number;
    description?: string;
  }): ChaosExperiment {
    return {
      id: `network-latency-${Date.now()}`,
      name: options.name,
      description: options.description || `Network latency injection of ${options.latencyMs}ms for ${options.duration} seconds`,
      version: '1.0.0',
      tags: ['network', 'latency', 'performance'],
      environment: options.environment,
      targetSelector: options.targetSelector,
      faultType: 'network_latency',
      faultParameters: {
        delay: options.latencyMs,
        jitter: options.jitterMs || 0,
        correlation: 25,
        duration: options.duration,
        interfaces: ['eth0'],
      },
      duration: options.duration,
      delay: 0,
      steadyStateHypothesis: {
        title: 'Application handles network latency gracefully',
        probes: [
          {
            name: 'api_response_time',
            type: 'http',
            configuration: {
              url: '${TARGET_API_ENDPOINT}',
              method: 'GET',
              timeout: 10000,
              expectedStatus: 200,
            },
            tolerance: {
              maxResponseTime: options.latencyMs + 2000,
            },
          },
          {
            name: 'timeout_error_rate',
            type: 'metric',
            configuration: {
              query: 'rate(http_requests_total{status="timeout"}[5m])',
              datasource: 'prometheus',
            },
            tolerance: {
              maxValue: 0.05, // 5% timeout rate
            },
          },
          {
            name: 'circuit_breaker_status',
            type: 'metric',
            configuration: {
              query: 'circuit_breaker_state',
              datasource: 'prometheus',
            },
            tolerance: {
              expectedValue: 'closed',
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
              threshold: 20, // 20% error rate
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
        onStart: ['chaos-engineering-team@company.com'],
        onComplete: ['chaos-engineering-team@company.com'],
        onFailure: ['chaos-engineering-team@company.com', 'sre-team@company.com'],
        onRollback: ['chaos-engineering-team@company.com', 'sre-team@company.com'],
      },
      createdBy: 'experiment-library',
      createdAt: new Date(),
      updatedAt: new Date(),
      enabled: true,
    };
  }

  /**
   * Service shutdown experiments
   */
  static createServiceShutdownExperiment(options: {
    name: string;
    environment: 'staging' | 'production' | 'development';
    targetSelector: any;
    serviceName: string;
    graceful: boolean;
    duration: number;
    description?: string;
  }): ChaosExperiment {
    return {
      id: `service-shutdown-${Date.now()}`,
      name: options.name,
      description: options.description || `${options.graceful ? 'Graceful' : 'Forceful'} shutdown of ${options.serviceName} for ${options.duration} seconds`,
      version: '1.0.0',
      tags: ['service', 'availability', 'failover'],
      environment: options.environment,
      targetSelector: options.targetSelector,
      faultType: 'service_shutdown',
      faultParameters: {
        serviceName: options.serviceName,
        graceful: options.graceful,
        duration: options.duration,
      },
      duration: options.duration,
      delay: 0,
      steadyStateHypothesis: {
        title: 'System maintains availability during service outage',
        probes: [
          {
            name: 'service_availability',
            type: 'http',
            configuration: {
              url: '${TARGET_SERVICE_ENDPOINT}',
              method: 'GET',
              timeout: 5000,
              expectedStatus: 200,
            },
            tolerance: {
              maxResponseTime: 2000,
            },
          },
          {
            name: 'fallback_mechanism',
            type: 'http',
            configuration: {
              url: '${FALLBACK_ENDPOINT}',
              method: 'GET',
              timeout: 5000,
              expectedStatus: 200,
            },
            tolerance: {
              maxResponseTime: 3000,
            },
          },
          {
            name: 'error_rate_check',
            type: 'metric',
            configuration: {
              query: 'rate(http_requests_total{status=~"5.."}[5m])',
              datasource: 'prometheus',
            },
            tolerance: {
              maxValue: 0.1, // 10% error rate
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
              threshold: 50, // 50% error rate
              timeWindow: 60,
            },
          },
        ],
        actions: [
          {
            type: 'stop_experiment',
            configuration: {},
          },
          {
            type: 'scale_up',
            configuration: {
              service: 'fallback-service',
              replicas: 3,
            },
          },
        ],
      },
      notifications: {
        onStart: ['chaos-engineering-team@company.com'],
        onComplete: ['chaos-engineering-team@company.com'],
        onFailure: ['chaos-engineering-team@company.com', 'sre-team@company.com'],
        onRollback: ['chaos-engineering-team@company.com', 'sre-team@company.com'],
      },
      createdBy: 'experiment-library',
      createdAt: new Date(),
      updatedAt: new Date(),
      enabled: true,
    };
  }

  /**
   * Container kill experiments
   */
  static createContainerKillExperiment(options: {
    name: string;
    environment: 'staging' | 'production' | 'development';
    targetSelector: any;
    signal: string;
    duration: number;
    description?: string;
  }): ChaosExperiment {
    return {
      id: `container-kill-${Date.now()}`,
      name: options.name,
      description: options.description || `Container kill experiment with ${options.signal} signal`,
      version: '1.0.0',
      tags: ['container', 'kubernetes', 'resilience'],
      environment: options.environment,
      targetSelector: options.targetSelector,
      faultType: 'container_kill',
      faultParameters: {
        signal: options.signal,
      },
      duration: options.duration,
      delay: 0,
      steadyStateHypothesis: {
        title: 'System recovers from container failures',
        probes: [
          {
            name: 'pod_restart_check',
            type: 'metric',
            configuration: {
              query: 'kube_pod_container_status_restarts_total',
              datasource: 'prometheus',
            },
            tolerance: {
              maxIncrease: 1,
            },
          },
          {
            name: 'service_availability',
            type: 'http',
            configuration: {
              url: '${TARGET_SERVICE_ENDPOINT}',
              method: 'GET',
              timeout: 5000,
              expectedStatus: 200,
            },
            tolerance: {
              maxResponseTime: 2000,
            },
          },
          {
            name: 'replica_count_check',
            type: 'metric',
            configuration: {
              query: 'kube_deployment_status_replicas_available',
              datasource: 'prometheus',
            },
            tolerance: {
              minValue: 2, // At least 2 replicas should be available
            },
          },
        ],
      },
      rollbackStrategy: {
        automatic: true,
        conditions: [
          {
            type: 'metric_threshold',
            configuration: {
              metric: 'kube_deployment_status_replicas_available',
              threshold: 1,
              operator: 'lt',
            },
          },
        ],
        actions: [
          {
            type: 'stop_experiment',
            configuration: {},
          },
          {
            type: 'scale_up',
            configuration: {
              deployment: '${TARGET_DEPLOYMENT}',
              replicas: 3,
            },
          },
        ],
      },
      notifications: {
        onStart: ['chaos-engineering-team@company.com'],
        onComplete: ['chaos-engineering-team@company.com'],
        onFailure: ['chaos-engineering-team@company.com', 'sre-team@company.com'],
        onRollback: ['chaos-engineering-team@company.com', 'sre-team@company.com'],
      },
      createdBy: 'experiment-library',
      createdAt: new Date(),
      updatedAt: new Date(),
      enabled: true,
    };
  }

  /**
   * Database connection failure experiments
   */
  static createDatabaseFailureExperiment(options: {
    name: string;
    environment: 'staging' | 'production' | 'development';
    targetSelector: any;
    database: string;
    duration: number;
    description?: string;
  }): ChaosExperiment {
    return {
      id: `database-failure-${Date.now()}`,
      name: options.name,
      description: options.description || `Database connection failure for ${options.database}`,
      version: '1.0.0',
      tags: ['database', 'connectivity', 'resilience'],
      environment: options.environment,
      targetSelector: options.targetSelector,
      faultType: 'database_connection_failure',
      faultParameters: {
        database: options.database,
        duration: options.duration,
      },
      duration: options.duration,
      delay: 0,
      steadyStateHypothesis: {
        title: 'Application handles database failures gracefully',
        probes: [
          {
            name: 'database_connection_check',
            type: 'custom',
            configuration: {
              script: 'check_database_connection.sh',
              timeout: 10,
              expectedExitCode: 0,
            },
            tolerance: {
              allowedFailures: 1,
            },
          },
          {
            name: 'cache_hit_rate',
            type: 'metric',
            configuration: {
              query: 'cache_hit_rate',
              datasource: 'prometheus',
            },
            tolerance: {
              minValue: 0.8, // 80% cache hit rate
            },
          },
          {
            name: 'application_errors',
            type: 'metric',
            configuration: {
              query: 'rate(application_errors_total[5m])',
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
              threshold: 25, // 25% error rate
              timeWindow: 120,
            },
          },
        ],
        actions: [
          {
            type: 'stop_experiment',
            configuration: {},
          },
          {
            type: 'failover',
            configuration: {
              target: 'secondary-database',
            },
          },
        ],
      },
      notifications: {
        onStart: ['chaos-engineering-team@company.com'],
        onComplete: ['chaos-engineering-team@company.com'],
        onFailure: ['chaos-engineering-team@company.com', 'sre-team@company.com', 'dba-team@company.com'],
        onRollback: ['chaos-engineering-team@company.com', 'sre-team@company.com', 'dba-team@company.com'],
      },
      createdBy: 'experiment-library',
      createdAt: new Date(),
      updatedAt: new Date(),
      enabled: true,
    };
  }

  /**
   * Lambda timeout experiments
   */
  static createLambdaTimeoutExperiment(options: {
    name: string;
    environment: 'staging' | 'production' | 'development';
    targetSelector: any;
    functionName: string;
    timeoutMs: number;
    description?: string;
  }): ChaosExperiment {
    return {
      id: `lambda-timeout-${Date.now()}`,
      name: options.name,
      description: options.description || `Lambda timeout experiment for ${options.functionName}`,
      version: '1.0.0',
      tags: ['lambda', 'serverless', 'timeout'],
      environment: options.environment,
      targetSelector: options.targetSelector,
      faultType: 'lambda_timeout',
      faultParameters: {
        functionName: options.functionName,
        timeoutMs: options.timeoutMs,
      },
      duration: 300, // 5 minutes
      delay: 0,
      steadyStateHypothesis: {
        title: 'System handles Lambda timeouts gracefully',
        probes: [
          {
            name: 'lambda_error_rate',
            type: 'metric',
            configuration: {
              query: `aws_lambda_errors_sum{function_name="${options.functionName}"}`,
              datasource: 'cloudwatch',
            },
            tolerance: {
              maxValue: 5, // Max 5 errors
            },
          },
          {
            name: 'downstream_service_health',
            type: 'http',
            configuration: {
              url: '${DOWNSTREAM_SERVICE_ENDPOINT}',
              method: 'GET',
              timeout: 5000,
              expectedStatus: 200,
            },
            tolerance: {
              maxResponseTime: 2000,
            },
          },
          {
            name: 'dead_letter_queue_size',
            type: 'metric',
            configuration: {
              query: `aws_sqs_approximate_number_of_messages_sum{queue_name="${options.functionName}-dlq"}`,
              datasource: 'cloudwatch',
            },
            tolerance: {
              maxValue: 10,
            },
          },
        ],
      },
      rollbackStrategy: {
        automatic: true,
        conditions: [
          {
            type: 'metric_threshold',
            configuration: {
              metric: 'lambda_error_rate',
              threshold: 10,
              operator: 'gt',
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
        onStart: ['chaos-engineering-team@company.com'],
        onComplete: ['chaos-engineering-team@company.com'],
        onFailure: ['chaos-engineering-team@company.com', 'sre-team@company.com'],
        onRollback: ['chaos-engineering-team@company.com', 'sre-team@company.com'],
      },
      createdBy: 'experiment-library',
      createdAt: new Date(),
      updatedAt: new Date(),
      enabled: true,
    };
  }

  /**
   * Get all available experiment templates
   */
  static getAllTemplates(): Array<{
    name: string;
    description: string;
    category: string;
    faultType: string;
    createFunction: Function;
  }> {
    return [
      {
        name: 'CPU Stress Test',
        description: 'Test system behavior under high CPU load',
        category: 'Performance',
        faultType: 'cpu_stress',
        createFunction: this.createCpuStressExperiment,
      },
      {
        name: 'Memory Stress Test',
        description: 'Test system behavior under memory pressure',
        category: 'Performance',
        faultType: 'memory_stress',
        createFunction: this.createMemoryStressExperiment,
      },
      {
        name: 'Network Latency Injection',
        description: 'Test system resilience to network latency',
        category: 'Network',
        faultType: 'network_latency',
        createFunction: this.createNetworkLatencyExperiment,
      },
      {
        name: 'Service Shutdown',
        description: 'Test system behavior when services become unavailable',
        category: 'Availability',
        faultType: 'service_shutdown',
        createFunction: this.createServiceShutdownExperiment,
      },
      {
        name: 'Container Kill',
        description: 'Test Kubernetes pod recovery mechanisms',
        category: 'Container',
        faultType: 'container_kill',
        createFunction: this.createContainerKillExperiment,
      },
      {
        name: 'Database Connection Failure',
        description: 'Test application resilience to database outages',
        category: 'Database',
        faultType: 'database_connection_failure',
        createFunction: this.createDatabaseFailureExperiment,
      },
      {
        name: 'Lambda Timeout',
        description: 'Test serverless function timeout handling',
        category: 'Serverless',
        faultType: 'lambda_timeout',
        createFunction: this.createLambdaTimeoutExperiment,
      },
    ];
  }
}
