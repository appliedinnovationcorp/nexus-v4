import { CronJob } from 'cron';
import { ChaosEngine } from '../core/chaos-engine';
import { ChaosExperiment, ChaosConfig } from '../types';
import { AnalyticsTracker } from '@nexus/analytics';
import { IncidentManager } from '@nexus/incident-management';
import { EventEmitter } from 'events';

interface ScheduledExperiment {
  experiment: ChaosExperiment;
  cronJob: CronJob;
  lastRun?: Date;
  nextRun?: Date;
  runCount: number;
  failureCount: number;
}

export class ChaosScheduler extends EventEmitter {
  private chaosEngine: ChaosEngine;
  private analytics: AnalyticsTracker;
  private incidentManager: IncidentManager;
  private config: ChaosConfig;
  private scheduledExperiments: Map<string, ScheduledExperiment> = new Map();
  private isRunning: boolean = false;

  constructor(chaosEngine: ChaosEngine, config: ChaosConfig) {
    super();
    this.chaosEngine = chaosEngine;
    this.config = config;
    this.analytics = new AnalyticsTracker();
    this.incidentManager = new IncidentManager({} as any);
  }

  /**
   * Start the chaos scheduler
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      throw new Error('Chaos scheduler is already running');
    }

    this.isRunning = true;

    // Start all scheduled experiments
    for (const [experimentId, scheduledExperiment] of this.scheduledExperiments) {
      try {
        scheduledExperiment.cronJob.start();
        console.log(`Started scheduled experiment: ${experimentId}`);
      } catch (error) {
        console.error(`Failed to start scheduled experiment ${experimentId}:`, error);
      }
    }

    await this.analytics.track('chaos.scheduler.started', {
      scheduledExperimentCount: this.scheduledExperiments.size,
    });

    console.log('Chaos scheduler started');
  }

  /**
   * Stop the chaos scheduler
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;

    // Stop all scheduled experiments
    for (const [experimentId, scheduledExperiment] of this.scheduledExperiments) {
      try {
        scheduledExperiment.cronJob.stop();
        console.log(`Stopped scheduled experiment: ${experimentId}`);
      } catch (error) {
        console.error(`Failed to stop scheduled experiment ${experimentId}:`, error);
      }
    }

    await this.analytics.track('chaos.scheduler.stopped', {
      scheduledExperimentCount: this.scheduledExperiments.size,
    });

    console.log('Chaos scheduler stopped');
  }

  /**
   * Schedule a chaos experiment
   */
  async scheduleExperiment(experiment: ChaosExperiment): Promise<void> {
    if (!experiment.schedule?.enabled || !experiment.schedule.cron) {
      throw new Error('Experiment does not have valid schedule configuration');
    }

    if (this.scheduledExperiments.has(experiment.id)) {
      throw new Error(`Experiment ${experiment.id} is already scheduled`);
    }

    try {
      const cronJob = new CronJob(
        experiment.schedule.cron,
        () => this.executeScheduledExperiment(experiment.id),
        null,
        false,
        experiment.schedule.timezone || 'UTC'
      );

      const scheduledExperiment: ScheduledExperiment = {
        experiment,
        cronJob,
        nextRun: cronJob.nextDate()?.toDate(),
        runCount: 0,
        failureCount: 0,
      };

      this.scheduledExperiments.set(experiment.id, scheduledExperiment);

      if (this.isRunning) {
        cronJob.start();
      }

      await this.analytics.track('chaos.experiment.scheduled', {
        experimentId: experiment.id,
        cronExpression: experiment.schedule.cron,
        timezone: experiment.schedule.timezone,
        nextRun: scheduledExperiment.nextRun,
      });

      this.emit('experiment_scheduled', { experimentId: experiment.id });

      console.log(`Scheduled experiment: ${experiment.id} with cron: ${experiment.schedule.cron}`);
    } catch (error) {
      await this.analytics.track('chaos.experiment.schedule_error', {
        experimentId: experiment.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Unschedule a chaos experiment
   */
  async unscheduleExperiment(experimentId: string): Promise<void> {
    const scheduledExperiment = this.scheduledExperiments.get(experimentId);
    if (!scheduledExperiment) {
      throw new Error(`Experiment ${experimentId} is not scheduled`);
    }

    try {
      scheduledExperiment.cronJob.stop();
      this.scheduledExperiments.delete(experimentId);

      await this.analytics.track('chaos.experiment.unscheduled', {
        experimentId,
        runCount: scheduledExperiment.runCount,
        failureCount: scheduledExperiment.failureCount,
      });

      this.emit('experiment_unscheduled', { experimentId });

      console.log(`Unscheduled experiment: ${experimentId}`);
    } catch (error) {
      await this.analytics.track('chaos.experiment.unschedule_error', {
        experimentId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Update scheduled experiment
   */
  async updateScheduledExperiment(experiment: ChaosExperiment): Promise<void> {
    if (this.scheduledExperiments.has(experiment.id)) {
      await this.unscheduleExperiment(experiment.id);
    }

    if (experiment.schedule?.enabled) {
      await this.scheduleExperiment(experiment);
    }
  }

  /**
   * Get scheduled experiments
   */
  getScheduledExperiments(): Array<{
    experimentId: string;
    experiment: ChaosExperiment;
    lastRun?: Date;
    nextRun?: Date;
    runCount: number;
    failureCount: number;
    isActive: boolean;
  }> {
    return Array.from(this.scheduledExperiments.entries()).map(([experimentId, scheduled]) => ({
      experimentId,
      experiment: scheduled.experiment,
      lastRun: scheduled.lastRun,
      nextRun: scheduled.nextRun,
      runCount: scheduled.runCount,
      failureCount: scheduled.failureCount,
      isActive: scheduled.cronJob.running || false,
    }));
  }

  /**
   * Get scheduler status
   */
  getStatus(): {
    isRunning: boolean;
    scheduledExperimentCount: number;
    totalRuns: number;
    totalFailures: number;
    uptime: number;
  } {
    const stats = Array.from(this.scheduledExperiments.values()).reduce(
      (acc, scheduled) => ({
        totalRuns: acc.totalRuns + scheduled.runCount,
        totalFailures: acc.totalFailures + scheduled.failureCount,
      }),
      { totalRuns: 0, totalFailures: 0 }
    );

    return {
      isRunning: this.isRunning,
      scheduledExperimentCount: this.scheduledExperiments.size,
      totalRuns: stats.totalRuns,
      totalFailures: stats.totalFailures,
      uptime: process.uptime(),
    };
  }

  /**
   * Execute a scheduled experiment
   */
  private async executeScheduledExperiment(experimentId: string): Promise<void> {
    const scheduledExperiment = this.scheduledExperiments.get(experimentId);
    if (!scheduledExperiment) {
      console.error(`Scheduled experiment not found: ${experimentId}`);
      return;
    }

    const { experiment } = scheduledExperiment;

    try {
      // Check if we should run the experiment
      const shouldRun = await this.shouldRunExperiment(experiment);
      if (!shouldRun.allowed) {
        console.log(`Skipping scheduled experiment ${experimentId}: ${shouldRun.reason}`);
        return;
      }

      // Check concurrent execution limit
      if (experiment.schedule?.maxConcurrentRuns) {
        const activeExecutions = await this.chaosEngine.getActiveExecutions();
        if (activeExecutions.success && activeExecutions.data) {
          const concurrentRuns = activeExecutions.data.filter(
            exec => exec.experimentId === experimentId
          ).length;

          if (concurrentRuns >= experiment.schedule.maxConcurrentRuns) {
            console.log(`Skipping scheduled experiment ${experimentId}: max concurrent runs reached`);
            return;
          }
        }
      }

      console.log(`Executing scheduled experiment: ${experimentId}`);

      // Execute the experiment
      const result = await this.chaosEngine.executeExperiment(experiment);

      if (result.success) {
        scheduledExperiment.runCount++;
        scheduledExperiment.lastRun = new Date();
        scheduledExperiment.nextRun = scheduledExperiment.cronJob.nextDate()?.toDate();

        await this.analytics.track('chaos.scheduled.execution_success', {
          experimentId,
          executionId: result.data?.id,
          runCount: scheduledExperiment.runCount,
        });

        this.emit('scheduled_experiment_executed', {
          experimentId,
          executionId: result.data?.id,
          success: true,
        });
      } else {
        scheduledExperiment.failureCount++;

        await this.analytics.track('chaos.scheduled.execution_failure', {
          experimentId,
          error: result.error?.message,
          failureCount: scheduledExperiment.failureCount,
        });

        this.emit('scheduled_experiment_failed', {
          experimentId,
          error: result.error?.message,
        });

        // Check if we should disable the experiment due to repeated failures
        if (scheduledExperiment.failureCount >= 3) {
          console.warn(`Disabling scheduled experiment ${experimentId} due to repeated failures`);
          await this.unscheduleExperiment(experimentId);

          // Create an incident for repeated failures
          await this.incidentManager.createIncident({
            title: `Chaos Experiment Repeatedly Failing: ${experiment.name}`,
            description: `Scheduled chaos experiment ${experimentId} has failed ${scheduledExperiment.failureCount} times and has been disabled.`,
            severity: 'medium',
            source: 'chaos-scheduler',
            tags: ['chaos-engineering', 'scheduled-experiment', 'failure'],
            metadata: {
              experimentId,
              failureCount: scheduledExperiment.failureCount,
              lastError: result.error?.message,
            },
          });
        }
      }
    } catch (error) {
      scheduledExperiment.failureCount++;

      await this.analytics.track('chaos.scheduled.execution_error', {
        experimentId,
        error: error instanceof Error ? error.message : 'Unknown error',
        failureCount: scheduledExperiment.failureCount,
      });

      this.emit('scheduled_experiment_error', {
        experimentId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      console.error(`Error executing scheduled experiment ${experimentId}:`, error);
    }
  }

  /**
   * Check if an experiment should run based on various conditions
   */
  private async shouldRunExperiment(experiment: ChaosExperiment): Promise<{
    allowed: boolean;
    reason?: string;
  }> {
    // Check if chaos engineering is globally enabled
    if (!this.config.global.enabled) {
      return { allowed: false, reason: 'Chaos engineering is globally disabled' };
    }

    // Check environment configuration
    const envConfig = this.config.environments[experiment.environment];
    if (!envConfig || !envConfig.enabled) {
      return { allowed: false, reason: `Environment ${experiment.environment} is disabled` };
    }

    // Check business hours constraints for production
    if (experiment.environment === 'production' && envConfig.businessHours?.enabled) {
      const now = new Date();
      const isBusinessHours = this.isBusinessHours(now, envConfig.businessHours);
      
      if (isBusinessHours) {
        return { allowed: false, reason: 'Production experiments not allowed during business hours' };
      }
    }

    // Check if there are any active incidents
    const activeIncidents = await this.incidentManager.getActiveIncidents();
    if (activeIncidents.length > 0) {
      const criticalIncidents = activeIncidents.filter(incident => 
        incident.severity === 'critical' || incident.severity === 'high'
      );
      
      if (criticalIncidents.length > 0) {
        return { allowed: false, reason: 'Active critical incidents detected' };
      }
    }

    // Check system health metrics (if available)
    const systemHealth = await this.checkSystemHealth(experiment);
    if (!systemHealth.healthy) {
      return { allowed: false, reason: `System health check failed: ${systemHealth.reason}` };
    }

    // Check rate limiting
    if (this.config.safety.rateLimiting.enabled) {
      const recentRuns = await this.getRecentExperimentRuns(experiment.id, 3600); // Last hour
      if (recentRuns >= this.config.safety.rateLimiting.maxExperimentsPerHour) {
        return { allowed: false, reason: 'Rate limit exceeded' };
      }
    }

    return { allowed: true };
  }

  /**
   * Check if current time is within business hours
   */
  private isBusinessHours(date: Date, businessHours: any): boolean {
    const day = date.getDay(); // 0 = Sunday, 6 = Saturday
    
    if (!businessHours.days.includes(day)) {
      return false;
    }

    const timeStr = date.toTimeString().substring(0, 5); // HH:MM format
    return timeStr >= businessHours.start && timeStr <= businessHours.end;
  }

  /**
   * Check system health before running experiments
   */
  private async checkSystemHealth(experiment: ChaosExperiment): Promise<{
    healthy: boolean;
    reason?: string;
  }> {
    try {
      // This would integrate with monitoring systems to check system health
      // For now, return healthy by default
      return { healthy: true };
    } catch (error) {
      return {
        healthy: false,
        reason: error instanceof Error ? error.message : 'Health check failed',
      };
    }
  }

  /**
   * Get recent experiment runs for rate limiting
   */
  private async getRecentExperimentRuns(experimentId: string, timeWindowSeconds: number): Promise<number> {
    // This would query the execution history from storage
    // For now, return 0
    return 0;
  }

  /**
   * Pause all scheduled experiments
   */
  async pauseAll(): Promise<void> {
    for (const [experimentId, scheduledExperiment] of this.scheduledExperiments) {
      try {
        scheduledExperiment.cronJob.stop();
        console.log(`Paused scheduled experiment: ${experimentId}`);
      } catch (error) {
        console.error(`Failed to pause scheduled experiment ${experimentId}:`, error);
      }
    }

    await this.analytics.track('chaos.scheduler.paused_all', {
      experimentCount: this.scheduledExperiments.size,
    });

    this.emit('scheduler_paused');
  }

  /**
   * Resume all scheduled experiments
   */
  async resumeAll(): Promise<void> {
    for (const [experimentId, scheduledExperiment] of this.scheduledExperiments) {
      try {
        scheduledExperiment.cronJob.start();
        console.log(`Resumed scheduled experiment: ${experimentId}`);
      } catch (error) {
        console.error(`Failed to resume scheduled experiment ${experimentId}:`, error);
      }
    }

    await this.analytics.track('chaos.scheduler.resumed_all', {
      experimentCount: this.scheduledExperiments.size,
    });

    this.emit('scheduler_resumed');
  }

  /**
   * Get experiment execution history
   */
  async getExecutionHistory(experimentId?: string, limit: number = 50): Promise<Array<{
    experimentId: string;
    executionId: string;
    status: string;
    startedAt: Date;
    completedAt?: Date;
    duration?: number;
    error?: string;
  }>> {
    // This would query execution history from storage
    // For now, return empty array
    return [];
  }

  /**
   * Generate scheduler report
   */
  async generateReport(period: 'day' | 'week' | 'month' = 'week'): Promise<{
    period: string;
    totalExecutions: number;
    successfulExecutions: number;
    failedExecutions: number;
    averageExecutionTime: number;
    experimentsRun: number;
    topFailingExperiments: Array<{
      experimentId: string;
      name: string;
      failureCount: number;
      failureRate: number;
    }>;
    insights: string[];
  }> {
    // This would generate a comprehensive report based on execution history
    // For now, return a placeholder report
    return {
      period,
      totalExecutions: 0,
      successfulExecutions: 0,
      failedExecutions: 0,
      averageExecutionTime: 0,
      experimentsRun: 0,
      topFailingExperiments: [],
      insights: [],
    };
  }
}
