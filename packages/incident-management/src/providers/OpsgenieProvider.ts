import axios, { AxiosInstance } from 'axios';
import { IncidentPriority, OnCallSchedule } from '../types/incident';

/**
 * Opsgenie Integration Provider
 * Handles alert creation, escalation, and on-call management
 */
export class OpsgenieProvider {
  private client: AxiosInstance;
  private teamId: string;

  constructor(config: { apiKey: string; teamId: string }) {
    this.teamId = config.teamId;
    
    this.client = axios.create({
      baseURL: 'https://api.opsgenie.com/v2',
      headers: {
        'Authorization': `GenieKey ${config.apiKey}`,
        'Content-Type': 'application/json'
      }
    });
  }

  /**
   * Create alert in Opsgenie
   */
  async createAlert(params: {
    title: string;
    description: string;
    priority: IncidentPriority;
    tags?: string[];
    source?: string;
    entity?: string;
    alias?: string;
    responders?: Array<{
      type: 'user' | 'team' | 'schedule' | 'escalation';
      id: string;
    }>;
  }): Promise<{ id: string; requestId: string }> {
    try {
      const response = await this.client.post('/alerts', {
        message: params.title,
        description: params.description,
        priority: this.mapPriorityToOpsgenie(params.priority),
        tags: params.tags || [],
        source: params.source || 'Nexus',
        entity: params.entity,
        alias: params.alias || `nexus-${Date.now()}`,
        responders: params.responders || [{
          type: 'team',
          id: this.teamId
        }]
      });

      return {
        id: response.data.data.alertId,
        requestId: response.data.requestId
      };
    } catch (error) {
      console.error('Failed to create Opsgenie alert:', error);
      throw new Error(`Opsgenie alert creation failed: ${error}`);
    }
  }

  /**
   * Acknowledge alert
   */
  async acknowledgeAlert(alertId: string, userId?: string, note?: string): Promise<void> {
    try {
      await this.client.post(`/alerts/${alertId}/acknowledge`, {
        user: userId,
        note: note
      });
    } catch (error) {
      console.error('Failed to acknowledge Opsgenie alert:', error);
      throw new Error(`Opsgenie alert acknowledgment failed: ${error}`);
    }
  }

  /**
   * Close alert
   */
  async closeAlert(alertId: string, userId?: string, note?: string): Promise<void> {
    try {
      await this.client.post(`/alerts/${alertId}/close`, {
        user: userId,
        note: note
      });
    } catch (error) {
      console.error('Failed to close Opsgenie alert:', error);
      throw new Error(`Opsgenie alert closure failed: ${error}`);
    }
  }

  /**
   * Escalate alert
   */
  async escalateAlert(alertId: string, escalationId: string): Promise<void> {
    try {
      await this.client.post(`/alerts/${alertId}/escalate`, {
        escalation: {
          id: escalationId,
          type: 'escalation'
        }
      });
    } catch (error) {
      console.error('Failed to escalate Opsgenie alert:', error);
      throw new Error(`Opsgenie alert escalation failed: ${error}`);
    }
  }

  /**
   * Add note to alert
   */
  async addNote(alertId: string, note: string, userId?: string): Promise<void> {
    try {
      await this.client.post(`/alerts/${alertId}/notes`, {
        note: note,
        user: userId
      });
    } catch (error) {
      console.error('Failed to add Opsgenie note:', error);
      throw new Error(`Opsgenie note creation failed: ${error}`);
    }
  }

  /**
   * Get alert details
   */
  async getAlert(alertId: string): Promise<any> {
    try {
      const response = await this.client.get(`/alerts/${alertId}`);
      return response.data.data;
    } catch (error) {
      console.error('Failed to get Opsgenie alert:', error);
      throw new Error(`Opsgenie alert retrieval failed: ${error}`);
    }
  }

  /**
   * List alerts
   */
  async listAlerts(params?: {
    query?: string;
    searchIdentifier?: string;
    searchIdentifierType?: 'id' | 'tiny' | 'alias';
    offset?: number;
    limit?: number;
    sort?: 'createdAt' | 'updatedAt' | 'tinyId' | 'alias' | 'message' | 'status' | 'acknowledged' | 'isSeen' | 'snoozed' | 'snoozedUntil' | 'count' | 'lastOccurredAt' | 'source' | 'owner' | 'integration.name' | 'integration.type' | 'report.ackTime' | 'report.closeTime' | 'report.acknowledgedBy' | 'report.closedBy';
    order?: 'asc' | 'desc';
  }): Promise<any[]> {
    try {
      const response = await this.client.get('/alerts', {
        params: {
          query: params?.query,
          searchIdentifier: params?.searchIdentifier,
          searchIdentifierType: params?.searchIdentifierType,
          offset: params?.offset || 0,
          limit: params?.limit || 100,
          sort: params?.sort || 'createdAt',
          order: params?.order || 'desc'
        }
      });

      return response.data.data;
    } catch (error) {
      console.error('Failed to list Opsgenie alerts:', error);
      throw new Error(`Opsgenie alert listing failed: ${error}`);
    }
  }

  /**
   * Get current on-call for schedule
   */
  async getCurrentOnCall(scheduleId: string): Promise<{
    userId: string;
    name: string;
    email: string;
    phone?: string;
    startTime: Date;
    endTime: Date;
  } | null> {
    try {
      const now = new Date();
      const response = await this.client.get(`/schedules/${scheduleId}/on-calls`, {
        params: {
          scheduleIdentifierType: 'id',
          date: now.toISOString()
        }
      });

      const onCallData = response.data.data.onCallRecipients[0];
      if (!onCallData) return null;

      return {
        userId: onCallData.id,
        name: onCallData.name,
        email: onCallData.username, // Opsgenie uses username as email
        startTime: new Date(response.data.data.onCallParticipants[0].startDate),
        endTime: new Date(response.data.data.onCallParticipants[0].endDate)
      };
    } catch (error) {
      console.error('Failed to get Opsgenie on-call:', error);
      return null;
    }
  }

  /**
   * Get schedule details
   */
  async getSchedule(scheduleId: string): Promise<OnCallSchedule | null> {
    try {
      const [scheduleResponse, onCallResponse] = await Promise.all([
        this.client.get(`/schedules/${scheduleId}`),
        this.getCurrentOnCall(scheduleId)
      ]);

      const schedule = scheduleResponse.data.data;
      
      if (!onCallResponse) return null;

      return {
        id: schedule.id,
        name: schedule.name,
        team: schedule.ownerTeam?.name || 'Unknown',
        currentOnCall: onCallResponse,
        escalationPolicy: {
          levels: [] // Would need to fetch escalation policy details
        },
        configuration: {
          timezone: schedule.timezone,
          rotationType: 'weekly', // Default
          rotationLength: 168, // 1 week in hours
          handoffTime: '09:00'
        }
      };
    } catch (error) {
      console.error('Failed to get Opsgenie schedule:', error);
      return null;
    }
  }

  /**
   * Get team details
   */
  async getTeam(teamId: string): Promise<any> {
    try {
      const response = await this.client.get(`/teams/${teamId}`);
      return response.data.data;
    } catch (error) {
      console.error('Failed to get Opsgenie team:', error);
      throw new Error(`Opsgenie team retrieval failed: ${error}`);
    }
  }

  /**
   * Get team members
   */
  async getTeamMembers(teamId: string): Promise<any[]> {
    try {
      const response = await this.client.get(`/teams/${teamId}/members`);
      return response.data.data;
    } catch (error) {
      console.error('Failed to get Opsgenie team members:', error);
      throw new Error(`Opsgenie team members retrieval failed: ${error}`);
    }
  }

  /**
   * Get escalation policies
   */
  async getEscalations(): Promise<any[]> {
    try {
      const response = await this.client.get('/escalations');
      return response.data.data;
    } catch (error) {
      console.error('Failed to get Opsgenie escalations:', error);
      throw new Error(`Opsgenie escalations retrieval failed: ${error}`);
    }
  }

  /**
   * Create escalation policy
   */
  async createEscalation(params: {
    name: string;
    description?: string;
    rules: Array<{
      condition: 'if-not-acked' | 'if-not-closed';
      notifyType: 'default' | 'users' | 'admins' | 'random' | 'next' | 'previous';
      delay: number; // minutes
      recipient: {
        type: 'user' | 'team' | 'schedule';
        id: string;
      };
    }>;
  }): Promise<{ id: string }> {
    try {
      const response = await this.client.post('/escalations', {
        name: params.name,
        description: params.description,
        rules: params.rules.map(rule => ({
          condition: rule.condition,
          notifyType: rule.notifyType,
          delay: {
            timeAmount: rule.delay,
            timeUnit: 'minutes'
          },
          recipient: rule.recipient
        }))
      });

      return {
        id: response.data.data.id
      };
    } catch (error) {
      console.error('Failed to create Opsgenie escalation:', error);
      throw new Error(`Opsgenie escalation creation failed: ${error}`);
    }
  }

  /**
   * Get integrations
   */
  async getIntegrations(): Promise<any[]> {
    try {
      const response = await this.client.get('/integrations');
      return response.data.data;
    } catch (error) {
      console.error('Failed to get Opsgenie integrations:', error);
      throw new Error(`Opsgenie integrations retrieval failed: ${error}`);
    }
  }

  /**
   * Create integration
   */
  async createIntegration(params: {
    name: string;
    type: string;
    allowWriteAccess?: boolean;
    ignoreTeamsFromPayload?: boolean;
    suppressNotifications?: boolean;
    ownerTeam?: {
      id: string;
    };
  }): Promise<{ id: string; apiKey: string }> {
    try {
      const response = await this.client.post('/integrations', {
        name: params.name,
        type: params.type,
        allowWriteAccess: params.allowWriteAccess ?? true,
        ignoreTeamsFromPayload: params.ignoreTeamsFromPayload ?? false,
        suppressNotifications: params.suppressNotifications ?? false,
        ownerTeam: params.ownerTeam || {
          id: this.teamId
        }
      });

      return {
        id: response.data.data.id,
        apiKey: response.data.data.apiKey
      };
    } catch (error) {
      console.error('Failed to create Opsgenie integration:', error);
      throw new Error(`Opsgenie integration creation failed: ${error}`);
    }
  }

  /**
   * Send heartbeat
   */
  async sendHeartbeat(heartbeatName: string): Promise<void> {
    try {
      await this.client.post(`/heartbeats/${heartbeatName}/ping`);
    } catch (error) {
      console.error('Failed to send Opsgenie heartbeat:', error);
      throw new Error(`Opsgenie heartbeat failed: ${error}`);
    }
  }

  /**
   * Get maintenance windows
   */
  async getMaintenances(): Promise<any[]> {
    try {
      const response = await this.client.get('/maintenances');
      return response.data.data;
    } catch (error) {
      console.error('Failed to get Opsgenie maintenances:', error);
      throw new Error(`Opsgenie maintenances retrieval failed: ${error}`);
    }
  }

  /**
   * Create maintenance window
   */
  async createMaintenance(params: {
    description: string;
    startDate: Date;
    endDate: Date;
    rules: Array<{
      entity: string;
      state: 'enabled' | 'disabled';
    }>;
  }): Promise<{ id: string }> {
    try {
      const response = await this.client.post('/maintenances', {
        description: params.description,
        time: {
          type: 'for-5-minutes', // This would be calculated from start/end dates
          startDate: params.startDate.toISOString(),
          endDate: params.endDate.toISOString()
        },
        rules: params.rules
      });

      return {
        id: response.data.data.id
      };
    } catch (error) {
      console.error('Failed to create Opsgenie maintenance:', error);
      throw new Error(`Opsgenie maintenance creation failed: ${error}`);
    }
  }

  // Private helper methods

  private mapPriorityToOpsgenie(priority: IncidentPriority): 'P1' | 'P2' | 'P3' | 'P4' | 'P5' {
    const mapping: Record<IncidentPriority, 'P1' | 'P2' | 'P3' | 'P4' | 'P5'> = {
      'p1': 'P1',
      'p2': 'P2',
      'p3': 'P3',
      'p4': 'P4'
    };
    return mapping[priority] || 'P3';
  }

  /**
   * Test Opsgenie connection
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.client.get('/account');
      return true;
    } catch (error) {
      console.error('Opsgenie connection test failed:', error);
      return false;
    }
  }
}
