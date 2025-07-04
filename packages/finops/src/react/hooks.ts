import { useState, useEffect, useCallback } from 'react';
import { FinOpsManager } from '../finops-manager';
import { FinOpsConfig, CostDataPoint, ResourceTags } from '../types';

/**
 * React hook for FinOps cost monitoring
 */
export function useCostMonitoring(config: FinOpsConfig) {
  const [finopsManager] = useState(() => new FinOpsManager(config));
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadDashboardData = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await finopsManager.getDashboardData();
      if (response.success) {
        setDashboardData(response.data);
      } else {
        setError(response.error?.message || 'Failed to load dashboard data');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [finopsManager]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  return {
    dashboardData,
    loading,
    error,
    refresh: loadDashboardData,
    finopsManager,
  };
}

/**
 * React hook for cost estimation
 */
export function useCostEstimation(config: FinOpsConfig) {
  const [finopsManager] = useState(() => new FinOpsManager(config));
  const [estimation, setEstimation] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const estimateCost = useCallback(async (changes: Array<{
    type: 'CREATE' | 'UPDATE' | 'DELETE';
    resourceType: string;
    configuration: Record<string, any>;
    region: string;
  }>) => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await finopsManager.estimateInfrastructureCost(changes);
      if (response.success) {
        setEstimation(response.data);
      } else {
        setError(response.error?.message || 'Failed to estimate cost');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [finopsManager]);

  return {
    estimation,
    loading,
    error,
    estimateCost,
  };
}

/**
 * React hook for resource tagging
 */
export function useResourceTagging(config: FinOpsConfig) {
  const [finopsManager] = useState(() => new FinOpsManager(config));
  const [complianceReport, setComplianceReport] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadComplianceReport = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const taggingManager = finopsManager.getTaggingManager();
      const report = await taggingManager.getTagComplianceReport();
      setComplianceReport(report);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [finopsManager]);

  const validateTags = useCallback(async (resourceArn: string, tags: Record<string, string>) => {
    const taggingManager = finopsManager.getTaggingManager();
    return await taggingManager.validateResourceTags(resourceArn, tags);
  }, [finopsManager]);

  const applyTags = useCallback(async (resourceArns: string[], tags: Record<string, string>) => {
    const taggingManager = finopsManager.getTaggingManager();
    return await taggingManager.tagResources(resourceArns, tags);
  }, [finopsManager]);

  useEffect(() => {
    loadComplianceReport();
  }, [loadComplianceReport]);

  return {
    complianceReport,
    loading,
    error,
    refresh: loadComplianceReport,
    validateTags,
    applyTags,
  };
}

/**
 * React hook for cost optimization
 */
export function useCostOptimization(config: FinOpsConfig) {
  const [finopsManager] = useState(() => new FinOpsManager(config));
  const [recommendations, setRecommendations] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadRecommendations = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await finopsManager.runCostOptimization();
      if (response.success) {
        setRecommendations(response.data);
      } else {
        setError(response.error?.message || 'Failed to load recommendations');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [finopsManager]);

  useEffect(() => {
    loadRecommendations();
  }, [loadRecommendations]);

  return {
    recommendations,
    loading,
    error,
    refresh: loadRecommendations,
  };
}

/**
 * React hook for cost trends
 */
export function useCostTrends(
  config: FinOpsConfig,
  options: {
    startDate: string;
    endDate: string;
    granularity: 'DAILY' | 'MONTHLY';
    service?: string;
  }
) {
  const [finopsManager] = useState(() => new FinOpsManager(config));
  const [trends, setTrends] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadTrends = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const costMonitoring = finopsManager.getCostMonitoring();
      const trendsData = await costMonitoring.getCostTrends(options);
      setTrends(trendsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [finopsManager, options]);

  useEffect(() => {
    loadTrends();
  }, [loadTrends]);

  return {
    trends,
    loading,
    error,
    refresh: loadTrends,
  };
}

/**
 * React hook for budget monitoring
 */
export function useBudgetMonitoring(config: FinOpsConfig, budgetName?: string) {
  const [finopsManager] = useState(() => new FinOpsManager(config));
  const [budgetStatus, setBudgetStatus] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadBudgetStatus = useCallback(async () => {
    if (!budgetName) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const costMonitoring = finopsManager.getCostMonitoring();
      const status = await costMonitoring.getBudgetStatus(budgetName);
      setBudgetStatus(status);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [finopsManager, budgetName]);

  useEffect(() => {
    loadBudgetStatus();
  }, [loadBudgetStatus]);

  return {
    budgetStatus,
    loading,
    error,
    refresh: loadBudgetStatus,
  };
}

/**
 * React hook for cost anomaly detection
 */
export function useCostAnomalies(
  config: FinOpsConfig,
  options: {
    startDate: string;
    endDate: string;
    monitorArn?: string;
  }
) {
  const [finopsManager] = useState(() => new FinOpsManager(config));
  const [anomalies, setAnomalies] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadAnomalies = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const costMonitoring = finopsManager.getCostMonitoring();
      const anomaliesData = await costMonitoring.getCostAnomalies(options);
      setAnomalies(anomaliesData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [finopsManager, options]);

  useEffect(() => {
    loadAnomalies();
  }, [loadAnomalies]);

  return {
    anomalies,
    loading,
    error,
    refresh: loadAnomalies,
  };
}
