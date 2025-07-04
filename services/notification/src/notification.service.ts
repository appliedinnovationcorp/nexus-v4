import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { EventPattern, MessagePattern } from '@nestjs/microservices';

export interface NotificationRequest {
  id: string;
  userId: string;
  type: 'email' | 'sms' | 'push' | 'slack' | 'discord' | 'webhook';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  template: string;
  data: Record<string, any>;
  channels: string[];
  scheduledAt?: Date;
  expiresAt?: Date;
  metadata?: Record<string, any>;
}

export interface NotificationStatus {
  id: string;
  status: 'pending' | 'processing' | 'sent' | 'failed' | 'expired';
  channel: string;
  sentAt?: Date;
  error?: string;
  attempts: number;
  maxAttempts: number;
}

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    @InjectQueue('email-notifications') private emailQueue: Queue,
    @InjectQueue('sms-notifications') private smsQueue: Queue,
    @InjectQueue('push-notifications') private pushQueue: Queue,
    @InjectQueue('slack-notifications') private slackQueue: Queue,
    @InjectQueue('discord-notifications') private discordQueue: Queue,
    @InjectQueue('webhook-notifications') private webhookQueue: Queue,
  ) {}

  // Send notification through multiple channels
  async sendNotification(request: NotificationRequest): Promise<{ 
    id: string; 
    status: string; 
    channels: string[] 
  }> {
    this.logger.debug(`Sending notification ${request.id} to ${request.channels.join(', ')}`);

    const promises = request.channels.map(channel => 
      this.sendToChannel(request, channel)
    );

    await Promise.all(promises);

    return {
      id: request.id,
      status: 'queued',
      channels: request.channels,
    };
  }

  // Send to specific channel
  private async sendToChannel(request: NotificationRequest, channel: string): Promise<void> {
    const jobData = {
      ...request,
      channel,
      timestamp: new Date(),
    };

    const jobOptions = {
      priority: this.getPriority(request.priority),
      attempts: this.getMaxAttempts(channel),
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
      delay: request.scheduledAt ? request.scheduledAt.getTime() - Date.now() : 0,
      removeOnComplete: 100,
      removeOnFail: 50,
    };

    switch (channel) {
      case 'email':
        await this.emailQueue.add('send-email', jobData, jobOptions);
        break;
      case 'sms':
        await this.smsQueue.add('send-sms', jobData, jobOptions);
        break;
      case 'push':
        await this.pushQueue.add('send-push', jobData, jobOptions);
        break;
      case 'slack':
        await this.slackQueue.add('send-slack', jobData, jobOptions);
        break;
      case 'discord':
        await this.discordQueue.add('send-discord', jobData, jobOptions);
        break;
      case 'webhook':
        await this.webhookQueue.add('send-webhook', jobData, jobOptions);
        break;
      default:
        this.logger.warn(`Unknown notification channel: ${channel}`);
    }
  }

  // Bulk notification sending
  async sendBulkNotifications(requests: NotificationRequest[]): Promise<{
    total: number;
    queued: number;
    failed: number;
  }> {
    this.logger.debug(`Sending bulk notifications: ${requests.length} requests`);

    let queued = 0;
    let failed = 0;

    const promises = requests.map(async (request) => {
      try {
        await this.sendNotification(request);
        queued++;
      } catch (error) {
        this.logger.error(`Failed to queue notification ${request.id}:`, error);
        failed++;
      }
    });

    await Promise.allSettled(promises);

    return {
      total: requests.length,
      queued,
      failed,
    };
  }

  // Event handlers for microservice communication
  @EventPattern('user.registered')
  async handleUserRegistered(data: { userId: string; email: string; name: string }): Promise<void> {
    await this.sendNotification({
      id: crypto.randomUUID(),
      userId: data.userId,
      type: 'email',
      priority: 'normal',
      template: 'welcome',
      data: {
        name: data.name,
        email: data.email,
      },
      channels: ['email'],
    });
  }

  @EventPattern('user.password_reset')
  async handlePasswordReset(data: { userId: string; email: string; resetToken: string }): Promise<void> {
    await this.sendNotification({
      id: crypto.randomUUID(),
      userId: data.userId,
      type: 'email',
      priority: 'high',
      template: 'password-reset',
      data: {
        email: data.email,
        resetToken: data.resetToken,
        resetUrl: `${process.env.FRONTEND_URL}/reset-password?token=${data.resetToken}`,
      },
      channels: ['email'],
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
    });
  }

  @EventPattern('system.alert')
  async handleSystemAlert(data: { 
    type: string; 
    severity: string; 
    message: string; 
    metadata: Record<string, any> 
  }): Promise<void> {
    const channels = ['slack'];
    if (data.severity === 'critical') {
      channels.push('sms', 'discord');
    }

    await this.sendNotification({
      id: crypto.randomUUID(),
      userId: 'system',
      type: 'slack',
      priority: data.severity === 'critical' ? 'urgent' : 'high',
      template: 'system-alert',
      data: {
        type: data.type,
        severity: data.severity,
        message: data.message,
        timestamp: new Date(),
        ...data.metadata,
      },
      channels,
    });
  }

  @MessagePattern('notification.status')
  async getNotificationStatus(notificationId: string): Promise<NotificationStatus[]> {
    // Get status from all queues
    const queues = [
      { name: 'email', queue: this.emailQueue },
      { name: 'sms', queue: this.smsQueue },
      { name: 'push', queue: this.pushQueue },
      { name: 'slack', queue: this.slackQueue },
      { name: 'discord', queue: this.discordQueue },
      { name: 'webhook', queue: this.webhookQueue },
    ];

    const statuses: NotificationStatus[] = [];

    for (const { name, queue } of queues) {
      const jobs = await queue.getJobs(['completed', 'failed', 'active', 'waiting']);
      const relevantJobs = jobs.filter(job => job.data.id === notificationId);

      for (const job of relevantJobs) {
        statuses.push({
          id: notificationId,
          status: this.mapJobStatus(job.opts.jobId ? 'completed' : 'pending'),
          channel: name,
          sentAt: job.finishedOn ? new Date(job.finishedOn) : undefined,
          error: job.failedReason,
          attempts: job.attemptsMade,
          maxAttempts: job.opts.attempts || 1,
        });
      }
    }

    return statuses;
  }

  // Get notification statistics
  async getNotificationStats(): Promise<{
    totalSent: number;
    totalFailed: number;
    channelStats: Record<string, { sent: number; failed: number }>;
    recentActivity: Array<{ timestamp: Date; channel: string; status: string; count: number }>;
  }> {
    const queues = [
      { name: 'email', queue: this.emailQueue },
      { name: 'sms', queue: this.smsQueue },
      { name: 'push', queue: this.pushQueue },
      { name: 'slack', queue: this.slackQueue },
      { name: 'discord', queue: this.discordQueue },
      { name: 'webhook', queue: this.webhookQueue },
    ];

    let totalSent = 0;
    let totalFailed = 0;
    const channelStats: Record<string, { sent: number; failed: number }> = {};

    for (const { name, queue } of queues) {
      const jobCounts = await queue.getJobCounts();
      const sent = jobCounts.completed;
      const failed = jobCounts.failed;

      totalSent += sent;
      totalFailed += failed;
      channelStats[name] = { sent, failed };
    }

    return {
      totalSent,
      totalFailed,
      channelStats,
      recentActivity: [], // Would be populated from a time-series database
    };
  }

  // Template management
  async getTemplate(templateName: string): Promise<{
    name: string;
    subject?: string;
    body: string;
    type: string;
  }> {
    // In a real implementation, this would fetch from a database
    const templates: Record<string, any> = {
      'welcome': {
        name: 'welcome',
        subject: 'Welcome to Nexus!',
        body: 'Hello {{name}}, welcome to our platform!',
        type: 'email',
      },
      'password-reset': {
        name: 'password-reset',
        subject: 'Password Reset Request',
        body: 'Click here to reset your password: {{resetUrl}}',
        type: 'email',
      },
      'system-alert': {
        name: 'system-alert',
        body: '🚨 {{severity}} Alert: {{message}}',
        type: 'slack',
      },
    };

    return templates[templateName] || {
      name: templateName,
      body: 'Template not found',
      type: 'text',
    };
  }

  private getPriority(priority: string): number {
    const priorityMap: Record<string, number> = {
      'urgent': 10,
      'high': 8,
      'normal': 5,
      'low': 2,
    };
    return priorityMap[priority] || 5;
  }

  private getMaxAttempts(channel: string): number {
    const attemptsMap: Record<string, number> = {
      'email': 3,
      'sms': 2,
      'push': 3,
      'slack': 2,
      'discord': 2,
      'webhook': 5,
    };
    return attemptsMap[channel] || 3;
  }

  private mapJobStatus(jobStatus: string): 'pending' | 'processing' | 'sent' | 'failed' | 'expired' {
    const statusMap: Record<string, any> = {
      'waiting': 'pending',
      'active': 'processing',
      'completed': 'sent',
      'failed': 'failed',
      'delayed': 'pending',
    };
    return statusMap[jobStatus] || 'pending';
  }
}
