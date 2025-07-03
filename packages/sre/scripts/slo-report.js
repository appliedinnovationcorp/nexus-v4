#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const yaml = require('yaml');
const { format, subDays, startOfDay, endOfDay } = require('date-fns');

/**
 * SLO Report Generator
 * Generates comprehensive SLO compliance reports
 */
class SLOReportGenerator {
  constructor() {
    this.configPath = path.join(__dirname, '../configs/slo-definitions.yaml');
    this.outputDir = path.join(__dirname, '../reports');
    
    // Ensure output directory exists
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }

  /**
   * Load SLO configuration
   */
  loadConfig() {
    try {
      const configContent = fs.readFileSync(this.configPath, 'utf8');
      return yaml.parse(configContent);
    } catch (error) {
      console.error('Failed to load SLO configuration:', error.message);
      process.exit(1);
    }
  }

  /**
   * Generate SLO report for a specific period
   */
  async generateReport(options = {}) {
    const {
      days = 30,
      services = null,
      format: outputFormat = 'json',
      output = null
    } = options;

    console.log(`Generating SLO report for the last ${days} days...`);

    const config = this.loadConfig();
    const endDate = endOfDay(new Date());
    const startDate = startOfDay(subDays(endDate, days));

    const report = {
      metadata: {
        reportId: `slo-report-${Date.now()}`,
        generatedAt: new Date().toISOString(),
        period: {
          start: startDate.toISOString(),
          end: endDate.toISOString(),
          days: days
        },
        filters: {
          services: services || 'all'
        }
      },
      summary: {
        totalServices: 0,
        totalSLOs: 0,
        slosMeetingTarget: 0,
        overallCompliance: 0,
        criticalIssues: 0,
        servicesAtRisk: []
      },
      services: [],
      recommendations: []
    };

    // Filter services if specified
    const servicesToProcess = services 
      ? config.services.filter(service => services.includes(service.name))
      : config.services;

    report.summary.totalServices = servicesToProcess.length;

    for (const service of servicesToProcess) {
      console.log(`Processing service: ${service.name}`);
      
      const serviceReport = await this.processService(service, startDate, endDate);
      report.services.push(serviceReport);
      
      // Update summary
      report.summary.totalSLOs += serviceReport.slos.length;
      report.summary.slosMeetingTarget += serviceReport.slos.filter(slo => slo.targetMet).length;
      
      if (serviceReport.status === 'at-risk' || serviceReport.status === 'critical') {
        report.summary.servicesAtRisk.push(service.name);
      }
      
      if (serviceReport.status === 'critical') {
        report.summary.criticalIssues++;
      }
    }

    // Calculate overall compliance
    report.summary.overallCompliance = report.summary.totalSLOs > 0
      ? (report.summary.slosMeetingTarget / report.summary.totalSLOs) * 100
      : 100;

    // Generate recommendations
    report.recommendations = this.generateRecommendations(report);

    // Output report
    await this.outputReport(report, outputFormat, output);
    
    console.log('\n📊 SLO Report Summary:');
    console.log(`   Overall Compliance: ${report.summary.overallCompliance.toFixed(2)}%`);
    console.log(`   SLOs Meeting Target: ${report.summary.slosMeetingTarget}/${report.summary.totalSLOs}`);
    console.log(`   Services at Risk: ${report.summary.servicesAtRisk.length}`);
    console.log(`   Critical Issues: ${report.summary.criticalIssues}`);

    return report;
  }

  /**
   * Process a single service
   */
  async processService(service, startDate, endDate) {
    const serviceReport = {
      name: service.name,
      tier: service.tier,
      owner: service.owner,
      description: service.description,
      status: 'healthy',
      slos: [],
      errorBudgets: [],
      alerts: [],
      metrics: {
        totalRequests: 0,
        errorRate: 0,
        averageLatency: 0,
        availability: 0
      }
    };

    for (const slo of service.slos) {
      const sloReport = await this.processSLO(slo, startDate, endDate);
      serviceReport.slos.push(sloReport);
      
      // Calculate error budget
      const errorBudget = this.calculateErrorBudget(slo, sloReport);
      serviceReport.errorBudgets.push(errorBudget);
    }

    // Determine service status
    serviceReport.status = this.determineServiceStatus(serviceReport);
    
    // Simulate some metrics (in real implementation, these would come from monitoring)
    serviceReport.metrics = this.simulateMetrics(service);

    return serviceReport;
  }

  /**
   * Process a single SLO
   */
  async processSLO(slo, startDate, endDate) {
    // In a real implementation, this would query the monitoring system
    // For now, we'll simulate the data based on service tier
    const actualValue = this.simulateSLIValue(slo);
    
    return {
      id: slo.id,
      name: slo.name,
      type: slo.sli.type,
      target: slo.target,
      actualValue: actualValue,
      targetMet: actualValue >= slo.target,
      timeWindow: slo.timeWindow,
      trend: this.calculateTrend(slo, actualValue),
      incidents: this.getIncidentsForSLO(slo, startDate, endDate)
    };
  }

  /**
   * Calculate error budget for an SLO
   */
  calculateErrorBudget(slo, sloReport) {
    const allowedErrorRate = (100 - slo.target) / 100;
    const actualErrorRate = (100 - sloReport.actualValue) / 100;
    
    // Estimate total requests based on service tier
    const totalRequests = this.estimateTotalRequests(slo);
    const allowedErrors = Math.floor(totalRequests * allowedErrorRate);
    const actualErrors = Math.floor(totalRequests * actualErrorRate);
    
    const remainingBudget = Math.max(0, allowedErrors - actualErrors);
    const consumptionPercentage = allowedErrors > 0 
      ? Math.min(100, (actualErrors / allowedErrors) * 100)
      : 0;

    const burnRate = this.calculateBurnRate(actualErrorRate, allowedErrorRate);
    
    return {
      sloId: slo.id,
      totalAllowed: allowedErrors,
      consumed: actualErrors,
      remaining: remainingBudget,
      consumptionPercentage: consumptionPercentage,
      burnRate: burnRate,
      status: this.determineBudgetStatus(consumptionPercentage, burnRate),
      timeToExhaustion: this.calculateTimeToExhaustion(remainingBudget, burnRate)
    };
  }

  /**
   * Simulate SLI value based on service tier and type
   */
  simulateSLIValue(slo) {
    const baseValues = {
      'tier-0': { availability: 99.95, latency: 95, error_rate: 0.05, quality: 90 },
      'tier-1': { availability: 99.9, latency: 90, error_rate: 0.1, quality: 85 },
      'tier-2': { availability: 99.5, latency: 85, error_rate: 0.5, quality: 80 },
      'tier-3': { availability: 99.0, latency: 80, error_rate: 1.0, quality: 75 }
    };
    
    const baseValue = baseValues[slo.tier][slo.sli.type] || 95;
    
    // Add some random variation
    const variation = (Math.random() - 0.5) * 4; // -2 to +2
    return Math.max(0, Math.min(100, baseValue + variation));
  }

  /**
   * Calculate trend for SLO
   */
  calculateTrend(slo, currentValue) {
    // Simulate trend calculation
    const previousValue = currentValue + (Math.random() - 0.5) * 2;
    const change = currentValue - previousValue;
    
    if (Math.abs(change) < 0.1) return 'stable';
    return change > 0 ? 'improving' : 'degrading';
  }

  /**
   * Get incidents for SLO (simulated)
   */
  getIncidentsForSLO(slo, startDate, endDate) {
    // Simulate incidents based on service tier
    const incidentProbability = {
      'tier-0': 0.1,
      'tier-1': 0.2,
      'tier-2': 0.3,
      'tier-3': 0.4
    };
    
    const incidents = [];
    if (Math.random() < incidentProbability[slo.tier]) {
      incidents.push({
        id: `incident-${Date.now()}`,
        title: `${slo.name} degradation`,
        severity: 'medium',
        startTime: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
        duration: Math.floor(Math.random() * 120) + 15, // 15-135 minutes
        impact: `${slo.sli.type} performance degraded`
      });
    }
    
    return incidents;
  }

  /**
   * Estimate total requests for error budget calculation
   */
  estimateTotalRequests(slo) {
    const requestsPerDay = {
      'tier-0': 1000000,
      'tier-1': 100000,
      'tier-2': 10000,
      'tier-3': 1000
    };
    
    const timeWindowDays = {
      '1h': 1/24,
      '6h': 6/24,
      '24h': 1,
      '7d': 7,
      '30d': 30,
      '90d': 90
    };
    
    return requestsPerDay[slo.tier] * timeWindowDays[slo.timeWindow];
  }

  /**
   * Calculate burn rate
   */
  calculateBurnRate(actualErrorRate, allowedErrorRate) {
    if (allowedErrorRate === 0) return 0;
    return actualErrorRate / allowedErrorRate;
  }

  /**
   * Determine budget status
   */
  determineBudgetStatus(consumptionPercentage, burnRate) {
    if (consumptionPercentage >= 100) return 'exhausted';
    if (consumptionPercentage >= 90 || burnRate > 10) return 'critical';
    if (consumptionPercentage >= 75 || burnRate > 5) return 'warning';
    return 'healthy';
  }

  /**
   * Calculate time to exhaustion
   */
  calculateTimeToExhaustion(remainingBudget, burnRate) {
    if (burnRate <= 1 || remainingBudget <= 0) return null;
    
    const hoursToExhaustion = remainingBudget / (burnRate - 1) / 24;
    
    if (hoursToExhaustion < 24) {
      return `${Math.floor(hoursToExhaustion)} hours`;
    } else {
      return `${Math.floor(hoursToExhaustion / 24)} days`;
    }
  }

  /**
   * Determine service status
   */
  determineServiceStatus(serviceReport) {
    const criticalBudgets = serviceReport.errorBudgets.filter(b => b.status === 'critical' || b.status === 'exhausted');
    const warningBudgets = serviceReport.errorBudgets.filter(b => b.status === 'warning');
    const failingSLOs = serviceReport.slos.filter(s => !s.targetMet);
    
    if (criticalBudgets.length > 0 || failingSLOs.length > serviceReport.slos.length / 2) {
      return 'critical';
    } else if (warningBudgets.length > 0 || failingSLOs.length > 0) {
      return 'at-risk';
    } else {
      return 'healthy';
    }
  }

  /**
   * Simulate metrics for a service
   */
  simulateMetrics(service) {
    const baseMetrics = {
      'tier-0': { requests: 1000000, errorRate: 0.05, latency: 150, availability: 99.95 },
      'tier-1': { requests: 100000, errorRate: 0.1, latency: 200, availability: 99.9 },
      'tier-2': { requests: 10000, errorRate: 0.5, latency: 300, availability: 99.5 },
      'tier-3': { requests: 1000, errorRate: 1.0, latency: 500, availability: 99.0 }
    };
    
    const base = baseMetrics[service.tier];
    
    return {
      totalRequests: base.requests + Math.floor(Math.random() * base.requests * 0.2),
      errorRate: base.errorRate + (Math.random() - 0.5) * base.errorRate * 0.5,
      averageLatency: base.latency + Math.floor((Math.random() - 0.5) * base.latency * 0.3),
      availability: base.availability + (Math.random() - 0.5) * 0.1
    };
  }

  /**
   * Generate recommendations based on report data
   */
  generateRecommendations(report) {
    const recommendations = [];
    
    // Overall compliance recommendations
    if (report.summary.overallCompliance < 95) {
      recommendations.push({
        type: 'critical',
        category: 'compliance',
        title: 'Low Overall SLO Compliance',
        description: `Overall compliance is ${report.summary.overallCompliance.toFixed(2)}%, which is below the recommended 95% threshold.`,
        actions: [
          'Review failing SLOs and identify root causes',
          'Consider adjusting SLO targets if they are unrealistic',
          'Implement additional monitoring and alerting',
          'Increase engineering focus on reliability'
        ]
      });
    }

    // Service-specific recommendations
    report.services.forEach(service => {
      if (service.status === 'critical') {
        recommendations.push({
          type: 'critical',
          category: 'service',
          title: `Critical Issues in ${service.name}`,
          description: `Service ${service.name} has critical SLO violations or exhausted error budgets.`,
          actions: [
            'Immediate investigation required',
            'Consider implementing circuit breakers',
            'Review recent deployments and changes',
            'Scale resources if needed'
          ]
        });
      }

      // Error budget recommendations
      service.errorBudgets.forEach(budget => {
        if (budget.status === 'critical' && budget.timeToExhaustion) {
          recommendations.push({
            type: 'warning',
            category: 'error-budget',
            title: `Error Budget Exhaustion Risk for ${service.name}`,
            description: `Error budget for SLO ${budget.sloId} will be exhausted in ${budget.timeToExhaustion}.`,
            actions: [
              'Reduce deployment frequency',
              'Focus on bug fixes over new features',
              'Implement additional testing',
              'Consider rolling back recent changes'
            ]
          });
        }
      });
    });

    // Tier-based recommendations
    const tier0Services = report.services.filter(s => s.tier === 'tier-0');
    const tier0AtRisk = tier0Services.filter(s => s.status !== 'healthy');
    
    if (tier0AtRisk.length > 0) {
      recommendations.push({
        type: 'critical',
        category: 'tier-0',
        title: 'Critical Services at Risk',
        description: `${tier0AtRisk.length} Tier-0 (critical) services are not meeting SLO targets.`,
        actions: [
          'Prioritize Tier-0 service reliability',
          'Implement additional redundancy',
          'Review disaster recovery procedures',
          'Consider emergency response protocols'
        ]
      });
    }

    return recommendations;
  }

  /**
   * Output report in specified format
   */
  async outputReport(report, format, outputPath) {
    const timestamp = format(new Date(), 'yyyy-MM-dd-HHmm');
    const defaultPath = path.join(this.outputDir, `slo-report-${timestamp}.${format}`);
    const filePath = outputPath || defaultPath;

    switch (format) {
      case 'json':
        fs.writeFileSync(filePath, JSON.stringify(report, null, 2));
        break;
      
      case 'yaml':
        fs.writeFileSync(filePath, yaml.stringify(report));
        break;
      
      case 'html':
        const htmlReport = this.generateHTMLReport(report);
        fs.writeFileSync(filePath, htmlReport);
        break;
      
      case 'csv':
        const csvReport = this.generateCSVReport(report);
        fs.writeFileSync(filePath, csvReport);
        break;
      
      default:
        throw new Error(`Unsupported format: ${format}`);
    }

    console.log(`\n📄 Report saved to: ${filePath}`);
  }

  /**
   * Generate HTML report
   */
  generateHTMLReport(report) {
    return `
<!DOCTYPE html>
<html>
<head>
    <title>SLO Report - ${format(new Date(report.metadata.generatedAt), 'yyyy-MM-dd')}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background: #f5f5f5; padding: 20px; border-radius: 5px; }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin: 20px 0; }
        .metric { background: white; border: 1px solid #ddd; padding: 15px; border-radius: 5px; text-align: center; }
        .metric h3 { margin: 0 0 10px 0; color: #333; }
        .metric .value { font-size: 2em; font-weight: bold; }
        .healthy { color: #28a745; }
        .warning { color: #ffc107; }
        .critical { color: #dc3545; }
        .service { margin: 20px 0; padding: 15px; border: 1px solid #ddd; border-radius: 5px; }
        .slo-table { width: 100%; border-collapse: collapse; margin: 10px 0; }
        .slo-table th, .slo-table td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        .slo-table th { background: #f5f5f5; }
        .recommendations { margin: 20px 0; }
        .recommendation { margin: 10px 0; padding: 15px; border-left: 4px solid #007bff; background: #f8f9fa; }
        .recommendation.critical { border-left-color: #dc3545; }
        .recommendation.warning { border-left-color: #ffc107; }
    </style>
</head>
<body>
    <div class="header">
        <h1>SLO Compliance Report</h1>
        <p><strong>Period:</strong> ${format(new Date(report.metadata.period.start), 'yyyy-MM-dd')} to ${format(new Date(report.metadata.period.end), 'yyyy-MM-dd')}</p>
        <p><strong>Generated:</strong> ${format(new Date(report.metadata.generatedAt), 'yyyy-MM-dd HH:mm:ss')}</p>
    </div>

    <div class="summary">
        <div class="metric">
            <h3>Overall Compliance</h3>
            <div class="value ${report.summary.overallCompliance >= 99 ? 'healthy' : report.summary.overallCompliance >= 95 ? 'warning' : 'critical'}">${report.summary.overallCompliance.toFixed(1)}%</div>
        </div>
        <div class="metric">
            <h3>SLOs Meeting Target</h3>
            <div class="value">${report.summary.slosMeetingTarget}/${report.summary.totalSLOs}</div>
        </div>
        <div class="metric">
            <h3>Services at Risk</h3>
            <div class="value ${report.summary.servicesAtRisk.length === 0 ? 'healthy' : 'warning'}">${report.summary.servicesAtRisk.length}</div>
        </div>
        <div class="metric">
            <h3>Critical Issues</h3>
            <div class="value ${report.summary.criticalIssues === 0 ? 'healthy' : 'critical'}">${report.summary.criticalIssues}</div>
        </div>
    </div>

    <h2>Services</h2>
    ${report.services.map(service => `
        <div class="service">
            <h3>${service.name} (${service.tier.toUpperCase()}) - <span class="${service.status}">${service.status.toUpperCase()}</span></h3>
            <p><strong>Owner:</strong> ${service.owner}</p>
            <p>${service.description}</p>
            
            <h4>SLOs</h4>
            <table class="slo-table">
                <thead>
                    <tr>
                        <th>SLO</th>
                        <th>Type</th>
                        <th>Target</th>
                        <th>Actual</th>
                        <th>Status</th>
                        <th>Trend</th>
                    </tr>
                </thead>
                <tbody>
                    ${service.slos.map(slo => `
                        <tr>
                            <td>${slo.name}</td>
                            <td>${slo.type}</td>
                            <td>${slo.target}%</td>
                            <td>${slo.actualValue.toFixed(2)}%</td>
                            <td class="${slo.targetMet ? 'healthy' : 'critical'}">${slo.targetMet ? 'PASS' : 'FAIL'}</td>
                            <td>${slo.trend}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `).join('')}

    <div class="recommendations">
        <h2>Recommendations</h2>
        ${report.recommendations.map(rec => `
            <div class="recommendation ${rec.type}">
                <h4>${rec.title}</h4>
                <p>${rec.description}</p>
                <ul>
                    ${rec.actions.map(action => `<li>${action}</li>`).join('')}
                </ul>
            </div>
        `).join('')}
    </div>
</body>
</html>
    `;
  }

  /**
   * Generate CSV report
   */
  generateCSVReport(report) {
    const headers = [
      'Service',
      'Tier',
      'Owner',
      'SLO Name',
      'SLO Type',
      'Target',
      'Actual',
      'Target Met',
      'Error Budget Remaining',
      'Budget Consumption %',
      'Burn Rate',
      'Status'
    ];

    const rows = [];
    report.services.forEach(service => {
      service.slos.forEach((slo, index) => {
        const budget = service.errorBudgets[index];
        rows.push([
          service.name,
          service.tier,
          service.owner,
          slo.name,
          slo.type,
          slo.target,
          slo.actualValue.toFixed(2),
          slo.targetMet ? 'Yes' : 'No',
          budget.remaining,
          budget.consumptionPercentage.toFixed(2),
          budget.burnRate.toFixed(2),
          budget.status
        ]);
      });
    });

    return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
  }
}

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);
  const options = {};

  for (let i = 0; i < args.length; i += 2) {
    const key = args[i].replace(/^--/, '');
    const value = args[i + 1];
    
    if (key === 'services') {
      options[key] = value.split(',');
    } else if (key === 'days') {
      options[key] = parseInt(value);
    } else {
      options[key] = value;
    }
  }

  const generator = new SLOReportGenerator();
  generator.generateReport(options).catch(error => {
    console.error('Failed to generate report:', error);
    process.exit(1);
  });
}

module.exports = SLOReportGenerator;
