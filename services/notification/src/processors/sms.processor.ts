import { Processor, Process } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { Twilio } from 'twilio';

export interface SMSJob {
  id: string;
  userId: string;
  template: string;
  data: Record<string, any>;
  to: string;
  message: string;
  priority: string;
  channel: string;
  timestamp: Date;
}

@Processor('sms-notifications')
export class SMSProcessor {
  private readonly logger = new Logger(SMSProcessor.name);
  private twilioClient: Twilio;
  private templates = new Map<string, string>();
  private readonly fromNumber: string;

  constructor() {
    this.initializeTwilio();
    this.loadSMSTemplates();
  }

  private initializeTwilio(): void {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    this.fromNumber = process.env.TWILIO_FROM_NUMBER || '+1234567890';

    if (!accountSid || !authToken) {
      this.logger.warn('Twilio credentials not configured. SMS functionality will be limited.');
      return;
    }

    try {
      this.twilioClient = new Twilio(accountSid, authToken);
      this.logger.log('Twilio client initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize Twilio client:', error);
    }
  }

  private loadSMSTemplates(): void {
    // Welcome SMS template
    this.templates.set('welcome', 
      'Welcome to {{companyName}}, {{name}}! Your account is now active. Get started: {{dashboardUrl}}'
    );

    // Password reset SMS template
    this.templates.set('password-reset', 
      'Password reset for {{companyName}}: {{resetUrl}} (expires in 24h). If you didn\'t request this, ignore this message.'
    );

    // Verification code template
    this.templates.set('verification-code', 
      'Your {{companyName}} verification code is: {{code}}. This code expires in {{expiryMinutes}} minutes.'
    );

    // Alert template
    this.templates.set('alert', 
      'ALERT: {{alertType}} - {{message}}. Time: {{timestamp}}. Check your dashboard for details.'
    );

    // Notification template
    this.templates.set('notification', 
      '{{companyName}}: {{message}}{{#if actionUrl}} - {{actionUrl}}{{/if}}'
    );

    // Order confirmation template
    this.templates.set('order-confirmation', 
      'Order confirmed! Order #{{orderNumber}} for ${{amount}}. Estimated delivery: {{deliveryDate}}. Track: {{trackingUrl}}'
    );

    // Appointment reminder template
    this.templates.set('appointment-reminder', 
      'Reminder: You have an appointment with {{providerName}} on {{date}} at {{time}}. Location: {{location}}'
    );

    // Payment reminder template
    this.templates.set('payment-reminder', 
      'Payment reminder: Your {{serviceName}} payment of ${{amount}} is due on {{dueDate}}. Pay now: {{paymentUrl}}'
    );

    this.logger.log(`Loaded ${this.templates.size} SMS templates`);
  }

  @Process('send-sms')
  async handleSendSMS(job: Job<SMSJob>): Promise<void> {
    const { id, userId, template, data, to, message, priority } = job.data;
    
    this.logger.debug(`Processing SMS job ${id} for user ${userId}`);

    if (!this.twilioClient) {
      throw new Error('Twilio client not initialized. Check your configuration.');
    }

    try {
      // Get template and render message
      let finalMessage = message;
      
      if (template && this.templates.has(template)) {
        const templateContent = this.templates.get(template)!;
        finalMessage = this.renderTemplate(templateContent, {
          ...data,
          companyName: data.companyName || 'Nexus Platform',
        });
      }

      // Validate phone number
      const cleanPhoneNumber = this.cleanPhoneNumber(to);
      if (!this.isValidPhoneNumber(cleanPhoneNumber)) {
        throw new Error(`Invalid phone number: ${to}`);
      }

      // Truncate message if too long (SMS limit is 160 characters for single SMS)
      if (finalMessage.length > 160) {
        this.logger.warn(`SMS message truncated from ${finalMessage.length} to 160 characters`);
        finalMessage = finalMessage.substring(0, 157) + '...';
      }

      // Send SMS via Twilio
      const result = await this.twilioClient.messages.create({
        body: finalMessage,
        from: this.fromNumber,
        to: cleanPhoneNumber,
        statusCallback: `${process.env.API_BASE_URL}/webhooks/sms/status`,
      });

      this.logger.log(`SMS sent successfully: ${id} (SID: ${result.sid})`);
      
      // Update job progress
      job.progress(100);
      
    } catch (error) {
      this.logger.error(`Failed to send SMS ${id}:`, error);
      throw error;
    }
  }

  @Process('send-bulk-sms')
  async handleBulkSMS(job: Job<{ messages: SMSJob[] }>): Promise<void> {
    const { messages } = job.data;
    
    this.logger.debug(`Processing bulk SMS job with ${messages.length} messages`);

    let successCount = 0;
    let failureCount = 0;

    for (let i = 0; i < messages.length; i++) {
      try {
        await this.handleSendSMS({ data: messages[i] } as Job<SMSJob>);
        successCount++;
        
        // Rate limiting - Twilio has rate limits
        if (i < messages.length - 1) {
          await this.delay(100); // 100ms delay between messages
        }
      } catch (error) {
        failureCount++;
        this.logger.error(`Failed to send bulk SMS ${i}:`, error);
      }

      // Update progress
      job.progress(Math.round(((i + 1) / messages.length) * 100));
    }

    this.logger.log(`Bulk SMS completed: ${successCount} sent, ${failureCount} failed`);
  }

  @Process('send-verification-code')
  async handleVerificationCode(job: Job<{
    phoneNumber: string;
    code: string;
    expiryMinutes: number;
  }>): Promise<void> {
    const { phoneNumber, code, expiryMinutes } = job.data;
    
    const smsJob: SMSJob = {
      id: `verification_${Date.now()}`,
      userId: 'system',
      template: 'verification-code',
      data: {
        code,
        expiryMinutes,
        companyName: 'Nexus Platform',
      },
      to: phoneNumber,
      message: '',
      priority: 'high',
      channel: 'sms',
      timestamp: new Date(),
    };

    await this.handleSendSMS({ data: smsJob } as Job<SMSJob>);
  }

  private renderTemplate(template: string, data: Record<string, any>): string {
    let rendered = template;
    
    // Simple template rendering (replace {{variable}} with data values)
    Object.keys(data).forEach(key => {
      const regex = new RegExp(`{{${key}}}`, 'g');
      rendered = rendered.replace(regex, String(data[key] || ''));
    });

    // Handle conditional blocks {{#if variable}}...{{/if}}
    rendered = rendered.replace(/{{#if\s+(\w+)}}(.*?){{\/if}}/g, (match, variable, content) => {
      return data[variable] ? content : '';
    });

    return rendered;
  }

  private cleanPhoneNumber(phoneNumber: string): string {
    // Remove all non-digit characters except +
    let cleaned = phoneNumber.replace(/[^\d+]/g, '');
    
    // Add country code if missing (assuming US +1)
    if (!cleaned.startsWith('+')) {
      if (cleaned.length === 10) {
        cleaned = '+1' + cleaned;
      } else if (cleaned.length === 11 && cleaned.startsWith('1')) {
        cleaned = '+' + cleaned;
      }
    }
    
    return cleaned;
  }

  private isValidPhoneNumber(phoneNumber: string): boolean {
    // Basic phone number validation
    const phoneRegex = /^\+[1-9]\d{1,14}$/;
    return phoneRegex.test(phoneNumber);
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Webhook handlers for Twilio status callbacks
  async handleDeliveryStatus(messageSid: string, status: string, errorCode?: string): Promise<void> {
    this.logger.debug(`SMS status update: ${messageSid} -> ${status}`);
    
    switch (status) {
      case 'delivered':
        this.logger.log(`SMS delivered: ${messageSid}`);
        break;
      case 'failed':
        this.logger.error(`SMS failed: ${messageSid} (Error: ${errorCode})`);
        break;
      case 'undelivered':
        this.logger.warn(`SMS undelivered: ${messageSid} (Error: ${errorCode})`);
        break;
      default:
        this.logger.debug(`SMS status: ${messageSid} -> ${status}`);
    }

    // In a real implementation, you would:
    // 1. Update delivery status in database
    // 2. Track delivery metrics
    // 3. Handle failed deliveries (retry, alert, etc.)
  }

  // Template management
  async addTemplate(name: string, template: string): Promise<void> {
    this.templates.set(name, template);
    this.logger.log(`Added SMS template: ${name}`);
  }

  async getTemplate(name: string): Promise<string | undefined> {
    return this.templates.get(name);
  }

  async getAllTemplates(): Promise<string[]> {
    return Array.from(this.templates.keys());
  }

  // Phone number validation and formatting
  async validatePhoneNumber(phoneNumber: string): Promise<{
    isValid: boolean;
    formatted: string;
    country?: string;
    carrier?: string;
  }> {
    if (!this.twilioClient) {
      return {
        isValid: this.isValidPhoneNumber(this.cleanPhoneNumber(phoneNumber)),
        formatted: this.cleanPhoneNumber(phoneNumber),
      };
    }

    try {
      const lookup = await this.twilioClient.lookups.v1.phoneNumbers(phoneNumber).fetch({
        type: ['carrier'],
      });

      return {
        isValid: true,
        formatted: lookup.phoneNumber,
        country: lookup.countryCode,
        carrier: lookup.carrier?.name,
      };
    } catch (error) {
      this.logger.warn(`Phone number validation failed for ${phoneNumber}:`, error.message);
      return {
        isValid: false,
        formatted: phoneNumber,
      };
    }
  }

  // SMS analytics
  async getSMSMetrics(): Promise<{
    totalSent: number;
    totalDelivered: number;
    totalFailed: number;
    deliveryRate: number;
    avgCost: number;
  }> {
    // In a real implementation, this would query your database or Twilio's API
    // For now, return mock data
    return {
      totalSent: 1250,
      totalDelivered: 1198,
      totalFailed: 52,
      deliveryRate: 95.84,
      avgCost: 0.0075, // $0.0075 per SMS
    };
  }

  // Opt-out handling
  async handleOptOut(phoneNumber: string): Promise<void> {
    this.logger.log(`Processing opt-out request for ${phoneNumber}`);
    
    // In a real implementation, you would:
    // 1. Add phone number to opt-out list
    // 2. Update user preferences
    // 3. Send confirmation SMS
    // 4. Update database records
  }

  // Opt-in handling
  async handleOptIn(phoneNumber: string): Promise<void> {
    this.logger.log(`Processing opt-in request for ${phoneNumber}`);
    
    // In a real implementation, you would:
    // 1. Remove phone number from opt-out list
    // 2. Update user preferences
    // 3. Send welcome SMS
    // 4. Update database records
  }

  // Check if phone number is opted out
  async isOptedOut(phoneNumber: string): Promise<boolean> {
    // In a real implementation, check your opt-out database
    return false;
  }
}
