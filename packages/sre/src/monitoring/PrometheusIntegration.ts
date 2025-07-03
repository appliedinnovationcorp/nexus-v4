import { SLI, SLO, ErrorBudget } from '../types/slo';

/**
 * Prometheus Integration for SLO Monitoring
 * Handles metric collection, SLI calculation, and alerting rules
 */
export class PrometheusIntegration {
  private prometheusUrl: string;
  private alertmanagerUrl: string;

  constructor(config: {
    prometheusUrl: string;
    alertmanagerUrl: string;
    timeout?: number;
  }) {
    this.prometheusUrl = config.prometheusUrl;
    this.alertmanagerUrl = config.alertmanagerUrl;
  }

  /**
   * Execute a Prometheus query
   */
  async query(query: string, time?: Date): Promise<any> {
    const url = new URL('/api/v1/query', this.prometheusUrl);
    url.searchParams.set('query', query);
    
    if (time) {
      url.searchParams.set('time', Math.floor(time.getTime() / 1000).toString());
    }

    const response = await fetch(url.toString());
    
    if (!response.ok) {
      throw new Error(`Prometheus query failed: ${response.statusText}`);
    }

    const data = await response.json();
    
    if (data.status !== 'success') {
      throw new Error(`Prometheus query error: ${data.error}`);
    }

    return data.data;
  }

  /**
   * Execute a Prometheus range query
   */
  async queryRange(
    query: string, 
    start: Date, 
    end: Date, 
    step: string = '1m'
  ): Promise<any> {
    const url = new URL('/api/v1/query_range', this.prometheusUrl);
    url.searchParams.set('query', query);
    url.searchParams.set('start', Math.floor(start.getTime() / 1000).toString());
    url.searchParams.set('end', Math.floor(end.getTime() / 1000).toString());
    url.searchParams.set('step', step);

    const response = await fetch(url.toString());
    
    if (!response.ok) {
      throw new Error(`Prometheus range query failed: ${response.statusText}`);
    }

    const data = await response.json();
    
    if (data.status !== 'success') {
      throw new Error(`Prometheus range query error: ${data.error}`);
    }

    return data.data;
  }

  /**
   * Calculate SLI value from Prometheus
   */
  async calculateSLI(sli: SLI, timeWindow: string = '5m'): Promise<number> {
    try {
      // Replace time window placeholder in query
      const query = sli.query.replace(/\[\$time_window\]/g, `[${timeWindow}]`);
      
      const result = await this.query(query);
      
      if (!result.result || result.result.length === 0) {
        throw new Error(`No data returned for SLI: ${sli.id}`);
      }

      // Extract the numeric value from the result
      const value = parseFloat(result.result[0].value[1]);
      
      if (isNaN(value)) {
        throw new Error(`Invalid SLI value for: ${sli.id}`);
      }

      return value;
    } catch (error) {
      console.error(`Failed to calculate SLI ${sli.id}:`, error);
      throw error;
    }
  }

  /**
   * Generate Prometheus recording rules for SLOs
   */
  generateRecordingRules(slos: SLO[]): string {
    const rules = slos.map(slo => {
      const sli = slo.sli;
      const ruleName = `slo:${slo.service}:${sli.type}:${slo.timeWindow}`;
      
      return {
        record: ruleName,
        expr: sli.query,
        labels: {
          service: slo.service,
          slo_name: slo.name,
          slo_id: slo.id,
          tier: slo.tier,
          sli_type: sli.type,
          time_window: slo.timeWindow
        }
      };
    });

    const errorBudgetRules = slos.map(slo => {
      const budgetRuleName = `slo:error_budget:${slo.service}:${slo.sli.type}:${slo.timeWindow}`;
      const allowedErrorRate = (100 - slo.target) / 100;
      
      return {
        record: budgetRuleName,
        expr: `${allowedErrorRate}`,
        labels: {
          service: slo.service,
          slo_name: slo.name,
          slo_id: slo.id,
          tier: slo.tier,
          time_window: slo.timeWindow
        }
      };
    });

    const burnRateRules = slos.map(slo => {
      const burnRateRuleName = `slo:burn_rate:${slo.service}:${slo.sli.type}:${slo.timeWindow}`;
      const sliRuleName = `slo:${slo.service}:${slo.sli.type}:${slo.timeWindow}`;
      const budgetRuleName = `slo:error_budget:${slo.service}:${slo.sli.type}:${slo.timeWindow}`;
      
      return {
        record: burnRateRuleName,
        expr: `(100 - ${sliRuleName}) / (${budgetRuleName} * 100)`,
        labels: {
          service: slo.service,
          slo_name: slo.name,
          slo_id: slo.id,
          tier: slo.tier,
          time_window: slo.timeWindow
        }
      };
    });

    const allRules = [...rules, ...errorBudgetRules, ...burnRateRules];

    return `
groups:
  - name: slo_recording_rules
    interval: 30s
    rules:
${allRules.map(rule => `      - record: ${rule.record}
        expr: ${rule.expr}
        labels:
${Object.entries(rule.labels).map(([key, value]) => `          ${key}: "${value}"`).join('\n')}`).join('\n')}
`;
  }

  /**
   * Generate Prometheus alerting rules for SLOs
   */
  generateAlertingRules(slos: SLO[]): string {
    const alerts: any[] = [];

    slos.forEach(slo => {
      const burnRateRuleName = `slo:burn_rate:${slo.service}:${slo.sli.type}:${slo.timeWindow}`;
      
      // Fast burn rate alert
      alerts.push({
        alert: `SLOFastBurnRate`,
        expr: `${burnRateRuleName}{slo_id="${slo.id}"} > ${slo.alerting.burnRate.fast.threshold}`,
        for: '2m',
        labels: {
          severity: slo.alerting.burnRate.fast.severity,
          service: slo.service,
          slo_id: slo.id,
          slo_name: slo.name,
          tier: slo.tier,
          alert_type: 'fast_burn'
        },
        annotations: {
          summary: `Fast burn rate detected for ${slo.name}`,
          description: `The error budget for ${slo.name} is being consumed at {{ $value }}x the sustainable rate (threshold: ${slo.alerting.burnRate.fast.threshold}x)`,
          runbook_url: slo.metadata.runbook || '',
          dashboard_url: `https://grafana.nexus.dev/d/slo-dashboard?var-service=${slo.service}`
        }
      });

      // Slow burn rate alert
      alerts.push({
        alert: `SLOSlowBurnRate`,
        expr: `${burnRateRuleName}{slo_id="${slo.id}"} > ${slo.alerting.burnRate.slow.threshold}`,
        for: '15m',
        labels: {
          severity: slo.alerting.burnRate.slow.severity,
          service: slo.service,
          slo_id: slo.id,
          slo_name: slo.name,
          tier: slo.tier,
          alert_type: 'slow_burn'
        },
        annotations: {
          summary: `Slow burn rate detected for ${slo.name}`,
          description: `The error budget for ${slo.name} is being consumed at {{ $value }}x the sustainable rate (threshold: ${slo.alerting.burnRate.slow.threshold}x)`,
          runbook_url: slo.metadata.runbook || '',
          dashboard_url: `https://grafana.nexus.dev/d/slo-dashboard?var-service=${slo.service}`
        }
      });

      // Budget exhaustion alerts
      slo.alerting.budgetExhaustion.thresholds.forEach(threshold => {
        const budgetConsumptionExpr = `(1 - (slo:error_budget_remaining:${slo.service}:${slo.sli.type}:${slo.timeWindow}{slo_id="${slo.id}"} / slo:error_budget_total:${slo.service}:${slo.sli.type}:${slo.timeWindow}{slo_id="${slo.id}"})) * 100`;
        
        alerts.push({
          alert: `SLOBudgetExhaustion`,
          expr: `${budgetConsumptionExpr} >= ${threshold.percentage}`,
          for: '5m',
          labels: {
            severity: threshold.severity,
            service: slo.service,
            slo_id: slo.id,
            slo_name: slo.name,
            tier: slo.tier,
            alert_type: 'budget_exhaustion',
            threshold: threshold.percentage.toString()
          },
          annotations: {
            summary: `Error budget ${threshold.percentage}% exhausted for ${slo.name}`,
            description: `{{ $value | humanizePercentage }} of the error budget for ${slo.name} has been consumed`,
            runbook_url: slo.metadata.runbook || '',
            dashboard_url: `https://grafana.nexus.dev/d/slo-dashboard?var-service=${slo.service}`
          }
        });
      });
    });

    return `
groups:
  - name: slo_alerting_rules
    interval: 30s
    rules:
${alerts.map(alert => `      - alert: ${alert.alert}
        expr: ${alert.expr}
        for: ${alert.for}
        labels:
${Object.entries(alert.labels).map(([key, value]) => `          ${key}: "${value}"`).join('\n')}
        annotations:
${Object.entries(alert.annotations).map(([key, value]) => `          ${key}: "${value}"`).join('\n')}`).join('\n')}
`;
  }

  /**
   * Create or update Prometheus rules
   */
  async updatePrometheusRules(slos: SLO[]): Promise<void> {
    const recordingRules = this.generateRecordingRules(slos);
    const alertingRules = this.generateAlertingRules(slos);
    
    // In a real implementation, you would:
    // 1. Write rules to files or ConfigMaps
    // 2. Reload Prometheus configuration
    // 3. Verify rules are loaded correctly
    
    console.log('Recording Rules:', recordingRules);
    console.log('Alerting Rules:', alertingRules);
  }

  /**
   * Get current alerts from Alertmanager
   */
  async getActiveAlerts(service?: string): Promise<any[]> {
    const url = new URL('/api/v1/alerts', this.alertmanagerUrl);
    
    if (service) {
      url.searchParams.set('filter', `service="${service}"`);
    }

    const response = await fetch(url.toString());
    
    if (!response.ok) {
      throw new Error(`Failed to fetch alerts: ${response.statusText}`);
    }

    const data = await response.json();
    return data.data || [];
  }

  /**
   * Silence an alert in Alertmanager
   */
  async silenceAlert(alertId: string, duration: string, comment: string): Promise<void> {
    const silenceData = {
      matchers: [
        {
          name: 'alertname',
          value: alertId,
          isRegex: false
        }
      ],
      startsAt: new Date().toISOString(),
      endsAt: new Date(Date.now() + this.parseDuration(duration)).toISOString(),
      createdBy: 'sre-system',
      comment: comment
    };

    const response = await fetch(`${this.alertmanagerUrl}/api/v1/silences`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(silenceData)
    });

    if (!response.ok) {
      throw new Error(`Failed to create silence: ${response.statusText}`);
    }
  }

  /**
   * Parse duration string to milliseconds
   */
  private parseDuration(duration: string): number {
    const units: { [key: string]: number } = {
      's': 1000,
      'm': 60 * 1000,
      'h': 60 * 60 * 1000,
      'd': 24 * 60 * 60 * 1000
    };

    const match = duration.match(/^(\d+)([smhd])$/);
    if (!match) {
      throw new Error(`Invalid duration format: ${duration}`);
    }

    const [, value, unit] = match;
    return parseInt(value) * units[unit];
  }
}
