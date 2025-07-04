import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import * as handlebars from 'handlebars';

export interface EmailCampaign {
  id: string;
  name: string;
  subject: string;
  template: string;
  recipients: string[];
  status: 'draft' | 'scheduled' | 'sending' | 'sent' | 'paused';
  scheduledAt?: Date;
  sentAt?: Date;
  stats: {
    sent: number;
    delivered: number;
    opened: number;
    clicked: number;
    bounced: number;
    unsubscribed: number;
  };
  createdAt: Date;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter;
  private campaigns = new Map<string, EmailCampaign>();

  constructor() {
    this.initializeTransporter();
  }

  private initializeTransporter(): void {
    this.transporter = nodemailer.createTransporter({
      host: process.env.SMTP_HOST || 'localhost',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  async createCampaign(campaignData: {
    name: string;
    subject: string;
    template: string;
    recipients: string[];
    scheduledAt?: Date;
  }): Promise<EmailCampaign> {
    const campaignId = this.generateId();
    
    const campaign: EmailCampaign = {
      id: campaignId,
      name: campaignData.name,
      subject: campaignData.subject,
      template: campaignData.template,
      recipients: campaignData.recipients,
      status: campaignData.scheduledAt ? 'scheduled' : 'draft',
      scheduledAt: campaignData.scheduledAt,
      stats: {
        sent: 0,
        delivered: 0,
        opened: 0,
        clicked: 0,
        bounced: 0,
        unsubscribed: 0,
      },
      createdAt: new Date(),
    };

    this.campaigns.set(campaignId, campaign);
    this.logger.log(`Email campaign created: ${campaignData.name} (${campaignId})`);

    return campaign;
  }

  async sendCampaign(campaignId: string): Promise<void> {
    const campaign = this.campaigns.get(campaignId);
    if (!campaign) {
      throw new Error(`Campaign ${campaignId} not found`);
    }

    campaign.status = 'sending';
    this.campaigns.set(campaignId, campaign);

    try {
      for (const recipient of campaign.recipients) {
        await this.sendEmail({
          to: recipient,
          subject: campaign.subject,
          template: campaign.template,
          data: { recipient },
        });
        
        campaign.stats.sent++;
      }

      campaign.status = 'sent';
      campaign.sentAt = new Date();
      this.campaigns.set(campaignId, campaign);

      this.logger.log(`Campaign sent: ${campaignId} to ${campaign.recipients.length} recipients`);
    } catch (error) {
      campaign.status = 'draft';
      this.campaigns.set(campaignId, campaign);
      this.logger.error(`Campaign failed: ${campaignId}`, error);
      throw error;
    }
  }

  private async sendEmail(emailData: {
    to: string;
    subject: string;
    template: string;
    data: Record<string, any>;
  }): Promise<void> {
    const compiledTemplate = handlebars.compile(emailData.template);
    const html = compiledTemplate(emailData.data);

    await this.transporter.sendMail({
      from: process.env.SMTP_FROM || 'noreply@nexus.dev',
      to: emailData.to,
      subject: emailData.subject,
      html,
    });
  }

  private generateId(): string {
    return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  async getCampaign(campaignId: string): Promise<EmailCampaign | undefined> {
    return this.campaigns.get(campaignId);
  }

  async getAllCampaigns(): Promise<EmailCampaign[]> {
    return Array.from(this.campaigns.values());
  }
}
