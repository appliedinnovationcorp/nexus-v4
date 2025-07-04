import { ResourceCostEstimate, FinOpsConfig } from '../types';
import { SecretManager } from '@nexus/secret-management';
import { AnalyticsTracker } from '@nexus/analytics';

interface AWSPricingData {
  [service: string]: {
    [region: string]: {
      [instanceType: string]: {
        onDemand: number;
        reserved?: {
          '1yr': number;
          '3yr': number;
        };
        spot?: number;
      };
    };
  };
}

interface InfrastructureChange {
  type: 'CREATE' | 'UPDATE' | 'DELETE';
  resourceType: string;
  resourceId?: string;
  configuration: Record<string, any>;
  region: string;
}

export class CostEstimationEngine {
  private secretManager: SecretManager;
  private analytics: AnalyticsTracker;
  private config: FinOpsConfig;
  private pricingData: AWSPricingData = {};
  private lastPricingUpdate: Date | null = null;

  constructor(config: FinOpsConfig) {
    this.config = config;
    this.secretManager = new SecretManager();
    this.analytics = new AnalyticsTracker();
  }

  /**
   * Estimate cost for a single resource
   */
  async estimateResourceCost(
    resourceType: string,
    configuration: Record<string, any>,
    region: string,
    options?: {
      utilizationRate?: number;
      hoursPerDay?: number;
      daysPerMonth?: number;
      includeDataTransfer?: boolean;
      includeStorage?: boolean;
    }
  ): Promise<ResourceCostEstimate> {
    try {
      await this.ensurePricingDataUpdated();

      const utilizationRate = options?.utilizationRate || 1;
      const hoursPerDay = options?.hoursPerDay || 24;
      const daysPerMonth = options?.daysPerMonth || 30;

      let hourlyRate = 0;
      let additionalCosts = 0;
      let confidence: 'LOW' | 'MEDIUM' | 'HIGH' = 'MEDIUM';

      switch (resourceType) {
        case 'AWS::EC2::Instance':
          hourlyRate = await this.getEC2InstanceCost(configuration, region);
          if (options?.includeStorage) {
            additionalCosts += await this.getEBSStorageCost(configuration, region);
          }
          break;

        case 'AWS::RDS::DBInstance':
          hourlyRate = await this.getRDSInstanceCost(configuration, region);
          break;

        case 'AWS::Lambda::Function':
          hourlyRate = await this.getLambdaCost(configuration, region);
          confidence = 'LOW'; // Lambda costs are highly variable
          break;

        case 'AWS::S3::Bucket':
          hourlyRate = await this.getS3StorageCost(configuration, region);
          break;

        case 'AWS::ECS::Service':
          hourlyRate = await this.getECSServiceCost(configuration, region);
          break;

        case 'AWS::EKS::Cluster':
          hourlyRate = await this.getEKSClusterCost(configuration, region);
          break;

        case 'AWS::ElastiCache::CacheCluster':
          hourlyRate = await this.getElastiCacheCost(configuration, region);
          break;

        case 'AWS::Elasticsearch::Domain':
          hourlyRate = await this.getElasticsearchCost(configuration, region);
          break;

        default:
          hourlyRate = 0;
          confidence = 'LOW';
      }

      // Apply utilization and usage patterns
      const effectiveHourlyRate = hourlyRate * utilizationRate;
      const dailyCost = effectiveHourlyRate * hoursPerDay;
      const monthlyCost = dailyCost * daysPerMonth + additionalCosts;
      const annualCost = monthlyCost * 12;

      // Add data transfer costs if requested
      if (options?.includeDataTransfer) {
        const dataTransferCost = await this.estimateDataTransferCost(configuration, region);
        additionalCosts += dataTransferCost;
      }

      const estimate: ResourceCostEstimate = {
        resourceType,
        resourceId: configuration.resourceId,
        region,
        hourlyRate: effectiveHourlyRate,
        dailyCost,
        monthlyCost,
        annualCost,
        instanceType: configuration.instanceType,
        storageSize: configuration.storageSize,
        storageType: configuration.storageType,
        utilizationRate,
        hoursPerDay,
        daysPerMonth,
        dataTransferCost: options?.includeDataTransfer ? await this.estimateDataTransferCost(configuration, region) : undefined,
        storageCost: options?.includeStorage ? await this.getEBSStorageCost(configuration, region) * 24 * daysPerMonth : undefined,
        estimatedAt: new Date(),
        confidence,
        notes: this.generateEstimationNotes(resourceType, configuration, confidence),
      };

      await this.analytics.track('finops.cost.resource_estimated', {
        resourceType,
        region,
        monthlyCost,
        confidence,
        utilizationRate,
      });

      return estimate;
    } catch (error) {
      await this.analytics.track('finops.cost.estimation_error', {
        resourceType,
        region,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Estimate cost impact of infrastructure changes
   */
  async estimateInfrastructureChanges(
    changes: InfrastructureChange[]
  ): Promise<{
    totalCurrentCost: number;
    totalNewCost: number;
    costDifference: number;
    percentageChange: number;
    breakdown: Array<{
      change: InfrastructureChange;
      currentCost: number;
      newCost: number;
      costDifference: number;
      estimate: ResourceCostEstimate;
    }>;
  }> {
    try {
      const breakdown: Array<{
        change: InfrastructureChange;
        currentCost: number;
        newCost: number;
        costDifference: number;
        estimate: ResourceCostEstimate;
      }> = [];

      let totalCurrentCost = 0;
      let totalNewCost = 0;

      for (const change of changes) {
        let currentCost = 0;
        let newCost = 0;

        switch (change.type) {
          case 'CREATE':
            // New resource, current cost is 0
            const createEstimate = await this.estimateResourceCost(
              change.resourceType,
              change.configuration,
              change.region
            );
            newCost = createEstimate.monthlyCost;
            breakdown.push({
              change,
              currentCost: 0,
              newCost,
              costDifference: newCost,
              estimate: createEstimate,
            });
            break;

          case 'DELETE':
            // Resource being deleted, new cost is 0
            if (change.resourceId) {
              currentCost = await this.getCurrentResourceCost(change.resourceId, change.resourceType);
            }
            breakdown.push({
              change,
              currentCost,
              newCost: 0,
              costDifference: -currentCost,
              estimate: await this.estimateResourceCost(change.resourceType, {}, change.region),
            });
            break;

          case 'UPDATE':
            // Resource being modified
            if (change.resourceId) {
              currentCost = await this.getCurrentResourceCost(change.resourceId, change.resourceType);
            }
            const updateEstimate = await this.estimateResourceCost(
              change.resourceType,
              change.configuration,
              change.region
            );
            newCost = updateEstimate.monthlyCost;
            breakdown.push({
              change,
              currentCost,
              newCost,
              costDifference: newCost - currentCost,
              estimate: updateEstimate,
            });
            break;
        }

        totalCurrentCost += currentCost;
        totalNewCost += newCost;
      }

      const costDifference = totalNewCost - totalCurrentCost;
      const percentageChange = totalCurrentCost > 0 ? (costDifference / totalCurrentCost) * 100 : 0;

      const result = {
        totalCurrentCost,
        totalNewCost,
        costDifference,
        percentageChange,
        breakdown,
      };

      await this.analytics.track('finops.cost.infrastructure_changes_estimated', {
        changeCount: changes.length,
        totalCurrentCost,
        totalNewCost,
        costDifference,
        percentageChange,
      });

      return result;
    } catch (error) {
      await this.analytics.track('finops.cost.infrastructure_estimation_error', {
        changeCount: changes.length,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Generate cost estimation report for CI/CD pipeline
   */
  async generateCIPipelineReport(
    changes: InfrastructureChange[],
    pullRequestId?: string,
    branch?: string
  ): Promise<{
    summary: {
      totalChanges: number;
      costImpact: number;
      percentageChange: number;
      riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    };
    details: {
      newResources: number;
      modifiedResources: number;
      deletedResources: number;
      estimatedMonthlyCost: number;
      breakdown: Array<{
        resourceType: string;
        action: string;
        costImpact: number;
        confidence: string;
      }>;
    };
    recommendations: string[];
    warnings: string[];
  }> {
    try {
      const estimation = await this.estimateInfrastructureChanges(changes);
      
      const newResources = changes.filter(c => c.type === 'CREATE').length;
      const modifiedResources = changes.filter(c => c.type === 'UPDATE').length;
      const deletedResources = changes.filter(c => c.type === 'DELETE').length;

      const riskLevel = this.calculateRiskLevel(estimation.costDifference, estimation.percentageChange);
      const recommendations = this.generateRecommendations(estimation.breakdown);
      const warnings = this.generateWarnings(estimation.breakdown);

      const report = {
        summary: {
          totalChanges: changes.length,
          costImpact: estimation.costDifference,
          percentageChange: estimation.percentageChange,
          riskLevel,
        },
        details: {
          newResources,
          modifiedResources,
          deletedResources,
          estimatedMonthlyCost: estimation.totalNewCost,
          breakdown: estimation.breakdown.map(item => ({
            resourceType: item.change.resourceType,
            action: item.change.type,
            costImpact: item.costDifference,
            confidence: item.estimate.confidence,
          })),
        },
        recommendations,
        warnings,
      };

      await this.analytics.track('finops.cost.ci_report_generated', {
        pullRequestId,
        branch,
        totalChanges: changes.length,
        costImpact: estimation.costDifference,
        riskLevel,
      });

      return report;
    } catch (error) {
      await this.analytics.track('finops.cost.ci_report_error', {
        pullRequestId,
        branch,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Private helper methods for specific AWS services
   */
  private async getEC2InstanceCost(config: Record<string, any>, region: string): Promise<number> {
    const instanceType = config.instanceType || 't3.micro';
    const pricing = this.pricingData.ec2?.[region]?.[instanceType];
    return pricing?.onDemand || 0.0116; // Default t3.micro price
  }

  private async getRDSInstanceCost(config: Record<string, any>, region: string): Promise<number> {
    const instanceType = config.dbInstanceClass || 'db.t3.micro';
    const engine = config.engine || 'mysql';
    const pricing = this.pricingData.rds?.[region]?.[instanceType];
    return pricing?.onDemand || 0.017; // Default db.t3.micro price
  }

  private async getLambdaCost(config: Record<string, any>, region: string): Promise<number> {
    const memorySize = config.memorySize || 128;
    const estimatedInvocations = config.estimatedInvocations || 1000000; // per month
    const averageDuration = config.averageDuration || 100; // ms
    
    // Lambda pricing: $0.0000166667 per GB-second
    const gbSeconds = (memorySize / 1024) * (averageDuration / 1000) * estimatedInvocations;
    const computeCost = gbSeconds * 0.0000166667;
    
    // Request cost: $0.20 per 1M requests
    const requestCost = (estimatedInvocations / 1000000) * 0.20;
    
    return (computeCost + requestCost) / (30 * 24); // Convert to hourly
  }

  private async getS3StorageCost(config: Record<string, any>, region: string): Promise<number> {
    const storageSize = config.storageSize || 1; // GB
    const storageClass = config.storageClass || 'STANDARD';
    
    let pricePerGB = 0.023; // Standard storage price
    if (storageClass === 'STANDARD_IA') pricePerGB = 0.0125;
    if (storageClass === 'GLACIER') pricePerGB = 0.004;
    
    return (storageSize * pricePerGB) / (30 * 24); // Convert to hourly
  }

  private async getECSServiceCost(config: Record<string, any>, region: string): Promise<number> {
    const taskDefinition = config.taskDefinition || {};
    const cpu = taskDefinition.cpu || 256;
    const memory = taskDefinition.memory || 512;
    const desiredCount = config.desiredCount || 1;
    
    // Fargate pricing
    const cpuCost = (cpu / 1024) * 0.04048; // per vCPU per hour
    const memoryCost = (memory / 1024) * 0.004445; // per GB per hour
    
    return (cpuCost + memoryCost) * desiredCount;
  }

  private async getEKSClusterCost(config: Record<string, any>, region: string): Promise<number> {
    // EKS cluster cost: $0.10 per hour
    const clusterCost = 0.10;
    
    // Add node group costs if specified
    const nodeGroups = config.nodeGroups || [];
    let nodeGroupCost = 0;
    
    for (const nodeGroup of nodeGroups) {
      const instanceType = nodeGroup.instanceType || 't3.medium';
      const desiredSize = nodeGroup.desiredSize || 1;
      const instanceCost = await this.getEC2InstanceCost({ instanceType }, region);
      nodeGroupCost += instanceCost * desiredSize;
    }
    
    return clusterCost + nodeGroupCost;
  }

  private async getElastiCacheCost(config: Record<string, any>, region: string): Promise<number> {
    const nodeType = config.cacheNodeType || 'cache.t3.micro';
    const numCacheNodes = config.numCacheNodes || 1;
    
    // Default ElastiCache pricing
    const pricing = this.pricingData.elasticache?.[region]?.[nodeType];
    return (pricing?.onDemand || 0.017) * numCacheNodes;
  }

  private async getElasticsearchCost(config: Record<string, any>, region: string): Promise<number> {
    const instanceType = config.instanceType || 't3.small.elasticsearch';
    const instanceCount = config.instanceCount || 1;
    
    // Default Elasticsearch pricing
    const pricing = this.pricingData.elasticsearch?.[region]?.[instanceType];
    return (pricing?.onDemand || 0.036) * instanceCount;
  }

  private async getEBSStorageCost(config: Record<string, any>, region: string): Promise<number> {
    const storageSize = config.storageSize || 8; // GB
    const storageType = config.storageType || 'gp3';
    
    let pricePerGB = 0.08; // gp3 price per month
    if (storageType === 'gp2') pricePerGB = 0.10;
    if (storageType === 'io1' || storageType === 'io2') pricePerGB = 0.125;
    
    return storageSize * pricePerGB; // Monthly cost
  }

  private async estimateDataTransferCost(config: Record<string, any>, region: string): Promise<number> {
    const estimatedTransferGB = config.estimatedDataTransferGB || 1;
    const dataTransferPrice = 0.09; // $0.09 per GB for first 10TB
    return estimatedTransferGB * dataTransferPrice;
  }

  private async getCurrentResourceCost(resourceId: string, resourceType: string): Promise<number> {
    // This would typically query Cost Explorer for actual resource costs
    // For now, return a placeholder value
    return 100; // $100/month placeholder
  }

  private async ensurePricingDataUpdated(): Promise<void> {
    const now = new Date();
    const oneDay = 24 * 60 * 60 * 1000;
    
    if (!this.lastPricingUpdate || (now.getTime() - this.lastPricingUpdate.getTime()) > oneDay) {
      await this.updatePricingData();
      this.lastPricingUpdate = now;
    }
  }

  private async updatePricingData(): Promise<void> {
    // This would typically fetch real-time pricing from AWS Pricing API
    // For now, use static pricing data
    this.pricingData = {
      ec2: {
        'us-east-1': {
          't3.micro': { onDemand: 0.0104 },
          't3.small': { onDemand: 0.0208 },
          't3.medium': { onDemand: 0.0416 },
          'm5.large': { onDemand: 0.096 },
        },
      },
      rds: {
        'us-east-1': {
          'db.t3.micro': { onDemand: 0.017 },
          'db.t3.small': { onDemand: 0.034 },
        },
      },
    };
  }

  private calculateRiskLevel(costDifference: number, percentageChange: number): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
    if (Math.abs(costDifference) < 100 && Math.abs(percentageChange) < 10) return 'LOW';
    if (Math.abs(costDifference) < 500 && Math.abs(percentageChange) < 25) return 'MEDIUM';
    if (Math.abs(costDifference) < 1000 && Math.abs(percentageChange) < 50) return 'HIGH';
    return 'CRITICAL';
  }

  private generateRecommendations(breakdown: any[]): string[] {
    const recommendations: string[] = [];
    
    for (const item of breakdown) {
      if (item.change.type === 'CREATE' && item.newCost > 500) {
        recommendations.push(`Consider using Reserved Instances for ${item.change.resourceType} to save up to 60%`);
      }
      
      if (item.estimate.confidence === 'LOW') {
        recommendations.push(`Review configuration for ${item.change.resourceType} - cost estimate has low confidence`);
      }
      
      if (item.change.resourceType === 'AWS::EC2::Instance' && item.change.configuration.instanceType?.includes('xlarge')) {
        recommendations.push('Consider right-sizing EC2 instances based on actual usage patterns');
      }
    }
    
    return recommendations;
  }

  private generateWarnings(breakdown: any[]): string[] {
    const warnings: string[] = [];
    
    for (const item of breakdown) {
      if (item.costDifference > 1000) {
        warnings.push(`High cost impact detected for ${item.change.resourceType}: $${item.costDifference.toFixed(2)}/month`);
      }
      
      if (item.change.type === 'DELETE' && item.currentCost > 100) {
        warnings.push(`Deleting resource with significant cost: ${item.change.resourceType} ($${item.currentCost.toFixed(2)}/month)`);
      }
    }
    
    return warnings;
  }

  private generateEstimationNotes(resourceType: string, configuration: Record<string, any>, confidence: string): string {
    const notes: string[] = [];
    
    notes.push(`Estimation confidence: ${confidence}`);
    
    if (resourceType === 'AWS::Lambda::Function') {
      notes.push('Lambda costs are highly dependent on actual usage patterns');
    }
    
    if (resourceType === 'AWS::S3::Bucket') {
      notes.push('S3 costs include storage only; data transfer and request costs not included');
    }
    
    if (confidence === 'LOW') {
      notes.push('Consider providing more detailed configuration for better accuracy');
    }
    
    return notes.join('; ');
  }
}
