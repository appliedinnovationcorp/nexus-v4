import axios, { AxiosInstance } from 'axios';
import { ChaosExperiment, ChaosExecution, FaultInjectionConfig } from '../types';
import { SecretManager } from '@nexus/secret-management';
import { AnalyticsTracker } from '@nexus/analytics';

interface GremlinConfig {
  apiKey: string;
  teamId: string;
  baseUrl?: string;
}

interface GremlinAttack {
  id: string;
  type: string;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
  target: {
    type: string;
    attributes: Record<string, any>;
  };
  impact: {
    type: string;
    parameters: Record<string, any>;
  };
  created_at: string;
  started_at?: string;
  completed_at?: string;
  error?: string;
}

interface GremlinTarget {
  id: string;
  type: 'host' | 'container' | 'kubernetes';
  attributes: {
    name: string;
    hostname?: string;
    ip_address?: string;
    tags?: Record<string, string>;
    kubernetes?: {
      namespace: string;
      pod_name?: string;
      deployment?: string;
    };
  };
  state: 'active' | 'inactive';
}

export class GremlinClient {
  private client: AxiosInstance;
  private secretManager: SecretManager;
  private analytics: AnalyticsTracker;
  private config: GremlinConfig;

  constructor(config: GremlinConfig) {
    this.config = config;
    this.secretManager = new SecretManager();
    this.analytics = new AnalyticsTracker();

    this.client = axios.create({
      baseURL: config.baseUrl || 'https://api.gremlin.com/v1',
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    });

    // Add request/response interceptors for logging
    this.client.interceptors.request.use(
      (config) => {
        console.log(`Gremlin API Request: ${config.method?.toUpperCase()} ${config.url}`);
        return config;
      },
      (error) => {
        console.error('Gremlin API Request Error:', error);
        return Promise.reject(error);
      }
    );

    this.client.interceptors.response.use(
      (response) => {
        console.log(`Gremlin API Response: ${response.status} ${response.config.url}`);
        return response;
      },
      (error) => {
        console.error('Gremlin API Response Error:', error.response?.status, error.response?.data);
        return Promise.reject(error);
      }
    );
  }

  /**
   * Create and execute a Gremlin attack based on chaos experiment
   */
  async executeExperiment(experiment: ChaosExperiment, execution: ChaosExecution): Promise<string> {
    try {
      // Convert chaos experiment to Gremlin attack
      const attack = await this.convertExperimentToAttack(experiment, execution);
      
      // Create the attack
      const response = await this.client.post(`/teams/${this.config.teamId}/attacks`, attack);
      const attackId = response.data.id;

      await this.analytics.track('gremlin.attack.created', {
        attackId,
        experimentId: experiment.id,
        executionId: execution.id,
        faultType: experiment.faultType,
        targetCount: execution.targets.length,
      });

      return attackId;
    } catch (error) {
      await this.analytics.track('gremlin.attack.creation_error', {
        experimentId: experiment.id,
        executionId: execution.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Get attack status from Gremlin
   */
  async getAttackStatus(attackId: string): Promise<GremlinAttack> {
    try {
      const response = await this.client.get(`/teams/${this.config.teamId}/attacks/${attackId}`);
      return response.data;
    } catch (error) {
      await this.analytics.track('gremlin.attack.status_error', {
        attackId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Stop a running Gremlin attack
   */
  async stopAttack(attackId: string): Promise<void> {
    try {
      await this.client.delete(`/teams/${this.config.teamId}/attacks/${attackId}`);
      
      await this.analytics.track('gremlin.attack.stopped', {
        attackId,
      });
    } catch (error) {
      await this.analytics.track('gremlin.attack.stop_error', {
        attackId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * List available targets
   */
  async listTargets(filters?: {
    type?: 'host' | 'container' | 'kubernetes';
    tags?: Record<string, string>;
  }): Promise<GremlinTarget[]> {
    try {
      const params = new URLSearchParams();
      
      if (filters?.type) {
        params.append('type', filters.type);
      }
      
      if (filters?.tags) {
        Object.entries(filters.tags).forEach(([key, value]) => {
          params.append(`tags.${key}`, value);
        });
      }

      const response = await this.client.get(`/teams/${this.config.teamId}/clients?${params.toString()}`);
      return response.data;
    } catch (error) {
      await this.analytics.track('gremlin.targets.list_error', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Get attack history
   */
  async getAttackHistory(limit: number = 50): Promise<GremlinAttack[]> {
    try {
      const response = await this.client.get(`/teams/${this.config.teamId}/attacks?limit=${limit}`);
      return response.data;
    } catch (error) {
      await this.analytics.track('gremlin.history.error', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Create a scenario (multi-step attack)
   */
  async createScenario(experiment: ChaosExperiment): Promise<string> {
    try {
      const scenario = {
        name: experiment.name,
        description: experiment.description,
        steps: [
          {
            delay: experiment.delay,
            attack: await this.convertExperimentToAttack(experiment, {} as ChaosExecution),
          },
        ],
        tags: experiment.tags,
      };

      const response = await this.client.post(`/teams/${this.config.teamId}/scenarios`, scenario);
      const scenarioId = response.data.id;

      await this.analytics.track('gremlin.scenario.created', {
        scenarioId,
        experimentId: experiment.id,
      });

      return scenarioId;
    } catch (error) {
      await this.analytics.track('gremlin.scenario.creation_error', {
        experimentId: experiment.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Execute a scenario
   */
  async executeScenario(scenarioId: string): Promise<string> {
    try {
      const response = await this.client.post(`/teams/${this.config.teamId}/scenarios/${scenarioId}/runs`);
      const runId = response.data.id;

      await this.analytics.track('gremlin.scenario.executed', {
        scenarioId,
        runId,
      });

      return runId;
    } catch (error) {
      await this.analytics.track('gremlin.scenario.execution_error', {
        scenarioId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Private helper methods
   */
  private async convertExperimentToAttack(
    experiment: ChaosExperiment, 
    execution: ChaosExecution
  ): Promise<any> {
    const target = this.buildGremlinTarget(experiment);
    const impact = this.buildGremlinImpact(experiment);

    return {
      target,
      impact,
      tags: experiment.tags,
      description: experiment.description,
    };
  }

  private buildGremlinTarget(experiment: ChaosExperiment): any {
    const selector = experiment.targetSelector;
    
    switch (selector.type) {
      case 'service':
        return {
          type: 'Random',
          attributes: {
            multiSelectTags: this.convertFiltersToTags(selector.filters),
            percent: selector.percentage,
          },
        };
      
      case 'instance':
        return {
          type: 'Random',
          attributes: {
            multiSelectTags: this.convertFiltersToTags(selector.filters),
            percent: selector.percentage,
          },
        };
      
      case 'container':
        return {
          type: 'Container',
          attributes: {
            multiSelectTags: this.convertFiltersToTags(selector.filters),
            percent: selector.percentage,
          },
        };
      
      case 'lambda':
        return {
          type: 'Random',
          attributes: {
            multiSelectTags: {
              'aws.lambda.function-name': selector.filters.functionName || [],
            },
            percent: selector.percentage,
          },
        };
      
      default:
        return {
          type: 'Random',
          attributes: {
            percent: selector.percentage,
          },
        };
    }
  }

  private buildGremlinImpact(experiment: ChaosExperiment): any {
    const params = experiment.faultParameters as any;

    switch (experiment.faultType) {
      case 'cpu_stress':
        return {
          infra_command_type: 'cpu',
          infra_command_args: {
            cores: params.workers || 0,
            percent: params.percentage || 50,
            length: experiment.duration,
          },
        };

      case 'memory_stress':
        return {
          infra_command_type: 'memory',
          infra_command_args: {
            percent: params.percentage || 50,
            length: experiment.duration,
          },
        };

      case 'disk_stress':
        return {
          infra_command_type: 'disk',
          infra_command_args: {
            dir: params.path || '/tmp',
            size: this.parseSize(params.size || '1GB'),
            length: experiment.duration,
          },
        };

      case 'network_latency':
        return {
          infra_command_type: 'latency',
          infra_command_args: {
            delay: params.delay || 100,
            jitter: params.jitter || 0,
            length: experiment.duration,
            device: params.interfaces?.[0] || 'eth0',
          },
        };

      case 'network_loss':
        return {
          infra_command_type: 'packet_loss',
          infra_command_args: {
            percent: params.percentage || 10,
            length: experiment.duration,
            device: params.interfaces?.[0] || 'eth0',
          },
        };

      case 'process_kill':
        return {
          infra_command_type: 'process_killer',
          infra_command_args: {
            process: params.processName,
            signal: this.convertSignal(params.signal || 'SIGTERM'),
            length: experiment.duration,
          },
        };

      case 'service_shutdown':
        return {
          infra_command_type: 'shutdown',
          infra_command_args: {
            delay: params.graceful ? 30 : 0,
            length: experiment.duration,
          },
        };

      case 'container_kill':
        return {
          infra_command_type: 'container_killer',
          infra_command_args: {
            signal: this.convertSignal(params.signal || 'SIGTERM'),
            length: experiment.duration,
          },
        };

      default:
        throw new Error(`Unsupported fault type for Gremlin: ${experiment.faultType}`);
    }
  }

  private convertFiltersToTags(filters: Record<string, any>): Record<string, string[]> {
    const tags: Record<string, string[]> = {};
    
    Object.entries(filters).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        tags[key] = value;
      } else if (typeof value === 'string') {
        tags[key] = [value];
      }
    });

    return tags;
  }

  private parseSize(size: string): number {
    const match = size.match(/^(\d+(?:\.\d+)?)\s*(GB|MB|KB|B)?$/i);
    if (!match) return 1024 * 1024 * 1024; // Default 1GB

    const value = parseFloat(match[1]);
    const unit = (match[2] || 'B').toUpperCase();

    switch (unit) {
      case 'GB': return value * 1024 * 1024 * 1024;
      case 'MB': return value * 1024 * 1024;
      case 'KB': return value * 1024;
      default: return value;
    }
  }

  private convertSignal(signal: string): number {
    const signalMap: Record<string, number> = {
      'SIGTERM': 15,
      'SIGKILL': 9,
      'SIGINT': 2,
      'SIGHUP': 1,
      'SIGQUIT': 3,
    };

    return signalMap[signal.toUpperCase()] || 15;
  }

  /**
   * Health check for Gremlin API
   */
  async healthCheck(): Promise<{ healthy: boolean; message?: string }> {
    try {
      await this.client.get(`/teams/${this.config.teamId}`);
      return { healthy: true };
    } catch (error) {
      return {
        healthy: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get team information
   */
  async getTeamInfo(): Promise<any> {
    try {
      const response = await this.client.get(`/teams/${this.config.teamId}`);
      return response.data;
    } catch (error) {
      await this.analytics.track('gremlin.team.info_error', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Get attack templates
   */
  async getAttackTemplates(): Promise<any[]> {
    try {
      const response = await this.client.get(`/teams/${this.config.teamId}/templates`);
      return response.data;
    } catch (error) {
      await this.analytics.track('gremlin.templates.error', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }
}
