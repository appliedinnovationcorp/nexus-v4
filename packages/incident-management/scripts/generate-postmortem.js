#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const Handlebars = require('handlebars');
const MarkdownIt = require('markdown-it');
const { format } = require('date-fns');

/**
 * Post-Mortem Generator
 * Generates post-mortem documents from incident data using templates
 */
class PostMortemGenerator {
  constructor() {
    this.templatesDir = path.join(__dirname, '../templates');
    this.outputDir = path.join(__dirname, '../reports/postmortems');
    this.md = new MarkdownIt();
    
    // Ensure output directory exists
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }

    // Register Handlebars helpers
    this.registerHandlebarsHelpers();
  }

  /**
   * Generate post-mortem document
   */
  async generatePostMortem(options = {}) {
    const {
      incidentId,
      template = 'standard',
      format: outputFormat = 'markdown',
      data = null
    } = options;

    console.log(`Generating post-mortem for incident ${incidentId}...`);

    // Load incident data (in real implementation, this would come from the incident management system)
    const incidentData = data || this.loadMockIncidentData(incidentId);
    
    // Load template
    const templateContent = this.loadTemplate(template);
    const compiledTemplate = Handlebars.compile(templateContent);
    
    // Generate document
    const document = compiledTemplate(incidentData);
    
    // Save document
    const filename = `postmortem-${incidentId}-${Date.now()}`;
    const outputPath = await this.saveDocument(document, filename, outputFormat);
    
    console.log(`✅ Post-mortem generated: ${outputPath}`);
    
    // Generate action items tracking
    if (incidentData.postmortem.actionItems.length > 0) {
      await this.generateActionItemsReport(incidentData, filename);
    }
    
    return {
      documentPath: outputPath,
      incidentId,
      template,
      format: outputFormat,
      actionItems: incidentData.postmortem.actionItems.length
    };
  }

  /**
   * Generate action items tracking report
   */
  async generateActionItemsReport(incidentData, baseFilename) {
    const actionItems = incidentData.postmortem.actionItems;
    
    const report = {
      postmortemId: incidentData.postmortem.id,
      incidentId: incidentData.incident.id,
      incidentTitle: incidentData.incident.title,
      generatedAt: new Date().toISOString(),
      totalActionItems: actionItems.length,
      byStatus: this.groupBy(actionItems, 'status'),
      byPriority: this.groupBy(actionItems, 'priority'),
      byCategory: this.groupBy(actionItems, 'category'),
      byOwner: this.groupBy(actionItems, 'owner'),
      actionItems: actionItems.map(item => ({
        ...item,
        daysUntilDue: this.calculateDaysUntilDue(item.dueDate),
        isOverdue: new Date(item.dueDate) < new Date(),
        statusIcon: this.getStatusIcon(item.status)
      }))
    };

    // Generate CSV for tracking
    const csvContent = this.generateActionItemsCSV(report.actionItems);
    const csvPath = path.join(this.outputDir, `${baseFilename}-action-items.csv`);
    fs.writeFileSync(csvPath, csvContent);
    
    // Generate JSON for programmatic access
    const jsonPath = path.join(this.outputDir, `${baseFilename}-action-items.json`);
    fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));
    
    console.log(`📋 Action items report generated: ${csvPath}`);
    
    return report;
  }

  /**
   * Generate incident metrics report
   */
  async generateIncidentMetrics(options = {}) {
    const {
      days = 30,
      includePostMortems = true
    } = options;

    console.log(`Generating incident metrics for the last ${days} days...`);

    // Load incident data (mock for demonstration)
    const incidents = this.loadMockIncidentsData(days);
    
    const report = {
      metadata: {
        reportId: `incident-metrics-${Date.now()}`,
        generatedAt: new Date().toISOString(),
        period: {
          days,
          start: new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString(),
          end: new Date().toISOString()
        }
      },
      summary: {
        totalIncidents: incidents.length,
        bySeverity: this.groupBy(incidents, 'severity'),
        byService: this.groupBy(incidents, 'classification.primaryService'),
        averageMTTR: this.calculateAverageMTTR(incidents),
        averageTTA: this.calculateAverageTTA(incidents),
        sloBreaches: incidents.reduce((sum, inc) => sum + inc.sloBreaches.length, 0)
      },
      trends: this.calculateTrends(incidents),
      topIssues: this.identifyTopIssues(incidents),
      recommendations: this.generateRecommendations(incidents)
    };

    // Save report
    const reportPath = path.join(this.outputDir, `incident-metrics-${Date.now()}.json`);
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    
    // Generate human-readable summary
    const summaryPath = await this.generateMetricsSummary(report);
    
    console.log(`📊 Incident metrics report generated: ${reportPath}`);
    console.log(`📄 Summary report generated: ${summaryPath}`);
    
    return report;
  }

  /**
   * Validate post-mortem completeness
   */
  validatePostMortem(postmortemData) {
    const requiredSections = [
      'summary',
      'timeline.events',
      'rootCause.primary',
      'impact',
      'whatWentWell',
      'whatCouldBeImproved',
      'actionItems',
      'lessonsLearned'
    ];

    const validation = {
      isComplete: true,
      missingSections: [],
      warnings: [],
      score: 0
    };

    // Check required sections
    requiredSections.forEach(section => {
      const value = this.getNestedValue(postmortemData, section);
      if (!value || (Array.isArray(value) && value.length === 0)) {
        validation.missingSections.push(section);
        validation.isComplete = false;
      }
    });

    // Check action items quality
    if (postmortemData.actionItems) {
      postmortemData.actionItems.forEach((item, index) => {
        if (!item.owner) {
          validation.warnings.push(`Action item ${index + 1} missing owner`);
        }
        if (!item.dueDate) {
          validation.warnings.push(`Action item ${index + 1} missing due date`);
        }
        if (!item.description || item.description.length < 10) {
          validation.warnings.push(`Action item ${index + 1} needs better description`);
        }
      });
    }

    // Calculate completeness score
    const totalSections = requiredSections.length;
    const completeSections = totalSections - validation.missingSections.length;
    validation.score = Math.round((completeSections / totalSections) * 100);

    return validation;
  }

  // Private helper methods

  loadTemplate(templateName) {
    const templatePath = path.join(this.templatesDir, `postmortem-${templateName}.md`);
    
    if (!fs.existsSync(templatePath)) {
      throw new Error(`Template not found: ${templateName}`);
    }
    
    return fs.readFileSync(templatePath, 'utf8');
  }

  loadMockIncidentData(incidentId) {
    // In a real implementation, this would query the incident management system
    return {
      incident: {
        id: incidentId,
        title: `API Service Degradation - ${incidentId}`,
        description: 'API response times increased significantly causing user impact',
        severity: 'sev2',
        status: 'resolved',
        classification: {
          primaryService: 'nexus-api',
          secondaryServices: ['nexus-database'],
          category: 'performance',
          businessImpact: 'high',
          customerImpact: {
            affected: true,
            userCount: 1500,
            description: 'Users experienced slow page loads and timeouts'
          }
        },
        timeline: {
          detectedAt: new Date(Date.now() - 4 * 60 * 60 * 1000), // 4 hours ago
          acknowledgedAt: new Date(Date.now() - 3.5 * 60 * 60 * 1000),
          investigationStartedAt: new Date(Date.now() - 3.25 * 60 * 60 * 1000),
          identifiedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
          mitigatedAt: new Date(Date.now() - 1.5 * 60 * 60 * 1000),
          resolvedAt: new Date(Date.now() - 1 * 60 * 60 * 1000)
        },
        metrics: {
          timeToDetect: 5,
          timeToAcknowledge: 30,
          timeToMitigate: 150,
          timeToResolve: 180,
          totalDuration: 180
        },
        sloBreaches: ['api-latency-slo', 'api-availability-slo']
      },
      postmortem: {
        id: `pm-${incidentId}`,
        summary: 'Database connection pool exhaustion led to API performance degradation affecting 1,500 users for 3 hours.',
        timeline: {
          events: [
            {
              timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000),
              description: 'Monitoring alerts triggered for increased API response times',
              type: 'detection'
            },
            {
              timestamp: new Date(Date.now() - 3.5 * 60 * 60 * 1000),
              description: 'On-call engineer acknowledged alerts and began investigation',
              type: 'investigation'
            },
            {
              timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
              description: 'Root cause identified as database connection pool exhaustion',
              type: 'investigation'
            },
            {
              timestamp: new Date(Date.now() - 1.5 * 60 * 60 * 1000),
              description: 'Database connection pool size increased and connections recycled',
              type: 'mitigation'
            },
            {
              timestamp: new Date(Date.now() - 1 * 60 * 60 * 1000),
              description: 'API performance returned to normal levels',
              type: 'resolution'
            }
          ]
        },
        impact: {
          duration: 180,
          servicesAffected: ['nexus-api', 'nexus-database'],
          usersAffected: 1500,
          revenueImpact: 5000,
          sloImpact: [
            {
              sloId: 'api-latency-slo',
              budgetConsumed: 25,
              targetMissed: true
            },
            {
              sloId: 'api-availability-slo',
              budgetConsumed: 15,
              targetMissed: false
            }
          ]
        },
        rootCause: {
          primary: 'Database connection pool was configured with insufficient maximum connections for peak load',
          contributing: [
            'Recent traffic increase not accounted for in capacity planning',
            'Connection pool monitoring was not alerting on high utilization',
            'No automatic scaling of connection pool size'
          ],
          detection: 'We detected the issue through API response time alerts, but connection pool monitoring would have provided earlier warning',
          development: 'Traffic gradually increased over the past week, slowly exhausting the connection pool until it reached capacity during peak hours'
        },
        whatWentWell: [
          'Monitoring alerts fired promptly when API performance degraded',
          'On-call engineer responded quickly and followed incident response procedures',
          'Root cause was identified efficiently using database monitoring tools',
          'Mitigation was applied quickly once root cause was identified',
          'Communication to stakeholders was clear and timely'
        ],
        whatCouldBeImproved: [
          'Connection pool monitoring should have alerted before user impact',
          'Capacity planning process needs to account for gradual traffic increases',
          'Database connection pool should auto-scale or have higher default limits',
          'Need better visibility into database resource utilization trends'
        ],
        actionItems: [
          {
            id: 'AI-001',
            description: 'Implement connection pool utilization monitoring with alerts at 80% capacity',
            owner: 'platform-team',
            dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            priority: 'high',
            status: 'open',
            category: 'prevention'
          },
          {
            id: 'AI-002',
            description: 'Review and update database connection pool configuration for all services',
            owner: 'backend-team',
            dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
            priority: 'high',
            status: 'open',
            category: 'prevention'
          },
          {
            id: 'AI-003',
            description: 'Implement automated capacity planning review process',
            owner: 'sre-team',
            dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            priority: 'medium',
            status: 'open',
            category: 'process'
          }
        ],
        lessonsLearned: [
          'Gradual resource exhaustion can be harder to detect than sudden failures',
          'Connection pool monitoring is critical for database-dependent services',
          'Capacity planning must account for organic traffic growth, not just planned increases',
          'Early warning systems prevent user impact better than reactive monitoring'
        ],
        metadata: {
          author: 'sre-engineer',
          reviewers: ['platform-lead', 'backend-lead'],
          createdAt: new Date(),
          publishedAt: new Date()
        }
      }
    };
  }

  loadMockIncidentsData(days) {
    // Generate mock incident data for the specified period
    const incidents = [];
    const severities = ['sev1', 'sev2', 'sev3', 'sev4'];
    const services = ['nexus-api', 'nexus-database', 'secret-management', 'nexus-frontend'];
    
    // Generate 10-20 incidents over the period
    const incidentCount = Math.floor(Math.random() * 10) + 10;
    
    for (let i = 0; i < incidentCount; i++) {
      const severity = severities[Math.floor(Math.random() * severities.length)];
      const service = services[Math.floor(Math.random() * services.length)];
      const detectedAt = new Date(Date.now() - Math.random() * days * 24 * 60 * 60 * 1000);
      const duration = Math.floor(Math.random() * 240) + 15; // 15-255 minutes
      
      incidents.push({
        id: `inc-${i + 1}`,
        severity,
        classification: {
          primaryService: service
        },
        timeline: {
          detectedAt,
          acknowledgedAt: new Date(detectedAt.getTime() + Math.random() * 30 * 60 * 1000),
          resolvedAt: new Date(detectedAt.getTime() + duration * 60 * 1000)
        },
        metrics: {
          timeToAcknowledge: Math.floor(Math.random() * 30) + 5,
          timeToResolve: duration,
          totalDuration: duration
        },
        sloBreaches: Math.random() > 0.7 ? [`${service}-slo`] : []
      });
    }
    
    return incidents.sort((a, b) => b.timeline.detectedAt - a.timeline.detectedAt);
  }

  async saveDocument(content, filename, format) {
    let outputPath;
    
    switch (format) {
      case 'markdown':
        outputPath = path.join(this.outputDir, `${filename}.md`);
        fs.writeFileSync(outputPath, content);
        break;
        
      case 'html':
        const htmlContent = this.md.render(content);
        const htmlTemplate = this.createHTMLTemplate(htmlContent);
        outputPath = path.join(this.outputDir, `${filename}.html`);
        fs.writeFileSync(outputPath, htmlTemplate);
        break;
        
      case 'pdf':
        // Would require additional PDF generation library
        throw new Error('PDF format not yet implemented');
        
      default:
        throw new Error(`Unsupported format: ${format}`);
    }
    
    return outputPath;
  }

  createHTMLTemplate(content) {
    return `
<!DOCTYPE html>
<html>
<head>
    <title>Post-Mortem Report</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; max-width: 800px; margin: 0 auto; padding: 20px; }
        h1, h2, h3 { color: #333; }
        h1 { border-bottom: 2px solid #eee; padding-bottom: 10px; }
        h2 { border-bottom: 1px solid #eee; padding-bottom: 5px; }
        table { border-collapse: collapse; width: 100%; margin: 20px 0; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f5f5f5; }
        code { background-color: #f5f5f5; padding: 2px 4px; border-radius: 3px; }
        pre { background-color: #f5f5f5; padding: 10px; border-radius: 5px; overflow-x: auto; }
        .timeline { background-color: #f9f9f9; padding: 15px; border-left: 4px solid #007bff; margin: 10px 0; }
        .action-item { background-color: #fff3cd; padding: 10px; border-left: 4px solid #ffc107; margin: 5px 0; }
        .lesson { background-color: #d1ecf1; padding: 10px; border-left: 4px solid #17a2b8; margin: 5px 0; }
    </style>
</head>
<body>
    ${content}
</body>
</html>
    `;
  }

  registerHandlebarsHelpers() {
    Handlebars.registerHelper('formatDate', (date, formatStr) => {
      if (!date) return 'N/A';
      return format(new Date(date), formatStr || 'MMM dd, yyyy HH:mm:ss');
    });

    Handlebars.registerHelper('capitalize', (str) => {
      if (!str) return '';
      return str.charAt(0).toUpperCase() + str.slice(1);
    });

    Handlebars.registerHelper('eq', (a, b) => a === b);
    Handlebars.registerHelper('gt', (a, b) => a > b);
    Handlebars.registerHelper('lt', (a, b) => a < b);
  }

  groupBy(array, key) {
    return array.reduce((groups, item) => {
      const value = this.getNestedValue(item, key);
      groups[value] = (groups[value] || 0) + 1;
      return groups;
    }, {});
  }

  getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => current && current[key], obj);
  }

  calculateDaysUntilDue(dueDate) {
    const now = new Date();
    const due = new Date(dueDate);
    const diffTime = due - now;
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  getStatusIcon(status) {
    const icons = {
      'open': '🔴',
      'in_progress': '🟡',
      'completed': '✅',
      'cancelled': '❌'
    };
    return icons[status] || '⚪';
  }

  generateActionItemsCSV(actionItems) {
    const headers = ['ID', 'Description', 'Owner', 'Due Date', 'Priority', 'Status', 'Category', 'Days Until Due', 'Is Overdue'];
    const rows = actionItems.map(item => [
      item.id,
      `"${item.description}"`,
      item.owner,
      format(new Date(item.dueDate), 'yyyy-MM-dd'),
      item.priority,
      item.status,
      item.category,
      item.daysUntilDue,
      item.isOverdue
    ]);
    
    return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
  }

  calculateAverageMTTR(incidents) {
    const validIncidents = incidents.filter(inc => inc.metrics.timeToResolve);
    if (validIncidents.length === 0) return 0;
    
    const totalMTTR = validIncidents.reduce((sum, inc) => sum + inc.metrics.timeToResolve, 0);
    return Math.round(totalMTTR / validIncidents.length);
  }

  calculateAverageTTA(incidents) {
    const validIncidents = incidents.filter(inc => inc.metrics.timeToAcknowledge);
    if (validIncidents.length === 0) return 0;
    
    const totalTTA = validIncidents.reduce((sum, inc) => sum + inc.metrics.timeToAcknowledge, 0);
    return Math.round(totalTTA / validIncidents.length);
  }

  calculateTrends(incidents) {
    // Simple trend calculation - would be more sophisticated in real implementation
    const midpoint = Math.floor(incidents.length / 2);
    const firstHalf = incidents.slice(0, midpoint);
    const secondHalf = incidents.slice(midpoint);
    
    const firstHalfAvgMTTR = this.calculateAverageMTTR(firstHalf);
    const secondHalfAvgMTTR = this.calculateAverageMTTR(secondHalf);
    
    return {
      frequency: firstHalf.length > secondHalf.length ? 'decreasing' : 'increasing',
      mttr: firstHalfAvgMTTR > secondHalfAvgMTTR ? 'improving' : 'degrading',
      severityTrend: {
        sev1: 'stable',
        sev2: 'stable',
        sev3: 'stable',
        sev4: 'stable'
      }
    };
  }

  identifyTopIssues(incidents) {
    const serviceGroups = this.groupBy(incidents, 'classification.primaryService');
    
    return Object.entries(serviceGroups)
      .map(([service, count]) => {
        const serviceIncidents = incidents.filter(inc => inc.classification.primaryService === service);
        const avgMTTR = this.calculateAverageMTTR(serviceIncidents);
        const totalDowntime = serviceIncidents.reduce((sum, inc) => sum + (inc.metrics.totalDuration || 0), 0);
        
        return {
          service,
          incidentCount: count,
          averageMTTR: avgMTTR,
          totalDowntime
        };
      })
      .sort((a, b) => b.incidentCount - a.incidentCount)
      .slice(0, 5);
  }

  generateRecommendations(incidents) {
    const recommendations = [];
    
    // High MTTR recommendation
    const avgMTTR = this.calculateAverageMTTR(incidents);
    if (avgMTTR > 120) {
      recommendations.push({
        type: 'response',
        description: 'Average MTTR is above 2 hours. Consider improving runbooks and automation.',
        priority: 'high',
        estimatedImpact: 'Reduce MTTR by 30-50%'
      });
    }
    
    // Frequent incidents recommendation
    if (incidents.length > 15) {
      recommendations.push({
        type: 'prevention',
        description: 'High incident frequency detected. Focus on root cause analysis and prevention.',
        priority: 'high',
        estimatedImpact: 'Reduce incident frequency by 25%'
      });
    }
    
    return recommendations;
  }

  async generateMetricsSummary(report) {
    const summaryContent = `
# Incident Metrics Summary

**Report Period:** ${format(new Date(report.metadata.period.start), 'MMM dd, yyyy')} - ${format(new Date(report.metadata.period.end), 'MMM dd, yyyy')}
**Generated:** ${format(new Date(report.metadata.generatedAt), 'MMM dd, yyyy HH:mm:ss')}

## Key Metrics

- **Total Incidents:** ${report.summary.totalIncidents}
- **Average MTTR:** ${report.summary.averageMTTR} minutes
- **Average TTA:** ${report.summary.averageTTA} minutes
- **SLO Breaches:** ${report.summary.sloBreaches}

## Incidents by Severity

${Object.entries(report.summary.bySeverity).map(([sev, count]) => `- **${sev.toUpperCase()}:** ${count}`).join('\n')}

## Top Issues

${report.topIssues.map((issue, index) => `${index + 1}. **${issue.service}**: ${issue.incidentCount} incidents, ${issue.averageMTTR}min avg MTTR`).join('\n')}

## Recommendations

${report.recommendations.map((rec, index) => `${index + 1}. **${rec.type.toUpperCase()}**: ${rec.description} (${rec.priority} priority)`).join('\n')}
    `;

    const summaryPath = path.join(this.outputDir, `incident-metrics-summary-${Date.now()}.md`);
    fs.writeFileSync(summaryPath, summaryContent.trim());
    
    return summaryPath;
  }
}

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);
  const command = args[0] || 'generate';
  
  const options = {};
  for (let i = 1; i < args.length; i += 2) {
    const key = args[i].replace(/^--/, '');
    const value = args[i + 1];
    options[key] = value;
  }

  const generator = new PostMortemGenerator();
  
  switch (command) {
    case 'generate':
      if (!options.incidentId) {
        console.error('Error: --incidentId is required');
        process.exit(1);
      }
      generator.generatePostMortem(options).catch(error => {
        console.error('Failed to generate post-mortem:', error);
        process.exit(1);
      });
      break;
      
    case 'metrics':
      generator.generateIncidentMetrics(options).catch(error => {
        console.error('Failed to generate metrics:', error);
        process.exit(1);
      });
      break;
      
    case 'validate':
      if (!options.file) {
        console.error('Error: --file is required');
        process.exit(1);
      }
      // Would validate an existing post-mortem file
      console.log('Validation not yet implemented');
      break;
      
    default:
      console.log('Usage: node generate-postmortem.js [generate|metrics|validate] [options]');
      console.log('');
      console.log('Commands:');
      console.log('  generate --incidentId <id> [--template standard] [--format markdown]');
      console.log('  metrics [--days 30] [--includePostMortems true]');
      console.log('  validate --file <path>');
  }
}

module.exports = PostMortemGenerator;
