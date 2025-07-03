import { 
  SLO, 
  SLI, 
  ErrorBudget, 
  SLOReport, 
  BurnRateAlert, 
  TimeWindow,
  ServiceTier,
  AlertSeverity 
} from '../types/slo';
import { addHours, addDays, differenceInMinutes, format } from 'date-fns';

/**
 * Core SLO Management System
 * Handles SLO calculations, error budget tracking, and alerting
 */
export class SLOManager {
  private slos: Map<string, SLO> = new Map();
  private errorBudgets: Map<string, ErrorBudget> = new Map();
  private alerts: Map<string, BurnRateAlert> = new Map();

  constructor(private config: {
    monitoringBackend: 'prometheus' | 'datadog' | 'cloudwatch';
    alertingEnabled: boolean;
    budgetCalculationInterval: number; // minutes
  }) {}

  /**
   * Register a new SLO
   */
  registerSLO(slo: SLO): void {
    this.slos.set(slo.id, slo);
    this.initializeErrorBudget(slo);
  }

  /**
   * Get SLO by ID
   */
  getSLO(id: string): SLO | undefined {
    return this.slos.get(id);
  }

  /**
   * Get all SLOs for a service
   */
  getSLOsForService(service: string): SLO[] {
    return Array.from(this.slos.values()).filter(slo => slo.service === service);
  }

  /**
   * Get all SLOs by tier
   */
  getSLOsByTier(tier: ServiceTier): SLO[] {
    return Array.from(this.slos.values()).filter(slo => slo.tier === tier);
  }

  /**
   * Calculate error budget for an SLO
   */
  calculateErrorBudget(sloId: string, actualSLI: number): ErrorBudget {
    const slo = this.slos.get(sloId);
    if (!slo) {
      throw new Error(`SLO not found: ${sloId}`);
    }

    const timeWindowMinutes = this.getTimeWindowInMinutes(slo.timeWindow);
    const totalRequests = this.estimateTotalRequests(slo, timeWindowMinutes);
    
    // Calculate allowed errors based on SLO target
    const allowedErrorRate = (100 - slo.target) / 100;
    const totalAllowedErrors = Math.floor(totalRequests * allowedErrorRate);
    
    // Calculate current errors based on actual SLI
    const currentErrorRate = (100 - actualSLI) / 100;
    const currentErrors = Math.floor(totalRequests * currentErrorRate);
    
    const remainingBudget = Math.max(0, totalAllowedErrors - currentErrors);
    const consumptionPercentage = totalAllowedErrors > 0 
      ? Math.min(100, (currentErrors / totalAllowedErrors) * 100)
      : 0;

    // Calculate burn rate (how fast we're consuming the budget)
    const burnRate = this.calculateBurnRate(slo, currentErrors, totalAllowedErrors);
    
    // Estimate time to exhaustion
    const timeToExhaustion = this.calculateTimeToExhaustion(
      remainingBudget, 
      burnRate, 
      timeWindowMinutes
    );

    // Determine status
    const status = this.determineBudgetStatus(consumptionPercentage, burnRate);

    const errorBudget: ErrorBudget = {
      sloId,
      timeWindow: slo.timeWindow,
      totalAllowedErrors,
      currentErrors,
      remainingBudget,
      consumptionPercentage,
      burnRate,
      timeToExhaustion,
      status,
      lastCalculated: new Date().toISOString()
    };

    this.errorBudgets.set(sloId, errorBudget);
    return errorBudget;
  }

  /**
   * Get error budget for an SLO
   */
  getErrorBudget(sloId: string): ErrorBudget | undefined {
    return this.errorBudgets.get(sloId);
  }

  /**
   * Check for burn rate violations and generate alerts
   */
  checkBurnRateAlerts(sloId: string): BurnRateAlert[] {
    const slo = this.slos.get(sloId);
    const errorBudget = this.errorBudgets.get(sloId);
    
    if (!slo || !errorBudget) {
      return [];
    }

    const alerts: BurnRateAlert[] = [];
    const now = new Date().toISOString();

    // Check fast burn rate
    if (errorBudget.burnRate > slo.alerting.burnRate.fast.threshold) {
      const alertId = `${sloId}-fast-burn-${Date.now()}`;
      alerts.push({
        id: alertId,
        sloId,
        service: slo.service,
        type: 'fast_burn',
        severity: slo.alerting.burnRate.fast.severity,
        burnRate: errorBudget.burnRate,
        threshold: slo.alerting.burnRate.fast.threshold,
        timeWindow: slo.alerting.burnRate.fast.window,
        message: `Fast burn rate detected for ${slo.name}: ${errorBudget.burnRate.toFixed(2)}x (threshold: ${slo.alerting.burnRate.fast.threshold}x)`,
        status: 'firing',
        firedAt: now,
        metadata: {
          errorBudgetRemaining: errorBudget.remainingBudget,
          timeToExhaustion: errorBudget.timeToExhaustion,
          runbook: slo.metadata.runbook
        }
      });
    }

    // Check slow burn rate
    if (errorBudget.burnRate > slo.alerting.burnRate.slow.threshold) {
      const alertId = `${sloId}-slow-burn-${Date.now()}`;
      alerts.push({
        id: alertId,
        sloId,
        service: slo.service,
        type: 'slow_burn',
        severity: slo.alerting.burnRate.slow.severity,
        burnRate: errorBudget.burnRate,
        threshold: slo.alerting.burnRate.slow.threshold,
        timeWindow: slo.alerting.burnRate.slow.window,
        message: `Slow burn rate detected for ${slo.name}: ${errorBudget.burnRate.toFixed(2)}x (threshold: ${slo.alerting.burnRate.slow.threshold}x)`,
        status: 'firing',
        firedAt: now,
        metadata: {
          errorBudgetRemaining: errorBudget.remainingBudget,
          timeToExhaustion: errorBudget.timeToExhaustion,
          runbook: slo.metadata.runbook
        }
      });
    }

    // Check budget exhaustion thresholds
    for (const threshold of slo.alerting.budgetExhaustion.thresholds) {
      if (errorBudget.consumptionPercentage >= threshold.percentage) {
        const alertId = `${sloId}-budget-exhaustion-${threshold.percentage}-${Date.now()}`;
        alerts.push({
          id: alertId,
          sloId,
          service: slo.service,
          type: 'budget_exhaustion',
          severity: threshold.severity,
          burnRate: errorBudget.burnRate,
          threshold: threshold.percentage,
          timeWindow: slo.timeWindow,
          message: `Error budget ${threshold.percentage}% exhausted for ${slo.name}: ${errorBudget.consumptionPercentage.toFixed(1)}% consumed`,
          status: 'firing',
          firedAt: now,
          metadata: {
            errorBudgetRemaining: errorBudget.remainingBudget,
            timeToExhaustion: errorBudget.timeToExhaustion,
            runbook: slo.metadata.runbook
          }
        });
      }
    }

    // Store alerts
    alerts.forEach(alert => this.alerts.set(alert.id, alert));
    
    return alerts;
  }

  /**
   * Generate SLO report for a time period
   */
  generateReport(startDate: Date, endDate: Date, services?: string[]): SLOReport {
    const reportId = `slo-report-${Date.now()}`;
    const slosToInclude = services 
      ? Array.from(this.slos.values()).filter(slo => services.includes(slo.service))
      : Array.from(this.slos.values());

    const sloPerformance = slosToInclude.map(slo => {
      const errorBudget = this.errorBudgets.get(slo.id);
      const actualValue = this.calculateActualSLI(slo, startDate, endDate);
      
      return {
        slo,
        performance: {
          actualValue,
          targetValue: slo.target,
          targetMet: actualValue >= slo.target,
          errorBudget: errorBudget || this.calculateErrorBudget(slo.id, actualValue)
        }
      };
    });

    const slosMeetingTarget = sloPerformance.filter(p => p.performance.targetMet).length;
    const overallCompliance = slosToInclude.length > 0 
      ? (slosMeetingTarget / slosToInclude.length) * 100 
      : 100;

    const servicesWithExhaustedBudgets = sloPerformance
      .filter(p => p.performance.errorBudget.status === 'exhausted')
      .map(p => p.slo.service);

    return {
      id: reportId,
      period: {
        start: startDate.toISOString(),
        end: endDate.toISOString()
      },
      slos: sloPerformance,
      summary: {
        totalSLOs: slosToInclude.length,
        slosMeetingTarget,
        overallCompliance,
        servicesWithExhaustedBudgets: [...new Set(servicesWithExhaustedBudgets)]
      },
      generatedAt: new Date().toISOString()
    };
  }

  /**
   * Get active alerts
   */
  getActiveAlerts(service?: string): BurnRateAlert[] {
    const alerts = Array.from(this.alerts.values()).filter(alert => alert.status === 'firing');
    return service ? alerts.filter(alert => alert.service === service) : alerts;
  }

  /**
   * Resolve an alert
   */
  resolveAlert(alertId: string): void {
    const alert = this.alerts.get(alertId);
    if (alert) {
      alert.status = 'resolved';
      alert.resolvedAt = new Date().toISOString();
      this.alerts.set(alertId, alert);
    }
  }

  // Private helper methods

  private initializeErrorBudget(slo: SLO): void {
    const errorBudget: ErrorBudget = {
      sloId: slo.id,
      timeWindow: slo.timeWindow,
      totalAllowedErrors: 0,
      currentErrors: 0,
      remainingBudget: 0,
      consumptionPercentage: 0,
      burnRate: 0,
      status: 'healthy',
      lastCalculated: new Date().toISOString()
    };
    
    this.errorBudgets.set(slo.id, errorBudget);
  }

  private getTimeWindowInMinutes(timeWindow: TimeWindow): number {
    const windows = {
      '1h': 60,
      '6h': 360,
      '24h': 1440,
      '7d': 10080,
      '30d': 43200,
      '90d': 129600
    };
    return windows[timeWindow];
  }

  private estimateTotalRequests(slo: SLO, timeWindowMinutes: number): number {
    // This would typically query your monitoring system
    // For now, we'll use a simple estimation based on service tier
    const requestsPerMinute = {
      'tier-0': 10000,
      'tier-1': 1000,
      'tier-2': 100,
      'tier-3': 10
    };
    
    return requestsPerMinute[slo.tier] * timeWindowMinutes;
  }

  private calculateBurnRate(slo: SLO, currentErrors: number, totalAllowedErrors: number): number {
    if (totalAllowedErrors === 0) return 0;
    
    const timeWindowMinutes = this.getTimeWindowInMinutes(slo.timeWindow);
    const currentRate = currentErrors / timeWindowMinutes;
    const allowedRate = totalAllowedErrors / timeWindowMinutes;
    
    return allowedRate > 0 ? currentRate / allowedRate : 0;
  }

  private calculateTimeToExhaustion(
    remainingBudget: number, 
    burnRate: number, 
    timeWindowMinutes: number
  ): string | undefined {
    if (burnRate <= 1 || remainingBudget <= 0) return undefined;
    
    const minutesToExhaustion = remainingBudget / (burnRate - 1);
    const exhaustionDate = addMinutes(new Date(), minutesToExhaustion);
    
    return format(exhaustionDate, 'yyyy-MM-dd HH:mm:ss');
  }

  private determineBudgetStatus(consumptionPercentage: number, burnRate: number): ErrorBudget['status'] {
    if (consumptionPercentage >= 100) return 'exhausted';
    if (consumptionPercentage >= 90 || burnRate > 10) return 'critical';
    if (consumptionPercentage >= 75 || burnRate > 5) return 'warning';
    return 'healthy';
  }

  private calculateActualSLI(slo: SLO, startDate: Date, endDate: Date): number {
    // This would typically execute the SLI query against your monitoring system
    // For now, we'll simulate based on service tier and SLI type
    const baseValues = {
      'tier-0': { availability: 99.95, latency: 95, error_rate: 0.05 },
      'tier-1': { availability: 99.9, latency: 90, error_rate: 0.1 },
      'tier-2': { availability: 99.5, latency: 85, error_rate: 0.5 },
      'tier-3': { availability: 99.0, latency: 80, error_rate: 1.0 }
    };
    
    const baseValue = baseValues[slo.tier][slo.sli.type as keyof typeof baseValues['tier-0']] || 95;
    
    // Add some random variation
    const variation = (Math.random() - 0.5) * 2; // -1 to +1
    return Math.max(0, Math.min(100, baseValue + variation));
  }
}

// Helper function to add minutes to a date
function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60000);
}
