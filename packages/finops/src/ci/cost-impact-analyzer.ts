import { CostEstimationEngine } from '../core/cost-estimation';
import { ResourceTaggingManager } from '../core/tagging';
import { FinOpsConfig } from '../types';
import { AnalyticsTracker } from '@nexus/analytics';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as yaml from 'js-yaml';

interface TerraformPlan {
  resource_changes: Array<{
    address: string;
    mode: string;
    type: string;
    name: string;
    change: {
      actions: string[];
      before: any;
      after: any;
    };
  }>;
  configuration: {
    root_module: {
      resources: Array<{
        address: string;
        type: string;
        name: string;
        expressions: Record<string, any>;
      }>;
    };
  };
}

interface CloudFormationTemplate {
  Resources: Record<string, {
    Type: string;
    Properties: Record<string, any>;
  }>;
}

interface CostImpactReport {
  summary: {
    totalChanges: number;
    costImpact: number;
    percentageChange: number;
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    estimatedMonthlyCost: number;
  };
  breakdown: {
    newResources: Array<{
      type: string;
      name: string;
      monthlyCost: number;
      confidence: string;
    }>;
    modifiedResources: Array<{
      type: string;
      name: string;
      currentCost: number;
      newCost: number;
      costDifference: number;
    }>;
    deletedResources: Array<{
      type: string;
      name: string;
      savedCost: number;
    }>;
  };
  tagging: {
    compliantResources: number;
    nonCompliantResources: number;
    missingTags: string[];
    tagViolations: Array<{
      resource: string;
      violations: string[];
    }>;
  };
  recommendations: string[];
  warnings: string[];
  metadata: {
    generatedAt: string;
    analysisVersion: string;
    pullRequestId?: string;
    branch?: string;
    commit?: string;
  };
}

export class CostImpactAnalyzer {
  private costEngine: CostEstimationEngine;
  private taggingManager: ResourceTaggingManager;
  private analytics: AnalyticsTracker;
  private config: FinOpsConfig;

  constructor(config: FinOpsConfig) {
    this.config = config;
    this.costEngine = new CostEstimationEngine(config);
    this.taggingManager = new ResourceTaggingManager(config);
    this.analytics = new AnalyticsTracker();
  }

  /**
   * Analyze Terraform plan for cost impact
   */
  async analyzeTerraformPlan(
    planFilePath: string,
    options?: {
      pullRequestId?: string;
      branch?: string;
      commit?: string;
    }
  ): Promise<CostImpactReport> {
    try {
      const planContent = await fs.readFile(planFilePath, 'utf-8');
      const plan: TerraformPlan = JSON.parse(planContent);

      const changes = this.extractTerraformChanges(plan);
      const costEstimation = await this.costEngine.estimateInfrastructureChanges(changes);
      const taggingAnalysis = await this.analyzeResourceTagging(plan);

      const report: CostImpactReport = {
        summary: {
          totalChanges: changes.length,
          costImpact: costEstimation.costDifference,
          percentageChange: costEstimation.percentageChange,
          riskLevel: this.calculateRiskLevel(costEstimation.costDifference, costEstimation.percentageChange),
          estimatedMonthlyCost: costEstimation.totalNewCost,
        },
        breakdown: {
          newResources: costEstimation.breakdown
            .filter(item => item.change.type === 'CREATE')
            .map(item => ({
              type: item.change.resourceType,
              name: item.change.resourceId || 'unknown',
              monthlyCost: item.newCost,
              confidence: item.estimate.confidence,
            })),
          modifiedResources: costEstimation.breakdown
            .filter(item => item.change.type === 'UPDATE')
            .map(item => ({
              type: item.change.resourceType,
              name: item.change.resourceId || 'unknown',
              currentCost: item.currentCost,
              newCost: item.newCost,
              costDifference: item.costDifference,
            })),
          deletedResources: costEstimation.breakdown
            .filter(item => item.change.type === 'DELETE')
            .map(item => ({
              type: item.change.resourceType,
              name: item.change.resourceId || 'unknown',
              savedCost: Math.abs(item.costDifference),
            })),
        },
        tagging: taggingAnalysis,
        recommendations: this.generateRecommendations(costEstimation.breakdown, taggingAnalysis),
        warnings: this.generateWarnings(costEstimation.breakdown, taggingAnalysis),
        metadata: {
          generatedAt: new Date().toISOString(),
          analysisVersion: '1.0.0',
          pullRequestId: options?.pullRequestId,
          branch: options?.branch,
          commit: options?.commit,
        },
      };

      await this.analytics.track('finops.ci.terraform_analyzed', {
        totalChanges: changes.length,
        costImpact: costEstimation.costDifference,
        riskLevel: report.summary.riskLevel,
        pullRequestId: options?.pullRequestId,
      });

      return report;
    } catch (error) {
      await this.analytics.track('finops.ci.terraform_analysis_error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        planFilePath,
      });
      throw error;
    }
  }

  /**
   * Analyze CloudFormation template for cost impact
   */
  async analyzeCloudFormationTemplate(
    templatePath: string,
    options?: {
      pullRequestId?: string;
      branch?: string;
      commit?: string;
    }
  ): Promise<CostImpactReport> {
    try {
      const templateContent = await fs.readFile(templatePath, 'utf-8');
      let template: CloudFormationTemplate;

      if (templatePath.endsWith('.yaml') || templatePath.endsWith('.yml')) {
        template = yaml.load(templateContent) as CloudFormationTemplate;
      } else {
        template = JSON.parse(templateContent);
      }

      const changes = this.extractCloudFormationChanges(template);
      const costEstimation = await this.costEngine.estimateInfrastructureChanges(changes);
      const taggingAnalysis = await this.analyzeCloudFormationTagging(template);

      const report: CostImpactReport = {
        summary: {
          totalChanges: changes.length,
          costImpact: costEstimation.costDifference,
          percentageChange: costEstimation.percentageChange,
          riskLevel: this.calculateRiskLevel(costEstimation.costDifference, costEstimation.percentageChange),
          estimatedMonthlyCost: costEstimation.totalNewCost,
        },
        breakdown: {
          newResources: costEstimation.breakdown.map(item => ({
            type: item.change.resourceType,
            name: item.change.resourceId || 'unknown',
            monthlyCost: item.newCost,
            confidence: item.estimate.confidence,
          })),
          modifiedResources: [],
          deletedResources: [],
        },
        tagging: taggingAnalysis,
        recommendations: this.generateRecommendations(costEstimation.breakdown, taggingAnalysis),
        warnings: this.generateWarnings(costEstimation.breakdown, taggingAnalysis),
        metadata: {
          generatedAt: new Date().toISOString(),
          analysisVersion: '1.0.0',
          pullRequestId: options?.pullRequestId,
          branch: options?.branch,
          commit: options?.commit,
        },
      };

      await this.analytics.track('finops.ci.cloudformation_analyzed', {
        totalChanges: changes.length,
        costImpact: costEstimation.costDifference,
        riskLevel: report.summary.riskLevel,
        pullRequestId: options?.pullRequestId,
      });

      return report;
    } catch (error) {
      await this.analytics.track('finops.ci.cloudformation_analysis_error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        templatePath,
      });
      throw error;
    }
  }

  /**
   * Generate cost impact comment for pull requests
   */
  generatePullRequestComment(report: CostImpactReport): string {
    const { summary, breakdown, tagging, recommendations, warnings } = report;

    let comment = '## 💰 Cost Impact Analysis\n\n';

    // Summary section
    comment += '### Summary\n';
    comment += `- **Total Changes**: ${summary.totalChanges}\n`;
    comment += `- **Monthly Cost Impact**: ${summary.costImpact >= 0 ? '+' : ''}$${summary.costImpact.toFixed(2)}\n`;
    comment += `- **Percentage Change**: ${summary.percentageChange >= 0 ? '+' : ''}${summary.percentageChange.toFixed(1)}%\n`;
    comment += `- **Risk Level**: ${this.getRiskEmoji(summary.riskLevel)} ${summary.riskLevel}\n`;
    comment += `- **Estimated Monthly Cost**: $${summary.estimatedMonthlyCost.toFixed(2)}\n\n`;

    // Resource breakdown
    if (breakdown.newResources.length > 0) {
      comment += '### 🆕 New Resources\n';
      comment += '| Resource | Type | Monthly Cost | Confidence |\n';
      comment += '|----------|------|--------------|------------|\n';
      for (const resource of breakdown.newResources) {
        comment += `| ${resource.name} | ${resource.type} | $${resource.monthlyCost.toFixed(2)} | ${resource.confidence} |\n`;
      }
      comment += '\n';
    }

    if (breakdown.modifiedResources.length > 0) {
      comment += '### 🔄 Modified Resources\n';
      comment += '| Resource | Type | Current | New | Difference |\n';
      comment += '|----------|------|---------|-----|------------|\n';
      for (const resource of breakdown.modifiedResources) {
        const diff = resource.costDifference >= 0 ? '+' : '';
        comment += `| ${resource.name} | ${resource.type} | $${resource.currentCost.toFixed(2)} | $${resource.newCost.toFixed(2)} | ${diff}$${resource.costDifference.toFixed(2)} |\n`;
      }
      comment += '\n';
    }

    if (breakdown.deletedResources.length > 0) {
      comment += '### 🗑️ Deleted Resources\n';
      comment += '| Resource | Type | Monthly Savings |\n';
      comment += '|----------|------|----------------|\n';
      for (const resource of breakdown.deletedResources) {
        comment += `| ${resource.name} | ${resource.type} | $${resource.savedCost.toFixed(2)} |\n`;
      }
      comment += '\n';
    }

    // Tagging compliance
    comment += '### 🏷️ Tagging Compliance\n';
    comment += `- **Compliant Resources**: ${tagging.compliantResources}\n`;
    comment += `- **Non-Compliant Resources**: ${tagging.nonCompliantResources}\n`;
    if (tagging.missingTags.length > 0) {
      comment += `- **Most Common Missing Tags**: ${tagging.missingTags.slice(0, 3).join(', ')}\n`;
    }
    comment += '\n';

    // Recommendations
    if (recommendations.length > 0) {
      comment += '### 💡 Recommendations\n';
      for (const recommendation of recommendations) {
        comment += `- ${recommendation}\n`;
      }
      comment += '\n';
    }

    // Warnings
    if (warnings.length > 0) {
      comment += '### ⚠️ Warnings\n';
      for (const warning of warnings) {
        comment += `- ${warning}\n`;
      }
      comment += '\n';
    }

    comment += `---\n*Analysis generated at ${report.metadata.generatedAt}*`;

    return comment;
  }

  /**
   * Generate cost impact report for CI/CD pipeline
   */
  async generateCIReport(
    infrastructureFiles: string[],
    outputPath: string,
    options?: {
      pullRequestId?: string;
      branch?: string;
      commit?: string;
      format?: 'json' | 'markdown' | 'html';
    }
  ): Promise<void> {
    try {
      const reports: CostImpactReport[] = [];

      for (const filePath of infrastructureFiles) {
        if (filePath.includes('terraform') && filePath.endsWith('.json')) {
          const report = await this.analyzeTerraformPlan(filePath, options);
          reports.push(report);
        } else if (filePath.endsWith('.yaml') || filePath.endsWith('.yml') || filePath.endsWith('.json')) {
          const report = await this.analyzeCloudFormationTemplate(filePath, options);
          reports.push(report);
        }
      }

      // Combine reports
      const combinedReport = this.combineReports(reports);

      // Generate output based on format
      const format = options?.format || 'json';
      let output: string;

      switch (format) {
        case 'markdown':
          output = this.generatePullRequestComment(combinedReport);
          break;
        case 'html':
          output = this.generateHTMLReport(combinedReport);
          break;
        default:
          output = JSON.stringify(combinedReport, null, 2);
      }

      await fs.writeFile(outputPath, output, 'utf-8');

      await this.analytics.track('finops.ci.report_generated', {
        fileCount: infrastructureFiles.length,
        format,
        totalCostImpact: combinedReport.summary.costImpact,
        riskLevel: combinedReport.summary.riskLevel,
      });
    } catch (error) {
      await this.analytics.track('finops.ci.report_generation_error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        fileCount: infrastructureFiles.length,
      });
      throw error;
    }
  }

  /**
   * Private helper methods
   */
  private extractTerraformChanges(plan: TerraformPlan): Array<{
    type: 'CREATE' | 'UPDATE' | 'DELETE';
    resourceType: string;
    resourceId?: string;
    configuration: Record<string, any>;
    region: string;
  }> {
    const changes: Array<{
      type: 'CREATE' | 'UPDATE' | 'DELETE';
      resourceType: string;
      resourceId?: string;
      configuration: Record<string, any>;
      region: string;
    }> = [];

    for (const resourceChange of plan.resource_changes) {
      const actions = resourceChange.change.actions;
      let changeType: 'CREATE' | 'UPDATE' | 'DELETE';

      if (actions.includes('create')) {
        changeType = 'CREATE';
      } else if (actions.includes('update')) {
        changeType = 'UPDATE';
      } else if (actions.includes('delete')) {
        changeType = 'DELETE';
      } else {
        continue; // Skip no-op changes
      }

      const awsResourceType = this.mapTerraformToAWSType(resourceChange.type);
      const configuration = resourceChange.change.after || resourceChange.change.before || {};
      const region = configuration.region || this.config.aws.region;

      changes.push({
        type: changeType,
        resourceType: awsResourceType,
        resourceId: resourceChange.address,
        configuration,
        region,
      });
    }

    return changes;
  }

  private extractCloudFormationChanges(template: CloudFormationTemplate): Array<{
    type: 'CREATE' | 'UPDATE' | 'DELETE';
    resourceType: string;
    resourceId?: string;
    configuration: Record<string, any>;
    region: string;
  }> {
    const changes: Array<{
      type: 'CREATE' | 'UPDATE' | 'DELETE';
      resourceType: string;
      resourceId?: string;
      configuration: Record<string, any>;
      region: string;
    }> = [];

    for (const [resourceName, resource] of Object.entries(template.Resources)) {
      changes.push({
        type: 'CREATE', // CloudFormation templates represent new resources
        resourceType: resource.Type,
        resourceId: resourceName,
        configuration: resource.Properties,
        region: this.config.aws.region,
      });
    }

    return changes;
  }

  private async analyzeResourceTagging(plan: TerraformPlan): Promise<{
    compliantResources: number;
    nonCompliantResources: number;
    missingTags: string[];
    tagViolations: Array<{
      resource: string;
      violations: string[];
    }>;
  }> {
    let compliantResources = 0;
    let nonCompliantResources = 0;
    const missingTagsCount: Record<string, number> = {};
    const tagViolations: Array<{
      resource: string;
      violations: string[];
    }> = [];

    for (const resourceChange of plan.resource_changes) {
      const tags = resourceChange.change.after?.tags || {};
      const validation = await this.taggingManager.validateResourceTags('', tags);

      if (validation.isValid) {
        compliantResources++;
      } else {
        nonCompliantResources++;
        
        // Track missing tags
        for (const missingTag of validation.missingRequiredTags) {
          missingTagsCount[missingTag] = (missingTagsCount[missingTag] || 0) + 1;
        }

        // Track violations
        if (validation.errors.length > 0 || validation.missingRequiredTags.length > 0) {
          tagViolations.push({
            resource: resourceChange.address,
            violations: [...validation.errors, ...validation.missingRequiredTags.map(tag => `Missing required tag: ${tag}`)],
          });
        }
      }
    }

    // Get most common missing tags
    const missingTags = Object.entries(missingTagsCount)
      .sort(([, a], [, b]) => b - a)
      .map(([tag]) => tag);

    return {
      compliantResources,
      nonCompliantResources,
      missingTags,
      tagViolations,
    };
  }

  private async analyzeCloudFormationTagging(template: CloudFormationTemplate): Promise<{
    compliantResources: number;
    nonCompliantResources: number;
    missingTags: string[];
    tagViolations: Array<{
      resource: string;
      violations: string[];
    }>;
  }> {
    let compliantResources = 0;
    let nonCompliantResources = 0;
    const missingTagsCount: Record<string, number> = {};
    const tagViolations: Array<{
      resource: string;
      violations: string[];
    }> = [];

    for (const [resourceName, resource] of Object.entries(template.Resources)) {
      const tags = resource.Properties.Tags || [];
      const tagObject: Record<string, string> = {};

      // Convert CloudFormation tag format to object
      if (Array.isArray(tags)) {
        for (const tag of tags) {
          if (tag.Key && tag.Value) {
            tagObject[tag.Key] = tag.Value;
          }
        }
      }

      const validation = await this.taggingManager.validateResourceTags('', tagObject);

      if (validation.isValid) {
        compliantResources++;
      } else {
        nonCompliantResources++;
        
        // Track missing tags
        for (const missingTag of validation.missingRequiredTags) {
          missingTagsCount[missingTag] = (missingTagsCount[missingTag] || 0) + 1;
        }

        // Track violations
        if (validation.errors.length > 0 || validation.missingRequiredTags.length > 0) {
          tagViolations.push({
            resource: resourceName,
            violations: [...validation.errors, ...validation.missingRequiredTags.map(tag => `Missing required tag: ${tag}`)],
          });
        }
      }
    }

    // Get most common missing tags
    const missingTags = Object.entries(missingTagsCount)
      .sort(([, a], [, b]) => b - a)
      .map(([tag]) => tag);

    return {
      compliantResources,
      nonCompliantResources,
      missingTags,
      tagViolations,
    };
  }

  private mapTerraformToAWSType(terraformType: string): string {
    const mapping: Record<string, string> = {
      'aws_instance': 'AWS::EC2::Instance',
      'aws_db_instance': 'AWS::RDS::DBInstance',
      'aws_lambda_function': 'AWS::Lambda::Function',
      'aws_s3_bucket': 'AWS::S3::Bucket',
      'aws_ecs_service': 'AWS::ECS::Service',
      'aws_eks_cluster': 'AWS::EKS::Cluster',
      'aws_elasticache_cluster': 'AWS::ElastiCache::CacheCluster',
      'aws_elasticsearch_domain': 'AWS::Elasticsearch::Domain',
    };

    return mapping[terraformType] || terraformType;
  }

  private calculateRiskLevel(costDifference: number, percentageChange: number): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
    if (Math.abs(costDifference) < 100 && Math.abs(percentageChange) < 10) return 'LOW';
    if (Math.abs(costDifference) < 500 && Math.abs(percentageChange) < 25) return 'MEDIUM';
    if (Math.abs(costDifference) < 1000 && Math.abs(percentageChange) < 50) return 'HIGH';
    return 'CRITICAL';
  }

  private generateRecommendations(breakdown: any[], tagging: any): string[] {
    const recommendations: string[] = [];

    // Cost-based recommendations
    const highCostResources = breakdown.filter(item => item.newCost > 500);
    if (highCostResources.length > 0) {
      recommendations.push('Consider using Reserved Instances or Savings Plans for high-cost resources');
    }

    // Tagging recommendations
    if (tagging.nonCompliantResources > 0) {
      recommendations.push('Ensure all resources have required tags for proper cost allocation');
    }

    if (tagging.missingTags.includes('Environment')) {
      recommendations.push('Add Environment tags to enable cost tracking by environment');
    }

    return recommendations;
  }

  private generateWarnings(breakdown: any[], tagging: any): string[] {
    const warnings: string[] = [];

    // High cost warnings
    const criticalCostChanges = breakdown.filter(item => Math.abs(item.costDifference) > 1000);
    if (criticalCostChanges.length > 0) {
      warnings.push(`${criticalCostChanges.length} resource(s) have critical cost impact (>$1000/month)`);
    }

    // Tagging warnings
    if (tagging.nonCompliantResources > tagging.compliantResources) {
      warnings.push('More than 50% of resources are not compliant with tagging policies');
    }

    return warnings;
  }

  private combineReports(reports: CostImpactReport[]): CostImpactReport {
    if (reports.length === 0) {
      throw new Error('No reports to combine');
    }

    if (reports.length === 1) {
      return reports[0];
    }

    // Combine multiple reports into one
    const combined: CostImpactReport = {
      summary: {
        totalChanges: reports.reduce((sum, r) => sum + r.summary.totalChanges, 0),
        costImpact: reports.reduce((sum, r) => sum + r.summary.costImpact, 0),
        percentageChange: 0, // Will be recalculated
        riskLevel: 'LOW',
        estimatedMonthlyCost: reports.reduce((sum, r) => sum + r.summary.estimatedMonthlyCost, 0),
      },
      breakdown: {
        newResources: reports.flatMap(r => r.breakdown.newResources),
        modifiedResources: reports.flatMap(r => r.breakdown.modifiedResources),
        deletedResources: reports.flatMap(r => r.breakdown.deletedResources),
      },
      tagging: {
        compliantResources: reports.reduce((sum, r) => sum + r.tagging.compliantResources, 0),
        nonCompliantResources: reports.reduce((sum, r) => sum + r.tagging.nonCompliantResources, 0),
        missingTags: [...new Set(reports.flatMap(r => r.tagging.missingTags))],
        tagViolations: reports.flatMap(r => r.tagging.tagViolations),
      },
      recommendations: [...new Set(reports.flatMap(r => r.recommendations))],
      warnings: [...new Set(reports.flatMap(r => r.warnings))],
      metadata: {
        generatedAt: new Date().toISOString(),
        analysisVersion: '1.0.0',
        pullRequestId: reports[0].metadata.pullRequestId,
        branch: reports[0].metadata.branch,
        commit: reports[0].metadata.commit,
      },
    };

    // Recalculate risk level
    combined.summary.riskLevel = this.calculateRiskLevel(
      combined.summary.costImpact,
      combined.summary.percentageChange
    );

    return combined;
  }

  private getRiskEmoji(riskLevel: string): string {
    switch (riskLevel) {
      case 'LOW': return '🟢';
      case 'MEDIUM': return '🟡';
      case 'HIGH': return '🟠';
      case 'CRITICAL': return '🔴';
      default: return '⚪';
    }
  }

  private generateHTMLReport(report: CostImpactReport): string {
    // This would generate a full HTML report
    // For brevity, returning a simple HTML structure
    return `
<!DOCTYPE html>
<html>
<head>
    <title>Cost Impact Analysis Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .summary { background: #f5f5f5; padding: 15px; border-radius: 5px; }
        .risk-${report.summary.riskLevel.toLowerCase()} { 
            color: ${report.summary.riskLevel === 'CRITICAL' ? 'red' : 
                    report.summary.riskLevel === 'HIGH' ? 'orange' : 
                    report.summary.riskLevel === 'MEDIUM' ? 'gold' : 'green'}; 
        }
        table { border-collapse: collapse; width: 100%; margin: 10px 0; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
    </style>
</head>
<body>
    <h1>💰 Cost Impact Analysis Report</h1>
    <div class="summary">
        <h2>Summary</h2>
        <p><strong>Total Changes:</strong> ${report.summary.totalChanges}</p>
        <p><strong>Monthly Cost Impact:</strong> $${report.summary.costImpact.toFixed(2)}</p>
        <p><strong>Risk Level:</strong> <span class="risk-${report.summary.riskLevel.toLowerCase()}">${report.summary.riskLevel}</span></p>
    </div>
    <p><em>Generated at ${report.metadata.generatedAt}</em></p>
</body>
</html>
    `;
  }
}
