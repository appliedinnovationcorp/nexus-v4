import { Processor, Process } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import * as nodemailer from 'nodemailer';
import * as handlebars from 'handlebars';

export interface EmailJob {
  id: string;
  userId: string;
  template: string;
  data: Record<string, any>;
  to: string;
  subject: string;
  priority: string;
  channel: string;
  timestamp: Date;
}

@Processor('email-notifications')
export class EmailProcessor {
  private readonly logger = new Logger(EmailProcessor.name);
  private transporter: nodemailer.Transporter;
  private templates = new Map<string, { subject: string; html: string; text: string }>();

  constructor() {
    this.initializeTransporter();
    this.loadEmailTemplates();
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
      pool: true,
      maxConnections: 5,
      maxMessages: 100,
    });

    // Verify connection
    this.transporter.verify((error) => {
      if (error) {
        this.logger.error('SMTP connection failed:', error);
      } else {
        this.logger.log('SMTP server connection established');
      }
    });
  }

  private loadEmailTemplates(): void {
    // Welcome email template
    this.templates.set('welcome', {
      subject: 'Welcome to {{companyName}}!',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Welcome to {{companyName}}</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #007bff; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; background: #f9f9f9; }
            .button { display: inline-block; padding: 12px 24px; background: #007bff; color: white; text-decoration: none; border-radius: 4px; }
            .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Welcome to {{companyName}}!</h1>
            </div>
            <div class="content">
              <h2>Hello {{name}},</h2>
              <p>Thank you for joining {{companyName}}! We're excited to have you on board.</p>
              <p>Here's what you can do next:</p>
              <ul>
                <li>Complete your profile setup</li>
                <li>Explore our features</li>
                <li>Connect with other users</li>
              </ul>
              <p style="text-align: center;">
                <a href="{{dashboardUrl}}" class="button">Get Started</a>
              </p>
            </div>
            <div class="footer">
              <p>© {{year}} {{companyName}}. All rights reserved.</p>
              <p>If you have any questions, contact us at {{supportEmail}}</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
        Welcome to {{companyName}}!
        
        Hello {{name}},
        
        Thank you for joining {{companyName}}! We're excited to have you on board.
        
        Here's what you can do next:
        - Complete your profile setup
        - Explore our features
        - Connect with other users
        
        Get started: {{dashboardUrl}}
        
        © {{year}} {{companyName}}. All rights reserved.
        If you have any questions, contact us at {{supportEmail}}
      `,
    });

    // Password reset template
    this.templates.set('password-reset', {
      subject: 'Reset Your Password - {{companyName}}',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Reset Your Password</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #dc3545; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; background: #f9f9f9; }
            .button { display: inline-block; padding: 12px 24px; background: #dc3545; color: white; text-decoration: none; border-radius: 4px; }
            .warning { background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 4px; margin: 15px 0; }
            .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Password Reset Request</h1>
            </div>
            <div class="content">
              <h2>Hello {{name}},</h2>
              <p>We received a request to reset your password for your {{companyName}} account.</p>
              <div class="warning">
                <strong>Security Notice:</strong> If you didn't request this password reset, please ignore this email. Your password will remain unchanged.
              </div>
              <p>To reset your password, click the button below:</p>
              <p style="text-align: center;">
                <a href="{{resetUrl}}" class="button">Reset Password</a>
              </p>
              <p><strong>This link will expire in 24 hours.</strong></p>
              <p>If the button doesn't work, copy and paste this link into your browser:</p>
              <p style="word-break: break-all;">{{resetUrl}}</p>
            </div>
            <div class="footer">
              <p>© {{year}} {{companyName}}. All rights reserved.</p>
              <p>For security questions, contact us at {{supportEmail}}</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
        Password Reset Request - {{companyName}}
        
        Hello {{name}},
        
        We received a request to reset your password for your {{companyName}} account.
        
        SECURITY NOTICE: If you didn't request this password reset, please ignore this email. Your password will remain unchanged.
        
        To reset your password, visit this link:
        {{resetUrl}}
        
        This link will expire in 24 hours.
        
        © {{year}} {{companyName}}. All rights reserved.
        For security questions, contact us at {{supportEmail}}
      `,
    });

    // Notification template
    this.templates.set('notification', {
      subject: '{{subject}} - {{companyName}}',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>{{subject}}</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #28a745; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; background: #f9f9f9; }
            .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>{{subject}}</h1>
            </div>
            <div class="content">
              <h2>Hello {{name}},</h2>
              <p>{{message}}</p>
              {{#if actionUrl}}
              <p style="text-align: center;">
                <a href="{{actionUrl}}" style="display: inline-block; padding: 12px 24px; background: #28a745; color: white; text-decoration: none; border-radius: 4px;">{{actionText}}</a>
              </p>
              {{/if}}
            </div>
            <div class="footer">
              <p>© {{year}} {{companyName}}. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
        {{subject}} - {{companyName}}
        
        Hello {{name}},
        
        {{message}}
        
        {{#if actionUrl}}
        {{actionText}}: {{actionUrl}}
        {{/if}}
        
        © {{year}} {{companyName}}. All rights reserved.
      `,
    });

    this.logger.log(`Loaded ${this.templates.size} email templates`);
  }

  @Process('send-email')
  async handleSendEmail(job: Job<EmailJob>): Promise<void> {
    const { id, userId, template, data, to, subject, priority } = job.data;
    
    this.logger.debug(`Processing email job ${id} for user ${userId}`);

    try {
      // Get template
      const emailTemplate = this.templates.get(template);
      if (!emailTemplate) {
        throw new Error(`Email template '${template}' not found`);
      }

      // Prepare template data with defaults
      const templateData = {
        ...data,
        companyName: data.companyName || 'Nexus Platform',
        year: new Date().getFullYear(),
        supportEmail: data.supportEmail || 'support@nexus.dev',
        dashboardUrl: data.dashboardUrl || process.env.FRONTEND_URL || 'http://localhost:3000',
      };

      // Compile templates
      const subjectTemplate = handlebars.compile(emailTemplate.subject);
      const htmlTemplate = handlebars.compile(emailTemplate.html);
      const textTemplate = handlebars.compile(emailTemplate.text);

      // Render email content
      const renderedSubject = subjectTemplate(templateData);
      const renderedHtml = htmlTemplate(templateData);
      const renderedText = textTemplate(templateData);

      // Send email
      const mailOptions = {
        from: process.env.SMTP_FROM || 'noreply@nexus.dev',
        to: to || data.email,
        subject: subject || renderedSubject,
        html: renderedHtml,
        text: renderedText,
        priority: this.mapPriority(priority),
        headers: {
          'X-Notification-ID': id,
          'X-User-ID': userId,
          'X-Template': template,
        },
      };

      const result = await this.transporter.sendMail(mailOptions);
      
      this.logger.log(`Email sent successfully: ${id} (MessageID: ${result.messageId})`);
      
      // Update job with success info
      job.progress(100);
      
    } catch (error) {
      this.logger.error(`Failed to send email ${id}:`, error);
      throw error; // This will mark the job as failed and trigger retry
    }
  }

  @Process('send-bulk-email')
  async handleBulkEmail(job: Job<{ emails: EmailJob[] }>): Promise<void> {
    const { emails } = job.data;
    
    this.logger.debug(`Processing bulk email job with ${emails.length} emails`);

    let successCount = 0;
    let failureCount = 0;

    for (let i = 0; i < emails.length; i++) {
      try {
        await this.handleSendEmail({ data: emails[i] } as Job<EmailJob>);
        successCount++;
      } catch (error) {
        failureCount++;
        this.logger.error(`Failed to send bulk email ${i}:`, error);
      }

      // Update progress
      job.progress(Math.round(((i + 1) / emails.length) * 100));
    }

    this.logger.log(`Bulk email completed: ${successCount} sent, ${failureCount} failed`);
  }

  private mapPriority(priority: string): 'high' | 'normal' | 'low' {
    switch (priority?.toLowerCase()) {
      case 'urgent':
      case 'high':
        return 'high';
      case 'low':
        return 'low';
      default:
        return 'normal';
    }
  }

  // Template management
  async addTemplate(name: string, template: { subject: string; html: string; text: string }): Promise<void> {
    this.templates.set(name, template);
    this.logger.log(`Added email template: ${name}`);
  }

  async getTemplate(name: string): Promise<{ subject: string; html: string; text: string } | undefined> {
    return this.templates.get(name);
  }

  async getAllTemplates(): Promise<string[]> {
    return Array.from(this.templates.keys());
  }

  // Email validation
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  // Bounce handling (would integrate with webhook endpoints)
  async handleBounce(messageId: string, bounceType: 'hard' | 'soft', reason: string): Promise<void> {
    this.logger.warn(`Email bounce detected: ${messageId} (${bounceType}): ${reason}`);
    
    // In a real implementation, you would:
    // 1. Update user's email status
    // 2. Add to suppression list if hard bounce
    // 3. Retry if soft bounce
    // 4. Send notification to admin if needed
  }

  // Complaint handling
  async handleComplaint(messageId: string, complaintType: string): Promise<void> {
    this.logger.warn(`Email complaint received: ${messageId} (${complaintType})`);
    
    // In a real implementation, you would:
    // 1. Add email to suppression list
    // 2. Update user preferences
    // 3. Send notification to admin
  }

  // Delivery tracking
  async handleDelivery(messageId: string, timestamp: Date): Promise<void> {
    this.logger.debug(`Email delivered: ${messageId} at ${timestamp}`);
    
    // In a real implementation, you would:
    // 1. Update delivery status in database
    // 2. Track delivery metrics
    // 3. Update user engagement data
  }

  // Open tracking
  async handleOpen(messageId: string, userAgent: string, ipAddress: string): Promise<void> {
    this.logger.debug(`Email opened: ${messageId} from ${ipAddress}`);
    
    // In a real implementation, you would:
    // 1. Update open status in database
    // 2. Track engagement metrics
    // 3. Update user activity
  }

  // Click tracking
  async handleClick(messageId: string, url: string, userAgent: string): Promise<void> {
    this.logger.debug(`Email link clicked: ${messageId} -> ${url}`);
    
    // In a real implementation, you would:
    // 1. Update click status in database
    // 2. Track link performance
    // 3. Update user engagement data
  }
}
