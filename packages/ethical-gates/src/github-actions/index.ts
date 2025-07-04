import * as core from '@actions/core';
import * as github from '@actions/github';
import { EthicalGatesManager } from '../core/ethical-gates-manager';
import { EthicalGatesConfig } from '../types';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as yaml from 'js-yaml';

async function run(): Promise<void> {
  try {
    // Get inputs
    const configPath = core.getInput('config-path');
    const targets = core.getInput('targets');
    const skipAccessibility = core.getInput('skip-accessibility') === 'true';
    const skipCarbon = core.getInput('skip-carbon') === 'true';
    const wcagLevel = core.getInput('wcag-level') as 'A' | 'AA' | 'AAA';
    const failOnViolation = core.getInput('fail-on-violation') === 'true';
    const createPrComment = core.getInput('create-pr-comment') === 'true';
    const createGithubIssues = core.getInput('create-github-issues') === 'true';
    const githubToken = core.getInput('github-token') || process.env.GITHUB_TOKEN;
    const websiteCarbonApiKey = core.getInput('website-carbon-api-key');

    // Load configuration
    let config: EthicalGatesConfig;
    try {
      const configContent = await fs.readFile(configPath, 'utf-8');
      config = yaml.load(configContent) as EthicalGatesConfig;
    } catch (error) {
      core.warning(`Config file not found at ${configPath}, using defaults`);
      config = getDefaultConfig();
    }

    // Override configuration with inputs
    if (targets) {
      const targetUrls = targets.split(',').map(url => url.trim());
      config.accessibility.targets = targetUrls.map(url => ({
        name: new URL(url).hostname,
        url,
      }));
    }

    config.accessibility.wcagLevel = wcagLevel;

    if (websiteCarbonApiKey) {
      config.carbonFootprint.methods.websiteCarbon.apiKey = websiteCarbonApiKey;
    }

    // Get GitHub context
    const pullRequest = github.context.payload.pull_request;
    const environment = github.context.ref.includes('main') ? 'production' : 'staging';
    const branch = github.context.ref.replace('refs/heads/', '');
    const commit = github.context.sha;

    // Initialize manager and run audit
    const manager = new EthicalGatesManager(config);
    
    core.info('🌟 Starting ethical gates audit...');
    
    const result = await manager.runEthicalAudit({
      targets: targets ? targets.split(',').map(url => url.trim()) : undefined,
      skipAccessibility,
      skipCarbon,
      environment,
      branch,
      commit,
      pullRequest: pullRequest?.number?.toString(),
    });

    if (!result.success || !result.data) {
      core.setFailed(`Ethical gates audit failed: ${result.error?.message}`);
      return;
    }

    const data = result.data;

    // Set outputs
    core.setOutput('overall-score', data.overall.score.toString());
    core.setOutput('overall-grade', data.overall.grade);
    core.setOutput('is-compliant', data.overall.isCompliant.toString());
    core.setOutput('accessibility-score', data.accessibility.summary.overallScore.toString());
    core.setOutput('accessibility-violations', data.accessibility.summary.totalViolations.toString());
    core.setOutput('carbon-per-page', data.carbonFootprint.estimates.perPageView.carbonGrams.toFixed(2));
    core.setOutput('monthly-carbon', data.carbonFootprint.estimates.monthly.carbonKg.toFixed(2));
    core.setOutput('action-items-count', data.actionItems.length.toString());

    // Generate HTML report
    const reportPath = await generateHTMLReport(data);
    core.setOutput('report-path', reportPath);

    // Log summary
    core.info('=== Ethical Gates Results ===');
    core.info(`Overall Score: ${data.overall.score}/100 (${data.overall.grade})`);
    core.info(`Compliant: ${data.overall.isCompliant ? '✅' : '❌'}`);
    core.info(`Accessibility Score: ${data.accessibility.summary.overallScore}/100`);
    core.info(`Accessibility Violations: ${data.accessibility.summary.totalViolations}`);
    core.info(`Carbon per Page: ${data.carbonFootprint.estimates.perPageView.carbonGrams.toFixed(2)}g CO2`);
    core.info(`Monthly Carbon: ${data.carbonFootprint.estimates.monthly.carbonKg.toFixed(2)}kg CO2`);

    // Create PR comment if enabled
    if (createPrComment && pullRequest && githubToken) {
      await createPullRequestComment(data, githubToken);
    }

    // Create GitHub issues if enabled
    if (createGithubIssues && githubToken) {
      await createGitHubIssues(data, githubToken);
    }

    // Check if we should fail the build
    if (failOnViolation && !data.overall.isCompliant) {
      const criticalIssues = data.actionItems.filter(item => item.priority === 'critical').length;
      const highIssues = data.actionItems.filter(item => item.priority === 'high').length;
      
      core.setFailed(
        `Quality gates failed: ${criticalIssues} critical and ${highIssues} high priority issues found. ` +
        `Overall score: ${data.overall.score}/100 (${data.overall.grade})`
      );
    } else {
      core.info('✅ Ethical gates audit completed successfully');
    }

  } catch (error) {
    core.setFailed(`Ethical gates action failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

async function generateHTMLReport(data: any): Promise<string> {
  const reportPath = path.join(process.cwd(), 'ethical-gates-report.html');
  
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Ethical Gates Report</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0; }
        .score { font-size: 3em; font-weight: bold; margin: 10px 0; }
        .grade { font-size: 1.5em; opacity: 0.9; }
        .content { padding: 30px; }
        .section { margin: 30px 0; }
        .section h2 { color: #333; border-bottom: 2px solid #eee; padding-bottom: 10px; }
        .metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin: 20px 0; }
        .metric { background: #f8f9fa; padding: 20px; border-radius: 8px; text-align: center; }
        .metric-value { font-size: 2em; font-weight: bold; color: #667eea; }
        .metric-label { color: #666; margin-top: 5px; }
        .action-item { border: 1px solid #ddd; margin: 10px 0; padding: 15px; border-radius: 5px; }
        .priority-critical { border-left: 5px solid #dc3545; }
        .priority-high { border-left: 5px solid #fd7e14; }
        .priority-medium { border-left: 5px solid #ffc107; }
        .priority-low { border-left: 5px solid #28a745; }
        .compliant { color: #28a745; }
        .non-compliant { color: #dc3545; }
        .footer { text-align: center; padding: 20px; color: #666; border-top: 1px solid #eee; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🌟 Ethical Gates Report</h1>
            <div class="score">${data.overall.score}/100</div>
            <div class="grade">Grade: ${data.overall.grade}</div>
            <div class="grade ${data.overall.isCompliant ? 'compliant' : 'non-compliant'}">
                ${data.overall.isCompliant ? '✅ Compliant' : '❌ Non-Compliant'}
            </div>
        </div>
        
        <div class="content">
            <div class="section">
                <h2>📊 Overview</h2>
                <div class="metrics">
                    <div class="metric">
                        <div class="metric-value">${data.accessibility.summary.overallScore}</div>
                        <div class="metric-label">Accessibility Score</div>
                    </div>
                    <div class="metric">
                        <div class="metric-value">${data.accessibility.summary.totalViolations}</div>
                        <div class="metric-label">A11y Violations</div>
                    </div>
                    <div class="metric">
                        <div class="metric-value">${data.carbonFootprint.estimates.perPageView.carbonGrams.toFixed(1)}g</div>
                        <div class="metric-label">CO2 per Page</div>
                    </div>
                    <div class="metric">
                        <div class="metric-value">${data.carbonFootprint.estimates.monthly.carbonKg.toFixed(1)}kg</div>
                        <div class="metric-label">Monthly CO2</div>
                    </div>
                </div>
            </div>

            <div class="section">
                <h2>♿ Accessibility</h2>
                <p><strong>WCAG Level:</strong> ${data.accessibility.summary.wcagLevel}</p>
                <p><strong>Score:</strong> ${data.accessibility.summary.overallScore}/100</p>
                <div class="metrics">
                    <div class="metric">
                        <div class="metric-value" style="color: #dc3545;">${data.accessibility.summary.violationsByImpact.critical}</div>
                        <div class="metric-label">Critical</div>
                    </div>
                    <div class="metric">
                        <div class="metric-value" style="color: #fd7e14;">${data.accessibility.summary.violationsByImpact.serious}</div>
                        <div class="metric-label">Serious</div>
                    </div>
                    <div class="metric">
                        <div class="metric-value" style="color: #ffc107;">${data.accessibility.summary.violationsByImpact.moderate}</div>
                        <div class="metric-label">Moderate</div>
                    </div>
                    <div class="metric">
                        <div class="metric-value" style="color: #28a745;">${data.accessibility.summary.violationsByImpact.minor}</div>
                        <div class="metric-label">Minor</div>
                    </div>
                </div>
            </div>

            <div class="section">
                <h2>🌱 Carbon Footprint</h2>
                <div class="metrics">
                    <div class="metric">
                        <div class="metric-value">${data.carbonFootprint.estimates.annual.equivalents.treesRequired}</div>
                        <div class="metric-label">Trees Required</div>
                    </div>
                    <div class="metric">
                        <div class="metric-value">${Math.round(data.carbonFootprint.estimates.annual.equivalents.carMiles)}</div>
                        <div class="metric-label">Car Miles Equivalent</div>
                    </div>
                    <div class="metric">
                        <div class="metric-value">${Math.round(data.carbonFootprint.estimates.annual.equivalents.homeEnergyDays)}</div>
                        <div class="metric-label">Home Energy Days</div>
                    </div>
                </div>
            </div>

            ${data.actionItems.length > 0 ? `
            <div class="section">
                <h2>📋 Action Items</h2>
                ${data.actionItems.slice(0, 10).map((item: any) => `
                    <div class="action-item priority-${item.priority}">
                        <h3>${item.title}</h3>
                        <p><strong>Priority:</strong> ${item.priority.toUpperCase()}</p>
                        <p><strong>Category:</strong> ${item.category}</p>
                        <p><strong>Description:</strong> ${item.description}</p>
                        <p><strong>Impact:</strong> ${item.impact}</p>
                        <p><strong>Effort:</strong> ${item.effort}</p>
                    </div>
                `).join('')}
                ${data.actionItems.length > 10 ? `<p><em>... and ${data.actionItems.length - 10} more items</em></p>` : ''}
            </div>
            ` : ''}
        </div>
        
        <div class="footer">
            <p>Generated by @nexus/ethical-gates • ${new Date().toLocaleString()}</p>
        </div>
    </div>
</body>
</html>
  `;

  await fs.writeFile(reportPath, html, 'utf-8');
  return reportPath;
}

async function createPullRequestComment(data: any, githubToken: string): Promise<void> {
  try {
    const octokit = github.getOctokit(githubToken);
    
    const comment = `## 🌟 Ethical Gates Report

### Overall Score: ${data.overall.score}/100 (${data.overall.grade}) ${data.overall.isCompliant ? '✅' : '❌'}

| Metric | Value | Status |
|--------|-------|--------|
| **Accessibility Score** | ${data.accessibility.summary.overallScore}/100 | ${data.overall.qualityGates.accessibility.passed ? '✅' : '❌'} |
| **WCAG Level** | ${data.accessibility.summary.wcagLevel} | - |
| **A11y Violations** | ${data.accessibility.summary.totalViolations} | ${data.accessibility.summary.totalViolations === 0 ? '✅' : '⚠️'} |
| **Carbon per Page** | ${data.carbonFootprint.estimates.perPageView.carbonGrams.toFixed(2)}g CO2 | ${data.overall.qualityGates.sustainability.passed ? '✅' : '❌'} |
| **Monthly Carbon** | ${data.carbonFootprint.estimates.monthly.carbonKg.toFixed(2)}kg CO2 | - |

### 🚨 Critical Issues
${data.actionItems.filter((item: any) => item.priority === 'critical').length === 0 
  ? 'No critical issues found! 🎉' 
  : data.actionItems.filter((item: any) => item.priority === 'critical').slice(0, 3).map((item: any) => 
    `- **${item.title}**: ${item.description}`
  ).join('\n')}

### 💡 Top Recommendations
${data.carbonFootprint.recommendations.slice(0, 3).map((rec: any) => 
  `- **${rec.title}**: ${rec.description} (${rec.potentialSaving.percentage}% improvement)`
).join('\n')}

---
*Generated by @nexus/ethical-gates*`;

    // Check if there's already a comment
    const { data: comments } = await octokit.rest.issues.listComments({
      owner: github.context.repo.owner,
      repo: github.context.repo.repo,
      issue_number: github.context.payload.pull_request!.number,
    });

    const existingComment = comments.find(comment => 
      comment.body?.includes('🌟 Ethical Gates Report')
    );

    if (existingComment) {
      await octokit.rest.issues.updateComment({
        owner: github.context.repo.owner,
        repo: github.context.repo.repo,
        comment_id: existingComment.id,
        body: comment,
      });
      core.info('Updated existing ethical gates comment');
    } else {
      await octokit.rest.issues.createComment({
        owner: github.context.repo.owner,
        repo: github.context.repo.repo,
        issue_number: github.context.payload.pull_request!.number,
        body: comment,
      });
      core.info('Created new ethical gates comment');
    }
  } catch (error) {
    core.warning(`Failed to create PR comment: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

async function createGitHubIssues(data: any, githubToken: string): Promise<void> {
  try {
    const octokit = github.getOctokit(githubToken);
    
    const criticalItems = data.actionItems.filter((item: any) => item.priority === 'critical');
    
    for (const item of criticalItems) {
      const title = `🚨 Critical Ethical Issue: ${item.title}`;
      const body = `## ${item.title}

**Category:** ${item.category}
**Priority:** ${item.priority.toUpperCase()}

### Description
${item.description}

### Impact
${item.impact}

### Effort Required
${item.effort}

### Due Date
${item.dueDate ? new Date(item.dueDate).toLocaleDateString() : 'Not specified'}

---
*Auto-generated by @nexus/ethical-gates*
*Audit ID: ${data.id}*`;

      await octokit.rest.issues.create({
        owner: github.context.repo.owner,
        repo: github.context.repo.repo,
        title,
        body,
        labels: ['ethical-gates', item.category, `priority-${item.priority}`],
      });
    }
    
    if (criticalItems.length > 0) {
      core.info(`Created ${criticalItems.length} GitHub issues for critical ethical violations`);
    }
  } catch (error) {
    core.warning(`Failed to create GitHub issues: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

function getDefaultConfig(): EthicalGatesConfig {
  return {
    enabled: true,
    enforceInCI: true,
    accessibility: {
      wcagLevel: 'AA',
      includeExperimental: false,
      tools: {
        axe: { enabled: true },
        lighthouse: { enabled: true, categories: ['accessibility'], threshold: 90 },
        pa11y: { enabled: true, standard: 'WCAG2AA', includeNotices: false, includeWarnings: true },
      },
      targets: [
        {
          name: 'localhost',
          url: 'http://localhost:3000',
        },
      ],
      reporting: {
        formats: ['json', 'html'],
        outputDir: './accessibility-reports',
        includeScreenshots: true,
        generateSummary: true,
      },
      qualityGates: {
        failOnViolations: true,
        maxViolations: { critical: 0, serious: 0, moderate: 5, minor: 10 },
        minScore: 90,
      },
    },
    carbonFootprint: {
      methods: {
        websiteCarbon: { enabled: true },
        lighthouse: { enabled: true, includeNetworkPayload: true },
        custom: { enabled: false },
      },
      infrastructure: {
        cloudProvider: 'aws',
        region: 'us-east-1',
        servers: [],
        cdn: { enabled: false, cacheHitRate: 0.8 },
      },
      application: {
        traffic: {
          monthlyPageViews: 10000,
          averageSessionDuration: 180,
          bounceRate: 0.4,
          peakTrafficMultiplier: 2,
        },
        performance: {
          cacheEfficiency: 0.7,
          compressionRatio: 0.7,
        },
      },
      reporting: {
        formats: ['json', 'html'],
        outputDir: './carbon-reports',
        includeComparisons: true,
        includeRecommendations: true,
      },
      qualityGates: {
        maxCarbonPerPageView: 5,
        maxCarbonPerMonth: 1000,
        maxEnergyPerPageView: 0.01,
        improvementThreshold: 0.05,
      },
    },
    integrations: {
      github: { enabled: true, createIssues: true, addComments: true, labels: ['accessibility', 'sustainability'] },
      slack: { enabled: false },
      jira: { enabled: false },
    },
    notifications: {
      onViolation: [],
      onImprovement: [],
      onThresholdExceeded: [],
    },
    tracking: {
      enabled: true,
      retentionDays: 90,
      trendAnalysis: true,
      benchmarking: true,
    },
  };
}

// Run the action
if (require.main === module) {
  run();
}

export { run };
