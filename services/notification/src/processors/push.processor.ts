import { Processor, Process } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import * as admin from 'firebase-admin';

export interface PushJob {
  id: string;
  userId: string;
  template: string;
  data: Record<string, any>;
  tokens: string[];
  title: string;
  body: string;
  priority: string;
  channel: string;
  timestamp: Date;
}

@Processor('push-notifications')
export class PushProcessor {
  private readonly logger = new Logger(PushProcessor.name);
  private firebaseApp: admin.app.App;
  private templates = new Map<string, { title: string; body: string; data?: Record<string, any> }>();

  constructor() {
    this.initializeFirebase();
    this.loadPushTemplates();
  }

  private initializeFirebase(): void {
    try {
      const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
      const projectId = process.env.FIREBASE_PROJECT_ID;

      if (!serviceAccount || !projectId) {
        this.logger.warn('Firebase credentials not configured. Push notification functionality will be limited.');
        return;
      }

      const credential = admin.credential.cert(JSON.parse(serviceAccount));
      
      this.firebaseApp = admin.initializeApp({
        credential,
        projectId,
      });

      this.logger.log('Firebase Admin SDK initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize Firebase Admin SDK:', error);
    }
  }

  private loadPushTemplates(): void {
    // Welcome push notification
    this.templates.set('welcome', {
      title: 'Welcome to {{companyName}}!',
      body: 'Hi {{name}}, thanks for joining us. Tap to get started!',
      data: {
        type: 'welcome',
        action: 'open_dashboard',
      },
    });

    // New message notification
    this.templates.set('new-message', {
      title: 'New Message',
      body: '{{senderName}}: {{messagePreview}}',
      data: {
        type: 'message',
        action: 'open_chat',
        chatId: '{{chatId}}',
      },
    });

    // System alert notification
    this.templates.set('system-alert', {
      title: '{{alertType}} Alert',
      body: '{{message}}',
      data: {
        type: 'alert',
        severity: '{{severity}}',
        action: 'open_alerts',
      },
    });

    // Order update notification
    this.templates.set('order-update', {
      title: 'Order Update',
      body: 'Your order #{{orderNumber}} is {{status}}',
      data: {
        type: 'order',
        orderId: '{{orderId}}',
        action: 'open_order',
      },
    });

    // Reminder notification
    this.templates.set('reminder', {
      title: 'Reminder',
      body: '{{reminderText}}',
      data: {
        type: 'reminder',
        reminderId: '{{reminderId}}',
        action: 'open_reminder',
      },
    });

    // Promotional notification
    this.templates.set('promotion', {
      title: '{{promoTitle}}',
      body: '{{promoDescription}} - {{discount}}% off!',
      data: {
        type: 'promotion',
        promoCode: '{{promoCode}}',
        action: 'open_promo',
      },
    });

    // Security alert notification
    this.templates.set('security-alert', {
      title: 'Security Alert',
      body: 'New login detected from {{location}} on {{device}}',
      data: {
        type: 'security',
        severity: 'high',
        action: 'open_security',
      },
    });

    // Achievement notification
    this.templates.set('achievement', {
      title: 'Achievement Unlocked!',
      body: 'Congratulations! You\'ve earned: {{achievementName}}',
      data: {
        type: 'achievement',
        achievementId: '{{achievementId}}',
        action: 'open_achievements',
      },
    });

    this.logger.log(`Loaded ${this.templates.size} push notification templates`);
  }

  @Process('send-push')
  async handleSendPush(job: Job<PushJob>): Promise<void> {
    const { id, userId, template, data, tokens, title, body, priority } = job.data;
    
    this.logger.debug(`Processing push notification job ${id} for user ${userId}`);

    if (!this.firebaseApp) {
      throw new Error('Firebase not initialized. Check your configuration.');
    }

    try {
      // Get template and render notification
      let finalTitle = title;
      let finalBody = body;
      let notificationData = data;

      if (template && this.templates.has(template)) {
        const templateContent = this.templates.get(template)!;
        const templateData = {
          ...data,
          companyName: data.companyName || 'Nexus Platform',
        };

        finalTitle = this.renderTemplate(templateContent.title, templateData);
        finalBody = this.renderTemplate(templateContent.body, templateData);
        
        if (templateContent.data) {
          notificationData = {
            ...notificationData,
            ...this.renderTemplateData(templateContent.data, templateData),
          };
        }
      }

      // Validate tokens
      const validTokens = tokens.filter(token => this.isValidFCMToken(token));
      if (validTokens.length === 0) {
        throw new Error('No valid FCM tokens provided');
      }

      // Prepare notification payload
      const message: admin.messaging.MulticastMessage = {
        notification: {
          title: finalTitle,
          body: finalBody,
        },
        data: this.stringifyData(notificationData),
        tokens: validTokens,
        android: {
          priority: this.mapAndroidPriority(priority),
          notification: {
            channelId: this.getNotificationChannel(template || 'default'),
            priority: this.mapAndroidNotificationPriority(priority),
            defaultSound: true,
            defaultVibrateTimings: true,
          },
        },
        apns: {
          payload: {
            aps: {
              alert: {
                title: finalTitle,
                body: finalBody,
              },
              sound: 'default',
              badge: 1,
            },
          },
          headers: {
            'apns-priority': this.mapAPNSPriority(priority),
          },
        },
        webpush: {
          notification: {
            title: finalTitle,
            body: finalBody,
            icon: data.icon || '/icon-192x192.png',
            badge: data.badge || '/badge-72x72.png',
            requireInteraction: priority === 'urgent',
          },
          fcmOptions: {
            link: data.clickAction || '/',
          },
        },
      };

      // Send notification
      const response = await admin.messaging().sendMulticast(message);
      
      this.logger.log(`Push notification sent: ${id} (Success: ${response.successCount}, Failed: ${response.failureCount})`);
      
      // Handle failed tokens
      if (response.failureCount > 0) {
        await this.handleFailedTokens(response.responses, validTokens);
      }

      // Update job progress
      job.progress(100);
      
    } catch (error) {
      this.logger.error(`Failed to send push notification ${id}:`, error);
      throw error;
    }
  }

  @Process('send-bulk-push')
  async handleBulkPush(job: Job<{ notifications: PushJob[] }>): Promise<void> {
    const { notifications } = job.data;
    
    this.logger.debug(`Processing bulk push notification job with ${notifications.length} notifications`);

    let successCount = 0;
    let failureCount = 0;

    for (let i = 0; i < notifications.length; i++) {
      try {
        await this.handleSendPush({ data: notifications[i] } as Job<PushJob>);
        successCount++;
      } catch (error) {
        failureCount++;
        this.logger.error(`Failed to send bulk push notification ${i}:`, error);
      }

      // Update progress
      job.progress(Math.round(((i + 1) / notifications.length) * 100));
    }

    this.logger.log(`Bulk push notifications completed: ${successCount} sent, ${failureCount} failed`);
  }

  @Process('send-topic-notification')
  async handleTopicNotification(job: Job<{
    topic: string;
    title: string;
    body: string;
    data?: Record<string, any>;
    condition?: string;
  }>): Promise<void> {
    const { topic, title, body, data, condition } = job.data;
    
    this.logger.debug(`Sending topic notification to: ${topic || condition}`);

    if (!this.firebaseApp) {
      throw new Error('Firebase not initialized. Check your configuration.');
    }

    try {
      const message: admin.messaging.Message = {
        notification: {
          title,
          body,
        },
        data: this.stringifyData(data || {}),
        ...(topic ? { topic } : { condition }),
      };

      const response = await admin.messaging().send(message);
      
      this.logger.log(`Topic notification sent successfully: ${response}`);
      
    } catch (error) {
      this.logger.error(`Failed to send topic notification:`, error);
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

  private renderTemplateData(templateData: Record<string, any>, data: Record<string, any>): Record<string, any> {
    const rendered: Record<string, any> = {};
    
    Object.keys(templateData).forEach(key => {
      const value = templateData[key];
      if (typeof value === 'string') {
        rendered[key] = this.renderTemplate(value, data);
      } else {
        rendered[key] = value;
      }
    });

    return rendered;
  }

  private stringifyData(data: Record<string, any>): Record<string, string> {
    const stringified: Record<string, string> = {};
    
    Object.keys(data).forEach(key => {
      stringified[key] = String(data[key]);
    });

    return stringified;
  }

  private isValidFCMToken(token: string): boolean {
    // Basic FCM token validation
    return token && token.length > 100 && /^[A-Za-z0-9_-]+$/.test(token);
  }

  private mapAndroidPriority(priority: string): 'normal' | 'high' {
    return ['urgent', 'high'].includes(priority?.toLowerCase()) ? 'high' : 'normal';
  }

  private mapAndroidNotificationPriority(priority: string): 'default' | 'min' | 'low' | 'high' | 'max' {
    switch (priority?.toLowerCase()) {
      case 'urgent':
        return 'max';
      case 'high':
        return 'high';
      case 'low':
        return 'low';
      default:
        return 'default';
    }
  }

  private mapAPNSPriority(priority: string): '5' | '10' {
    return ['urgent', 'high'].includes(priority?.toLowerCase()) ? '10' : '5';
  }

  private getNotificationChannel(template: string): string {
    const channelMap: Record<string, string> = {
      'welcome': 'general',
      'new-message': 'messages',
      'system-alert': 'alerts',
      'order-update': 'orders',
      'reminder': 'reminders',
      'promotion': 'promotions',
      'security-alert': 'security',
      'achievement': 'achievements',
      'default': 'general',
    };

    return channelMap[template] || 'general';
  }

  private async handleFailedTokens(responses: admin.messaging.SendResponse[], tokens: string[]): Promise<void> {
    const failedTokens: string[] = [];
    
    responses.forEach((response, index) => {
      if (!response.success) {
        const token = tokens[index];
        const error = response.error;
        
        this.logger.warn(`Failed to send to token ${token}: ${error?.message}`);
        
        // Handle specific error types
        if (error?.code === 'messaging/registration-token-not-registered' ||
            error?.code === 'messaging/invalid-registration-token') {
          failedTokens.push(token);
        }
      }
    });

    if (failedTokens.length > 0) {
      this.logger.log(`Marking ${failedTokens.length} tokens as invalid`);
      // In a real implementation, you would remove these tokens from your database
    }
  }

  // Token management
  async subscribeToTopic(tokens: string[], topic: string): Promise<void> {
    if (!this.firebaseApp) {
      throw new Error('Firebase not initialized');
    }

    try {
      const response = await admin.messaging().subscribeToTopic(tokens, topic);
      this.logger.log(`Subscribed ${response.successCount} tokens to topic: ${topic}`);
      
      if (response.failureCount > 0) {
        this.logger.warn(`Failed to subscribe ${response.failureCount} tokens to topic: ${topic}`);
      }
    } catch (error) {
      this.logger.error(`Failed to subscribe to topic ${topic}:`, error);
      throw error;
    }
  }

  async unsubscribeFromTopic(tokens: string[], topic: string): Promise<void> {
    if (!this.firebaseApp) {
      throw new Error('Firebase not initialized');
    }

    try {
      const response = await admin.messaging().unsubscribeFromTopic(tokens, topic);
      this.logger.log(`Unsubscribed ${response.successCount} tokens from topic: ${topic}`);
      
      if (response.failureCount > 0) {
        this.logger.warn(`Failed to unsubscribe ${response.failureCount} tokens from topic: ${topic}`);
      }
    } catch (error) {
      this.logger.error(`Failed to unsubscribe from topic ${topic}:`, error);
      throw error;
    }
  }

  // Template management
  async addTemplate(name: string, template: { title: string; body: string; data?: Record<string, any> }): Promise<void> {
    this.templates.set(name, template);
    this.logger.log(`Added push notification template: ${name}`);
  }

  async getTemplate(name: string): Promise<{ title: string; body: string; data?: Record<string, any> } | undefined> {
    return this.templates.get(name);
  }

  async getAllTemplates(): Promise<string[]> {
    return Array.from(this.templates.keys());
  }

  // Analytics
  async getPushMetrics(): Promise<{
    totalSent: number;
    totalDelivered: number;
    totalOpened: number;
    deliveryRate: number;
    openRate: number;
    topTopics: Array<{ topic: string; subscribers: number }>;
  }> {
    // In a real implementation, this would query your analytics database
    return {
      totalSent: 5420,
      totalDelivered: 5180,
      totalOpened: 1854,
      deliveryRate: 95.57,
      openRate: 35.79,
      topTopics: [
        { topic: 'general', subscribers: 12500 },
        { topic: 'promotions', subscribers: 8900 },
        { topic: 'alerts', subscribers: 6700 },
      ],
    };
  }

  // Device token validation
  async validateToken(token: string): Promise<boolean> {
    if (!this.firebaseApp || !this.isValidFCMToken(token)) {
      return false;
    }

    try {
      // Send a test message to validate token
      await admin.messaging().send({
        token,
        data: { test: 'true' },
      }, true); // dry run
      
      return true;
    } catch (error) {
      this.logger.debug(`Token validation failed: ${error.message}`);
      return false;
    }
  }
}
