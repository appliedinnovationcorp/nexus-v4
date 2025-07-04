import { AxeBuilder } from '@axe-core/playwright';
import { chromium, Browser, Page } from 'playwright';
import lighthouse from 'lighthouse';
import * as pa11y from 'pa11y';
import {
  AccessibilityConfig,
  AccessibilityAuditResult,
  AccessibilityViolation,
  WCAGLevel,
} from '../types';
import { SecretManager } from '@nexus/secret-management';
import { AnalyticsTracker } from '@nexus/analytics';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs/promises';
import * as path from 'path';

export class AccessibilityAuditor {
  private secretManager: SecretManager;
  private analytics: AnalyticsTracker;
  private config: AccessibilityConfig;
  private browser: Browser | null = null;

  constructor(config: AccessibilityConfig) {
    this.config = config;
    this.secretManager = new SecretManager();
    this.analytics = new AnalyticsTracker();
  }

  /**
   * Run comprehensive accessibility audit
   */
  async runAudit(targets?: string[]): Promise<AccessibilityAuditResult[]> {
    const auditTargets = targets || this.config.targets.map(t => t.url);
    const results: AccessibilityAuditResult[] = [];

    try {
      await this.initializeBrowser();

      for (const targetConfig of this.config.targets) {
        if (targets && !targets.includes(targetConfig.url)) {
          continue;
        }

        console.log(`🔍 Auditing accessibility for: ${targetConfig.url}`);
        
        const result = await this.auditTarget(targetConfig);
        results.push(result);

        await this.analytics.track('accessibility.audit.completed', {
          url: targetConfig.url,
          score: result.summary.overallScore,
          violations: result.summary.totalViolations,
          isCompliant: result.summary.isCompliant,
        });
      }

      return results;
    } catch (error) {
      await this.analytics.track('accessibility.audit.error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        targets: auditTargets,
      });
      throw error;
    } finally {
      await this.cleanup();
    }
  }

  /**
   * Audit a single target
   */
  private async auditTarget(targetConfig: AccessibilityConfig['targets'][0]): Promise<AccessibilityAuditResult> {
    const auditId = uuidv4();
    const startTime = Date.now();

    try {
      const page = await this.createPage(targetConfig);
      
      // Navigate to target URL
      await page.goto(targetConfig.url, { waitUntil: 'networkidle' });
      
      // Wait for specific elements if configured
      if (targetConfig.waitFor?.selector) {
        await page.waitForSelector(targetConfig.waitFor.selector, {
          timeout: targetConfig.waitFor.timeout,
        });
      }

      // Run all enabled audits
      const [axeResults, lighthouseResults, pa11yResults] = await Promise.allSettled([
        this.config.tools.axe.enabled ? this.runAxeAudit(page) : Promise.resolve(null),
        this.config.tools.lighthouse.enabled ? this.runLighthouseAudit(targetConfig.url) : Promise.resolve(null),
        this.config.tools.pa11y.enabled ? this.runPa11yAudit(targetConfig.url) : Promise.resolve(null),
      ]);

      // Process results
      const processedAxeResults = axeResults.status === 'fulfilled' ? axeResults.value : null;
      const processedLighthouseResults = lighthouseResults.status === 'fulfilled' ? lighthouseResults.value : null;
      const processedPa11yResults = pa11yResults.status === 'fulfilled' ? pa11yResults.value : null;

      // Calculate summary
      const summary = this.calculateSummary(
        processedAxeResults,
        processedLighthouseResults,
        processedPa11yResults
      );

      // Get page metadata
      const userAgent = await page.evaluate(() => navigator.userAgent);
      const viewport = page.viewportSize() || { width: 1920, height: 1080 };

      await page.close();

      const result: AccessibilityAuditResult = {
        id: auditId,
        url: targetConfig.url,
        timestamp: new Date(),
        axeResults: processedAxeResults || undefined,
        lighthouseResults: processedLighthouseResults || undefined,
        pa11yResults: processedPa11yResults || undefined,
        summary,
        metadata: {
          userAgent,
          viewport,
          duration: Date.now() - startTime,
          toolVersions: {
            axe: require('axe-core/package.json').version,
            lighthouse: require('lighthouse/package.json').version,
            pa11y: require('pa11y/package.json').version,
          },
        },
      };

      // Generate reports if configured
      if (this.config.reporting.generateSummary) {
        await this.generateReports(result);
      }

      return result;
    } catch (error) {
      await this.analytics.track('accessibility.audit.target_error', {
        url: targetConfig.url,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Run Axe accessibility audit
   */
  private async runAxeAudit(page: Page): Promise<AccessibilityAuditResult['axeResults']> {
    try {
      const axeBuilder = new AxeBuilder({ page });

      // Configure Axe based on settings
      if (this.config.tools.axe.tags) {
        axeBuilder.withTags(this.config.tools.axe.tags);
      } else {
        // Default to WCAG level tags
        const wcagTags = this.getWCAGTags(this.config.wcagLevel);
        axeBuilder.withTags(wcagTags);
      }

      // Configure rules
      if (this.config.tools.axe.rules) {
        Object.entries(this.config.tools.axe.rules).forEach(([rule, status]) => {
          if (status === 'disabled') {
            axeBuilder.disableRules([rule]);
          }
        });
      }

      const results = await axeBuilder.analyze();

      return {
        violations: results.violations.map(this.mapAxeViolation),
        passes: results.passes.map(pass => ({
          id: pass.id,
          description: pass.description,
          nodes: pass.nodes.map(node => ({
            target: node.target,
            html: node.html,
          })),
        })),
        incomplete: results.incomplete.map(this.mapAxeViolation),
        inapplicable: results.inapplicable.map(rule => ({
          id: rule.id,
          description: rule.description,
        })),
      };
    } catch (error) {
      console.error('Axe audit failed:', error);
      return undefined;
    }
  }

  /**
   * Run Lighthouse accessibility audit
   */
  private async runLighthouseAudit(url: string): Promise<AccessibilityAuditResult['lighthouseResults']> {
    try {
      const result = await lighthouse(url, {
        onlyCategories: this.config.tools.lighthouse.categories,
        port: 0, // Use random port
        chromeFlags: ['--headless', '--no-sandbox'],
      });

      if (!result) {
        throw new Error('Lighthouse audit failed');
      }

      const accessibilityCategory = result.lhr.categories.accessibility;
      const audits = result.lhr.audits;

      return {
        score: Math.round((accessibilityCategory?.score || 0) * 100),
        audits: Object.fromEntries(
          Object.entries(audits)
            .filter(([, audit]) => audit.scoreDisplayMode !== 'notApplicable')
            .map(([id, audit]) => [
              id,
              {
                id,
                title: audit.title,
                description: audit.description,
                score: audit.score,
                scoreDisplayMode: audit.scoreDisplayMode,
                displayValue: audit.displayValue,
                details: audit.details,
              },
            ])
        ),
      };
    } catch (error) {
      console.error('Lighthouse audit failed:', error);
      return undefined;
    }
  }

  /**
   * Run Pa11y accessibility audit
   */
  private async runPa11yAudit(url: string): Promise<AccessibilityAuditResult['pa11yResults']> {
    try {
      const results = await pa11y(url, {
        standard: this.config.tools.pa11y.standard,
        includeNotices: this.config.tools.pa11y.includeNotices,
        includeWarnings: this.config.tools.pa11y.includeWarnings,
        chromeLaunchConfig: {
          headless: true,
          args: ['--no-sandbox'],
        },
      });

      return {
        issues: results.issues.map(issue => ({
          code: issue.code,
          type: issue.type as 'error' | 'warning' | 'notice',
          message: issue.message,
          context: issue.context,
          selector: issue.selector,
          runner: issue.runner,
          runnerExtras: issue.runnerExtras,
        })),
      };
    } catch (error) {
      console.error('Pa11y audit failed:', error);
      return undefined;
    }
  }

  /**
   * Calculate audit summary
   */
  private calculateSummary(
    axeResults: AccessibilityAuditResult['axeResults'],
    lighthouseResults: AccessibilityAuditResult['lighthouseResults'],
    pa11yResults: AccessibilityAuditResult['pa11yResults']
  ): AccessibilityAuditResult['summary'] {
    let totalViolations = 0;
    const violationsByImpact = {
      critical: 0,
      serious: 0,
      moderate: 0,
      minor: 0,
    };

    // Count Axe violations
    if (axeResults?.violations) {
      axeResults.violations.forEach(violation => {
        totalViolations++;
        violationsByImpact[violation.impact]++;
      });
    }

    // Count Pa11y errors as violations
    if (pa11yResults?.issues) {
      pa11yResults.issues.forEach(issue => {
        if (issue.type === 'error') {
          totalViolations++;
          violationsByImpact.serious++; // Treat Pa11y errors as serious
        }
      });
    }

    // Calculate overall score
    let overallScore = 100;
    
    // Deduct points based on violations
    overallScore -= violationsByImpact.critical * 25;
    overallScore -= violationsByImpact.serious * 15;
    overallScore -= violationsByImpact.moderate * 5;
    overallScore -= violationsByImpact.minor * 1;

    // Factor in Lighthouse score if available
    if (lighthouseResults?.score) {
      overallScore = Math.min(overallScore, lighthouseResults.score);
    }

    overallScore = Math.max(0, overallScore);

    // Determine WCAG compliance level
    let wcagLevel: WCAGLevel = 'A';
    if (overallScore >= 90 && violationsByImpact.critical === 0) {
      wcagLevel = 'AA';
    }
    if (overallScore >= 95 && violationsByImpact.critical === 0 && violationsByImpact.serious === 0) {
      wcagLevel = 'AAA';
    }

    // Check compliance against quality gates
    const isCompliant = this.checkCompliance(violationsByImpact, overallScore);

    return {
      totalViolations,
      violationsByImpact,
      overallScore,
      wcagLevel,
      isCompliant,
    };
  }

  /**
   * Check compliance against quality gates
   */
  private checkCompliance(
    violationsByImpact: { critical: number; serious: number; moderate: number; minor: number },
    overallScore: number
  ): boolean {
    const gates = this.config.qualityGates;

    if (!gates.failOnViolations) {
      return true;
    }

    // Check violation limits
    if (violationsByImpact.critical > gates.maxViolations.critical) {
      return false;
    }
    if (violationsByImpact.serious > gates.maxViolations.serious) {
      return false;
    }
    if (violationsByImpact.moderate > gates.maxViolations.moderate) {
      return false;
    }
    if (violationsByImpact.minor > gates.maxViolations.minor) {
      return false;
    }

    // Check minimum score
    if (overallScore < gates.minScore) {
      return false;
    }

    return true;
  }

  /**
   * Generate audit reports
   */
  private async generateReports(result: AccessibilityAuditResult): Promise<void> {
    const outputDir = this.config.reporting.outputDir;
    await fs.mkdir(outputDir, { recursive: true });

    const baseFilename = `accessibility-${result.id}`;

    // Generate JSON report
    if (this.config.reporting.formats.includes('json')) {
      const jsonPath = path.join(outputDir, `${baseFilename}.json`);
      await fs.writeFile(jsonPath, JSON.stringify(result, null, 2));
    }

    // Generate HTML report
    if (this.config.reporting.formats.includes('html')) {
      const htmlPath = path.join(outputDir, `${baseFilename}.html`);
      const htmlContent = this.generateHTMLReport(result);
      await fs.writeFile(htmlPath, htmlContent);
    }

    // Generate CSV report
    if (this.config.reporting.formats.includes('csv')) {
      const csvPath = path.join(outputDir, `${baseFilename}.csv`);
      const csvContent = this.generateCSVReport(result);
      await fs.writeFile(csvPath, csvContent);
    }

    // Generate JUnit XML report
    if (this.config.reporting.formats.includes('junit')) {
      const junitPath = path.join(outputDir, `${baseFilename}.xml`);
      const junitContent = this.generateJUnitReport(result);
      await fs.writeFile(junitPath, junitContent);
    }
  }

  /**
   * Helper methods
   */
  private async initializeBrowser(): Promise<void> {
    this.browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-dev-shm-usage'],
    });
  }

  private async createPage(targetConfig: AccessibilityConfig['targets'][0]): Promise<Page> {
    if (!this.browser) {
      throw new Error('Browser not initialized');
    }

    const page = await this.browser.newPage({
      viewport: targetConfig.viewport || { width: 1920, height: 1080 },
    });

    // Set up authentication if configured
    if (targetConfig.authentication && targetConfig.authentication.type !== 'none') {
      await this.setupAuthentication(page, targetConfig.authentication);
    }

    return page;
  }

  private async setupAuthentication(page: Page, auth: any): Promise<void> {
    switch (auth.type) {
      case 'basic':
        await page.setExtraHTTPHeaders({
          'Authorization': `Basic ${Buffer.from(`${auth.credentials.username}:${auth.credentials.password}`).toString('base64')}`,
        });
        break;
      case 'bearer':
        await page.setExtraHTTPHeaders({
          'Authorization': `Bearer ${auth.credentials.token}`,
        });
        break;
      case 'cookie':
        await page.context().addCookies(
          Object.entries(auth.credentials).map(([name, value]) => ({
            name,
            value: value as string,
            domain: new URL(page.url()).hostname,
          }))
        );
        break;
    }
  }

  private async cleanup(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  private getWCAGTags(level: WCAGLevel): string[] {
    const baseTags = ['wcag2a'];
    if (level === 'AA' || level === 'AAA') {
      baseTags.push('wcag2aa');
    }
    if (level === 'AAA') {
      baseTags.push('wcag2aaa');
    }
    return baseTags;
  }

  private mapAxeViolation = (violation: any): AccessibilityViolation => ({
    id: violation.id,
    impact: violation.impact,
    tags: violation.tags,
    description: violation.description,
    help: violation.help,
    helpUrl: violation.helpUrl,
    nodes: violation.nodes.map((node: any) => ({
      target: node.target,
      html: node.html,
      failureSummary: node.failureSummary,
      element: node.element,
    })),
    wcag: violation.tags.some((tag: string) => tag.startsWith('wcag')) ? {
      level: this.extractWCAGLevel(violation.tags),
      criteria: violation.tags.filter((tag: string) => tag.startsWith('wcag')),
      techniques: violation.tags.filter((tag: string) => tag.startsWith('technique')),
    } : undefined,
  });

  private extractWCAGLevel(tags: string[]): WCAGLevel {
    if (tags.includes('wcag2aaa')) return 'AAA';
    if (tags.includes('wcag2aa')) return 'AA';
    return 'A';
  }

  private generateHTMLReport(result: AccessibilityAuditResult): string {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Accessibility Audit Report - ${result.url}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; line-height: 1.6; }
        .header { background: #f4f4f4; padding: 20px; border-radius: 5px; margin-bottom: 20px; }
        .score { font-size: 2em; font-weight: bold; color: ${result.summary.overallScore >= 90 ? 'green' : result.summary.overallScore >= 70 ? 'orange' : 'red'}; }
        .violation { border: 1px solid #ddd; margin: 10px 0; padding: 15px; border-radius: 5px; }
        .critical { border-left: 5px solid #d32f2f; }
        .serious { border-left: 5px solid #f57c00; }
        .moderate { border-left: 5px solid #fbc02d; }
        .minor { border-left: 5px solid #388e3c; }
        .summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin: 20px 0; }
        .summary-card { background: #f9f9f9; padding: 15px; border-radius: 5px; text-align: center; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Accessibility Audit Report</h1>
        <p><strong>URL:</strong> ${result.url}</p>
        <p><strong>Date:</strong> ${result.timestamp.toLocaleString()}</p>
        <p><strong>Overall Score:</strong> <span class="score">${result.summary.overallScore}/100</span></p>
        <p><strong>WCAG Level:</strong> ${result.summary.wcagLevel}</p>
        <p><strong>Compliant:</strong> ${result.summary.isCompliant ? '✅ Yes' : '❌ No'}</p>
    </div>

    <div class="summary-grid">
        <div class="summary-card">
            <h3>Critical</h3>
            <div style="font-size: 2em; color: #d32f2f;">${result.summary.violationsByImpact.critical}</div>
        </div>
        <div class="summary-card">
            <h3>Serious</h3>
            <div style="font-size: 2em; color: #f57c00;">${result.summary.violationsByImpact.serious}</div>
        </div>
        <div class="summary-card">
            <h3>Moderate</h3>
            <div style="font-size: 2em; color: #fbc02d;">${result.summary.violationsByImpact.moderate}</div>
        </div>
        <div class="summary-card">
            <h3>Minor</h3>
            <div style="font-size: 2em; color: #388e3c;">${result.summary.violationsByImpact.minor}</div>
        </div>
    </div>

    ${result.axeResults?.violations.length ? `
    <h2>Violations</h2>
    ${result.axeResults.violations.map(violation => `
        <div class="violation ${violation.impact}">
            <h3>${violation.help}</h3>
            <p><strong>Impact:</strong> ${violation.impact.toUpperCase()}</p>
            <p><strong>Description:</strong> ${violation.description}</p>
            <p><strong>Help:</strong> <a href="${violation.helpUrl}" target="_blank">Learn more</a></p>
            <p><strong>Affected Elements:</strong> ${violation.nodes.length}</p>
            ${violation.nodes.map(node => `
                <div style="background: #f5f5f5; padding: 10px; margin: 5px 0; border-radius: 3px;">
                    <code>${node.html}</code>
                </div>
            `).join('')}
        </div>
    `).join('')}
    ` : '<p>No violations found! 🎉</p>'}

    <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 0.9em; color: #666;">
        <p>Generated by @nexus/ethical-gates v${require('../../package.json').version}</p>
        <p>Audit Duration: ${result.metadata.duration}ms</p>
    </div>
</body>
</html>
    `;
  }

  private generateCSVReport(result: AccessibilityAuditResult): string {
    const headers = ['URL', 'Timestamp', 'Overall Score', 'WCAG Level', 'Compliant', 'Critical', 'Serious', 'Moderate', 'Minor'];
    const row = [
      result.url,
      result.timestamp.toISOString(),
      result.summary.overallScore.toString(),
      result.summary.wcagLevel,
      result.summary.isCompliant.toString(),
      result.summary.violationsByImpact.critical.toString(),
      result.summary.violationsByImpact.serious.toString(),
      result.summary.violationsByImpact.moderate.toString(),
      result.summary.violationsByImpact.minor.toString(),
    ];

    return [headers.join(','), row.join(',')].join('\n');
  }

  private generateJUnitReport(result: AccessibilityAuditResult): string {
    const violations = result.axeResults?.violations || [];
    const testCases = violations.map(violation => `
        <testcase name="${violation.id}" classname="accessibility">
            <failure message="${violation.help}" type="${violation.impact}">
                ${violation.description}
                
                Affected elements: ${violation.nodes.length}
                Help: ${violation.helpUrl}
            </failure>
        </testcase>
    `).join('');

    return `<?xml version="1.0" encoding="UTF-8"?>
<testsuite name="Accessibility Audit" tests="${violations.length}" failures="${violations.length}" time="${result.metadata.duration / 1000}">
    ${testCases}
</testsuite>`;
  }
}
