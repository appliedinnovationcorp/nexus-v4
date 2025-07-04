import { v4 as uuidv4 } from 'uuid';
import { differenceInMinutes, addMinutes } from 'date-fns';
import { 
  Incident, 
  IncidentSeverity, 
  IncidentStatus, 
  IncidentPriority,
  IncidentAction,
  IncidentParticipant,
  IncidentCommunication,
  IncidentMetrics,
  PostMortem,
  OnCallSchedule,
  AlertRule,
  IncidentResponse
} from '../types/incident';
import { PagerDutyProvider } from '../providers/PagerDutyProvider';
import { OpsgenieProvider } from '../providers/OpsgenieProvider';

/**
 * Core Incident Management System
 * Handles incident lifecycle, escalation, and coordination
 */
export class IncidentManager {
  private incidents: Map<string, Incident> = new Map();
  private postMortems: Map<string, PostMortem> = new Map();
  private onCallSchedules: Map<string, OnCallSchedule> = new Map();
  private alertRules: Map<string, AlertRule> = new Map();
  private responses: Map<string, IncidentResponse> = new Map();
  
  private pagerDutyProvider?: PagerDutyProvider;
  private opsgenieProvider?: OpsgenieProvider;
  
  private config: {
    defaultSeverity: IncidentSeverity;
    autoEscalationEnabled: boolean;
    autoEscalationDelay: number; // minutes
    postMortemRequired: IncidentSeverity[];
    slackWebhookUrl?: string;
    statusPageUrl?: string;
  };

  constructor(config: {
    pagerduty?: { apiKey: string; serviceKey: string };
    opsgenie?: { apiKey: string; teamId: string };
    defaultSeverity?: IncidentSeverity;
    autoEscalationEnabled?: boolean;
    autoEscalationDelay?: number;
    postMortemRequired?: IncidentSeverity[];
    slackWebhookUrl?: string;
    statusPageUrl?: string;
  }) {
    this.config = {
      defaultSeverity: config.defaultSeverity || 'sev3',
      autoEscalationEnabled: config.autoEscalationEnabled ?? true,
      autoEscalationDelay: config.autoEscalationDelay || 15,
      postMortemRequired: config.postMortemRequired || ['sev1', 'sev2'],
      slackWebhookUrl: config.slackWebhookUrl,
      statusPageUrl: config.statusPageUrl
    };

    // Initialize providers
    if (config.pagerduty) {
      this.pagerDutyProvider = new PagerDutyProvider(config.pagerduty);
    }
    
    if (config.opsgenie) {
      this.opsgenieProvider = new OpsgenieProvider(config.opsgenie);
    }

    // Setup auto-escalation
    if (this.config.autoEscalationEnabled) {
      this.setupAutoEscalation();
    }
  }

  /**
   * Create a new incident
   */
  async createIncident(params: {
    title: string;
    description: string;
    severity?: IncidentSeverity;
    priority?: IncidentPriority;
    service: string;
    source?: 'manual' | 'alert' | 'slo_breach' | 'monitoring' | 'user_report';
    createdBy: string;
    alertIds?: string[];
    sloBreachIds?: string[];
  }): Promise<Incident> {
    const incidentId = uuidv4();
    const now = new Date();
    
    const severity = params.severity || this.config.defaultSeverity;
    const priority = this.mapSeverityToPriority(severity);

    const incident: Incident = {
      id: incidentId,
      title: params.title,
      description: params.description,
      status: 'triggered',
      severity,
      priority,
      classification: {
        primaryService: params.service,
        secondaryServices: [],
        category: 'availability', // Default, can be updated
        businessImpact: this.mapSeverityToBusinessImpact(severity),
        customerImpact: {
          affected: severity === 'sev1' || severity === 'sev2'
        }
      },
      timeline: {
        detectedAt: now,
        startedAt: now
      },
      metrics: {},
      participants: [],
      actions: [],
      communications: [],
      alerts: params.alertIds || [],
      sloBreaches: params.sloBreachIds || [],
      externalTickets: {},
      tags: [params.service, severity, priority],
      metadata: {
        createdBy: params.createdBy,
        createdAt: now,
        updatedBy: params.createdBy,
        updatedAt: now,
        source: params.source || 'manual',
        environment: 'production'
      }
    };

    this.incidents.set(incidentId, incident);

    // Trigger initial response
    await this.triggerIncidentResponse(incident);

    // Log incident creation
    await this.addIncidentAction(incidentId, {
      description: `Incident created: ${params.title}`,
      performedBy: params.createdBy,
      type: 'investigation',
      outcome: 'successful'
    });

    return incident;
  }

  /**
   * Update incident status
   */
  async updateIncidentStatus(
    incidentId: string, 
    status: IncidentStatus, 
    updatedBy: string,
    notes?: string
  ): Promise<void> {
    const incident = this.incidents.get(incidentId);
    if (!incident) {
      throw new Error(`Incident not found: ${incidentId}`);
    }

    const previousStatus = incident.status;
    incident.status = status;
    incident.metadata.updatedBy = updatedBy;
    incident.metadata.updatedAt = new Date();

    // Update timeline
    const now = new Date();
    switch (status) {
      case 'acknowledged':
        incident.timeline.acknowledgedAt = now;
        break;
      case 'investigating':
        incident.timeline.investigationStartedAt = now;
        break;
      case 'identified':
        incident.timeline.identifiedAt = now;
        break;
      case 'resolved':
        incident.timeline.resolvedAt = now;
        break;
    }

    // Calculate metrics
    this.updateIncidentMetrics(incident);

    // Log status change
    await this.addIncidentAction(incidentId, {
      description: `Status changed from ${previousStatus} to ${status}${notes ? `: ${notes}` : ''}`,
      performedBy: updatedBy,
      type: status === 'resolved' ? 'resolution' : 'investigation',
      outcome: 'successful'
    });

    // Send notifications
    await this.sendStatusUpdate(incident, previousStatus);

    // Handle resolution
    if (status === 'resolved') {
      await this.handleIncidentResolution(incident);
    }

    this.incidents.set(incidentId, incident);
  }

  /**
   * Add participant to incident
   */
  async addParticipant(
    incidentId: string,
    participant: Omit<IncidentParticipant, 'joinedAt'>
  ): Promise<void> {
    const incident = this.incidents.get(incidentId);
    if (!incident) {
      throw new Error(`Incident not found: ${incidentId}`);
    }

    const fullParticipant: IncidentParticipant = {
      ...participant,
      joinedAt: new Date()
    };

    incident.participants.push(fullParticipant);
    
    // Log participant addition
    await this.addIncidentAction(incidentId, {
      description: `${participant.name} joined as ${participant.role}`,
      performedBy: 'system',
      type: 'escalation',
      outcome: 'successful'
    });

    this.incidents.set(incidentId, incident);
  }

  /**
   * Add action to incident
   */
  async addIncidentAction(
    incidentId: string,
    action: Omit<IncidentAction, 'id' | 'performedAt'>
  ): Promise<void> {
    const incident = this.incidents.get(incidentId);
    if (!incident) {
      throw new Error(`Incident not found: ${incidentId}`);
    }

    const fullAction: IncidentAction = {
      id: uuidv4(),
      ...action,
      performedAt: new Date()
    };

    incident.actions.push(fullAction);
    incident.metadata.updatedAt = new Date();
    
    this.incidents.set(incidentId, incident);
  }

  /**
   * Send communication
   */
  async sendCommunication(
    incidentId: string,
    communication: Omit<IncidentCommunication, 'id' | 'sentAt'>
  ): Promise<void> {
    const incident = this.incidents.get(incidentId);
    if (!incident) {
      throw new Error(`Incident not found: ${incidentId}`);
    }

    const fullCommunication: IncidentCommunication = {
      id: uuidv4(),
      ...communication,
      sentAt: new Date()
    };

    incident.communications.push(fullCommunication);

    // Actually send the communication
    await this.deliverCommunication(fullCommunication);

    this.incidents.set(incidentId, incident);
  }

  /**
   * Escalate incident
   */
  async escalateIncident(
    incidentId: string,
    escalatedBy: string,
    reason: string,
    targetLevel?: string
  ): Promise<void> {
    const incident = this.incidents.get(incidentId);
    if (!incident) {
      throw new Error(`Incident not found: ${incidentId}`);
    }

    // Increase severity if not already at highest
    if (incident.severity === 'sev3') {
      incident.severity = 'sev2';
    } else if (incident.severity === 'sev2') {
      incident.severity = 'sev1';
    }

    // Update priority
    incident.priority = this.mapSeverityToPriority(incident.severity);

    // Log escalation
    await this.addIncidentAction(incidentId, {
      description: `Incident escalated to ${incident.severity}: ${reason}`,
      performedBy: escalatedBy,
      type: 'escalation',
      outcome: 'successful'
    });

    // Trigger escalated response
    await this.triggerEscalatedResponse(incident, targetLevel);

    this.incidents.set(incidentId, incident);
  }

  /**
   * Create post-mortem for incident
   */
  async createPostMortem(
    incidentId: string,
    author: string,
    template?: 'standard' | 'security' | 'performance'
  ): Promise<PostMortem> {
    const incident = this.incidents.get(incidentId);
    if (!incident) {
      throw new Error(`Incident not found: ${incidentId}`);
    }

    const postMortemId = uuidv4();
    const now = new Date();

    const postMortem: PostMortem = {
      id: postMortemId,
      incidentId,
      title: `Post-Mortem: ${incident.title}`,
      summary: '',
      timeline: {
        events: this.generateTimelineEvents(incident)
      },
      impact: {
        duration: incident.metrics.totalDuration || 0,
        servicesAffected: [incident.classification.primaryService, ...incident.classification.secondaryServices],
        sloImpact: [] // This would be populated from SLO system
      },
      rootCause: {
        primary: '',
        contributing: [],
        detection: '',
        development: ''
      },
      whatWentWell: [],
      whatCouldBeImproved: [],
      actionItems: [],
      lessonsLearned: [],
      status: 'draft',
      metadata: {
        author,
        reviewers: [],
        createdAt: now,
        updatedAt: now
      }
    };

    this.postMortems.set(postMortemId, postMortem);
    return postMortem;
  }

  /**
   * Get incident by ID
   */
  getIncident(incidentId: string): Incident | undefined {
    return this.incidents.get(incidentId);
  }

  /**
   * Get all incidents
   */
  getAllIncidents(): Incident[] {
    return Array.from(this.incidents.values());
  }

  /**
   * Get incidents by status
   */
  getIncidentsByStatus(status: IncidentStatus): Incident[] {
    return Array.from(this.incidents.values()).filter(incident => incident.status === status);
  }

  /**
   * Get active incidents
   */
  getActiveIncidents(): Incident[] {
    const activeStatuses: IncidentStatus[] = ['triggered', 'acknowledged', 'investigating', 'identified', 'monitoring'];
    return Array.from(this.incidents.values()).filter(incident => 
      activeStatuses.includes(incident.status)
    );
  }

  /**
   * Get post-mortem by ID
   */
  getPostMortem(postMortemId: string): PostMortem | undefined {
    return this.postMortems.get(postMortemId);
  }

  // Private helper methods

  private async triggerIncidentResponse(incident: Incident): Promise<void> {
    // Get on-call schedule for the service
    const schedule = this.getOnCallScheduleForService(incident.classification.primaryService);
    
    if (schedule) {
      // Page the on-call person
      await this.pageOnCall(incident, schedule.currentOnCall);
    }

    // Send to external systems
    if (this.pagerDutyProvider) {
      const pdIncident = await this.pagerDutyProvider.createIncident({
        title: incident.title,
        description: incident.description,
        severity: incident.severity,
        service: incident.classification.primaryService
      });
      incident.externalTickets.pagerduty = pdIncident.id;
    }

    if (this.opsgenieProvider) {
      const opsIncident = await this.opsgenieProvider.createAlert({
        title: incident.title,
        description: incident.description,
        priority: incident.priority,
        tags: incident.tags
      });
      incident.externalTickets.opsgenie = opsIncident.id;
    }

    // Send initial communications
    await this.sendInitialCommunications(incident);
  }

  private async triggerEscalatedResponse(incident: Incident, targetLevel?: string): Promise<void> {
    // Get escalation policy
    const schedule = this.getOnCallScheduleForService(incident.classification.primaryService);
    
    if (schedule && schedule.escalationPolicy) {
      const targetEscalationLevel = targetLevel || this.getNextEscalationLevel(incident.severity);
      const escalationLevel = schedule.escalationPolicy.levels.find(l => l.level === targetEscalationLevel);
      
      if (escalationLevel) {
        // Page escalation targets
        for (const target of escalationLevel.targets) {
          await this.pageTarget(incident, target);
        }
      }
    }
  }

  private async pageOnCall(incident: Incident, onCall: OnCallSchedule['currentOnCall']): Promise<void> {
    const response: IncidentResponse = {
      id: uuidv4(),
      incidentId: incident.id,
      type: 'page',
      target: {
        type: 'user',
        id: onCall.userId,
        name: onCall.name
      },
      status: 'pending',
      method: 'phone',
      details: {
        triggeredAt: new Date(),
        attempts: 0
      }
    };

    this.responses.set(response.id, response);

    // Add participant to incident
    await this.addParticipant(incident.id, {
      userId: onCall.userId,
      name: onCall.name,
      email: onCall.email,
      role: 'primary_responder',
      wasOnCall: true
    });
  }

  private async pageTarget(incident: Incident, target: any): Promise<void> {
    const response: IncidentResponse = {
      id: uuidv4(),
      incidentId: incident.id,
      type: 'escalation',
      target,
      status: 'pending',
      method: 'phone',
      details: {
        triggeredAt: new Date(),
        attempts: 0
      }
    };

    this.responses.set(response.id, response);
  }

  private async sendInitialCommunications(incident: Incident): Promise<void> {
    // Send Slack notification
    if (this.config.slackWebhookUrl) {
      await this.sendCommunication(incident.id, {
        type: 'slack',
        message: `🚨 New ${incident.severity.toUpperCase()} incident: ${incident.title}`,
        sentBy: 'system',
        channel: '#incidents'
      });
    }

    // Update status page for high severity incidents
    if ((incident.severity === 'sev1' || incident.severity === 'sev2') && this.config.statusPageUrl) {
      await this.sendCommunication(incident.id, {
        type: 'status_page',
        message: `We are investigating an issue affecting ${incident.classification.primaryService}`,
        sentBy: 'system'
      });
    }
  }

  private async sendStatusUpdate(incident: Incident, previousStatus: IncidentStatus): Promise<void> {
    const statusMessage = this.generateStatusMessage(incident, previousStatus);
    
    // Send to Slack
    if (this.config.slackWebhookUrl) {
      await this.sendCommunication(incident.id, {
        type: 'slack',
        message: statusMessage,
        sentBy: 'system',
        channel: '#incidents'
      });
    }
  }

  private async deliverCommunication(communication: IncidentCommunication): Promise<void> {
    // This would integrate with actual communication systems
    console.log(`Delivering ${communication.type} communication:`, communication.message);
  }

  private async handleIncidentResolution(incident: Incident): Promise<void> {
    // Close external tickets
    if (incident.externalTickets.pagerduty && this.pagerDutyProvider) {
      await this.pagerDutyProvider.resolveIncident(incident.externalTickets.pagerduty);
    }

    if (incident.externalTickets.opsgenie && this.opsgenieProvider) {
      await this.opsgenieProvider.closeAlert(incident.externalTickets.opsgenie);
    }

    // Send resolution communication
    await this.sendCommunication(incident.id, {
      type: 'slack',
      message: `✅ Incident resolved: ${incident.title}`,
      sentBy: 'system',
      channel: '#incidents'
    });

    // Create post-mortem if required
    if (this.config.postMortemRequired.includes(incident.severity)) {
      const incidentCommander = incident.participants.find(p => p.role === 'incident_commander');
      const author = incidentCommander?.userId || incident.metadata.createdBy;
      
      await this.createPostMortem(incident.id, author);
    }
  }

  private updateIncidentMetrics(incident: Incident): void {
    const timeline = incident.timeline;
    const metrics: IncidentMetrics = {};

    if (timeline.acknowledgedAt && timeline.detectedAt) {
      metrics.timeToAcknowledge = differenceInMinutes(timeline.acknowledgedAt, timeline.detectedAt);
    }

    if (timeline.mitigatedAt && timeline.detectedAt) {
      metrics.timeToMitigate = differenceInMinutes(timeline.mitigatedAt, timeline.detectedAt);
    }

    if (timeline.resolvedAt && timeline.detectedAt) {
      metrics.timeToResolve = differenceInMinutes(timeline.resolvedAt, timeline.detectedAt);
      metrics.mttr = metrics.timeToResolve;
      metrics.totalDuration = metrics.timeToResolve;
    }

    incident.metrics = metrics;
  }

  private generateTimelineEvents(incident: Incident): PostMortem['timeline']['events'] {
    const events: PostMortem['timeline']['events'] = [];
    
    if (incident.timeline.detectedAt) {
      events.push({
        timestamp: incident.timeline.detectedAt,
        description: 'Incident detected',
        type: 'detection'
      });
    }

    if (incident.timeline.acknowledgedAt) {
      events.push({
        timestamp: incident.timeline.acknowledgedAt,
        description: 'Incident acknowledged',
        type: 'investigation'
      });
    }

    if (incident.timeline.identifiedAt) {
      events.push({
        timestamp: incident.timeline.identifiedAt,
        description: 'Root cause identified',
        type: 'investigation'
      });
    }

    if (incident.timeline.mitigatedAt) {
      events.push({
        timestamp: incident.timeline.mitigatedAt,
        description: 'Mitigation applied',
        type: 'mitigation'
      });
    }

    if (incident.timeline.resolvedAt) {
      events.push({
        timestamp: incident.timeline.resolvedAt,
        description: 'Incident resolved',
        type: 'resolution'
      });
    }

    return events.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  private mapSeverityToPriority(severity: IncidentSeverity): IncidentPriority {
    const mapping: Record<IncidentSeverity, IncidentPriority> = {
      'sev1': 'p1',
      'sev2': 'p2',
      'sev3': 'p3',
      'sev4': 'p4'
    };
    return mapping[severity];
  }

  private mapSeverityToBusinessImpact(severity: IncidentSeverity): 'none' | 'low' | 'medium' | 'high' | 'critical' {
    const mapping: Record<IncidentSeverity, 'none' | 'low' | 'medium' | 'high' | 'critical'> = {
      'sev1': 'critical',
      'sev2': 'high',
      'sev3': 'medium',
      'sev4': 'low'
    };
    return mapping[severity];
  }

  private getOnCallScheduleForService(service: string): OnCallSchedule | undefined {
    return Array.from(this.onCallSchedules.values()).find(schedule => 
      schedule.team === service || schedule.name.includes(service)
    );
  }

  private getNextEscalationLevel(severity: IncidentSeverity): string {
    if (severity === 'sev1') return 'l3';
    if (severity === 'sev2') return 'l2';
    return 'l1';
  }

  private generateStatusMessage(incident: Incident, previousStatus: IncidentStatus): string {
    const statusEmojis = {
      'triggered': '🔴',
      'acknowledged': '🟡',
      'investigating': '🔍',
      'identified': '🎯',
      'monitoring': '👀',
      'resolved': '✅'
    };

    return `${statusEmojis[incident.status]} Incident ${incident.id} status changed from ${previousStatus} to ${incident.status}: ${incident.title}`;
  }

  private setupAutoEscalation(): void {
    // Check for unacknowledged incidents every minute
    setInterval(() => {
      this.checkForAutoEscalation();
    }, 60000);
  }

  private async checkForAutoEscalation(): Promise<void> {
    const now = new Date();
    const activeIncidents = this.getActiveIncidents();

    for (const incident of activeIncidents) {
      if (incident.status === 'triggered' && incident.timeline.detectedAt) {
        const minutesSinceDetection = differenceInMinutes(now, incident.timeline.detectedAt);
        
        if (minutesSinceDetection >= this.config.autoEscalationDelay) {
          await this.escalateIncident(
            incident.id,
            'system',
            `Auto-escalation after ${this.config.autoEscalationDelay} minutes without acknowledgment`
          );
        }
      }
    }
  }
}
