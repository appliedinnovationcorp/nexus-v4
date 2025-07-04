#!/usr/bin/env node

import { Command } from 'commander';
import { TechRadarManager } from '../core/tech-radar-manager';
import { APIVersionManager } from '../api/api-version-manager';
import { RadarGenerator } from '../visualization/radar-generator';
import { TechRadarConfig, TechnologyEntry, APIVersion } from '../types';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as yaml from 'js-yaml';

const program = new Command();

program
  .name('tech-radar')
  .description('Technology radar and API versioning management CLI')
  .version('1.0.0');

/**
 * Load configuration from file
 */
async function loadConfig(configPath?: string): Promise<TechRadarConfig> {
  const defaultConfigPath = path.join(process.cwd(), '.tech-radar', 'config.yaml');
  const finalConfigPath = configPath || defaultConfigPath;

  try {
    const configContent = await fs.readFile(finalConfigPath, 'utf-8');
    const config = yaml.load(configContent) as TechRadarConfig;
    return config;
  } catch (error) {
    console.error(`Failed to load config from ${finalConfigPath}:`, error);
    return getDefaultConfig();
  }
}

/**
 * Get default configuration
 */
function getDefaultConfig(): TechRadarConfig {
  return {
    title: 'Technology Radar',
    organization: 'Your Organization',
    visualization: {
      width: 1200,
      height: 800,
      colors: {
        adopt: '#5cb85c',
        trial: '#f0ad4e',
        assess: '#5bc0de',
        hold: '#d9534f',
      },
      showLegend: true,
      showLabels: true,
    },
    quadrants: {
      'languages-frameworks': {
        name: 'Languages & Frameworks',
        description: 'Programming languages, frameworks, and libraries',
      },
      'tools': {
        name: 'Tools',
        description: 'Development tools, IDEs, and utilities',
      },
      'platforms': {
        name: 'Platforms',
        description: 'Infrastructure, cloud platforms, and services',
      },
      'techniques': {
        name: 'Techniques',
        description: 'Methods, practices, and architectural patterns',
      },
    },
    rings: {
      adopt: {
        name: 'Adopt',
        description: 'Technologies we have high confidence in and actively use',
        color: '#5cb85c',
      },
      trial: {
        name: 'Trial',
        description: 'Technologies worth pursuing with a goal to understand their impact',
        color: '#f0ad4e',
      },
      assess: {
        name: 'Assess',
        description: 'Technologies to explore with the goal of understanding their fit',
        color: '#5bc0de',
      },
      hold: {
        name: 'Hold',
        description: 'Technologies to avoid or phase out',
        color: '#d9534f',
      },
    },
    reviewProcess: {
      reviewCycle: 'quarterly',
      reviewers: [],
      approvalRequired: true,
      votingThreshold: 0.6,
    },
    apiVersioning: {
      defaultStrategy: 'semantic',
      deprecationPeriod: 365,
      sunsetPeriod: 180,
      notificationPeriods: [90, 30, 7],
      supportLevels: {
        full: 730,
        maintenance: 365,
        securityOnly: 180,
      },
    },
    integrations: {
      github: { enabled: false, branch: 'main', path: 'tech-radar' },
      confluence: { enabled: false },
      slack: { enabled: false },
    },
    notifications: {
      deprecationWarnings: [],
      radarUpdates: [],
      reviewReminders: [],
    },
  };
}

/**
 * Technology management commands
 */
const techCommand = program
  .command('tech')
  .description('Manage technologies in the radar');

techCommand
  .command('add')
  .description('Add a new technology to the radar')
  .requiredOption('-n, --name <name>', 'Technology name')
  .requiredOption('-d, --description <description>', 'Technology description')
  .requiredOption('-q, --quadrant <quadrant>', 'Quadrant (languages-frameworks, tools, platforms, techniques)')
  .requiredOption('-r, --ring <ring>', 'Ring (adopt, trial, assess, hold)')
  .option('-c, --config <path>', 'Path to configuration file')
  .option('--tags <tags>', 'Comma-separated tags')
  .option('--url <url>', 'Technology URL')
  .option('--strategic-value <value>', 'Strategic value (low, medium, high, critical)', 'medium')
  .action(async (options) => {
    try {
      const config = await loadConfig(options.config);
      const manager = new TechRadarManager(config);

      const technology: Omit<TechnologyEntry, 'id' | 'createdAt' | 'updatedAt' | 'version'> = {
        name: options.name,
        description: options.description,
        quadrant: options.quadrant,
        ring: options.ring,
        movement: 'no-change',
        tags: options.tags ? options.tags.split(',').map((t: string) => t.trim()) : [],
        url: options.url,
        introducedDate: new Date(),
        lastReviewDate: new Date(),
        nextReviewDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days
        adoptionLevel: 0,
        teamUsage: [],
        assessment: {
          maturity: 3,
          community: 3,
          documentation: 3,
          performance: 3,
          security: 3,
          maintenance: 3,
          learningCurve: 3,
          overallScore: 3,
        },
        businessImpact: {
          strategicValue: options.strategicValue,
          riskLevel: 'medium',
          costImpact: 'medium',
          timeToValue: 'medium',
        },
        dependencies: [],
        alternatives: [],
        supersedes: [],
        rationale: {
          pros: [],
          cons: [],
          tradeoffs: [],
          decisionFactors: [],
          keyStakeholders: [],
        },
        createdBy: 'cli-user',
        updatedBy: 'cli-user',
      };

      const result = await manager.addTechnology(technology);

      if (result.success && result.data) {
        console.log(`✅ Technology added successfully:`);
        console.log(`   ID: ${result.data.id}`);
        console.log(`   Name: ${result.data.name}`);
        console.log(`   Quadrant: ${result.data.quadrant}`);
        console.log(`   Ring: ${result.data.ring}`);
      } else {
        console.error(`❌ Failed to add technology: ${result.error?.message}`);
        process.exit(1);
      }
    } catch (error) {
      console.error('💥 Error adding technology:', error);
      process.exit(1);
    }
  });

techCommand
  .command('move')
  .description('Move a technology to a different ring')
  .requiredOption('-i, --id <id>', 'Technology ID')
  .requiredOption('-r, --ring <ring>', 'New ring (adopt, trial, assess, hold)')
  .requiredOption('--rationale <rationale>', 'Rationale for the move')
  .option('-c, --config <path>', 'Path to configuration file')
  .action(async (options) => {
    try {
      const config = await loadConfig(options.config);
      const manager = new TechRadarManager(config);

      const result = await manager.moveTechnology(
        options.id,
        options.ring,
        options.rationale,
        'cli-user'
      );

      if (result.success && result.data) {
        console.log(`✅ Technology moved successfully:`);
        console.log(`   Name: ${result.data.name}`);
        console.log(`   New Ring: ${result.data.ring}`);
        console.log(`   Movement: ${result.data.movement}`);
      } else {
        console.error(`❌ Failed to move technology: ${result.error?.message}`);
        process.exit(1);
      }
    } catch (error) {
      console.error('💥 Error moving technology:', error);
      process.exit(1);
    }
  });

techCommand
  .command('deprecate')
  .description('Deprecate a technology')
  .requiredOption('-i, --id <id>', 'Technology ID')
  .requiredOption('--reason <reason>', 'Deprecation reason')
  .option('--migration-path <path>', 'Migration guide URL')
  .option('--replacement <id>', 'Replacement technology ID')
  .option('-c, --config <path>', 'Path to configuration file')
  .action(async (options) => {
    try {
      const config = await loadConfig(options.config);
      const manager = new TechRadarManager(config);

      const result = await manager.deprecateTechnology(
        options.id,
        options.reason,
        options.migrationPath,
        options.replacement
      );

      if (result.success && result.data) {
        console.log(`✅ Technology deprecated successfully:`);
        console.log(`   Notice ID: ${result.data.id}`);
        console.log(`   Deprecation Date: ${result.data.deprecationDate.toLocaleDateString()}`);
        console.log(`   Sunset Date: ${result.data.sunsetDate?.toLocaleDateString()}`);
        console.log(`   Removal Date: ${result.data.removalDate?.toLocaleDateString()}`);
      } else {
        console.error(`❌ Failed to deprecate technology: ${result.error?.message}`);
        process.exit(1);
      }
    } catch (error) {
      console.error('💥 Error deprecating technology:', error);
      process.exit(1);
    }
  });

techCommand
  .command('list')
  .description('List technologies in the radar')
  .option('-q, --quadrant <quadrant>', 'Filter by quadrant')
  .option('-r, --ring <ring>', 'Filter by ring')
  .option('--status <status>', 'Filter by status (active, deprecated, all)', 'all')
  .option('--tags <tags>', 'Filter by tags (comma-separated)')
  .option('-c, --config <path>', 'Path to configuration file')
  .action(async (options) => {
    try {
      const config = await loadConfig(options.config);
      const manager = new TechRadarManager(config);

      const filters: any = {};
      if (options.quadrant) filters.quadrant = options.quadrant;
      if (options.ring) filters.ring = options.ring;
      if (options.status) filters.status = options.status;
      if (options.tags) filters.tags = options.tags.split(',').map((t: string) => t.trim());

      const result = await manager.getTechnologies(filters);

      if (result.success && result.data) {
        console.log(`📋 Technologies (${result.data.length} found):`);
        console.log('');

        result.data.forEach(tech => {
          const statusIcon = tech.deprecation?.status === 'deprecated' ? '⚠️' : '✅';
          const movementIcon = tech.movement === 'in' ? '↗️' : tech.movement === 'out' ? '↘️' : '➡️';
          
          console.log(`${statusIcon} ${tech.name} ${movementIcon}`);
          console.log(`   ID: ${tech.id}`);
          console.log(`   Quadrant: ${tech.quadrant}`);
          console.log(`   Ring: ${tech.ring}`);
          console.log(`   Adoption: ${tech.adoptionLevel}%`);
          console.log(`   Strategic Value: ${tech.businessImpact.strategicValue}`);
          if (tech.tags.length > 0) {
            console.log(`   Tags: ${tech.tags.join(', ')}`);
          }
          if (tech.deprecation?.status !== 'active') {
            console.log(`   Status: ${tech.deprecation?.status}`);
            if (tech.deprecation?.reason) {
              console.log(`   Reason: ${tech.deprecation.reason}`);
            }
          }
          console.log('');
        });
      } else {
        console.error(`❌ Failed to list technologies: ${result.error?.message}`);
        process.exit(1);
      }
    } catch (error) {
      console.error('💥 Error listing technologies:', error);
      process.exit(1);
    }
  });

/**
 * API version management commands
 */
const apiCommand = program
  .command('api')
  .description('Manage API versions');

apiCommand
  .command('create')
  .description('Create a new API version')
  .requiredOption('-n, --name <name>', 'API name')
  .requiredOption('-v, --version <version>', 'Version string')
  .option('-s, --strategy <strategy>', 'Versioning strategy (semantic, date-based, sequential, header-based)', 'semantic')
  .option('-c, --config <path>', 'Path to configuration file')
  .action(async (options) => {
    try {
      const config = await loadConfig(options.config);
      const manager = new APIVersionManager(config);

      const result = await manager.createAPIVersion(
        options.name,
        options.version,
        options.strategy,
        'cli-user'
      );

      if (result.success && result.data) {
        console.log(`✅ API version created successfully:`);
        console.log(`   ID: ${result.data.id}`);
        console.log(`   API: ${result.data.apiName}`);
        console.log(`   Version: ${result.data.version}`);
        console.log(`   Strategy: ${result.data.versioningStrategy}`);
        console.log(`   Status: ${result.data.status}`);
      } else {
        console.error(`❌ Failed to create API version: ${result.error?.message}`);
        process.exit(1);
      }
    } catch (error) {
      console.error('💥 Error creating API version:', error);
      process.exit(1);
    }
  });

apiCommand
  .command('deprecate')
  .description('Deprecate an API version')
  .requiredOption('-i, --id <id>', 'API version ID')
  .requiredOption('--reason <reason>', 'Deprecation reason')
  .option('--migration-guide <url>', 'Migration guide URL')
  .option('--breaking-changes <changes>', 'Comma-separated breaking changes')
  .option('-c, --config <path>', 'Path to configuration file')
  .action(async (options) => {
    try {
      const config = await loadConfig(options.config);
      const manager = new APIVersionManager(config);

      const breakingChanges = options.breakingChanges 
        ? options.breakingChanges.split(',').map((c: string) => c.trim())
        : undefined;

      const result = await manager.deprecateAPIVersion(
        options.id,
        options.reason,
        options.migrationGuide,
        breakingChanges
      );

      if (result.success && result.data) {
        console.log(`✅ API version deprecated successfully:`);
        console.log(`   Notice ID: ${result.data.id}`);
        console.log(`   Deprecation Date: ${result.data.deprecationDate.toLocaleDateString()}`);
        console.log(`   Sunset Date: ${result.data.sunsetDate?.toLocaleDateString()}`);
        console.log(`   Removal Date: ${result.data.removalDate?.toLocaleDateString()}`);
      } else {
        console.error(`❌ Failed to deprecate API version: ${result.error?.message}`);
        process.exit(1);
      }
    } catch (error) {
      console.error('💥 Error deprecating API version:', error);
      process.exit(1);
    }
  });

apiCommand
  .command('list')
  .description('List API versions')
  .option('-n, --name <name>', 'Filter by API name')
  .option('-s, --status <status>', 'Filter by status')
  .option('--deprecated', 'Show only deprecated versions')
  .option('--active-only', 'Show only versions with active clients')
  .option('-c, --config <path>', 'Path to configuration file')
  .action(async (options) => {
    try {
      const config = await loadConfig(options.config);
      const manager = new APIVersionManager(config);

      const filters: any = {};
      if (options.name) filters.apiName = options.name;
      if (options.status) filters.status = options.status;
      if (options.deprecated) filters.deprecated = true;
      if (options.activeOnly) filters.activeOnly = true;

      const result = await manager.getAPIVersions(filters);

      if (result.success && result.data) {
        console.log(`📋 API Versions (${result.data.length} found):`);
        console.log('');

        result.data.forEach(api => {
          const statusIcon = api.status === 'deprecated' ? '⚠️' : api.status === 'stable' ? '✅' : '🔄';
          
          console.log(`${statusIcon} ${api.apiName} v${api.version}`);
          console.log(`   ID: ${api.id}`);
          console.log(`   Status: ${api.status}`);
          console.log(`   Strategy: ${api.versioningStrategy}`);
          console.log(`   Active Clients: ${api.usage.activeClients}`);
          console.log(`   Requests/Day: ${api.usage.requestsPerDay}`);
          console.log(`   Error Rate: ${(api.usage.errorRate * 100).toFixed(2)}%`);
          console.log(`   Avg Response Time: ${api.usage.averageResponseTime}ms`);
          
          if (api.deprecation) {
            console.log(`   Deprecated: ${api.deprecation.deprecatedDate?.toLocaleDateString()}`);
            console.log(`   Sunset: ${api.deprecation.sunsetDate?.toLocaleDateString()}`);
            console.log(`   Removal: ${api.deprecation.removalDate?.toLocaleDateString()}`);
          }
          console.log('');
        });
      } else {
        console.error(`❌ Failed to list API versions: ${result.error?.message}`);
        process.exit(1);
      }
    } catch (error) {
      console.error('💥 Error listing API versions:', error);
      process.exit(1);
    }
  });

/**
 * Radar visualization commands
 */
const radarCommand = program
  .command('radar')
  .description('Generate radar visualizations');

radarCommand
  .command('generate')
  .description('Generate radar snapshot and visualization')
  .requiredOption('-t, --title <title>', 'Snapshot title')
  .option('-c, --config <path>', 'Path to configuration file')
  .option('-o, --output <dir>', 'Output directory', './radar-output')
  .option('--format <format>', 'Output format (svg, png, html, all)', 'html')
  .option('--publish', 'Publish the snapshot')
  .action(async (options) => {
    try {
      const config = await loadConfig(options.config);
      const manager = new TechRadarManager(config);
      const generator = new RadarGenerator(config);

      // Create snapshot
      console.log('📊 Creating radar snapshot...');
      const snapshotResult = await manager.createSnapshot(
        options.title,
        'cli-user',
        options.publish
      );

      if (!snapshotResult.success || !snapshotResult.data) {
        console.error(`❌ Failed to create snapshot: ${snapshotResult.error?.message}`);
        process.exit(1);
      }

      const snapshot = snapshotResult.data;
      console.log(`✅ Snapshot created: ${snapshot.id} (${snapshot.version})`);

      // Create output directory
      await fs.mkdir(options.output, { recursive: true });

      // Generate visualizations
      console.log('🎨 Generating visualizations...');

      if (options.format === 'svg' || options.format === 'all') {
        const svg = await generator.generateSVG(snapshot);
        const svgPath = path.join(options.output, `radar-${snapshot.version}.svg`);
        await fs.writeFile(svgPath, svg);
        console.log(`📄 SVG generated: ${svgPath}`);
      }

      if (options.format === 'png' || options.format === 'all') {
        const pngPath = path.join(options.output, `radar-${snapshot.version}.png`);
        await generator.generatePNG(snapshot, pngPath);
        console.log(`🖼️  PNG generated: ${pngPath}`);
      }

      if (options.format === 'html' || options.format === 'all') {
        const html = await generator.generateHTML(snapshot);
        const htmlPath = path.join(options.output, `radar-${snapshot.version}.html`);
        await fs.writeFile(htmlPath, html);
        console.log(`🌐 HTML generated: ${htmlPath}`);
      }

      console.log('');
      console.log('📈 Snapshot Summary:');
      console.log(`   Total Technologies: ${snapshot.summary.totalTechnologies}`);
      console.log(`   New Technologies: ${snapshot.summary.newTechnologies}`);
      console.log(`   Deprecated Technologies: ${snapshot.summary.deprecatedTechnologies}`);
      console.log(`   Published: ${snapshot.isPublished ? 'Yes' : 'No'}`);
    } catch (error) {
      console.error('💥 Error generating radar:', error);
      process.exit(1);
    }
  });

/**
 * Configuration commands
 */
program
  .command('init')
  .description('Initialize tech radar configuration')
  .option('-o, --output <path>', 'Output path for configuration file', '.tech-radar/config.yaml')
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
      console.log('1. Edit the configuration file to match your organization');
      console.log('2. Add technologies: tech-radar tech add --name "React" --description "..." --quadrant languages-frameworks --ring adopt');
      console.log('3. Generate radar: tech-radar radar generate --title "Q1 2024 Tech Radar"');
    } catch (error) {
      console.error('💥 Error initializing configuration:', error);
      process.exit(1);
    }
  });

// Parse command line arguments
program.parse();

export { program };
