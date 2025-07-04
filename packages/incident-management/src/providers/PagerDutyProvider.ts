import axios, { AxiosInstance } from 'axios';
import { IncidentSeverity, IncidentPriority, OnCallSchedule } from '../types/incident';

/**
 * PagerDuty Integration Provider
 * Handles incident creation, escalation, and on-call management
 */
export class PagerDutyProvider {
  private client: AxiosInstance;
  private serviceKey: string;

  constructor(config: { apiKey: string; serviceKey: string }) {
    this.serviceKey = config.serviceKey;
    
    this.client = axios.create({
      baseURL: 'https://api.pagerduty.com',
      headers: {
        'Authorization': `Token token=${config.apiKey}`,
        'Accept': 'application/vnd.pagerduty+json;version=2',
        'Content-Type': 'application/json'
      }
    });
  }

  /**
   * Create incident in PagerDuty
   */
  async createIncident(params: {
    title: string;
    description: string;
    severity: IncidentSeverity;
    service: string;
    urgency?: 'high' | 'low';
    assignedTo?: string;
  }): Promise<{ id: string; url: string }> {
    try {
      const urgency = this.mapSeverityToUrgency(params.severity);
      
      const response = await this.client.post('/incidents', {
        incident: {
          type: 'incident',
          title: params.title,
          service: {
            id: await this.getServiceId(params.service),
            type: 'service_reference'
          },
          urgency,
          body: {
            type: 'incident_body',
            details: params.description
          },
          incident_key: `nexus-${Date.now()}`,
          ...(params.assignedTo && {
            assignments: [{
              assignee: {
                id: params.assignedTo,
                type: 'user_reference'
              }
            }]
          })
        }
      });

      return {
        id: response.data.incident.id,
        url: response.data.incident.html_url
      };
    } catch (error) {
      console.error('Failed to create PagerDuty incident:', error);
      throw new Error(`PagerDuty incident creation failed: ${error}`);
    }
  }

  /**
   * Update incident status
   */
  async updateIncident(incidentId: string, status: 'acknowledged' | 'resolved', userId?: string): Promise<void> {
    try {
      await this.client.put(`/incidents/${incidentId}`, {
        incident: {
          type: 'incident',
          status,
          ...(userId && {
            assignments: [{
              assignee: {
                id: userId,
                type: 'user_reference'
              }
            }]
          })
        }
      });
    } catch (error) {
      console.error('Failed to update PagerDuty incident:', error);
      throw new Error(`PagerDuty incident update failed: ${error}`);
    }
  }

  /**
   * Resolve incident
   */
  async resolveIncident(incidentId: string): Promise<void> {
    await this.updateIncident(incidentId, 'resolved');
  }

  /**
   * Escalate incident
   */
  async escalateIncident(incidentId: string, escalationPolicyId: string): Promise<void> {
    try {
      await this.client.post(`/incidents/${incidentId}/escalate`, {
        escalation_policy: {
          id: escalationPolicyId,
          type: 'escalation_policy_reference'
        }
      });
    } catch (error) {
      console.error('Failed to escalate PagerDuty incident:', error);
      throw new Error(`PagerDuty incident escalation failed: ${error}`);
    }
  }

  /**
   * Add note to incident
   */
  async addNote(incidentId: string, content: string, userId: string): Promise<void> {
    try {
      await this.client.post(`/incidents/${incidentId}/notes`, {
        note: {
          content
        }
      }, {
        headers: {
          'From': userId
        }
      });
    } catch (error) {
      console.error('Failed to add PagerDuty note:', error);
      throw new Error(`PagerDuty note creation failed: ${error}`);
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
      const response = await this.client.get(`/schedules/${scheduleId}/users`, {
        params: {
          since: new Date().toISOString(),
          until: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
        }
      });

      const onCallEntry = response.data.users[0];
      if (!onCallEntry) return null;

      return {
        userId: onCallEntry.id,
        name: onCallEntry.name,
        email: onCallEntry.email,
        phone: onCallEntry.contact_methods?.find((cm: any) => cm.type === 'phone_contact_method')?.address,
        startTime: new Date(onCallEntry.start),
        endTime: new Date(onCallEntry.end)
      };
    } catch (error) {
      console.error('Failed to get PagerDuty on-call:', error);
      return null;
    }
  }

  /**
   * Get on-call schedule
   */
  async getSchedule(scheduleId: string): Promise<OnCallSchedule | null> {
    try {
      const [scheduleResponse, onCallResponse] = await Promise.all([
        this.client.get(`/schedules/${scheduleId}`),
        this.getCurrentOnCall(scheduleId)
      ]);

      const schedule = scheduleResponse.data.schedule;
      
      if (!onCallResponse) return null;

      return {
        id: schedule.id,
        name: schedule.name,
        team: schedule.teams?.[0]?.name || 'Unknown',
        currentOnCall: onCallResponse,
        escalationPolicy: {
          levels: [] // Would need to fetch escalation policy details
        },
        configuration: {
          timezone: schedule.time_zone,
          rotationType: 'weekly', // Default
          rotationLength: 168, // 1 week in hours
          handoffTime: '09:00'
        }
      };
    } catch (error) {
      console.error('Failed to get PagerDuty schedule:', error);
      return null;
    }
  }

  /**
   * Create service in PagerDuty
   */
  async createService(params: {
    name: string;
    description?: string;
    escalationPolicyId: string;
  }): Promise<{ id: string; integrationKey: string }> {
    try {
      const response = await this.client.post('/services', {
        service: {
          name: params.name,
          description: params.description,
          escalation_policy: {
            id: params.escalationPolicyId,
            type: 'escalation_policy_reference'
          }
        }
      });

      // Create integration for the service
      const integrationResponse = await this.client.post(`/services/${response.data.service.id}/integrations`, {
        integration: {
          type: 'generic_events_api_inbound_integration',
          name: `${params.name} Integration`
        }
      });

      return {
        id: response.data.service.id,
        integrationKey: integrationResponse.data.integration.integration_key
      };
    } catch (error) {
      console.error('Failed to create PagerDuty service:', error);
      throw new Error(`PagerDuty service creation failed: ${error}`);
    }
  }

  /**
   * Send event to PagerDuty Events API
   */
  async sendEvent(params: {
    eventAction: 'trigger' | 'acknowledge' | 'resolve';
    routingKey: string;
    dedupKey?: string;
    summary: string;
    source: string;
    severity: 'critical' | 'error' | 'warning' | 'info';
    component?: string;
    group?: string;
    class?: string;
    customDetails?: Record<string, any>;
  }): Promise<{ dedupKey: string; status: string }> {
    try {
      const response = await axios.post('https://events.pagerduty.com/v2/enqueue', {
        routing_key: params.routingKey,
        event_action: params.eventAction,
        dedup_key: params.dedupKey,
        payload: {
          summary: params.summary,
          source: params.source,
          severity: params.severity,
          component: params.component,
          group: params.group,
          class: params.class,
          custom_details: params.customDetails
        }
      });

      return {
        dedupKey: response.data.dedup_key,
        status: response.data.status
      };
    } catch (error) {
      console.error('Failed to send PagerDuty event:', error);
      throw new Error(`PagerDuty event failed: ${error}`);
    }
  }

  /**
   * Get incident details
   */
  async getIncident(incidentId: string): Promise<any> {
    try {
      const response = await this.client.get(`/incidents/${incidentId}`);
      return response.data.incident;
    } catch (error) {
      console.error('Failed to get PagerDuty incident:', error);
      throw new Error(`PagerDuty incident retrieval failed: ${error}`);
    }
  }

  /**
   * List incidents
   */
  async listIncidents(params?: {
    statuses?: string[];
    serviceIds?: string[];
    since?: Date;
    until?: Date;
    limit?: number;
  }): Promise<any[]> {
    try {
      const queryParams: any = {
        limit: params?.limit || 100
      };

      if (params?.statuses) {
        queryParams['statuses[]'] = params.statuses;
      }

      if (params?.serviceIds) {
        queryParams['service_ids[]'] = params.serviceIds;
      }

      if (params?.since) {
        queryParams.since = params.since.toISOString();
      }

      if (params?.until) {
        queryParams.until = params.until.toISOString();
      }

      const response = await this.client.get('/incidents', {
        params: queryParams
      });

      return response.data.incidents;
    } catch (error) {
      console.error('Failed to list PagerDuty incidents:', error);
      throw new Error(`PagerDuty incident listing failed: ${error}`);
    }
  }

  /**
   * Get escalation policies
   */
  async getEscalationPolicies(): Promise<any[]> {
    try {
      const response = await this.client.get('/escalation_policies');
      return response.data.escalation_policies;
    } catch (error) {
      console.error('Failed to get PagerDuty escalation policies:', error);
      throw new Error(`PagerDuty escalation policies retrieval failed: ${error}`);
    }
  }

  /**
   * Get users
   */
  async getUsers(): Promise<any[]> {
    try {
      const response = await this.client.get('/users');
      return response.data.users;
    } catch (error) {
      console.error('Failed to get PagerDuty users:', error);
      throw new Error(`PagerDuty users retrieval failed: ${error}`);
    }
  }

  // Private helper methods

  private mapSeverityToUrgency(severity: IncidentSeverity): 'high' | 'low' {
    return severity === 'sev1' || severity === 'sev2' ? 'high' : 'low';
  }

  private async getServiceId(serviceName: string): Promise<string> {
    try {
      const response = await this.client.get('/services', {
        params: {
          query: serviceName
        }
      });

      const service = response.data.services.find((s: any) => 
        s.name.toLowerCase().includes(serviceName.toLowerCase())
      );

      if (!service) {
        throw new Error(`Service not found: ${serviceName}`);
      }

      return service.id;
    } catch (error) {
      console.error('Failed to get PagerDuty service ID:', error);
      throw new Error(`PagerDuty service lookup failed: ${error}`);
    }
  }

  /**
   * Test PagerDuty connection
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.client.get('/users', { params: { limit: 1 } });
      return true;
    } catch (error) {
      console.error('PagerDuty connection test failed:', error);
      return false;
    }
  }
}
