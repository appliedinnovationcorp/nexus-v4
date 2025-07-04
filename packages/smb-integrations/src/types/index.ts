import { z } from 'zod';

/**
 * SMB Integration Types
 * Common types for popular SMB business tool integrations
 */

// Base integration configuration
export const IntegrationSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(['accounting', 'crm', 'email', 'ecommerce', 'social', 'storage', 'communication']),
  provider: z.string(), // 'quickbooks', 'shopify', 'gmail', etc.
  status: z.enum(['connected', 'disconnected', 'error', 'pending']),
  credentials: z.record(z.string()).optional(),
  lastSync: z.date().optional(),
  syncFrequency: z.enum(['realtime', 'hourly', 'daily', 'weekly']),
  dataTypes: z.array(z.string()), // ['customers', 'invoices', 'products', etc.]
  config: z.record(z.any()).optional(),
});

export type Integration = z.infer<typeof IntegrationSchema>;

// Common data types across integrations
export interface Customer {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    zip?: string;
    country?: string;
  };
  createdAt: Date;
  updatedAt: Date;
  metadata?: Record<string, any>;
}

export interface Invoice {
  id: string;
  customerId: string;
  number: string;
  amount: number;
  balance: number;
  dueDate: Date;
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';
  items: InvoiceItem[];
  createdAt: Date;
  updatedAt: Date;
}

export interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  rate: number;
  amount: number;
}

export interface Product {
  id: string;
  name: string;
  description?: string;
  price: number;
  sku?: string;
  category?: string;
  inventory?: number;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Order {
  id: string;
  customerId: string;
  status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  total: number;
  items: OrderItem[];
  shippingAddress?: Address;
  billingAddress?: Address;
  createdAt: Date;
  updatedAt: Date;
}

export interface OrderItem {
  id: string;
  productId: string;
  quantity: number;
  price: number;
  total: number;
}

export interface Address {
  street: string;
  city: string;
  state: string;
  zip: string;
  country: string;
}

// Integration-specific types
export interface QuickBooksConfig {
  consumerKey: string;
  consumerSecret: string;
  accessToken: string;
  refreshToken: string;
  companyId: string;
  sandbox: boolean;
}

export interface ShopifyConfig {
  shopName: string;
  accessToken: string;
  apiVersion: string;
}

export interface GmailConfig {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  accessToken: string;
}

export interface SlackConfig {
  botToken: string;
  appToken: string;
  signingSecret: string;
}

// Sync result types
export interface SyncResult {
  integration: string;
  success: boolean;
  recordsProcessed: number;
  recordsCreated: number;
  recordsUpdated: number;
  recordsSkipped: number;
  errors: string[];
  startTime: Date;
  endTime: Date;
  duration: number; // milliseconds
}

// Webhook types
export interface WebhookEvent {
  id: string;
  integration: string;
  event: string;
  data: any;
  timestamp: Date;
  processed: boolean;
}

// Error types
export class IntegrationError extends Error {
  constructor(
    message: string,
    public integration: string,
    public code: string,
    public details?: any
  ) {
    super(message);
    this.name = 'IntegrationError';
  }
}

// Common integration interface
export interface BaseIntegration {
  connect(config: any): Promise<void>;
  disconnect(): Promise<void>;
  testConnection(): Promise<boolean>;
  sync(): Promise<SyncResult>;
  getStatus(): { connected: boolean; lastSync?: Date };
}

// Popular SMB integrations list
export const POPULAR_INTEGRATIONS = [
  {
    id: 'quickbooks',
    name: 'QuickBooks',
    type: 'accounting',
    description: 'Accounting and financial management',
    category: 'Finance',
    popularity: 95,
    setupDifficulty: 'medium',
    features: ['invoicing', 'expenses', 'reporting', 'payments']
  },
  {
    id: 'shopify',
    name: 'Shopify',
    type: 'ecommerce',
    description: 'E-commerce platform',
    category: 'Sales',
    popularity: 90,
    setupDifficulty: 'easy',
    features: ['products', 'orders', 'customers', 'inventory']
  },
  {
    id: 'gmail',
    name: 'Gmail',
    type: 'email',
    description: 'Email communication',
    category: 'Communication',
    popularity: 85,
    setupDifficulty: 'easy',
    features: ['email', 'contacts', 'calendar', 'automation']
  },
  {
    id: 'slack',
    name: 'Slack',
    type: 'communication',
    description: 'Team communication',
    category: 'Communication',
    popularity: 80,
    setupDifficulty: 'easy',
    features: ['messaging', 'notifications', 'workflows', 'bots']
  },
  {
    id: 'stripe',
    name: 'Stripe',
    type: 'payment',
    description: 'Payment processing',
    category: 'Finance',
    popularity: 75,
    setupDifficulty: 'medium',
    features: ['payments', 'subscriptions', 'invoicing', 'analytics']
  },
  {
    id: 'mailchimp',
    name: 'Mailchimp',
    type: 'marketing',
    description: 'Email marketing',
    category: 'Marketing',
    popularity: 70,
    setupDifficulty: 'easy',
    features: ['email_campaigns', 'automation', 'analytics', 'audiences']
  },
  {
    id: 'hubspot',
    name: 'HubSpot',
    type: 'crm',
    description: 'Customer relationship management',
    category: 'Sales',
    popularity: 65,
    setupDifficulty: 'medium',
    features: ['contacts', 'deals', 'tasks', 'automation']
  },
  {
    id: 'google-workspace',
    name: 'Google Workspace',
    type: 'productivity',
    description: 'Productivity suite',
    category: 'Productivity',
    popularity: 85,
    setupDifficulty: 'easy',
    features: ['docs', 'sheets', 'drive', 'calendar']
  }
] as const;
