import { Processor, Process } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { WebClient } from '@slack/web-api';

export interface SlackJob {
  id: string;
  userId: string;
  template: string;
  data: Record<string, any>;
  channel: string;
  message: string;
  priority: string;
  timestamp: Date;
}

@Processor('slack-notifications')
export class SlackProcessor {
  private readonly logger = new Logger(SlackProcessor.name);
  private slackClient: WebClient;
  private templates = new Map<string, any>();

  constructor() {
    this.initializeSlack();
    this.loadSlackTemplates();
  }

  private initializeSlack(): void {
    const botToken = process.env.SLACK_BOT_TOKEN;

    if (!botToken) {
      this.logger.warn('Slack bot token not configured. Slack functionality will be limited.');
      return;
    }

    try {
      this.slackClient = new WebClient(botToken);
      this.logger.log('Slack client initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize Slack client:', error);
    }
  }

  private loadSlackTemplates(): void {
    // System alert template
    this.templates.set('system-alert', {
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: '🚨 {{severity}} Alert: {{alertType}}',
          },
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: '*Message:* {{message}}\n*Time:* {{timestamp}}\n*Service:* {{service}}',
          },
        },
        {
          type: 'actions',
          elements: [
            {
              type: 'button',
              text: {
                type: 'plain_text',
                text: 'View Dashboard',
              },
              url: '{{dashboardUrl}}',
              style: 'primary',
            },
            {
              type: 'button',
              text: {
                type: 'plain_text',
                text: 'View Logs',
              },
              url: '{{logsUrl}}',
            },
          ],
        },
      ],
    });

    // Deployment notification template
    this.templates.set('deployment', {
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: '🚀 Deployment {{status}}',
          },
        },
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: '*Service:*\n{{serviceName}}',
            },
            {
              type: 'mrkdwn',
              text: '*Version:*\n{{version}}',
            },
            {
              type: 'mrkdwn',
              text: '*Environment:*\n{{environment}}',
            },
            {
              type: 'mrkdwn',
              text: '*Duration:*\n{{duration}}',
            },
          ],
        },
      ],
    });

    // Performance report template
    this.templates.set('performance-report', {
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: '📊 Performance Report',
          },
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: '*Daily Performance Summary*',
          },
        },
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: '*Response Time:*\n{{avgResponseTime}}ms',
            },
            {
              type: 'mrkdwn',
              text: '*Error Rate:*\n{{errorRate}}%',
            },
            {
              type: 'mrkdwn',
              text: '*Throughput:*\n{{throughput}} req/s',
            },
            {
              type: 'mrkdwn',
              text: '*Uptime:*\n{{uptime}}%',
            },
          ],
        },
      ],
    });

    // User activity template
    this.templates.set('user-activity', {
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: '👤 *{{activityType}}*\nUser: {{userName}}\nAction: {{action}}\nTime: {{timestamp}}',
          },
        },
      ],
    });

    // Simple message template
    this.templates.set('simple-message', {
      text: '{{message}}',
    });

    this.logger.log(`Loaded ${this.templates.size} Slack templates`);
  }

  @Process('send-slack')
  async handleSendSlack(job: Job<SlackJob>): Promise<void> {
    const { id, userId, template, data, channel, message, priority } = job.data;
    
    this.logger.debug(`Processing Slack job ${id} for user ${userId}`);

    if (!this.slackClient) {
      throw new Error('Slack client not initialized. Check your configuration.');
    }

    try {
      let messagePayload: any = {
        channel: channel || '#general',
        text: message,
      };

      // Use template if specified
      if (template && this.templates.has(template)) {
        const templateContent = this.templates.get(template);
        const templateData = {
          ...data,
          timestamp: new Date().toISOString(),
        };

        if (templateContent.blocks) {
          messagePayload.blocks = this.renderBlocks(templateContent.blocks, templateData);
        } else if (templateContent.text) {
          messagePayload.text = this.renderTemplate(templateContent.text, templateData);
        }

        // Add thread timestamp if this is a reply
        if (data.threadTs) {
          messagePayload.thread_ts = data.threadTs;
        }

        // Add username and icon for bot messages
        if (data.username) {
          messagePayload.username = data.username;
        }
        if (data.iconEmoji) {
          messagePayload.icon_emoji = data.iconEmoji;
        }
        if (data.iconUrl) {
          messagePayload.icon_url = data.iconUrl;
        }
      }

      // Send message
      const result = await this.slackClient.chat.postMessage(messagePayload);
      
      if (result.ok) {
        this.logger.log(`Slack message sent successfully: ${id} (ts: ${result.ts})`);
      } else {
        throw new Error(`Slack API error: ${result.error}`);
      }

      // Update job progress
      job.progress(100);
      
    } catch (error) {
      this.logger.error(`Failed to send Slack message ${id}:`, error);
      throw error;
    }
  }

  @Process('send-bulk-slack')
  async handleBulkSlack(job: Job<{ messages: SlackJob[] }>): Promise<void> {
    const { messages } = job.data;
    
    this.logger.debug(`Processing bulk Slack job with ${messages.length} messages`);

    let successCount = 0;
    let failureCount = 0;

    for (let i = 0; i < messages.length; i++) {
      try {
        await this.handleSendSlack({ data: messages[i] } as Job<SlackJob>);
        successCount++;
        
        // Rate limiting - Slack has rate limits
        if (i < messages.length - 1) {
          await this.delay(1000); // 1 second delay between messages
        }
      } catch (error) {
        failureCount++;
        this.logger.error(`Failed to send bulk Slack message ${i}:`, error);
      }

      // Update progress
      job.progress(Math.round(((i + 1) / messages.length) * 100));
    }

    this.logger.log(`Bulk Slack messages completed: ${successCount} sent, ${failureCount} failed`);
  }

  @Process('update-slack-message')
  async handleUpdateMessage(job: Job<{
    channel: string;
    timestamp: string;
    text?: string;
    blocks?: any[];
  }>): Promise<void> {
    const { channel, timestamp, text, blocks } = job.data;
    
    if (!this.slackClient) {
      throw new Error('Slack client not initialized');
    }

    try {
      const updatePayload: any = {
        channel,
        ts: timestamp,
      };

      if (text) {
        updatePayload.text = text;
      }
      if (blocks) {
        updatePayload.blocks = blocks;
      }

      const result = await this.slackClient.chat.update(updatePayload);
      
      if (result.ok) {
        this.logger.log(`Slack message updated successfully: ${timestamp}`);
      } else {
        throw new Error(`Slack API error: ${result.error}`);
      }
    } catch (error) {
      this.logger.error(`Failed to update Slack message:`, error);
      throw error;
    }
  }

  private renderTemplate(template: string, data: Record<string, any>): string {
    let rendered = template;
    
    Object.keys(data).forEach(key => {
      const regex = new RegExp(`{{${key}}}`, 'g');
      rendered = rendered.replace(regex, String(data[key] || ''));
    });

    return rendered;
  }

  private renderBlocks(blocks: any[], data: Record<string, any>): any[] {
    return blocks.map(block => this.renderBlock(block, data));
  }

  private renderBlock(block: any, data: Record<string, any>): any {
    if (typeof block === 'string') {
      return this.renderTemplate(block, data);
    }

    if (Array.isArray(block)) {
      return block.map(item => this.renderBlock(item, data));
    }

    if (typeof block === 'object' && block !== null) {
      const rendered: any = {};
      
      Object.keys(block).forEach(key => {
        rendered[key] = this.renderBlock(block[key], data);
      });
      
      return rendered;
    }

    return block;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Slack-specific features
  async sendFileToSlack(
    channel: string,
    filePath: string,
    filename: string,
    title?: string,
    comment?: string
  ): Promise<void> {
    if (!this.slackClient) {
      throw new Error('Slack client not initialized');
    }

    try {
      const result = await this.slackClient.files.upload({
        channels: channel,
        file: filePath,
        filename,
        title,
        initial_comment: comment,
      });

      if (result.ok) {
        this.logger.log(`File uploaded to Slack successfully: ${filename}`);
      } else {
        throw new Error(`Slack file upload error: ${result.error}`);
      }
    } catch (error) {
      this.logger.error(`Failed to upload file to Slack:`, error);
      throw error;
    }
  }

  async createSlackChannel(name: string, isPrivate: boolean = false): Promise<string> {
    if (!this.slackClient) {
      throw new Error('Slack client not initialized');
    }

    try {
      const result = await this.slackClient.conversations.create({
        name,
        is_private: isPrivate,
      });

      if (result.ok && result.channel) {
        this.logger.log(`Slack channel created: ${name} (${result.channel.id})`);
        return result.channel.id;
      } else {
        throw new Error(`Slack channel creation error: ${result.error}`);
      }
    } catch (error) {
      this.logger.error(`Failed to create Slack channel:`, error);
      throw error;
    }
  }

  async inviteToChannel(channel: string, users: string[]): Promise<void> {
    if (!this.slackClient) {
      throw new Error('Slack client not initialized');
    }

    try {
      const result = await this.slackClient.conversations.invite({
        channel,
        users: users.join(','),
      });

      if (result.ok) {
        this.logger.log(`Users invited to Slack channel: ${users.join(', ')}`);
      } else {
        throw new Error(`Slack invite error: ${result.error}`);
      }
    } catch (error) {
      this.logger.error(`Failed to invite users to Slack channel:`, error);
      throw error;
    }
  }

  // Template management
  async addTemplate(name: string, template: any): Promise<void> {
    this.templates.set(name, template);
    this.logger.log(`Added Slack template: ${name}`);
  }

  async getTemplate(name: string): Promise<any> {
    return this.templates.get(name);
  }

  async getAllTemplates(): Promise<string[]> {
    return Array.from(this.templates.keys());
  }

  // Slack workspace info
  async getWorkspaceInfo(): Promise<any> {
    if (!this.slackClient) {
      throw new Error('Slack client not initialized');
    }

    try {
      const result = await this.slackClient.team.info();
      
      if (result.ok) {
        return result.team;
      } else {
        throw new Error(`Slack API error: ${result.error}`);
      }
    } catch (error) {
      this.logger.error(`Failed to get workspace info:`, error);
      throw error;
    }
  }

  // Channel management
  async getChannels(): Promise<any[]> {
    if (!this.slackClient) {
      throw new Error('Slack client not initialized');
    }

    try {
      const result = await this.slackClient.conversations.list({
        types: 'public_channel,private_channel',
      });
      
      if (result.ok && result.channels) {
        return result.channels;
      } else {
        throw new Error(`Slack API error: ${result.error}`);
      }
    } catch (error) {
      this.logger.error(`Failed to get channels:`, error);
      throw error;
    }
  }

  // User management
  async getUsers(): Promise<any[]> {
    if (!this.slackClient) {
      throw new Error('Slack client not initialized');
    }

    try {
      const result = await this.slackClient.users.list();
      
      if (result.ok && result.members) {
        return result.members;
      } else {
        throw new Error(`Slack API error: ${result.error}`);
      }
    } catch (error) {
      this.logger.error(`Failed to get users:`, error);
      throw error;
    }
  }
}
