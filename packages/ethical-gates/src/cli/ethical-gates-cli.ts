#!/usr/bin/env node

import { Command } from 'commander';
import { EthicalGatesManager } from '../core/ethical-gates-manager';
import { EthicalGatesConfig } from '../types';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as yaml from 'js-yaml';

const program = new Command();

program
  .name('ethical-gates')
  .description('Ethical and sustainable quality gates for accessibility and carbon footprint compliance')
  .version('1.0.0');

/**
 * Load configuration from file
 */
async function loadConfig(configPath?: string): Promise<EthicalGatesConfig> {
  const defaultConfigPath = path.join(process.cwd(), '.ethical-gates', 'config.yaml');
  const finalConfigPath = configPath || defaultConfigPath;

  try {
    const configContent = await fs.readFile(finalConfigPath, 'utf-8');
    const config = yaml.load(configContent) as EthicalGatesConfig;
    return config;
  } catch (error) {
    console.error(`Failed to load config from ${finalConfigPath}:`, error);
    
    // Return default configuration
    return getDefaultConfig();
  }
}

/**
 * Get default configuration
 */
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

/**
 * Audit command
 */
program
  .command('audit')
  .description('Run comprehensive ethical gates audit')
  .option('-c, --config <path>', 'Path to configuration file')
  .option('-t, --targets <urls...>', 'Target URLs to audit')
  .option('--skip-accessibility', 'Skip accessibility audit')
  .option('--skip-carbon', 'Skip carbon footprint estimation')
  .option('--environment <env>', 'Environment name')
  .option('--branch <branch>', 'Git branch name')
  .option('--commit <commit>', 'Git commit hash')
  .option('--pr <number>', 'Pull request number')
  .option('--fail-on-violation', 'Exit with error code if quality gates fail')
  .action(async (options) => {
    try {
      const config = await loadConfig(options.config);
      
      // Override targets if provided
      if (options.targets) {
        config.accessibility.targets = options.targets.map((url: string) => ({
          name: new URL(url).hostname,
          url,
        }));
      }

      const manager = new EthicalGatesManager(config);
      
      console.log('🌟 Starting ethical gates audit...');
      console.log(`📋 Targets: ${config.accessibility.targets.map(t => t.url).join(', ')}`);
      
      const result = await manager.runEthicalAudit({
        targets: options.targets,
        skipAccessibility: options.skipAccessibility,
        skipCarbon: options.skipCarbon,
        environment: options.environment,
        branch: options.branch,
        commit: options.commit,
        pullRequest: options.pr,
      });

      if (result.success && result.data) {
        const data = result.data;
        
        console.log('\n📊 Audit Results:');
        console.log(`Overall Score: ${data.overall.score}/100 (${data.overall.grade})`);
        console.log(`Compliant: ${data.overall.isCompliant ? '✅' : '❌'}`);
        
        console.log('\n♿ Accessibility:');
        console.log(`  Score: ${data.accessibility.summary.overallScore}/100`);
        console.log(`  WCAG Level: ${data.accessibility.summary.wcagLevel}`);
        console.log(`  Violations: ${data.accessibility.summary.totalViolations}`);
        console.log(`    Critical: ${data.accessibility.summary.violationsByImpact.critical}`);
        console.log(`    Serious: ${data.accessibility.summary.violationsByImpact.serious}`);
        console.log(`    Moderate: ${data.accessibility.summary.violationsByImpact.moderate}`);
        console.log(`    Minor: ${data.accessibility.summary.violationsByImpact.minor}`);
        
        console.log('\n🌱 Carbon Footprint:');
        console.log(`  Per Page View: ${data.carbonFootprint.estimates.perPageView.carbonGrams.toFixed(2)}g CO2`);
        console.log(`  Monthly Total: ${data.carbonFootprint.estimates.monthly.carbonKg.toFixed(2)}kg CO2`);
        console.log(`  Annual Total: ${data.carbonFootprint.estimates.annual.carbonKg.toFixed(2)}kg CO2`);
        console.log(`  Trees Required: ${data.carbonFootprint.estimates.annual.equivalents.treesRequired}`);
        
        if (data.actionItems.length > 0) {
          console.log('\n📋 Action Items:');
          data.actionItems.slice(0, 5).forEach((item, index) => {
            const priorityEmoji = {
              critical: '🚨',
              high: '⚠️',
              medium: '📝',
              low: '💡',
            }[item.priority];
            
            console.log(`  ${index + 1}. ${priorityEmoji} ${item.title}`);
            console.log(`     ${item.description}`);
            console.log(`     Impact: ${item.impact}`);
            console.log(`     Effort: ${item.effort}`);
          });
          
          if (data.actionItems.length > 5) {
            console.log(`     ... and ${data.actionItems.length - 5} more items`);
          }
        }

        // Check if we should fail the build
        if (options.failOnViolation && !data.overall.isCompliant) {
          console.log('\n❌ Quality gates failed - exiting with error code');
          process.exit(1);
        }
        
        console.log('\n✅ Audit completed successfully');
      } else {
        console.error('❌ Audit failed:', result.error?.message);
        process.exit(1);
      }
    } catch (error) {
      console.error('💥 Error running audit:', error);
      process.exit(1);
    }
  });

/**
 * Accessibility-only audit command
 */
program
  .command('accessibility')
  .alias('a11y')
  .description('Run accessibility audit only')
  .option('-c, --config <path>', 'Path to configuration file')
  .option('-t, --targets <urls...>', 'Target URLs to audit')
  .option('--wcag-level <level>', 'WCAG compliance level (A, AA, AAA)', 'AA')
  .option('--format <format>', 'Output format (json, html, csv, junit)', 'html')
  .option('--output <dir>', 'Output directory', './accessibility-reports')
  .action(async (options) => {
    try {
      const config = await loadConfig(options.config);
      
      // Override configuration based on options
      if (options.targets) {
        config.accessibility.targets = options.targets.map((url: string) => ({
          name: new URL(url).hostname,
          url,
        }));
      }
      
      config.accessibility.wcagLevel = options.wcagLevel;
      config.accessibility.reporting.outputDir = options.output;
      config.accessibility.reporting.formats = [options.format];

      const manager = new EthicalGatesManager(config);
      
      console.log('♿ Running accessibility audit...');
      
      const result = await manager.runEthicalAudit({
        targets: options.targets,
        skipCarbon: true,
      });

      if (result.success && result.data) {
        const accessibility = result.data.accessibility;
        
        console.log('\n📊 Accessibility Results:');
        console.log(`Score: ${accessibility.summary.overallScore}/100`);
        console.log(`WCAG Level: ${accessibility.summary.wcagLevel}`);
        console.log(`Compliant: ${accessibility.summary.isCompliant ? '✅' : '❌'}`);
        console.log(`Total Violations: ${accessibility.summary.totalViolations}`);
        
        console.log(`\n📁 Reports generated in: ${options.output}`);
      } else {
        console.error('❌ Accessibility audit failed:', result.error?.message);
        process.exit(1);
      }
    } catch (error) {
      console.error('💥 Error running accessibility audit:', error);
      process.exit(1);
    }
  });

/**
 * Carbon footprint estimation command
 */
program
  .command('carbon')
  .description('Estimate carbon footprint only')
  .option('-c, --config <path>', 'Path to configuration file')
  .option('-u, --url <url>', 'Target URL to analyze')
  .option('--format <format>', 'Output format (json, html, csv)', 'html')
  .option('--output <dir>', 'Output directory', './carbon-reports')
  .action(async (options) => {
    try {
      const config = await loadConfig(options.config);
      
      config.carbonFootprint.reporting.outputDir = options.output;
      config.carbonFootprint.reporting.formats = [options.format];

      const manager = new EthicalGatesManager(config);
      
      console.log('🌱 Estimating carbon footprint...');
      
      const result = await manager.runEthicalAudit({
        targets: options.url ? [options.url] : undefined,
        skipAccessibility: true,
      });

      if (result.success && result.data) {
        const carbon = result.data.carbonFootprint;
        
        console.log('\n📊 Carbon Footprint Results:');
        console.log(`Per Page View: ${carbon.estimates.perPageView.carbonGrams.toFixed(2)}g CO2`);
        console.log(`Monthly Total: ${carbon.estimates.monthly.carbonKg.toFixed(2)}kg CO2`);
        console.log(`Annual Total: ${carbon.estimates.annual.carbonKg.toFixed(2)}kg CO2`);
        console.log(`Trees Required: ${carbon.estimates.annual.equivalents.treesRequired}`);
        console.log(`Car Miles Equivalent: ${carbon.estimates.annual.equivalents.carMiles.toFixed(0)} miles`);
        
        if (carbon.recommendations.length > 0) {
          console.log('\n💡 Top Recommendations:');
          carbon.recommendations.slice(0, 3).forEach((rec, index) => {
            console.log(`  ${index + 1}. ${rec.title}`);
            console.log(`     Potential saving: ${rec.potentialSaving.carbonGrams.toFixed(2)}g CO2 (${rec.potentialSaving.percentage}%)`);
          });
        }
        
        console.log(`\n📁 Reports generated in: ${options.output}`);
      } else {
        console.error('❌ Carbon footprint estimation failed:', result.error?.message);
        process.exit(1);
      }
    } catch (error) {
      console.error('💥 Error estimating carbon footprint:', error);
      process.exit(1);
    }
  });

/**
 * Configuration generation command
 */
program
  .command('init')
  .description('Generate default configuration file')
  .option('-o, --output <path>', 'Output path for configuration file', '.ethical-gates/config.yaml')
  .option('--overwrite', 'Overwrite existing configuration file')
  .action(async (options) => {
    try {
      const configPath = options.output;
      const configDir = path.dirname(configPath);
      
      // Check if file exists
      try {
        await fs.access(configPath);
        if (!options.overwrite) {
          console.log(`❌ Configuration file already exists at ${configPath}`);
          console.log('Use --overwrite to replace it');
          process.exit(1);
        }
      } catch {
        // File doesn't exist, which is fine
      }
      
      // Create directory if it doesn't exist
      await fs.mkdir(configDir, { recursive: true });
      
      // Generate default configuration
      const defaultConfig = getDefaultConfig();
      const configYaml = yaml.dump(defaultConfig, { indent: 2 });
      
      await fs.writeFile(configPath, configYaml, 'utf-8');
      
      console.log(`✅ Configuration file generated at: ${configPath}`);
      console.log('\n📝 Next steps:');
      console.log('1. Edit the configuration file to match your requirements');
      console.log('2. Update target URLs in the accessibility section');
      console.log('3. Configure your infrastructure details for carbon estimation');
      console.log('4. Run: ethical-gates audit');
    } catch (error) {
      console.error('💥 Error generating configuration:', error);
      process.exit(1);
    }
  });

/**
 * Validation command
 */
program
  .command('validate')
  .description('Validate configuration file')
  .option('-c, --config <path>', 'Path to configuration file')
  .action(async (options) => {
    try {
      const config = await loadConfig(options.config);
      
      console.log('🔍 Validating configuration...');
      
      // Basic validation
      const errors: string[] = [];
      const warnings: string[] = [];
      
      if (!config.enabled) {
        warnings.push('Ethical gates are disabled');
      }
      
      if (config.accessibility.targets.length === 0) {
        errors.push('No accessibility targets configured');
      }
      
      config.accessibility.targets.forEach((target, index) => {
        try {
          new URL(target.url);
        } catch {
          errors.push(`Invalid URL in target ${index + 1}: ${target.url}`);
        }
      });
      
      if (config.carbonFootprint.infrastructure.servers.length === 0) {
        warnings.push('No infrastructure servers configured for carbon estimation');
      }
      
      // Report results
      if (errors.length === 0) {
        console.log('✅ Configuration is valid');
        
        if (warnings.length > 0) {
          console.log('\n⚠️  Warnings:');
          warnings.forEach(warning => console.log(`  - ${warning}`));
        }
      } else {
        console.log('❌ Configuration validation failed');
        console.log('\n🚨 Errors:');
        errors.forEach(error => console.log(`  - ${error}`));
        
        if (warnings.length > 0) {
          console.log('\n⚠️  Warnings:');
          warnings.forEach(warning => console.log(`  - ${warning}`));
        }
        
        process.exit(1);
      }
    } catch (error) {
      console.error('💥 Error validating configuration:', error);
      process.exit(1);
    }
  });

// Parse command line arguments
program.parse();

export { program };
