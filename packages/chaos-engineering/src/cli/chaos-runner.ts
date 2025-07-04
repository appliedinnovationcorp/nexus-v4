#!/usr/bin/env node

import { Command } from 'commander';
import { ChaosEngine } from '../core/chaos-engine';
import { ChaosScheduler } from '../scheduler/chaos-scheduler';
import { ExperimentLibrary } from '../experiments/experiment-library';
import { GremlinClient } from '../integrations/gremlin-client';
import { ChaosConfig, ChaosExperiment } from '../types';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as yaml from 'js-yaml';

const program = new Command();

program
  .name('chaos-runner')
  .description('Chaos Engineering CLI for running and managing chaos experiments')
  .version('1.0.0');

/**
 * Load configuration from file
 */
async function loadConfig(configPath?: string): Promise<ChaosConfig> {
  const defaultConfigPath = path.join(process.cwd(), '.chaos', 'config.yaml');
  const finalConfigPath = configPath || defaultConfigPath;

  try {
    const configContent = await fs.readFile(finalConfigPath, 'utf-8');
    const config = yaml.load(configContent) as ChaosConfig;
    return config;
  } catch (error) {
    console.error(`Failed to load config from ${finalConfigPath}:`, error);
    process.exit(1);
  }
}

/**
 * Load experiment from file
 */
async function loadExperiment(experimentPath: string): Promise<ChaosExperiment> {
  try {
    const experimentContent = await fs.readFile(experimentPath, 'utf-8');
    let experiment: ChaosExperiment;

    if (experimentPath.endsWith('.yaml') || experimentPath.endsWith('.yml')) {
      experiment = yaml.load(experimentContent) as ChaosExperiment;
    } else {
      experiment = JSON.parse(experimentContent);
    }

    return experiment;
  } catch (error) {
    console.error(`Failed to load experiment from ${experimentPath}:`, error);
    process.exit(1);
  }
}

/**
 * Run experiment command
 */
program
  .command('run')
  .description('Run a chaos experiment')
  .option('-e, --experiment <path>', 'Path to experiment file')
  .option('-c, --config <path>', 'Path to configuration file')
  .option('--dry-run', 'Perform a dry run without actually executing the experiment')
  .option('--wait', 'Wait for experiment completion')
  .action(async (options) => {
    try {
      if (!options.experiment) {
        console.error('Experiment file is required');
        process.exit(1);
      }

      const config = await loadConfig(options.config);
      const experiment = await loadExperiment(options.experiment);

      if (options.dryRun) {
        config.global.dryRun = true;
        console.log('🧪 DRY RUN MODE - No actual faults will be injected');
      }

      const chaosEngine = new ChaosEngine(config);
      
      console.log(`🚀 Starting chaos experiment: ${experiment.name}`);
      console.log(`📋 Description: ${experiment.description}`);
      console.log(`🎯 Environment: ${experiment.environment}`);
      console.log(`⚡ Fault Type: ${experiment.faultType}`);
      console.log(`⏱️  Duration: ${experiment.duration} seconds`);

      const result = await chaosEngine.executeExperiment(experiment);

      if (result.success && result.data) {
        console.log(`✅ Experiment started successfully`);
        console.log(`🆔 Execution ID: ${result.data.id}`);

        if (options.wait) {
          console.log('⏳ Waiting for experiment completion...');
          await waitForCompletion(chaosEngine, result.data.id);
        } else {
          console.log('💡 Use "chaos-runner status" to check execution status');
        }
      } else {
        console.error('❌ Failed to start experiment:', result.error?.message);
        process.exit(1);
      }
    } catch (error) {
      console.error('💥 Error running experiment:', error);
      process.exit(1);
    }
  });

/**
 * Status command
 */
program
  .command('status')
  .description('Check experiment execution status')
  .option('-e, --execution-id <id>', 'Execution ID to check')
  .option('-c, --config <path>', 'Path to configuration file')
  .option('--all', 'Show all active executions')
  .action(async (options) => {
    try {
      const config = await loadConfig(options.config);
      const chaosEngine = new ChaosEngine(config);

      if (options.all) {
        const result = await chaosEngine.getActiveExecutions();
        if (result.success && result.data) {
          console.log(`📊 Active Executions: ${result.data.length}`);
          
          for (const execution of result.data) {
            console.log(`\n🆔 ${execution.id}`);
            console.log(`📝 Experiment: ${execution.experimentId}`);
            console.log(`📊 Status: ${getStatusEmoji(execution.status)} ${execution.status}`);
            console.log(`⏰ Started: ${execution.startedAt.toLocaleString()}`);
            
            if (execution.completedAt) {
              console.log(`🏁 Completed: ${execution.completedAt.toLocaleString()}`);
            }
          }
        }
      } else if (options.executionId) {
        const result = await chaosEngine.getExecutionStatus(options.executionId);
        if (result.success && result.data) {
          const execution = result.data;
          
          console.log(`\n📊 Execution Status Report`);
          console.log(`🆔 Execution ID: ${execution.id}`);
          console.log(`📝 Experiment: ${execution.experimentId}`);
          console.log(`📊 Status: ${getStatusEmoji(execution.status)} ${execution.status}`);
          console.log(`⏰ Started: ${execution.startedAt.toLocaleString()}`);
          
          if (execution.completedAt) {
            console.log(`🏁 Completed: ${execution.completedAt.toLocaleString()}`);
            console.log(`⏱️  Duration: ${execution.duration} seconds`);
          }

          console.log(`\n🎯 Targets: ${execution.targets.length}`);
          execution.targets.forEach((target, index) => {
            console.log(`  ${index + 1}. ${target.type} (${target.status})`);
          });

          console.log(`\n📋 Phases:`);
          execution.phases.forEach((phase, index) => {
            const statusEmoji = getStatusEmoji(phase.status);
            console.log(`  ${index + 1}. ${phase.name}: ${statusEmoji} ${phase.status}`);
          });

          if (execution.results.weaknessesFound.length > 0) {
            console.log(`\n⚠️  Weaknesses Found: ${execution.results.weaknessesFound.length}`);
            execution.results.weaknessesFound.forEach((weakness, index) => {
              console.log(`  ${index + 1}. ${weakness.type}: ${weakness.description}`);
            });
          }

          if (execution.results.recommendations.length > 0) {
            console.log(`\n💡 Recommendations:`);
            execution.results.recommendations.forEach((rec, index) => {
              console.log(`  ${index + 1}. ${rec}`);
            });
          }
        } else {
          console.error('❌ Failed to get execution status:', result.error?.message);
          process.exit(1);
        }
      } else {
        console.error('Either --execution-id or --all is required');
        process.exit(1);
      }
    } catch (error) {
      console.error('💥 Error checking status:', error);
      process.exit(1);
    }
  });

/**
 * Stop command
 */
program
  .command('stop')
  .description('Stop a running experiment')
  .requiredOption('-e, --execution-id <id>', 'Execution ID to stop')
  .option('-c, --config <path>', 'Path to configuration file')
  .option('-r, --reason <reason>', 'Reason for stopping the experiment')
  .action(async (options) => {
    try {
      const config = await loadConfig(options.config);
      const chaosEngine = new ChaosEngine(config);

      console.log(`🛑 Stopping experiment execution: ${options.executionId}`);
      
      const result = await chaosEngine.stopExperiment(options.executionId, options.reason);

      if (result.success) {
        console.log('✅ Experiment stopped successfully');
      } else {
        console.error('❌ Failed to stop experiment:', result.error?.message);
        process.exit(1);
      }
    } catch (error) {
      console.error('💥 Error stopping experiment:', error);
      process.exit(1);
    }
  });

/**
 * List templates command
 */
program
  .command('templates')
  .description('List available experiment templates')
  .option('--category <category>', 'Filter by category')
  .action((options) => {
    const templates = ExperimentLibrary.getAllTemplates();
    
    const filteredTemplates = options.category 
      ? templates.filter(t => t.category.toLowerCase() === options.category.toLowerCase())
      : templates;

    console.log(`📚 Available Experiment Templates: ${filteredTemplates.length}`);
    
    const categories = [...new Set(filteredTemplates.map(t => t.category))];
    
    categories.forEach(category => {
      console.log(`\n📁 ${category}:`);
      const categoryTemplates = filteredTemplates.filter(t => t.category === category);
      
      categoryTemplates.forEach((template, index) => {
        console.log(`  ${index + 1}. ${template.name}`);
        console.log(`     ${template.description}`);
        console.log(`     Fault Type: ${template.faultType}`);
      });
    });
  });

/**
 * Generate experiment command
 */
program
  .command('generate')
  .description('Generate an experiment from a template')
  .requiredOption('-t, --template <name>', 'Template name')
  .requiredOption('-o, --output <path>', 'Output file path')
  .option('--name <name>', 'Experiment name')
  .option('--environment <env>', 'Target environment', 'staging')
  .option('--duration <seconds>', 'Experiment duration in seconds', '300')
  .action(async (options) => {
    try {
      const templates = ExperimentLibrary.getAllTemplates();
      const template = templates.find(t => 
        t.name.toLowerCase().includes(options.template.toLowerCase())
      );

      if (!template) {
        console.error(`❌ Template not found: ${options.template}`);
        console.log('\n📚 Available templates:');
        templates.forEach(t => console.log(`  - ${t.name}`));
        process.exit(1);
      }

      // Generate experiment with basic parameters
      const experimentOptions = {
        name: options.name || `Generated ${template.name}`,
        environment: options.environment as any,
        targetSelector: {
          type: 'service' as const,
          filters: { environment: [options.environment] },
          percentage: 50,
        },
        duration: parseInt(options.duration),
        description: `Generated experiment based on ${template.name} template`,
      };

      // Add template-specific options
      let experiment: ChaosExperiment;
      
      switch (template.faultType) {
        case 'cpu_stress':
          experiment = ExperimentLibrary.createCpuStressExperiment({
            ...experimentOptions,
            cpuPercentage: 70,
          });
          break;
        case 'memory_stress':
          experiment = ExperimentLibrary.createMemoryStressExperiment({
            ...experimentOptions,
            memoryPercentage: 80,
          });
          break;
        case 'network_latency':
          experiment = ExperimentLibrary.createNetworkLatencyExperiment({
            ...experimentOptions,
            latencyMs: 200,
            jitterMs: 50,
          });
          break;
        default:
          console.error(`❌ Template generation not implemented for: ${template.faultType}`);
          process.exit(1);
      }

      // Write experiment to file
      const experimentYaml = yaml.dump(experiment, { indent: 2 });
      await fs.writeFile(options.output, experimentYaml, 'utf-8');

      console.log(`✅ Generated experiment: ${options.output}`);
      console.log(`📝 Name: ${experiment.name}`);
      console.log(`🎯 Environment: ${experiment.environment}`);
      console.log(`⚡ Fault Type: ${experiment.faultType}`);
      console.log(`⏱️  Duration: ${experiment.duration} seconds`);
    } catch (error) {
      console.error('💥 Error generating experiment:', error);
      process.exit(1);
    }
  });

/**
 * Validate experiment command
 */
program
  .command('validate')
  .description('Validate an experiment file')
  .requiredOption('-e, --experiment <path>', 'Path to experiment file')
  .option('-c, --config <path>', 'Path to configuration file')
  .action(async (options) => {
    try {
      const config = await loadConfig(options.config);
      const experiment = await loadExperiment(options.experiment);

      console.log(`🔍 Validating experiment: ${experiment.name}`);

      // Basic validation
      const errors: string[] = [];
      const warnings: string[] = [];

      if (!experiment.name) errors.push('Experiment name is required');
      if (!experiment.description) warnings.push('Experiment description is recommended');
      if (!experiment.environment) errors.push('Environment is required');
      if (!experiment.faultType) errors.push('Fault type is required');
      if (!experiment.duration || experiment.duration <= 0) errors.push('Valid duration is required');

      // Environment-specific validation
      const envConfig = config.environments[experiment.environment];
      if (!envConfig) {
        errors.push(`Environment ${experiment.environment} is not configured`);
      } else {
        if (!envConfig.enabled) {
          warnings.push(`Environment ${experiment.environment} is disabled`);
        }
        if (!envConfig.allowedFaultTypes.includes(experiment.faultType)) {
          errors.push(`Fault type ${experiment.faultType} is not allowed in ${experiment.environment}`);
        }
      }

      // Safety validation
      if (experiment.targetSelector.percentage > config.safety.blastRadius.maxTargetPercentage) {
        errors.push(`Target percentage (${experiment.targetSelector.percentage}%) exceeds blast radius limit (${config.safety.blastRadius.maxTargetPercentage}%)`);
      }

      // Report results
      if (errors.length === 0) {
        console.log('✅ Experiment validation passed');
        
        if (warnings.length > 0) {
          console.log('\n⚠️  Warnings:');
          warnings.forEach(warning => console.log(`  - ${warning}`));
        }
      } else {
        console.log('❌ Experiment validation failed');
        console.log('\n🚨 Errors:');
        errors.forEach(error => console.log(`  - ${error}`));
        
        if (warnings.length > 0) {
          console.log('\n⚠️  Warnings:');
          warnings.forEach(warning => console.log(`  - ${warning}`));
        }
        
        process.exit(1);
      }
    } catch (error) {
      console.error('💥 Error validating experiment:', error);
      process.exit(1);
    }
  });

/**
 * Scheduler commands
 */
const schedulerCommand = program
  .command('scheduler')
  .description('Manage chaos experiment scheduler');

schedulerCommand
  .command('start')
  .description('Start the chaos scheduler')
  .option('-c, --config <path>', 'Path to configuration file')
  .action(async (options) => {
    try {
      const config = await loadConfig(options.config);
      const chaosEngine = new ChaosEngine(config);
      const scheduler = new ChaosScheduler(chaosEngine, config);

      console.log('🚀 Starting chaos scheduler...');
      await scheduler.start();
      
      // Keep the process running
      process.on('SIGINT', async () => {
        console.log('\n🛑 Stopping chaos scheduler...');
        await scheduler.stop();
        process.exit(0);
      });

      console.log('✅ Chaos scheduler is running');
      console.log('Press Ctrl+C to stop');
    } catch (error) {
      console.error('💥 Error starting scheduler:', error);
      process.exit(1);
    }
  });

schedulerCommand
  .command('status')
  .description('Check scheduler status')
  .option('-c, --config <path>', 'Path to configuration file')
  .action(async (options) => {
    try {
      // This would connect to a running scheduler instance
      console.log('📊 Scheduler Status: Not implemented in CLI mode');
      console.log('💡 Use the web interface or API to check scheduler status');
    } catch (error) {
      console.error('💥 Error checking scheduler status:', error);
      process.exit(1);
    }
  });

/**
 * Helper functions
 */
function getStatusEmoji(status: string): string {
  switch (status) {
    case 'pending': return '⏳';
    case 'running': return '🏃';
    case 'completed': return '✅';
    case 'failed': return '❌';
    case 'cancelled': return '🛑';
    case 'rolled_back': return '↩️';
    default: return '❓';
  }
}

async function waitForCompletion(chaosEngine: ChaosEngine, executionId: string): Promise<void> {
  const maxWaitTime = 30 * 60 * 1000; // 30 minutes
  const pollInterval = 5000; // 5 seconds
  const startTime = Date.now();

  while (Date.now() - startTime < maxWaitTime) {
    const result = await chaosEngine.getExecutionStatus(executionId);
    
    if (result.success && result.data) {
      const status = result.data.status;
      
      if (status === 'completed') {
        console.log('✅ Experiment completed successfully');
        
        if (result.data.results.weaknessesFound.length > 0) {
          console.log(`\n⚠️  Found ${result.data.results.weaknessesFound.length} weakness(es):`);
          result.data.results.weaknessesFound.forEach((weakness, index) => {
            console.log(`  ${index + 1}. ${weakness.description} (${weakness.severity})`);
          });
        }
        
        return;
      } else if (status === 'failed') {
        console.log('❌ Experiment failed');
        if (result.data.error) {
          console.log(`Error: ${result.data.error.message}`);
        }
        process.exit(1);
      } else if (status === 'cancelled' || status === 'rolled_back') {
        console.log(`🛑 Experiment ${status}`);
        if (result.data.rollbackReason) {
          console.log(`Reason: ${result.data.rollbackReason}`);
        }
        return;
      }
      
      console.log(`⏳ Status: ${status}`);
    }
    
    await new Promise(resolve => setTimeout(resolve, pollInterval));
  }
  
  console.log('⏰ Timeout waiting for experiment completion');
}

// Parse command line arguments
program.parse();

export { program };
