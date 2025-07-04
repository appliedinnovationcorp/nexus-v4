import {
  TechnologyEntry,
  TechRadarSnapshot,
  TechRadarConfig,
  TechRadarApiResponse,
  TechRadarRing,
  TechRadarQuadrant,
  DeprecationNotice,
  TechnologyAssessment,
} from '../types';
import { SecretManager } from '@nexus/secret-management';
import { AnalyticsTracker } from '@nexus/analytics';
import { SLOManager } from '@nexus/sre';
import { IncidentManager } from '@nexus/incident-management';
import { v4 as uuidv4 } from 'uuid';
import { addDays, isAfter, isBefore } from 'date-fns';
import * as fs from 'fs/promises';
import * as path from 'path';

export class TechRadarManager {
  private secretManager: SecretManager;
  private analytics: AnalyticsTracker;
  private sloManager: SLOManager;
  private incidentManager: IncidentManager;
  private config: TechRadarConfig;
  private technologies: Map<string, TechnologyEntry> = new Map();
  private snapshots: Map<string, TechRadarSnapshot> = new Map();

  constructor(config: TechRadarConfig) {
    this.config = config;
    this.secretManager = new SecretManager();
    this.analytics = new AnalyticsTracker();
    this.sloManager = new SLOManager({} as any);
    this.incidentManager = new IncidentManager({} as any);
  }

  /**
   * Add or update a technology in the radar
   */
  async addTechnology(technology: Omit<TechnologyEntry, 'id' | 'createdAt' | 'updatedAt' | 'version'>): Promise<TechRadarApiResponse<TechnologyEntry>> {
    try {
      const technologyId = uuidv4();
      const now = new Date();

      const newTechnology: TechnologyEntry = {
        ...technology,
        id: technologyId,
        createdAt: now,
        updatedAt: now,
        version: 1,
      };

      // Validate technology entry
      const validationResult = this.validateTechnology(newTechnology);
      if (!validationResult.valid) {
        return {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: validationResult.errors.join(', '),
          },
          metadata: {
            timestamp: new Date().toISOString(),
            requestId: uuidv4(),
            version: '1.0.0',
          },
        };
      }

      this.technologies.set(technologyId, newTechnology);

      // Track analytics
      await this.analytics.track('tech_radar.technology.added', {
        technologyId,
        name: technology.name,
        quadrant: technology.quadrant,
        ring: technology.ring,
        strategicValue: technology.businessImpact.strategicValue,
      });

      // Send notifications if configured
      await this.sendTechnologyNotification('added', newTechnology);

      return {
        success: true,
        data: newTechnology,
        metadata: {
          timestamp: new Date().toISOString(),
          requestId: uuidv4(),
          version: '1.0.0',
        },
      };
    } catch (error) {
      await this.analytics.track('tech_radar.technology.add_error', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      return {
        success: false,
        error: {
          code: 'ADD_TECHNOLOGY_ERROR',
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
   * Move a technology to a different ring
   */
  async moveTechnology(
    technologyId: string,
    newRing: TechRadarRing,
    rationale: string,
    movedBy: string
  ): Promise<TechRadarApiResponse<TechnologyEntry>> {
    try {
      const technology = this.technologies.get(technologyId);
      if (!technology) {
        return {
          success: false,
          error: {
            code: 'TECHNOLOGY_NOT_FOUND',
            message: `Technology with ID ${technologyId} not found`,
          },
          metadata: {
            timestamp: new Date().toISOString(),
            requestId: uuidv4(),
            version: '1.0.0',
          },
        };
      }

      const oldRing = technology.ring;
      const updatedTechnology: TechnologyEntry = {
        ...technology,
        ring: newRing,
        movement: this.calculateMovement(oldRing, newRing),
        lastReviewDate: new Date(),
        nextReviewDate: this.calculateNextReviewDate(),
        updatedBy: movedBy,
        updatedAt: new Date(),
        version: technology.version + 1,
      };

      // Add rationale to decision history
      updatedTechnology.rationale.decisionFactors.push(
        `Moved from ${oldRing} to ${newRing}: ${rationale}`
      );

      this.technologies.set(technologyId, updatedTechnology);

      // Track analytics
      await this.analytics.track('tech_radar.technology.moved', {
        technologyId,
        name: technology.name,
        from: oldRing,
        to: newRing,
        movedBy,
      });

      // Send notifications
      await this.sendTechnologyNotification('moved', updatedTechnology, { from: oldRing, to: newRing });

      // Check if this is a deprecation move
      if (newRing === 'hold' && oldRing !== 'hold') {
        await this.handleTechnologyDeprecation(updatedTechnology, rationale);
      }

      return {
        success: true,
        data: updatedTechnology,
        metadata: {
          timestamp: new Date().toISOString(),
          requestId: uuidv4(),
          version: '1.0.0',
        },
      };
    } catch (error) {
      await this.analytics.track('tech_radar.technology.move_error', {
        technologyId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      return {
        success: false,
        error: {
          code: 'MOVE_TECHNOLOGY_ERROR',
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
   * Deprecate a technology
   */
  async deprecateTechnology(
    technologyId: string,
    reason: string,
    migrationPath?: string,
    replacementTechnologyId?: string
  ): Promise<TechRadarApiResponse<DeprecationNotice>> {
    try {
      const technology = this.technologies.get(technologyId);
      if (!technology) {
        return {
          success: false,
          error: {
            code: 'TECHNOLOGY_NOT_FOUND',
            message: `Technology with ID ${technologyId} not found`,
          },
          metadata: {
            timestamp: new Date().toISOString(),
            requestId: uuidv4(),
            version: '1.0.0',
          },
        };
      }

      const now = new Date();
      const deprecationDate = now;
      const sunsetDate = addDays(now, 180); // 6 months
      const removalDate = addDays(now, 365); // 1 year

      // Update technology with deprecation info
      const updatedTechnology: TechnologyEntry = {
        ...technology,
        ring: 'hold',
        movement: 'out',
        deprecation: {
          status: 'deprecated',
          deprecatedDate: deprecationDate,
          sunsetDate,
          removalDate,
          reason,
          migrationPath,
          replacementTechnology: replacementTechnologyId,
        },
        lastReviewDate: now,
        updatedAt: now,
        version: technology.version + 1,
      };

      this.technologies.set(technologyId, updatedTechnology);

      // Create deprecation notice
      const deprecationNotice: DeprecationNotice = {
        id: uuidv4(),
        type: 'technology',
        targetId: technologyId,
        title: `Technology Deprecation: ${technology.name}`,
        message: `${technology.name} has been deprecated. ${reason}`,
        severity: 'warning',
        noticeDate: now,
        deprecationDate,
        sunsetDate,
        removalDate,
        recipients: this.buildNotificationRecipients(technology),
        migration: migrationPath ? {
          hasAutomatedMigration: false,
          migrationGuideUrl: migrationPath,
          replacementTechnology: replacementTechnologyId,
          estimatedEffort: 'medium',
        } : undefined,
        acknowledgments: [],
        createdBy: 'system',
        createdAt: now,
        updatedAt: now,
      };

      // Send deprecation notifications
      await this.sendDeprecationNotice(deprecationNotice);

      // Track analytics
      await this.analytics.track('tech_radar.technology.deprecated', {
        technologyId,
        name: technology.name,
        reason,
        sunsetDate: sunsetDate.toISOString(),
        replacementTechnology: replacementTechnologyId,
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
      await this.analytics.track('tech_radar.technology.deprecation_error', {
        technologyId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      return {
        success: false,
        error: {
          code: 'DEPRECATION_ERROR',
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
   * Create a radar snapshot
   */
  async createSnapshot(
    title: string,
    createdBy: string,
    publish: boolean = false
  ): Promise<TechRadarApiResponse<TechRadarSnapshot>> {
    try {
      const snapshotId = uuidv4();
      const now = new Date();
      const technologies = Array.from(this.technologies.values());

      // Calculate changes from previous snapshot
      const previousSnapshot = this.getLatestSnapshot();
      const changes = this.calculateChanges(technologies, previousSnapshot);

      // Calculate summary statistics
      const summary = this.calculateSummary(technologies);

      const snapshot: TechRadarSnapshot = {
        id: snapshotId,
        version: this.generateSnapshotVersion(),
        title,
        date: now,
        technologies,
        changes,
        summary,
        createdBy,
        createdAt: now,
        publishedAt: publish ? now : undefined,
        isPublished: publish,
      };

      this.snapshots.set(snapshotId, snapshot);

      // Save snapshot to storage
      await this.saveSnapshot(snapshot);

      // Track analytics
      await this.analytics.track('tech_radar.snapshot.created', {
        snapshotId,
        version: snapshot.version,
        technologiesCount: technologies.length,
        isPublished: publish,
        changes: {
          added: changes.added.length,
          moved: changes.moved.length,
          removed: changes.removed.length,
          updated: changes.updated.length,
        },
      });

      // Send notifications if published
      if (publish) {
        await this.sendSnapshotNotification(snapshot);
      }

      return {
        success: true,
        data: snapshot,
        metadata: {
          timestamp: new Date().toISOString(),
          requestId: uuidv4(),
          version: '1.0.0',
        },
      };
    } catch (error) {
      await this.analytics.track('tech_radar.snapshot.creation_error', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      return {
        success: false,
        error: {
          code: 'SNAPSHOT_CREATION_ERROR',
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
   * Get technologies by criteria
   */
  async getTechnologies(filters?: {
    quadrant?: TechRadarQuadrant;
    ring?: TechRadarRing;
    status?: 'active' | 'deprecated' | 'all';
    tags?: string[];
  }): Promise<TechRadarApiResponse<TechnologyEntry[]>> {
    try {
      let technologies = Array.from(this.technologies.values());

      // Apply filters
      if (filters) {
        if (filters.quadrant) {
          technologies = technologies.filter(tech => tech.quadrant === filters.quadrant);
        }
        
        if (filters.ring) {
          technologies = technologies.filter(tech => tech.ring === filters.ring);
        }
        
        if (filters.status && filters.status !== 'all') {
          if (filters.status === 'active') {
            technologies = technologies.filter(tech => 
              !tech.deprecation || tech.deprecation.status === 'active'
            );
          } else if (filters.status === 'deprecated') {
            technologies = technologies.filter(tech => 
              tech.deprecation && tech.deprecation.status !== 'active'
            );
          }
        }
        
        if (filters.tags && filters.tags.length > 0) {
          technologies = technologies.filter(tech => 
            filters.tags!.some(tag => tech.tags.includes(tag))
          );
        }
      }

      return {
        success: true,
        data: technologies,
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
          code: 'GET_TECHNOLOGIES_ERROR',
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
   * Get deprecation notices
   */
  async getDeprecationNotices(filters?: {
    type?: 'technology' | 'api-version';
    severity?: 'info' | 'warning' | 'critical';
    pending?: boolean;
  }): Promise<TechRadarApiResponse<DeprecationNotice[]>> {
    try {
      // This would typically query from a database
      // For now, generate notices from deprecated technologies
      const notices: DeprecationNotice[] = [];
      
      for (const technology of this.technologies.values()) {
        if (technology.deprecation && technology.deprecation.status !== 'active') {
          const notice: DeprecationNotice = {
            id: uuidv4(),
            type: 'technology',
            targetId: technology.id,
            title: `Technology Deprecation: ${technology.name}`,
            message: technology.deprecation.reason || 'Technology has been deprecated',
            severity: technology.deprecation.status === 'removed' ? 'critical' : 'warning',
            noticeDate: technology.deprecation.deprecatedDate || new Date(),
            deprecationDate: technology.deprecation.deprecatedDate || new Date(),
            sunsetDate: technology.deprecation.sunsetDate,
            removalDate: technology.deprecation.removalDate,
            recipients: this.buildNotificationRecipients(technology),
            acknowledgments: [],
            createdBy: 'system',
            createdAt: technology.deprecation.deprecatedDate || new Date(),
            updatedAt: technology.updatedAt,
          };
          
          notices.push(notice);
        }
      }

      // Apply filters
      let filteredNotices = notices;
      if (filters) {
        if (filters.type) {
          filteredNotices = filteredNotices.filter(notice => notice.type === filters.type);
        }
        if (filters.severity) {
          filteredNotices = filteredNotices.filter(notice => notice.severity === filters.severity);
        }
        if (filters.pending) {
          const now = new Date();
          filteredNotices = filteredNotices.filter(notice => 
            notice.removalDate ? isAfter(notice.removalDate, now) : true
          );
        }
      }

      return {
        success: true,
        data: filteredNotices,
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
          code: 'GET_DEPRECATION_NOTICES_ERROR',
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
  private validateTechnology(technology: TechnologyEntry): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!technology.name.trim()) {
      errors.push('Technology name is required');
    }

    if (!technology.description.trim()) {
      errors.push('Technology description is required');
    }

    if (technology.assessment.overallScore < 1 || technology.assessment.overallScore > 5) {
      errors.push('Overall score must be between 1 and 5');
    }

    if (technology.adoptionLevel < 0 || technology.adoptionLevel > 100) {
      errors.push('Adoption level must be between 0 and 100');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  private calculateMovement(oldRing: TechRadarRing, newRing: TechRadarRing): 'in' | 'out' | 'no-change' {
    const ringOrder = { hold: 0, assess: 1, trial: 2, adopt: 3 };
    const oldOrder = ringOrder[oldRing];
    const newOrder = ringOrder[newRing];

    if (newOrder > oldOrder) return 'in';
    if (newOrder < oldOrder) return 'out';
    return 'no-change';
  }

  private calculateNextReviewDate(): Date {
    const reviewCycle = this.config.reviewProcess.reviewCycle;
    const now = new Date();

    switch (reviewCycle) {
      case 'monthly':
        return addDays(now, 30);
      case 'quarterly':
        return addDays(now, 90);
      case 'biannual':
        return addDays(now, 180);
      case 'annual':
        return addDays(now, 365);
      default:
        return addDays(now, 90);
    }
  }

  private async handleTechnologyDeprecation(technology: TechnologyEntry, reason: string): Promise<void> {
    // Create incident for high-impact technology deprecation
    if (technology.businessImpact.strategicValue === 'critical' || technology.businessImpact.strategicValue === 'high') {
      await this.incidentManager.createIncident({
        title: `Critical Technology Deprecated: ${technology.name}`,
        description: `${technology.name} has been moved to HOLD status. Reason: ${reason}`,
        severity: 'medium',
        source: 'tech-radar',
        tags: ['tech-radar', 'deprecation', 'strategic-technology'],
        metadata: {
          technologyId: technology.id,
          strategicValue: technology.businessImpact.strategicValue,
          adoptionLevel: technology.adoptionLevel,
        },
      });
    }
  }

  private buildNotificationRecipients(technology: TechnologyEntry): DeprecationNotice['recipients'] {
    const recipients: DeprecationNotice['recipients'] = [];

    // Add configured notification emails
    this.config.notifications.deprecationWarnings.forEach(email => {
      recipients.push({
        type: 'email',
        target: email,
        sent: false,
      });
    });

    // Add team members who use this technology
    technology.teamUsage.forEach(usage => {
      recipients.push({
        type: 'email',
        target: `${usage.team}@company.com`, // Assuming team email format
        sent: false,
      });
    });

    return recipients;
  }

  private async sendTechnologyNotification(
    action: 'added' | 'moved' | 'deprecated',
    technology: TechnologyEntry,
    moveDetails?: { from: TechRadarRing; to: TechRadarRing }
  ): Promise<void> {
    // This would integrate with notification services
    console.log(`Technology ${action}: ${technology.name}`, moveDetails);
  }

  private async sendDeprecationNotice(notice: DeprecationNotice): Promise<void> {
    // This would send actual notifications
    console.log(`Deprecation notice sent for: ${notice.title}`);
  }

  private async sendSnapshotNotification(snapshot: TechRadarSnapshot): Promise<void> {
    // This would send snapshot publication notifications
    console.log(`Radar snapshot published: ${snapshot.title} (${snapshot.version})`);
  }

  private getLatestSnapshot(): TechRadarSnapshot | undefined {
    const snapshots = Array.from(this.snapshots.values())
      .filter(s => s.isPublished)
      .sort((a, b) => b.date.getTime() - a.date.getTime());
    
    return snapshots[0];
  }

  private calculateChanges(
    currentTechnologies: TechnologyEntry[],
    previousSnapshot?: TechRadarSnapshot
  ): TechRadarSnapshot['changes'] {
    if (!previousSnapshot) {
      return {
        added: currentTechnologies.map(t => t.id),
        moved: [],
        removed: [],
        updated: [],
      };
    }

    const previousTechMap = new Map(previousSnapshot.technologies.map(t => [t.id, t]));
    const currentTechMap = new Map(currentTechnologies.map(t => [t.id, t]));

    const added: string[] = [];
    const moved: Array<{ technologyId: string; from: TechRadarRing; to: TechRadarRing }> = [];
    const removed: string[] = [];
    const updated: string[] = [];

    // Find added and moved technologies
    for (const current of currentTechnologies) {
      const previous = previousTechMap.get(current.id);
      if (!previous) {
        added.push(current.id);
      } else if (previous.ring !== current.ring) {
        moved.push({
          technologyId: current.id,
          from: previous.ring,
          to: current.ring,
        });
      } else if ('version' in previous && 'version' in current && previous.version !== current.version) {
        updated.push(current.id);
      }
    }

    // Find removed technologies
    for (const previous of previousSnapshot.technologies) {
      if (!currentTechMap.has(previous.id)) {
        removed.push(previous.id);
      }
    }

    return { added, moved, removed, updated };
  }

  private calculateSummary(technologies: TechnologyEntry[]): TechRadarSnapshot['summary'] {
    const byQuadrant: Record<string, number> = {};
    const byRing: Record<string, number> = {};
    let newTechnologies = 0;
    let deprecatedTechnologies = 0;

    const thirtyDaysAgo = addDays(new Date(), -30);

    for (const tech of technologies) {
      // Count by quadrant
      byQuadrant[tech.quadrant] = (byQuadrant[tech.quadrant] || 0) + 1;
      
      // Count by ring
      byRing[tech.ring] = (byRing[tech.ring] || 0) + 1;
      
      // Count new technologies (added in last 30 days)
      if (isAfter(tech.createdAt, thirtyDaysAgo)) {
        newTechnologies++;
      }
      
      // Count deprecated technologies
      if (tech.deprecation && tech.deprecation.status !== 'active') {
        deprecatedTechnologies++;
      }
    }

    return {
      totalTechnologies: technologies.length,
      byQuadrant,
      byRing,
      newTechnologies,
      deprecatedTechnologies,
    };
  }

  private generateSnapshotVersion(): string {
    const now = new Date();
    return `${now.getFullYear()}.${(now.getMonth() + 1).toString().padStart(2, '0')}.${now.getDate().toString().padStart(2, '0')}`;
  }

  private async saveSnapshot(snapshot: TechRadarSnapshot): Promise<void> {
    try {
      const snapshotsDir = './tech-radar-snapshots';
      await fs.mkdir(snapshotsDir, { recursive: true });
      
      const filename = `${snapshot.version}-${snapshot.id}.json`;
      const filepath = path.join(snapshotsDir, filename);
      
      await fs.writeFile(filepath, JSON.stringify(snapshot, null, 2));
    } catch (error) {
      console.warn('Failed to save snapshot:', error);
    }
  }
}
