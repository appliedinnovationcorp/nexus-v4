import * as core from '@actions/core';
import * as github from '@actions/github';
import { CostImpactAnalyzer } from '../ci/cost-impact-analyzer';
import { FinOpsConfig } from '../types';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as yaml from 'js-yaml';

async function run(): Promise<void> {
  try {
    // Get inputs
    const terraformPlanPath = core.getInput('terraform-plan-path');
    const cloudformationTemplatePath = core.getInput('cloudformation-template-path');
    const awsRegion = core.getInput('aws-region');
    const costThreshold = parseFloat(core.getInput('cost-threshold'));
    const enablePrComments = core.getInput('enable-pr-comments') === 'true';
    const outputFormat = core.getInput('output-format') as 'json' | 'markdown' | 'html';
    const finopsConfigPath = core.getInput('finops-config-path');

    // Load FinOps configuration
    let config: FinOpsConfig;
    try {
      const configContent = await fs.readFile(finopsConfigPath, 'utf-8');
      config = yaml.load(configContent) as FinOpsConfig;
    } catch (error) {
      // Use default configuration if file doesn't exist
      config = getDefaultFinOpsConfig(awsRegion);
      core.warning(`FinOps config file not found at ${finopsConfigPath}, using defaults`);
    }

    // Initialize cost impact analyzer
    const analyzer = new CostImpactAnalyzer(config);

    // Determine which files to analyze
    const filesToAnalyze: string[] = [];
    if (terraformPlanPath) {
      filesToAnalyze.push(terraformPlanPath);
    }
    if (cloudformationTemplatePath) {
      filesToAnalyze.push(cloudformationTemplatePath);
    }

    if (filesToAnalyze.length === 0) {
      core.setFailed('No infrastructure files specified for analysis');
      return;
    }

    // Get PR context
    const pullRequest = github.context.payload.pull_request;
    const pullRequestId = pullRequest?.number?.toString();
    const branch = pullRequest?.head?.ref;
    const commit = pullRequest?.head?.sha;

    // Generate cost analysis report
    const reportPath = path.join(process.cwd(), `cost-analysis-${Date.now()}.${outputFormat}`);
    
    await analyzer.generateCIReport(filesToAnalyze, reportPath, {
      pullRequestId,
      branch,
      commit,
      format: outputFormat,
    });

    // Read the generated report
    const reportContent = await fs.readFile(reportPath, 'utf-8');
    let report;
    
    if (outputFormat === 'json') {
      report = JSON.parse(reportContent);
    } else {
      // For markdown/html, we need to analyze separately to get structured data
      if (terraformPlanPath) {
        report = await analyzer.analyzeTerraformPlan(terraformPlanPath, {
          pullRequestId,
          branch,
          commit,
        });
      } else if (cloudformationTemplatePath) {
        report = await analyzer.analyzeCloudFormationTemplate(cloudformationTemplatePath, {
          pullRequestId,
          branch,
          commit,
        });
      }
    }

    // Set outputs
    core.setOutput('cost-impact', report.summary.costImpact.toString());
    core.setOutput('risk-level', report.summary.riskLevel);
    core.setOutput('report-path', reportPath);
    
    const totalResources = report.tagging.compliantResources + report.tagging.nonCompliantResources;
    const compliancePercentage = totalResources > 0 
      ? (report.tagging.compliantResources / totalResources) * 100 
      : 100;
    core.setOutput('tagging-compliance', compliancePercentage.toFixed(1));

    // Check if cost impact exceeds threshold
    if (Math.abs(report.summary.costImpact) > costThreshold) {
      core.warning(`Cost impact ($${report.summary.costImpact.toFixed(2)}) exceeds threshold ($${costThreshold})`);
    }

    // Add PR comment if enabled and in PR context
    if (enablePrComments && pullRequest && github.context.eventName === 'pull_request') {
      await addPullRequestComment(report, analyzer);
    }

    // Log summary
    core.info('=== Cost Analysis Summary ===');
    core.info(`Total Changes: ${report.summary.totalChanges}`);
    core.info(`Monthly Cost Impact: $${report.summary.costImpact.toFixed(2)}`);
    core.info(`Risk Level: ${report.summary.riskLevel}`);
    core.info(`Tagging Compliance: ${compliancePercentage.toFixed(1)}%`);

    // Set job status based on risk level
    if (report.summary.riskLevel === 'CRITICAL') {
      core.setFailed(`Critical cost impact detected: $${report.summary.costImpact.toFixed(2)}/month`);
    } else if (report.summary.riskLevel === 'HIGH') {
      core.warning(`High cost impact detected: $${report.summary.costImpact.toFixed(2)}/month`);
    }

  } catch (error) {
    core.setFailed(`Cost analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

async function addPullRequestComment(report: any, analyzer: CostImpactAnalyzer): Promise<void> {
  try {
    const token = core.getInput('github-token') || process.env.GITHUB_TOKEN;
    if (!token) {
      core.warning('GitHub token not provided, skipping PR comment');
      return;
    }

    const octokit = github.getOctokit(token);
    const comment = analyzer.generatePullRequestComment(report);

    // Check if there's already a cost analysis comment
    const { data: comments } = await octokit.rest.issues.listComments({
      owner: github.context.repo.owner,
      repo: github.context.repo.repo,
      issue_number: github.context.payload.pull_request!.number,
    });

    const existingComment = comments.find(comment => 
      comment.body?.includes('## 💰 Cost Impact Analysis')
    );

    if (existingComment) {
      // Update existing comment
      await octokit.rest.issues.updateComment({
        owner: github.context.repo.owner,
        repo: github.context.repo.repo,
        comment_id: existingComment.id,
        body: comment,
      });
      core.info('Updated existing cost analysis comment');
    } else {
      // Create new comment
      await octokit.rest.issues.createComment({
        owner: github.context.repo.owner,
        repo: github.context.repo.repo,
        issue_number: github.context.payload.pull_request!.number,
        body: comment,
      });
      core.info('Created new cost analysis comment');
    }
  } catch (error) {
    core.warning(`Failed to add PR comment: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

function getDefaultFinOpsConfig(region: string): FinOpsConfig {
  return {
    aws: {
      region,
      costExplorerEnabled: true,
      budgetsEnabled: true,
    },
    tagging: {
      enforceRequiredTags: true,
      requiredTags: ['Environment', 'Project', 'Owner', 'CostCenter'],
      tagValidationRules: {
        Environment: /^(production|staging|development|test)$/,
        Owner: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
      },
      autoTagging: {
        enabled: true,
        defaultTags: {
          CreatedBy: 'github-actions',
          ManagedBy: 'terraform',
        },
      },
    },
    costMonitoring: {
      anomalyDetection: {
        enabled: true,
        sensitivity: 'MEDIUM',
        minimumImpact: 100,
      },
      budgetAlerts: {
        enabled: true,
        defaultThresholds: [50, 80, 100],
        escalationRules: [
          {
            threshold: 80,
            recipients: ['team@company.com'],
            channels: ['email'],
          },
          {
            threshold: 100,
            recipients: ['management@company.com'],
            channels: ['email', 'slack'],
          },
        ],
      },
    },
    optimization: {
      autoRecommendations: true,
      recommendationTypes: ['RIGHT_SIZING', 'RESERVED_INSTANCES', 'UNUSED_RESOURCES'],
      implementationApproval: 'MANUAL',
    },
    reporting: {
      defaultCurrency: 'USD',
      timezone: 'UTC',
      retentionPeriod: 90,
      exportFormats: ['json', 'csv'],
    },
    notifications: {
      slack: {
        enabled: false,
      },
      email: {
        enabled: true,
      },
      webhook: {
        enabled: false,
        endpoints: [],
      },
    },
  };
}

// Run the action
if (require.main === module) {
  run();
}

export { run };
