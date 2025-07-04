import axios from 'axios';
import lighthouse from 'lighthouse';
import {
  CarbonFootprintConfig,
  CarbonFootprintResult,
} from '../types';
import { SecretManager } from '@nexus/secret-management';
import { AnalyticsTracker } from '@nexus/analytics';
import { v4 as uuidv4 } from 'uuid';

interface WebsiteCarbonResponse {
  url: string;
  green: boolean;
  bytes: number;
  cleanerThan: number;
  statistics: {
    adjustedBytes: number;
    energy: number;
    co2: {
      grid: {
        grams: number;
        litres: number;
      };
      renewable: {
        grams: number;
        litres: number;
      };
    };
  };
}

interface CloudCarbonIntensity {
  [region: string]: {
    [provider: string]: number; // gCO2/kWh
  };
}

export class CarbonFootprintEstimator {
  private secretManager: SecretManager;
  private analytics: AnalyticsTracker;
  private config: CarbonFootprintConfig;

  // Carbon intensity data (gCO2/kWh) by cloud provider and region
  private readonly carbonIntensity: CloudCarbonIntensity = {
    'us-east-1': { aws: 415, gcp: 479, azure: 415 },
    'us-west-2': { aws: 351, gcp: 351, azure: 351 },
    'eu-west-1': { aws: 316, gcp: 316, azure: 316 },
    'eu-central-1': { aws: 338, gcp: 338, azure: 338 },
    'ap-southeast-1': { aws: 431, gcp: 431, azure: 431 },
    'ap-northeast-1': { aws: 462, gcp: 462, azure: 462 },
  };

  constructor(config: CarbonFootprintConfig) {
    this.config = config;
    this.secretManager = new SecretManager();
    this.analytics = new AnalyticsTracker();
  }

  /**
   * Estimate carbon footprint for a website or application
   */
  async estimateCarbonFootprint(url?: string): Promise<CarbonFootprintResult> {
    const estimationId = uuidv4();
    const startTime = Date.now();

    try {
      console.log(`🌱 Estimating carbon footprint${url ? ` for: ${url}` : ' for infrastructure'}`);

      // Gather data from different sources
      const [websiteData, lighthouseData, infrastructureData] = await Promise.allSettled([
        url && this.config.methods.websiteCarbon.enabled 
          ? this.getWebsiteCarbonData(url) 
          : Promise.resolve(null),
        url && this.config.methods.lighthouse.enabled 
          ? this.getLighthouseData(url) 
          : Promise.resolve(null),
        this.getInfrastructureData(),
      ]);

      // Process results
      const processedWebsiteData = websiteData.status === 'fulfilled' ? websiteData.value : null;
      const processedLighthouseData = lighthouseData.status === 'fulfilled' ? lighthouseData.value : null;
      const processedInfrastructureData = infrastructureData.status === 'fulfilled' ? infrastructureData.value : null;

      // Calculate estimates
      const estimates = await this.calculateEstimates(
        processedWebsiteData,
        processedLighthouseData,
        processedInfrastructureData,
        url
      );

      // Generate breakdown
      const breakdown = this.calculateBreakdown(estimates, processedLighthouseData);

      // Extract performance factors
      const factors = this.extractPerformanceFactors(processedLighthouseData);

      // Generate recommendations
      const recommendations = this.generateRecommendations(estimates, factors, breakdown);

      const result: CarbonFootprintResult = {
        id: estimationId,
        url,
        timestamp: new Date(),
        estimates,
        breakdown,
        factors,
        recommendations,
        metadata: {
          method: this.determineMethod(processedWebsiteData, processedLighthouseData, processedInfrastructureData),
          dataSource: this.determineDataSource(processedWebsiteData, processedLighthouseData),
          confidence: this.calculateConfidence(processedWebsiteData, processedLighthouseData, processedInfrastructureData),
          assumptions: this.getAssumptions(),
          limitations: this.getLimitations(),
        },
      };

      await this.analytics.track('carbon.estimation.completed', {
        url,
        carbonPerPageView: estimates.perPageView.carbonGrams,
        monthlyCarbon: estimates.monthly.carbonKg,
        confidence: result.metadata.confidence,
      });

      return result;
    } catch (error) {
      await this.analytics.track('carbon.estimation.error', {
        url,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Get carbon data from Website Carbon API
   */
  private async getWebsiteCarbonData(url: string): Promise<WebsiteCarbonResponse | null> {
    try {
      const apiUrl = 'https://api.websitecarbon.org/site';
      const params = new URLSearchParams({ url });
      
      if (this.config.methods.websiteCarbon.apiKey) {
        // Use authenticated API for higher rate limits
        const response = await axios.get(`${apiUrl}?${params}`, {
          headers: {
            'Authorization': `Bearer ${this.config.methods.websiteCarbon.apiKey}`,
          },
        });
        return response.data;
      } else {
        // Use public API
        const response = await axios.get(`${apiUrl}?${params}`);
        return response.data;
      }
    } catch (error) {
      console.warn('Website Carbon API failed:', error);
      return null;
    }
  }

  /**
   * Get performance data from Lighthouse
   */
  private async getLighthouseData(url: string): Promise<any> {
    try {
      const result = await lighthouse(url, {
        onlyCategories: ['performance'],
        port: 0,
        chromeFlags: ['--headless', '--no-sandbox'],
      });

      if (!result) {
        throw new Error('Lighthouse audit failed');
      }

      return {
        performance: result.lhr.categories.performance,
        audits: result.lhr.audits,
        timing: result.lhr.timing,
      };
    } catch (error) {
      console.warn('Lighthouse audit failed:', error);
      return null;
    }
  }

  /**
   * Calculate infrastructure carbon footprint
   */
  private async getInfrastructureData(): Promise<any> {
    const infrastructureCarbon = {
      compute: 0,
      storage: 0,
      network: 0,
      database: 0,
    };

    const carbonIntensity = this.carbonIntensity[this.config.infrastructure.region]?.[this.config.infrastructure.cloudProvider] || 500;

    for (const server of this.config.infrastructure.servers) {
      let serverCarbon = 0;

      // Calculate compute carbon
      if (server.specifications.cpu) {
        const cpuPower = server.specifications.cpu.tdp || (server.specifications.cpu.cores * 15); // Estimate 15W per core
        const cpuEnergyKwh = (cpuPower / 1000) * server.hoursPerMonth * server.utilizationRate;
        const cpuCarbonGrams = cpuEnergyKwh * carbonIntensity;
        serverCarbon += cpuCarbonGrams;
      }

      // Calculate memory carbon (approximate)
      if (server.specifications.memory) {
        const memoryPower = server.specifications.memory.size * 0.5; // ~0.5W per GB
        const memoryEnergyKwh = (memoryPower / 1000) * server.hoursPerMonth;
        const memoryCarbonGrams = memoryEnergyKwh * carbonIntensity;
        serverCarbon += memoryCarbonGrams;
      }

      // Calculate storage carbon
      if (server.specifications.storage) {
        const storagePower = server.specifications.storage.type === 'ssd' ? 2 : 6; // Watts per TB
        const storageEnergyKwh = (storagePower * server.specifications.storage.size / 1000 / 1000) * server.hoursPerMonth;
        const storageCarbonGrams = storageEnergyKwh * carbonIntensity;
        serverCarbon += storageCarbonGrams;
      }

      // Categorize carbon by server type
      switch (server.type) {
        case 'compute':
          infrastructureCarbon.compute += serverCarbon;
          break;
        case 'storage':
          infrastructureCarbon.storage += serverCarbon;
          break;
        case 'network':
          infrastructureCarbon.network += serverCarbon;
          break;
        case 'database':
          infrastructureCarbon.database += serverCarbon;
          break;
      }
    }

    return infrastructureCarbon;
  }

  /**
   * Calculate carbon estimates
   */
  private async calculateEstimates(
    websiteData: WebsiteCarbonResponse | null,
    lighthouseData: any,
    infrastructureData: any,
    url?: string
  ): Promise<CarbonFootprintResult['estimates']> {
    let carbonPerPageView = 0;
    let energyPerPageView = 0;

    // Use Website Carbon data if available
    if (websiteData) {
      carbonPerPageView = websiteData.statistics.co2.grid.grams;
      energyPerPageView = websiteData.statistics.energy;
    } else if (lighthouseData) {
      // Estimate from Lighthouse performance data
      const transferSize = this.extractTransferSize(lighthouseData);
      carbonPerPageView = this.estimateCarbonFromTransferSize(transferSize);
      energyPerPageView = carbonPerPageView / 500; // Rough conversion
    } else if (infrastructureData) {
      // Estimate from infrastructure data
      const totalInfrastructureCarbon = Object.values(infrastructureData).reduce((sum: number, value: number) => sum + value, 0);
      carbonPerPageView = totalInfrastructureCarbon / this.config.application.traffic.monthlyPageViews;
      energyPerPageView = carbonPerPageView / 500;
    } else {
      // Fallback estimates
      carbonPerPageView = 4.6; // Global average
      energyPerPageView = 0.0092;
    }

    // Calculate monthly and annual totals
    const monthlyPageViews = this.config.application.traffic.monthlyPageViews;
    const monthlyCarbon = (carbonPerPageView * monthlyPageViews) / 1000; // Convert to kg
    const monthlyEnergy = energyPerPageView * monthlyPageViews;

    const annualCarbon = monthlyCarbon * 12;
    const annualEnergy = (monthlyEnergy * 12) / 1000; // Convert to MWh

    // Calculate equivalents
    const treesRequired = Math.ceil(annualCarbon / 21.77); // 21.77 kg CO2 per tree per year
    const carMiles = annualCarbon * 2.31; // 1 kg CO2 = 2.31 miles
    const homeEnergyDays = (annualEnergy * 1000) / 30; // 30 kWh per day average

    return {
      perPageView: {
        carbonGrams: carbonPerPageView,
        energyKwh: energyPerPageView,
        waterLiters: carbonPerPageView * 0.001, // Rough estimate
      },
      monthly: {
        carbonKg: monthlyCarbon,
        energyKwh: monthlyEnergy,
        waterLiters: monthlyCarbon * 1000 * 0.001,
        costUsd: monthlyEnergy * 0.12, // $0.12 per kWh average
      },
      annual: {
        carbonKg: annualCarbon,
        energyMwh: annualEnergy,
        equivalents: {
          treesRequired,
          carMiles,
          homeEnergyDays,
        },
      },
    };
  }

  /**
   * Calculate carbon breakdown by component
   */
  private calculateBreakdown(
    estimates: CarbonFootprintResult['estimates'],
    lighthouseData: any
  ): CarbonFootprintResult['breakdown'] {
    const totalCarbon = estimates.perPageView.carbonGrams;

    // Estimate breakdown percentages
    let frontendPercentage = 0.3; // 30% frontend
    let backendPercentage = 0.4; // 40% backend
    let infrastructurePercentage = 0.2; // 20% infrastructure
    let dataTransferPercentage = 0.1; // 10% data transfer

    // Adjust based on Lighthouse data if available
    if (lighthouseData) {
      const transferSize = this.extractTransferSize(lighthouseData);
      if (transferSize > 2000) { // Large pages
        frontendPercentage = 0.4;
        dataTransferPercentage = 0.15;
        backendPercentage = 0.3;
        infrastructurePercentage = 0.15;
      }
    }

    return {
      frontend: {
        carbonGrams: totalCarbon * frontendPercentage,
        percentage: frontendPercentage * 100,
        factors: ['JavaScript execution', 'CSS rendering', 'Image processing'],
      },
      backend: {
        carbonGrams: totalCarbon * backendPercentage,
        percentage: backendPercentage * 100,
        factors: ['Server processing', 'Database queries', 'API calls'],
      },
      infrastructure: {
        carbonGrams: totalCarbon * infrastructurePercentage,
        percentage: infrastructurePercentage * 100,
        factors: ['Server hosting', 'Load balancing', 'CDN'],
      },
      dataTransfer: {
        carbonGrams: totalCarbon * dataTransferPercentage,
        percentage: dataTransferPercentage * 100,
        factors: ['Network transmission', 'CDN delivery', 'API responses'],
      },
    };
  }

  /**
   * Extract performance factors from Lighthouse data
   */
  private extractPerformanceFactors(lighthouseData: any): CarbonFootprintResult['factors'] {
    if (!lighthouseData) {
      return {
        pageSize: 2000, // Default 2MB
        loadTime: 3,
        requests: 50,
        thirdPartyRequests: 15,
        imageOptimization: 0.7,
        cacheEfficiency: 0.7,
        compressionRatio: 0.7,
      };
    }

    const audits = lighthouseData.audits;
    
    return {
      pageSize: this.extractTransferSize(lighthouseData),
      loadTime: audits['speed-index']?.numericValue / 1000 || 3,
      requests: audits['network-requests']?.details?.items?.length || 50,
      thirdPartyRequests: audits['third-party-summary']?.details?.items?.length || 15,
      imageOptimization: this.calculateImageOptimization(audits),
      cacheEfficiency: this.calculateCacheEfficiency(audits),
      compressionRatio: this.calculateCompressionRatio(audits),
    };
  }

  /**
   * Generate sustainability recommendations
   */
  private generateRecommendations(
    estimates: CarbonFootprintResult['estimates'],
    factors: CarbonFootprintResult['factors'],
    breakdown: CarbonFootprintResult['breakdown']
  ): CarbonFootprintResult['recommendations'] {
    const recommendations: CarbonFootprintResult['recommendations'] = [];

    // Image optimization recommendations
    if (factors.imageOptimization < 0.8) {
      recommendations.push({
        category: 'frontend',
        priority: 'high',
        title: 'Optimize Images',
        description: 'Compress and resize images to reduce page size and carbon footprint',
        potentialSaving: {
          carbonGrams: estimates.perPageView.carbonGrams * 0.2,
          percentage: 20,
        },
        implementation: {
          effort: 'medium',
          timeframe: '1-2 weeks',
          resources: ['WebP conversion', 'Image compression tools', 'Responsive images'],
        },
      });
    }

    // Caching recommendations
    if (factors.cacheEfficiency < 0.8) {
      recommendations.push({
        category: 'infrastructure',
        priority: 'medium',
        title: 'Improve Caching',
        description: 'Implement better caching strategies to reduce server load and energy consumption',
        potentialSaving: {
          carbonGrams: estimates.perPageView.carbonGrams * 0.15,
          percentage: 15,
        },
        implementation: {
          effort: 'medium',
          timeframe: '2-3 weeks',
          resources: ['CDN setup', 'Browser caching', 'Server-side caching'],
        },
      });
    }

    // Performance recommendations
    if (factors.loadTime > 3) {
      recommendations.push({
        category: 'performance',
        priority: 'high',
        title: 'Improve Page Load Speed',
        description: 'Faster loading pages consume less energy and reduce carbon emissions',
        potentialSaving: {
          carbonGrams: estimates.perPageView.carbonGrams * 0.25,
          percentage: 25,
        },
        implementation: {
          effort: 'high',
          timeframe: '3-4 weeks',
          resources: ['Code splitting', 'Lazy loading', 'Performance optimization'],
        },
      });
    }

    // Third-party recommendations
    if (factors.thirdPartyRequests > 20) {
      recommendations.push({
        category: 'frontend',
        priority: 'medium',
        title: 'Reduce Third-Party Scripts',
        description: 'Minimize external dependencies to reduce network requests and energy consumption',
        potentialSaving: {
          carbonGrams: estimates.perPageView.carbonGrams * 0.1,
          percentage: 10,
        },
        implementation: {
          effort: 'low',
          timeframe: '1 week',
          resources: ['Script audit', 'Dependency cleanup', 'Self-hosting'],
        },
      });
    }

    // Infrastructure recommendations
    if (breakdown.infrastructure.percentage > 30) {
      recommendations.push({
        category: 'infrastructure',
        priority: 'medium',
        title: 'Optimize Infrastructure',
        description: 'Right-size servers and use green hosting providers to reduce carbon footprint',
        potentialSaving: {
          carbonGrams: estimates.perPageView.carbonGrams * 0.3,
          percentage: 30,
        },
        implementation: {
          effort: 'high',
          timeframe: '4-6 weeks',
          resources: ['Green hosting', 'Server optimization', 'Auto-scaling'],
        },
      });
    }

    return recommendations.sort((a, b) => {
      const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
  }

  /**
   * Helper methods
   */
  private estimateCarbonFromTransferSize(transferSizeKB: number): number {
    // Rough estimate: 1KB = ~0.006g CO2
    return transferSizeKB * 0.006;
  }

  private extractTransferSize(lighthouseData: any): number {
    const audits = lighthouseData.audits;
    return audits['total-byte-weight']?.numericValue / 1024 || 2000; // Convert to KB
  }

  private calculateImageOptimization(audits: any): number {
    const imageAudit = audits['uses-optimized-images'];
    if (!imageAudit || imageAudit.score === null) return 0.7;
    return imageAudit.score;
  }

  private calculateCacheEfficiency(audits: any): number {
    const cacheAudit = audits['uses-long-cache-ttl'];
    if (!cacheAudit || cacheAudit.score === null) return 0.7;
    return cacheAudit.score;
  }

  private calculateCompressionRatio(audits: any): number {
    const compressionAudit = audits['uses-text-compression'];
    if (!compressionAudit || compressionAudit.score === null) return 0.7;
    return compressionAudit.score;
  }

  private determineMethod(websiteData: any, lighthouseData: any, infrastructureData: any): string {
    if (websiteData) return 'Website Carbon API';
    if (lighthouseData) return 'Lighthouse Performance Analysis';
    if (infrastructureData) return 'Infrastructure Analysis';
    return 'Fallback Estimates';
  }

  private determineDataSource(websiteData: any, lighthouseData: any): string {
    if (websiteData) return 'Website Carbon API';
    if (lighthouseData) return 'Google Lighthouse';
    return 'Internal Calculations';
  }

  private calculateConfidence(websiteData: any, lighthouseData: any, infrastructureData: any): 'low' | 'medium' | 'high' {
    if (websiteData && lighthouseData && infrastructureData) return 'high';
    if ((websiteData && lighthouseData) || (websiteData && infrastructureData)) return 'medium';
    return 'low';
  }

  private getAssumptions(): string[] {
    return [
      'Average global electricity carbon intensity used where specific data unavailable',
      'User behavior patterns based on industry averages',
      'Server utilization rates estimated from configuration',
      'Network transmission efficiency assumed at industry standard',
    ];
  }

  private getLimitations(): string[] {
    return [
      'Estimates may vary based on actual usage patterns',
      'Regional carbon intensity differences not fully accounted for',
      'Third-party service carbon footprint not included',
      'Manufacturing and disposal carbon footprint not included',
    ];
  }
}
