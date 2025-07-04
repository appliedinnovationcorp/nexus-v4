import {
  APIVersion,
  APIVersioningStrategy,
  DeprecationStatus,
  DeprecationNotice,
  TechRadarApiResponse,
  TechRadarConfig,
} from '../types';
import { SecretManager } from '@nexus/secret-management';
import { AnalyticsTracker } from '@nexus/analytics';
import { v4 as uuidv4 } from 'uuid';
import { addDays, isAfter, isBefore } from 'date-fns';
import * as semver from 'semver';

export class APIVersionManager {
  private secretManager: SecretManager;
  private analytics: AnalyticsTracker;
  private config: TechRadarConfig;
  private apiVersions: Map<string, APIVersion> = new Map();

  constructor(config: TechRadarConfig) {
    this.config = config;
    this.secretManager = new SecretManager();
    this.analytics = new AnalyticsTracker();
  }

  /**
   * Create a new API version
   */
  async createAPIVersion(
    apiName: string,
    version: string,
    strategy: APIVersioningStrategy,
    createdBy: string
  ): Promise<TechRadarApiResponse<APIVersion>> {
    try {
      const versionId = uuidv4();
      const now = new Date();

      // Parse version based on strategy
      const versionInfo = this.parseVersion(version, strategy);
      if (!versionInfo.valid) {
        return {
          success: false,
          error: {
            code: 'INVALID_VERSION_FORMAT',
            message: versionInfo.error || 'Invalid version format',
          },
          metadata: {
            timestamp: new Date().toISOString(),
            requestId: uuidv4(),
            version: '1.0.0',
          },
        };
      }

      const apiVersion: APIVersion = {
        id: versionId,
        version,
        apiName,
        versioningStrategy: strategy,
        majorVersion: versionInfo.major!,
        minorVersion: versionInfo.minor!,
        patchVersion: versionInfo.patch,
        status: 'development',
        releaseDate: now,
        usage: {
          activeClients: 0,
          requestsPerDay: 0,
          errorRate: 0,
          averageResponseTime: 0,
        },
        compatibility: {
          backwardCompatible: true,
          forwardCompatible: false,
          supportedClients: [],
        },
        documentation: {},
        support: {
          supportLevel: 'full',
        },
        createdBy,
        createdAt: now,
        updatedBy: createdBy,
        updatedAt: now,
      };

      this.apiVersions.set(versionId, apiVersion);

      await this.analytics.track('api_version.created', {
        apiName,
        version,
        strategy,
        versionId,
        createdBy,
      });

      return {
        success: true,
        data: apiVersion,
        metadata: {
          timestamp: new Date().toISOString(),
          requestId: uuidv4(),
          version: '1.0.0',
        },
      };
    } catch (error) {
      await this.analytics.track('api_version.creation_error', {
        apiName,
        version,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      return {
        success: false,
        error: {
          code: 'API_VERSION_CREATION_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
        metadata: {
          timestamp: new Date().toISOString(),
          requestId: uuidv4(),
          version: '1.0.0',
        },
      };
    }
  }

  /**
   * Deprecate an API version
   */
  async deprecateAPIVersion(
    versionId: string,
    reason: string,
    migrationGuide?: string,
    breakingChanges?: string[]
  ): Promise<TechRadarApiResponse<DeprecationNotice>> {
    try {
      const apiVersion = this.apiVersions.get(versionId);
      if (!apiVersion) {
        return {
          success: false,
          error: {
            code: 'API_VERSION_NOT_FOUND',
            message: `API version with ID ${versionId} not found`,
          },
          metadata: {
            timestamp: new Date().toISOString(),
            requestId: uuidv4(),
            version: '1.0.0',
          },
        };
      }

      const now = new Date();
      const deprecationPeriod = this.config.apiVersioning.deprecationPeriod;
      const sunsetPeriod = this.config.apiVersioning.sunsetPeriod;

      const deprecationDate = now;
      const sunsetDate = addDays(now, deprecationPeriod);
      const removalDate = addDays(sunsetDate, sunsetPeriod);

      // Update API version with deprecation info
      const updatedAPIVersion: APIVersion = {
        ...apiVersion,
        status: 'deprecated',
        deprecation: {
          deprecatedDate: deprecationDate,
          sunsetDate,
          removalDate,
          reason,
          migrationGuide,
          breakingChanges: breakingChanges || [],
        },
        support: {
          ...apiVersion.support,
          supportLevel: 'maintenance',
          supportEndDate: sunsetDate,
        },
        updatedAt: now,
      };

      this.apiVersions.set(versionId, updatedAPIVersion);

      // Create deprecation notice
      const deprecationNotice: DeprecationNotice = {
        id: uuidv4(),
        type: 'api-version',
        targetId: versionId,
        title: `API Deprecation: ${apiVersion.apiName} v${apiVersion.version}`,
        message: `API version ${apiVersion.version} of ${apiVersion.apiName} has been deprecated. ${reason}`,
        severity: this.calculateDeprecationSeverity(apiVersion),
        noticeDate: now,
        deprecationDate,
        sunsetDate,
        removalDate,
        recipients: this.buildAPINotificationRecipients(apiVersion),
        migration: migrationGuide ? {
          hasAutomatedMigration: false,
          migrationGuideUrl: migrationGuide,
          estimatedEffort: this.estimateMigrationEffort(breakingChanges || []),
        } : undefined,
        acknowledgments: [],
        createdBy: 'system',
        createdAt: now,
        updatedAt: now,
      };

      // Schedule deprecation notifications
      await this.scheduleDeprecationNotifications(deprecationNotice, apiVersion);

      await this.analytics.track('api_version.deprecated', {
        apiName: apiVersion.apiName,
        version: apiVersion.version,
        versionId,
        reason,
        activeClients: apiVersion.usage.activeClients,
        sunsetDate: sunsetDate.toISOString(),
      });

      return {
        success: true,
        data: deprecationNotice,
        metadata: {
          timestamp: new Date().toISOString(),
          requestId: uuidv4(),
          version: '1.0.0',
        },
      };
    } catch (error) {
      await this.analytics.track('api_version.deprecation_error', {
        versionId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      return {
        success: false,
        error: {
          code: 'API_DEPRECATION_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
        metadata: {
          timestamp: new Date().toISOString(),
          requestId: uuidv4(),
          version: '1.0.0',
        },
      };
    }
  }

  /**
   * Update API version usage metrics
   */
  async updateUsageMetrics(
    versionId: string,
    metrics: {
      activeClients?: number;
      requestsPerDay?: number;
      errorRate?: number;
      averageResponseTime?: number;
    }
  ): Promise<TechRadarApiResponse<APIVersion>> {
    try {
      const apiVersion = this.apiVersions.get(versionId);
      if (!apiVersion) {
        return {
          success: false,
          error: {
            code: 'API_VERSION_NOT_FOUND',
            message: `API version with ID ${versionId} not found`,
          },
          metadata: {
            timestamp: new Date().toISOString(),
            requestId: uuidv4(),
            version: '1.0.0',
          },
        };
      }

      const updatedAPIVersion: APIVersion = {
        ...apiVersion,
        usage: {
          ...apiVersion.usage,
          ...metrics,
          lastUsed: new Date(),
        },
        updatedAt: new Date(),
      };

      this.apiVersions.set(versionId, updatedAPIVersion);

      await this.analytics.track('api_version.usage_updated', {
        apiName: apiVersion.apiName,
        version: apiVersion.version,
        versionId,
        metrics,
      });

      return {
        success: true,
        data: updatedAPIVersion,
        metadata: {
          timestamp: new Date().toISOString(),
          requestId: uuidv4(),
          version: '1.0.0',
        },
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'USAGE_UPDATE_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
        metadata: {
          timestamp: new Date().toISOString(),
          requestId: uuidv4(),
          version: '1.0.0',
        },
      };
    }
  }

  /**
   * Get API versions with filters
   */
  async getAPIVersions(filters?: {
    apiName?: string;
    status?: APIVersion['status'];
    deprecated?: boolean;
    activeOnly?: boolean;
  }): Promise<TechRadarApiResponse<APIVersion[]>> {
    try {
      let versions = Array.from(this.apiVersions.values());

      if (filters) {
        if (filters.apiName) {
          versions = versions.filter(v => v.apiName === filters.apiName);
        }

        if (filters.status) {
          versions = versions.filter(v => v.status === filters.status);
        }

        if (filters.deprecated !== undefined) {
          versions = versions.filter(v => 
            filters.deprecated ? v.status === 'deprecated' : v.status !== 'deprecated'
          );
        }

        if (filters.activeOnly) {
          versions = versions.filter(v => v.usage.activeClients > 0);
        }
      }

      // Sort by API name and version
      versions.sort((a, b) => {
        if (a.apiName !== b.apiName) {
          return a.apiName.localeCompare(b.apiName);
        }
        return this.compareVersions(a.version, b.version, a.versioningStrategy);
      });

      return {
        success: true,
        data: versions,
        metadata: {
          timestamp: new Date().toISOString(),
          requestId: uuidv4(),
          version: '1.0.0',
        },
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'GET_API_VERSIONS_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
        metadata: {
          timestamp: new Date().toISOString(),
          requestId: uuidv4(),
          version: '1.0.0',
        },
      };
    }
  }

  /**
   * Get deprecation timeline for an API
   */
  async getDeprecationTimeline(apiName: string): Promise<TechRadarApiResponse<{
    versions: Array<{
      version: string;
      status: APIVersion['status'];
      deprecationDate?: Date;
      sunsetDate?: Date;
      removalDate?: Date;
      activeClients: number;
    }>;
    recommendations: string[];
  }>> {
    try {
      const apiVersions = Array.from(this.apiVersions.values())
        .filter(v => v.apiName === apiName)
        .sort((a, b) => this.compareVersions(a.version, b.version, a.versioningStrategy));

      const timeline = apiVersions.map(v => ({
        version: v.version,
        status: v.status,
        deprecationDate: v.deprecation?.deprecatedDate,
        sunsetDate: v.deprecation?.sunsetDate,
        removalDate: v.deprecation?.removalDate,
        activeClients: v.usage.activeClients,
      }));

      const recommendations = this.generateDeprecationRecommendations(apiVersions);

      return {
        success: true,
        data: {
          versions: timeline,
          recommendations,
        },
        metadata: {
          timestamp: new Date().toISOString(),
          requestId: uuidv4(),
          version: '1.0.0',
        },
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'GET_DEPRECATION_TIMELINE_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
        metadata: {
          timestamp: new Date().toISOString(),
          requestId: uuidv4(),
          version: '1.0.0',
        },
      };
    }
  }

  /**
   * Private helper methods
   */
  private parseVersion(version: string, strategy: APIVersioningStrategy): {
    valid: boolean;
    major?: number;
    minor?: number;
    patch?: number;
    error?: string;
  } {
    switch (strategy) {
      case 'semantic':
        if (semver.valid(version)) {
          const parsed = semver.parse(version);
          return {
            valid: true,
            major: parsed!.major,
            minor: parsed!.minor,
            patch: parsed!.patch,
          };
        }
        return { valid: false, error: 'Invalid semantic version format' };

      case 'date-based':
        const dateMatch = version.match(/^(\d{4})\.(\d{2})\.(\d{2})$/);
        if (dateMatch) {
          return {
            valid: true,
            major: parseInt(dateMatch[1]),
            minor: parseInt(dateMatch[2]),
            patch: parseInt(dateMatch[3]),
          };
        }
        return { valid: false, error: 'Invalid date-based version format (YYYY.MM.DD)' };

      case 'sequential':
        const seqMatch = version.match(/^v?(\d+)$/);
        if (seqMatch) {
          return {
            valid: true,
            major: parseInt(seqMatch[1]),
            minor: 0,
          };
        }
        return { valid: false, error: 'Invalid sequential version format' };

      case 'header-based':
        // For header-based versioning, we still need a version identifier
        const headerMatch = version.match(/^(\d+)\.(\d+)$/);
        if (headerMatch) {
          return {
            valid: true,
            major: parseInt(headerMatch[1]),
            minor: parseInt(headerMatch[2]),
          };
        }
        return { valid: false, error: 'Invalid header-based version format' };

      default:
        return { valid: false, error: 'Unknown versioning strategy' };
    }
  }

  private compareVersions(a: string, b: string, strategy: APIVersioningStrategy): number {
    switch (strategy) {
      case 'semantic':
        return semver.compare(a, b);
      
      case 'date-based':
      case 'sequential':
      case 'header-based':
        const aInfo = this.parseVersion(a, strategy);
        const bInfo = this.parseVersion(b, strategy);
        
        if (!aInfo.valid || !bInfo.valid) return 0;
        
        if (aInfo.major !== bInfo.major) {
          return aInfo.major! - bInfo.major!;
        }
        if (aInfo.minor !== bInfo.minor) {
          return aInfo.minor! - bInfo.minor!;
        }
        if (aInfo.patch !== undefined && bInfo.patch !== undefined) {
          return aInfo.patch - bInfo.patch;
        }
        return 0;
      
      default:
        return a.localeCompare(b);
    }
  }

  private calculateDeprecationSeverity(apiVersion: APIVersion): 'info' | 'warning' | 'critical' {
    if (apiVersion.usage.activeClients > 100) return 'critical';
    if (apiVersion.usage.activeClients > 10) return 'warning';
    return 'info';
  }

  private estimateMigrationEffort(breakingChanges: string[]): 'low' | 'medium' | 'high' {
    if (breakingChanges.length === 0) return 'low';
    if (breakingChanges.length <= 3) return 'medium';
    return 'high';
  }

  private buildAPINotificationRecipients(apiVersion: APIVersion): DeprecationNotice['recipients'] {
    const recipients: DeprecationNotice['recipients'] = [];

    // Add configured notification emails
    this.config.notifications.deprecationWarnings.forEach(email => {
      recipients.push({
        type: 'email',
        target: email,
        sent: false,
      });
    });

    // Add API-specific contacts
    if (apiVersion.support.contactEmail) {
      recipients.push({
        type: 'email',
        target: apiVersion.support.contactEmail,
        sent: false,
      });
    }

    return recipients;
  }

  private async scheduleDeprecationNotifications(
    notice: DeprecationNotice,
    apiVersion: APIVersion
  ): Promise<void> {
    const notificationPeriods = this.config.apiVersioning.notificationPeriods;
    
    for (const days of notificationPeriods) {
      const notificationDate = addDays(notice.deprecationDate, -days);
      
      if (isAfter(notificationDate, new Date())) {
        // Schedule notification (this would integrate with a job scheduler)
        console.log(`Scheduled deprecation notification for ${apiVersion.apiName} v${apiVersion.version} on ${notificationDate.toISOString()}`);
      }
    }
  }

  private generateDeprecationRecommendations(apiVersions: APIVersion[]): string[] {
    const recommendations: string[] = [];
    const now = new Date();

    const activeVersions = apiVersions.filter(v => v.status !== 'removed');
    const deprecatedVersions = apiVersions.filter(v => v.status === 'deprecated');
    const versionsWithClients = apiVersions.filter(v => v.usage.activeClients > 0);

    if (deprecatedVersions.length > 0) {
      recommendations.push(`${deprecatedVersions.length} version(s) are deprecated and should be migrated`);
    }

    if (versionsWithClients.length > 3) {
      recommendations.push('Consider consolidating API versions to reduce maintenance overhead');
    }

    const oldVersions = apiVersions.filter(v => {
      const daysSinceRelease = (now.getTime() - v.releaseDate.getTime()) / (1000 * 60 * 60 * 24);
      return daysSinceRelease > 730 && v.usage.activeClients > 0; // 2 years old
    });

    if (oldVersions.length > 0) {
      recommendations.push(`${oldVersions.length} version(s) are over 2 years old and should be evaluated for deprecation`);
    }

    return recommendations;
  }
}
