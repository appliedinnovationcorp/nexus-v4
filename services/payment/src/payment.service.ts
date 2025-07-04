import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { Cron, CronExpression } from '@nestjs/schedule';
import Stripe from 'stripe';
import { Decimal } from 'decimal.js';

export interface Payment {
  id: string;
  customerId: string;
  amount: number;
  currency: string;
  status: 'pending' | 'processing' | 'succeeded' | 'failed' | 'canceled' | 'refunded';
  paymentMethod: 'stripe' | 'paypal' | 'bank_transfer' | 'crypto';
  paymentIntentId?: string;
  description: string;
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
  failureReason?: string;
}

export interface Subscription {
  id: string;
  customerId: string;
  planId: string;
  status: 'active' | 'canceled' | 'past_due' | 'unpaid' | 'trialing';
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  trialEnd?: Date;
  cancelAtPeriodEnd: boolean;
  stripeSubscriptionId?: string;
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface Plan {
  id: string;
  name: string;
  description: string;
  amount: number;
  currency: string;
  interval: 'day' | 'week' | 'month' | 'year';
  intervalCount: number;
  trialPeriodDays?: number;
  features: string[];
  isActive: boolean;
  stripePriceId?: string;
  metadata: Record<string, any>;
  createdAt: Date;
}

export interface Invoice {
  id: string;
  customerId: string;
  subscriptionId?: string;
  amount: number;
  currency: string;
  status: 'draft' | 'open' | 'paid' | 'void' | 'uncollectible';
  dueDate: Date;
  paidAt?: Date;
  items: InvoiceItem[];
  taxAmount: number;
  discountAmount: number;
  totalAmount: number;
  stripeInvoiceId?: string;
  pdfUrl?: string;
  createdAt: Date;
}

export interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unitAmount: number;
  totalAmount: number;
  metadata: Record<string, any>;
}

export interface Customer {
  id: string;
  email: string;
  name: string;
  phone?: string;
  address?: {
    line1: string;
    line2?: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
  stripeCustomerId?: string;
  paypalCustomerId?: string;
  defaultPaymentMethod?: string;
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);
  private stripe: Stripe;
  
  // In-memory storage (replace with database in production)
  private payments = new Map<string, Payment>();
  private subscriptions = new Map<string, Subscription>();
  private plans = new Map<string, Plan>();
  private invoices = new Map<string, Invoice>();
  private customers = new Map<string, Customer>();

  constructor(
    @InjectQueue('payment-processing') private paymentQueue: Queue,
    @InjectQueue('invoice-generation') private invoiceQueue: Queue,
    @InjectQueue('subscription-management') private subscriptionQueue: Queue,
  ) {
    this.initializeStripe();
    this.initializeDefaultPlans();
  }

  private initializeStripe(): void {
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    
    if (!stripeSecretKey) {
      this.logger.warn('Stripe secret key not configured. Stripe functionality will be limited.');
      return;
    }

    this.stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2024-12-18.acacia',
    });

    this.logger.log('Stripe client initialized');
  }

  private initializeDefaultPlans(): void {
    const defaultPlans: Plan[] = [
      {
        id: 'basic',
        name: 'Basic Plan',
        description: 'Perfect for individuals and small teams',
        amount: 999, // $9.99
        currency: 'usd',
        interval: 'month',
        intervalCount: 1,
        trialPeriodDays: 14,
        features: [
          'Up to 5 users',
          '10GB storage',
          'Basic support',
          'Core features',
        ],
        isActive: true,
        metadata: {},
        createdAt: new Date(),
      },
      {
        id: 'pro',
        name: 'Pro Plan',
        description: 'For growing businesses and teams',
        amount: 2999, // $29.99
        currency: 'usd',
        interval: 'month',
        intervalCount: 1,
        trialPeriodDays: 14,
        features: [
          'Up to 25 users',
          '100GB storage',
          'Priority support',
          'Advanced features',
          'Analytics dashboard',
        ],
        isActive: true,
        metadata: {},
        createdAt: new Date(),
      },
      {
        id: 'enterprise',
        name: 'Enterprise Plan',
        description: 'For large organizations with advanced needs',
        amount: 9999, // $99.99
        currency: 'usd',
        interval: 'month',
        intervalCount: 1,
        features: [
          'Unlimited users',
          '1TB storage',
          '24/7 dedicated support',
          'All features',
          'Custom integrations',
          'SLA guarantee',
        ],
        isActive: true,
        metadata: {},
        createdAt: new Date(),
      },
    ];

    defaultPlans.forEach(plan => {
      this.plans.set(plan.id, plan);
    });

    this.logger.log(`Initialized ${defaultPlans.length} default plans`);
  }

  // Customer Management
  async createCustomer(customerData: {
    email: string;
    name: string;
    phone?: string;
    address?: Customer['address'];
    metadata?: Record<string, any>;
  }): Promise<Customer> {
    const customerId = this.generateId();

    let stripeCustomerId: string | undefined;
    
    if (this.stripe) {
      try {
        const stripeCustomer = await this.stripe.customers.create({
          email: customerData.email,
          name: customerData.name,
          phone: customerData.phone,
          address: customerData.address,
          metadata: customerData.metadata || {},
        });
        stripeCustomerId = stripeCustomer.id;
      } catch (error) {
        this.logger.error('Failed to create Stripe customer:', error);
      }
    }

    const customer: Customer = {
      id: customerId,
      email: customerData.email,
      name: customerData.name,
      phone: customerData.phone,
      address: customerData.address,
      stripeCustomerId,
      metadata: customerData.metadata || {},
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.customers.set(customerId, customer);
    this.logger.log(`Customer created: ${customerData.email} (${customerId})`);

    return customer;
  }

  // Payment Processing
  async createPayment(paymentData: {
    customerId: string;
    amount: number;
    currency: string;
    paymentMethod: 'stripe' | 'paypal';
    description: string;
    metadata?: Record<string, any>;
  }): Promise<Payment> {
    const customer = this.customers.get(paymentData.customerId);
    if (!customer) {
      throw new BadRequestException('Customer not found');
    }

    const paymentId = this.generateId();
    
    const payment: Payment = {
      id: paymentId,
      customerId: paymentData.customerId,
      amount: paymentData.amount,
      currency: paymentData.currency,
      status: 'pending',
      paymentMethod: paymentData.paymentMethod,
      description: paymentData.description,
      metadata: paymentData.metadata || {},
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.payments.set(paymentId, payment);

    // Queue for processing
    await this.paymentQueue.add('process-payment', {
      paymentId,
      customerId: paymentData.customerId,
      amount: paymentData.amount,
      currency: paymentData.currency,
      paymentMethod: paymentData.paymentMethod,
    });

    this.logger.log(`Payment created: ${paymentId} for ${paymentData.amount} ${paymentData.currency}`);
    return payment;
  }

  async processStripePayment(
    paymentId: string,
    customerId: string,
    amount: number,
    currency: string
  ): Promise<void> {
    if (!this.stripe) {
      throw new Error('Stripe not configured');
    }

    const payment = this.payments.get(paymentId);
    const customer = this.customers.get(customerId);

    if (!payment || !customer) {
      throw new Error('Payment or customer not found');
    }

    try {
      payment.status = 'processing';
      this.payments.set(paymentId, payment);

      // Create payment intent
      const paymentIntent = await this.stripe.paymentIntents.create({
        amount,
        currency,
        customer: customer.stripeCustomerId,
        description: payment.description,
        metadata: {
          paymentId,
          customerId,
        },
      });

      payment.paymentIntentId = paymentIntent.id;
      payment.status = paymentIntent.status === 'succeeded' ? 'succeeded' : 'processing';
      payment.updatedAt = new Date();
      
      this.payments.set(paymentId, payment);

      this.logger.log(`Stripe payment processed: ${paymentId} (${paymentIntent.id})`);

    } catch (error) {
      payment.status = 'failed';
      payment.failureReason = error.message;
      payment.updatedAt = new Date();
      this.payments.set(paymentId, payment);

      this.logger.error(`Stripe payment failed: ${paymentId}`, error);
      throw error;
    }
  }

  // Subscription Management
  async createSubscription(subscriptionData: {
    customerId: string;
    planId: string;
    trialEnd?: Date;
    metadata?: Record<string, any>;
  }): Promise<Subscription> {
    const customer = this.customers.get(subscriptionData.customerId);
    const plan = this.plans.get(subscriptionData.planId);

    if (!customer || !plan) {
      throw new BadRequestException('Customer or plan not found');
    }

    const subscriptionId = this.generateId();
    const now = new Date();
    const periodEnd = new Date(now);
    
    // Calculate period end based on plan interval
    switch (plan.interval) {
      case 'day':
        periodEnd.setDate(periodEnd.getDate() + plan.intervalCount);
        break;
      case 'week':
        periodEnd.setDate(periodEnd.getDate() + (plan.intervalCount * 7));
        break;
      case 'month':
        periodEnd.setMonth(periodEnd.getMonth() + plan.intervalCount);
        break;
      case 'year':
        periodEnd.setFullYear(periodEnd.getFullYear() + plan.intervalCount);
        break;
    }

    let stripeSubscriptionId: string | undefined;

    if (this.stripe && customer.stripeCustomerId && plan.stripePriceId) {
      try {
        const stripeSubscription = await this.stripe.subscriptions.create({
          customer: customer.stripeCustomerId,
          items: [{ price: plan.stripePriceId }],
          trial_end: subscriptionData.trialEnd ? Math.floor(subscriptionData.trialEnd.getTime() / 1000) : undefined,
          metadata: subscriptionData.metadata || {},
        });
        stripeSubscriptionId = stripeSubscription.id;
      } catch (error) {
        this.logger.error('Failed to create Stripe subscription:', error);
      }
    }

    const subscription: Subscription = {
      id: subscriptionId,
      customerId: subscriptionData.customerId,
      planId: subscriptionData.planId,
      status: subscriptionData.trialEnd ? 'trialing' : 'active',
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
      trialEnd: subscriptionData.trialEnd,
      cancelAtPeriodEnd: false,
      stripeSubscriptionId,
      metadata: subscriptionData.metadata || {},
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.subscriptions.set(subscriptionId, subscription);
    this.logger.log(`Subscription created: ${subscriptionId} for plan ${subscriptionData.planId}`);

    return subscription;
  }

  async cancelSubscription(subscriptionId: string, cancelAtPeriodEnd: boolean = true): Promise<Subscription> {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) {
      throw new BadRequestException('Subscription not found');
    }

    if (cancelAtPeriodEnd) {
      subscription.cancelAtPeriodEnd = true;
      subscription.status = 'active'; // Keep active until period end
    } else {
      subscription.status = 'canceled';
    }

    subscription.updatedAt = new Date();
    this.subscriptions.set(subscriptionId, subscription);

    // Cancel in Stripe if applicable
    if (this.stripe && subscription.stripeSubscriptionId) {
      try {
        await this.stripe.subscriptions.update(subscription.stripeSubscriptionId, {
          cancel_at_period_end: cancelAtPeriodEnd,
        });
      } catch (error) {
        this.logger.error('Failed to cancel Stripe subscription:', error);
      }
    }

    this.logger.log(`Subscription ${cancelAtPeriodEnd ? 'scheduled for cancellation' : 'canceled'}: ${subscriptionId}`);
    return subscription;
  }

  // Invoice Management
  async generateInvoice(invoiceData: {
    customerId: string;
    subscriptionId?: string;
    items: Omit<InvoiceItem, 'id' | 'totalAmount'>[];
    dueDate: Date;
    taxRate?: number;
    discountAmount?: number;
  }): Promise<Invoice> {
    const customer = this.customers.get(invoiceData.customerId);
    if (!customer) {
      throw new BadRequestException('Customer not found');
    }

    const invoiceId = this.generateId();
    
    // Calculate amounts
    const items: InvoiceItem[] = invoiceData.items.map(item => ({
      ...item,
      id: this.generateId(),
      totalAmount: new Decimal(item.quantity).mul(item.unitAmount).toNumber(),
    }));

    const subtotal = items.reduce((sum, item) => sum + item.totalAmount, 0);
    const taxAmount = new Decimal(subtotal).mul(invoiceData.taxRate || 0).toNumber();
    const discountAmount = invoiceData.discountAmount || 0;
    const totalAmount = subtotal + taxAmount - discountAmount;

    const invoice: Invoice = {
      id: invoiceId,
      customerId: invoiceData.customerId,
      subscriptionId: invoiceData.subscriptionId,
      amount: subtotal,
      currency: 'usd', // Default currency
      status: 'draft',
      dueDate: invoiceData.dueDate,
      items,
      taxAmount,
      discountAmount,
      totalAmount,
      createdAt: new Date(),
    };

    this.invoices.set(invoiceId, invoice);

    // Queue for PDF generation
    await this.invoiceQueue.add('generate-invoice-pdf', {
      invoiceId,
      customerId: invoiceData.customerId,
    });

    this.logger.log(`Invoice generated: ${invoiceId} for customer ${invoiceData.customerId}`);
    return invoice;
  }

  // Scheduled Tasks
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async processSubscriptionRenewals(): Promise<void> {
    this.logger.debug('Processing subscription renewals');

    const now = new Date();
    const subscriptionsToRenew = Array.from(this.subscriptions.values())
      .filter(sub => 
        sub.status === 'active' && 
        sub.currentPeriodEnd <= now &&
        !sub.cancelAtPeriodEnd
      );

    for (const subscription of subscriptionsToRenew) {
      await this.subscriptionQueue.add('renew-subscription', {
        subscriptionId: subscription.id,
      });
    }

    this.logger.log(`Queued ${subscriptionsToRenew.length} subscriptions for renewal`);
  }

  @Cron(CronExpression.EVERY_DAY_AT_1AM)
  async processOverdueInvoices(): Promise<void> {
    this.logger.debug('Processing overdue invoices');

    const now = new Date();
    const overdueInvoices = Array.from(this.invoices.values())
      .filter(invoice => 
        invoice.status === 'open' && 
        invoice.dueDate < now
      );

    for (const invoice of overdueInvoices) {
      // Send overdue notice
      this.logger.warn(`Invoice overdue: ${invoice.id}`);
      
      // In a real implementation, you would:
      // 1. Send overdue notification
      // 2. Apply late fees
      // 3. Suspend services if needed
      // 4. Start collection process
    }
  }

  // Analytics and Reporting
  async getPaymentAnalytics(period: 'day' | 'week' | 'month' | 'year' = 'month'): Promise<{
    totalRevenue: number;
    totalTransactions: number;
    averageTransactionValue: number;
    successRate: number;
    topPaymentMethods: Array<{ method: string; count: number; revenue: number }>;
    revenueByDay: Array<{ date: string; revenue: number }>;
  }> {
    const payments = Array.from(this.payments.values());
    const successfulPayments = payments.filter(p => p.status === 'succeeded');
    
    const totalRevenue = successfulPayments.reduce((sum, p) => sum + p.amount, 0);
    const totalTransactions = payments.length;
    const averageTransactionValue = totalRevenue / (successfulPayments.length || 1);
    const successRate = (successfulPayments.length / (totalTransactions || 1)) * 100;

    // Group by payment method
    const methodStats = new Map<string, { count: number; revenue: number }>();
    successfulPayments.forEach(payment => {
      const existing = methodStats.get(payment.paymentMethod) || { count: 0, revenue: 0 };
      existing.count++;
      existing.revenue += payment.amount;
      methodStats.set(payment.paymentMethod, existing);
    });

    const topPaymentMethods = Array.from(methodStats.entries())
      .map(([method, stats]) => ({ method, ...stats }))
      .sort((a, b) => b.revenue - a.revenue);

    // Revenue by day (mock data for now)
    const revenueByDay = this.generateRevenueByDay(period);

    return {
      totalRevenue,
      totalTransactions,
      averageTransactionValue,
      successRate,
      topPaymentMethods,
      revenueByDay,
    };
  }

  private generateRevenueByDay(period: string): Array<{ date: string; revenue: number }> {
    const days = period === 'week' ? 7 : period === 'month' ? 30 : 365;
    const data = [];
    
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      
      data.push({
        date: date.toISOString().split('T')[0],
        revenue: Math.floor(Math.random() * 10000) + 1000,
      });
    }
    
    return data;
  }

  // Helper methods
  private generateId(): string {
    return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Public API methods
  async getPayment(paymentId: string): Promise<Payment | undefined> {
    return this.payments.get(paymentId);
  }

  async getSubscription(subscriptionId: string): Promise<Subscription | undefined> {
    return this.subscriptions.get(subscriptionId);
  }

  async getCustomer(customerId: string): Promise<Customer | undefined> {
    return this.customers.get(customerId);
  }

  async getInvoice(invoiceId: string): Promise<Invoice | undefined> {
    return this.invoices.get(invoiceId);
  }

  async getAllPlans(): Promise<Plan[]> {
    return Array.from(this.plans.values()).filter(plan => plan.isActive);
  }

  async getCustomerPayments(customerId: string): Promise<Payment[]> {
    return Array.from(this.payments.values())
      .filter(payment => payment.customerId === customerId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async getCustomerSubscriptions(customerId: string): Promise<Subscription[]> {
    return Array.from(this.subscriptions.values())
      .filter(subscription => subscription.customerId === customerId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async getCustomerInvoices(customerId: string): Promise<Invoice[]> {
    return Array.from(this.invoices.values())
      .filter(invoice => invoice.customerId === customerId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }
}
