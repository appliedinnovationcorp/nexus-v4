import { useState, useEffect, useCallback, useRef } from 'react';
import { ChaosEngine } from '../core/chaos-engine';
import { ChaosScheduler } from '../scheduler/chaos-scheduler';
import { ExperimentLibrary } from '../experiments/experiment-library';
import { 
  ChaosConfig, 
  ChaosExperiment, 
  ChaosExecution, 
  ChaosEvent,
  ResilienceAssessment,
  ChaosMetrics 
} from '../types';

/**
 * React hook for managing chaos experiments
 */
export function useChaosEngine(config: ChaosConfig) {
  const [chaosEngine] = useState(() => new ChaosEngine(config));
  const [activeExecutions, setActiveExecutions] = useState<ChaosExecution[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadActiveExecutions = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await chaosEngine.getActiveExecutions();
      if (response.success && response.data) {
        setActiveExecutions(response.data);
      } else {
        setError(response.error?.message || 'Failed to load active executions');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [chaosEngine]);

  const executeExperiment = useCallback(async (experiment: ChaosExperiment) => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await chaosEngine.executeExperiment(experiment);
      if (response.success) {
        await loadActiveExecutions(); // Refresh the list
        return response.data;
      } else {
        setError(response.error?.message || 'Failed to execute experiment');
        return null;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      return null;
    } finally {
      setLoading(false);
    }
  }, [chaosEngine, loadActiveExecutions]);

  const stopExperiment = useCallback(async (executionId: string, reason?: string) => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await chaosEngine.stopExperiment(executionId, reason);
      if (response.success) {
        await loadActiveExecutions(); // Refresh the list
        return true;
      } else {
        setError(response.error?.message || 'Failed to stop experiment');
        return false;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      return false;
    } finally {
      setLoading(false);
    }
  }, [chaosEngine, loadActiveExecutions]);

  const getExecutionStatus = useCallback(async (executionId: string) => {
    try {
      const response = await chaosEngine.getExecutionStatus(executionId);
      if (response.success) {
        return response.data;
      } else {
        setError(response.error?.message || 'Failed to get execution status');
        return null;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      return null;
    }
  }, [chaosEngine]);

  useEffect(() => {
    loadActiveExecutions();
  }, [loadActiveExecutions]);

  return {
    chaosEngine,
    activeExecutions,
    loading,
    error,
    executeExperiment,
    stopExperiment,
    getExecutionStatus,
    refresh: loadActiveExecutions,
  };
}

/**
 * React hook for chaos experiment scheduling
 */
export function useChaosScheduler(chaosEngine: ChaosEngine, config: ChaosConfig) {
  const [scheduler] = useState(() => new ChaosScheduler(chaosEngine, config));
  const [scheduledExperiments, setScheduledExperiments] = useState<any[]>([]);
  const [schedulerStatus, setSchedulerStatus] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadScheduledExperiments = useCallback(() => {
    try {
      const experiments = scheduler.getScheduledExperiments();
      setScheduledExperiments(experiments);
      
      const status = scheduler.getStatus();
      setSchedulerStatus(status);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  }, [scheduler]);

  const scheduleExperiment = useCallback(async (experiment: ChaosExperiment) => {
    setLoading(true);
    setError(null);
    
    try {
      await scheduler.scheduleExperiment(experiment);
      loadScheduledExperiments();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      return false;
    } finally {
      setLoading(false);
    }
  }, [scheduler, loadScheduledExperiments]);

  const unscheduleExperiment = useCallback(async (experimentId: string) => {
    setLoading(true);
    setError(null);
    
    try {
      await scheduler.unscheduleExperiment(experimentId);
      loadScheduledExperiments();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      return false;
    } finally {
      setLoading(false);
    }
  }, [scheduler, loadScheduledExperiments]);

  const startScheduler = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      await scheduler.start();
      loadScheduledExperiments();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      return false;
    } finally {
      setLoading(false);
    }
  }, [scheduler, loadScheduledExperiments]);

  const stopScheduler = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      await scheduler.stop();
      loadScheduledExperiments();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      return false;
    } finally {
      setLoading(false);
    }
  }, [scheduler, loadScheduledExperiments]);

  useEffect(() => {
    loadScheduledExperiments();
  }, [loadScheduledExperiments]);

  return {
    scheduler,
    scheduledExperiments,
    schedulerStatus,
    loading,
    error,
    scheduleExperiment,
    unscheduleExperiment,
    startScheduler,
    stopScheduler,
    refresh: loadScheduledExperiments,
  };
}

/**
 * React hook for experiment templates
 */
export function useExperimentTemplates() {
  const [templates] = useState(() => ExperimentLibrary.getAllTemplates());
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);

  const generateExperiment = useCallback((templateName: string, options: any) => {
    const template = templates.find(t => t.name === templateName);
    if (!template) {
      throw new Error(`Template not found: ${templateName}`);
    }

    return template.createFunction(options);
  }, [templates]);

  const getTemplatesByCategory = useCallback((category?: string) => {
    if (!category) return templates;
    return templates.filter(t => t.category === category);
  }, [templates]);

  const getCategories = useCallback(() => {
    return [...new Set(templates.map(t => t.category))];
  }, [templates]);

  return {
    templates,
    selectedTemplate,
    setSelectedTemplate,
    generateExperiment,
    getTemplatesByCategory,
    getCategories,
  };
}

/**
 * React hook for real-time experiment monitoring
 */
export function useExperimentMonitoring(executionId: string, chaosEngine: ChaosEngine) {
  const [execution, setExecution] = useState<ChaosExecution | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const loadExecution = useCallback(async () => {
    if (!executionId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await chaosEngine.getExecutionStatus(executionId);
      if (response.success && response.data) {
        setExecution(response.data);
      } else {
        setError(response.error?.message || 'Failed to load execution');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [executionId, chaosEngine]);

  const startPolling = useCallback((interval: number = 5000) => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    
    intervalRef.current = setInterval(loadExecution, interval);
  }, [loadExecution]);

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    loadExecution();
    
    // Start polling if execution is active
    if (execution && (execution.status === 'running' || execution.status === 'pending')) {
      startPolling();
    } else {
      stopPolling();
    }

    return () => stopPolling();
  }, [executionId, execution?.status, loadExecution, startPolling, stopPolling]);

  return {
    execution,
    loading,
    error,
    refresh: loadExecution,
    startPolling,
    stopPolling,
  };
}

/**
 * React hook for chaos engineering metrics
 */
export function useChaosMetrics(config: ChaosConfig) {
  const [metrics, setMetrics] = useState<ChaosMetrics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadMetrics = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      // This would typically fetch metrics from a backend service
      // For now, return mock data
      const mockMetrics: ChaosMetrics = {
        experimentsTotal: 150,
        experimentsSuccessful: 135,
        experimentsFailed: 10,
        experimentsRolledBack: 5,
        averageExecutionTime: 285,
        weaknessesFound: 23,
        mttr: 45,
        blastRadiusAverage: 15,
        confidenceScore: 87,
      };
      
      setMetrics(mockMetrics);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMetrics();
  }, [loadMetrics]);

  return {
    metrics,
    loading,
    error,
    refresh: loadMetrics,
  };
}

/**
 * React hook for resilience assessment
 */
export function useResilienceAssessment(config: ChaosConfig) {
  const [assessment, setAssessment] = useState<ResilienceAssessment | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadAssessment = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      // This would typically generate an assessment based on experiment results
      // For now, return mock data
      const mockAssessment: ResilienceAssessment = {
        overallScore: 78,
        categories: {
          availability: {
            score: 85,
            findings: ['High availability maintained during service failures'],
            recommendations: ['Implement circuit breakers for external dependencies'],
          },
          performance: {
            score: 72,
            findings: ['Performance degrades under high CPU load'],
            recommendations: ['Add auto-scaling policies', 'Optimize resource allocation'],
          },
          scalability: {
            score: 80,
            findings: ['System scales well horizontally'],
            recommendations: ['Consider vertical scaling for database tier'],
          },
          security: {
            score: 75,
            findings: ['Security controls remain effective during failures'],
            recommendations: ['Implement additional monitoring for security events'],
          },
          observability: {
            score: 82,
            findings: ['Good visibility into system behavior'],
            recommendations: ['Add more detailed error tracking'],
          },
        },
        trends: {
          period: 'last-30-days',
          scoreChange: 5,
          improvementAreas: ['performance', 'security'],
        },
        nextSteps: [
          'Focus on performance optimization',
          'Implement recommended circuit breakers',
          'Enhance security monitoring',
        ],
      };
      
      setAssessment(mockAssessment);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAssessment();
  }, [loadAssessment]);

  return {
    assessment,
    loading,
    error,
    refresh: loadAssessment,
  };
}

/**
 * React hook for chaos events (WebSocket-based real-time updates)
 */
export function useChaosEvents(config: ChaosConfig) {
  const [events, setEvents] = useState<ChaosEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    try {
      // This would connect to a WebSocket endpoint for real-time events
      // For now, simulate events
      setConnected(true);
      
      // Simulate receiving events
      const interval = setInterval(() => {
        const mockEvent: ChaosEvent = {
          type: 'experiment_started',
          payload: {
            experimentId: `exp-${Date.now()}`,
            executionId: `exec-${Date.now()}`,
          },
        };
        
        setEvents(prev => [mockEvent, ...prev.slice(0, 49)]); // Keep last 50 events
      }, 10000);

      return () => clearInterval(interval);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connection failed');
      setConnected(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setConnected(false);
  }, []);

  const clearEvents = useCallback(() => {
    setEvents([]);
  }, []);

  useEffect(() => {
    connect();
    return () => disconnect();
  }, [connect, disconnect]);

  return {
    events,
    connected,
    error,
    connect,
    disconnect,
    clearEvents,
  };
}

/**
 * React hook for experiment validation
 */
export function useExperimentValidation(config: ChaosConfig) {
  const validateExperiment = useCallback((experiment: ChaosExperiment) => {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Basic validation
    if (!experiment.name) errors.push('Experiment name is required');
    if (!experiment.description) warnings.push('Experiment description is recommended');
    if (!experiment.environment) errors.push('Environment is required');
    if (!experiment.faultType) errors.push('Fault type is required');
    if (!experiment.duration || experiment.duration <= 0) errors.push('Valid duration is required');

    // Environment-specific validation
    const envConfig = config.environments[experiment.environment];
    if (!envConfig) {
      errors.push(`Environment ${experiment.environment} is not configured`);
    } else {
      if (!envConfig.enabled) {
        warnings.push(`Environment ${experiment.environment} is disabled`);
      }
      if (!envConfig.allowedFaultTypes.includes(experiment.faultType)) {
        errors.push(`Fault type ${experiment.faultType} is not allowed in ${experiment.environment}`);
      }
    }

    // Safety validation
    if (experiment.targetSelector.percentage > config.safety.blastRadius.maxTargetPercentage) {
      errors.push(`Target percentage exceeds blast radius limit`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }, [config]);

  return { validateExperiment };
}
