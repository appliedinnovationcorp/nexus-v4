import { z } from 'zod';

/**
 * Core AI Business Copilot Types
 * SMB-focused business automation and productivity
 */

// Business automation request types
export const BusinessTaskSchema = z.object({
  id: z.string(),
  description: z.string(),
  category: z.enum(['automation', 'analysis', 'optimization', 'compliance', 'integration']),
  priority: z.enum(['low', 'medium', 'high', 'urgent']),
  estimatedTimeSaving: z.number().optional(), // hours per week
  complexity: z.enum(['simple', 'moderate', 'complex']),
  requiredIntegrations: z.array(z.string()).optional(),
  createdAt: z.date(),
  status: z.enum(['pending', 'in_progress', 'completed', 'failed']),
});

export type BusinessTask = z.infer<typeof BusinessTaskSchema>;

// AI Copilot conversation types
export const CopilotMessageSchema = z.object({
  id: z.string(),
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string(),
  timestamp: z.date(),
  taskId: z.string().optional(),
  metadata: z.record(z.any()).optional(),
});

export type CopilotMessage = z.infer<typeof CopilotMessageSchema>;

// Business automation workflow types
export const WorkflowStepSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  type: z.enum(['trigger', 'condition', 'action', 'delay']),
  config: z.record(z.any()),
  nextSteps: z.array(z.string()).optional(),
});

export const WorkflowSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  category: z.enum(['sales', 'marketing', 'operations', 'finance', 'hr', 'customer_service']),
  steps: z.array(WorkflowStepSchema),
  isActive: z.boolean(),
  createdBy: z.string(),
  createdAt: z.date(),
  lastRun: z.date().optional(),
  runCount: z.number().default(0),
  successRate: z.number().default(0),
  estimatedTimeSaving: z.number(), // hours per week
});

export type Workflow = z.infer<typeof WorkflowSchema>;
export type WorkflowStep = z.infer<typeof WorkflowStepSchema>;

// Business insights and recommendations
export const BusinessInsightSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  category: z.enum(['cost_saving', 'efficiency', 'growth', 'risk', 'compliance']),
  impact: z.enum(['low', 'medium', 'high']),
  effort: z.enum(['low', 'medium', 'high']),
  potentialSaving: z.number().optional(), // dollars per month
  potentialTimeSaving: z.number().optional(), // hours per week
  actionItems: z.array(z.string()),
  priority: z.number().min(1).max(10),
  createdAt: z.date(),
  status: z.enum(['new', 'acknowledged', 'in_progress', 'completed', 'dismissed']),
});

export type BusinessInsight = z.infer<typeof BusinessInsightSchema>;

// SMB integration types
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

// Business health and metrics
export const BusinessMetricsSchema = z.object({
  id: z.string(),
  businessId: z.string(),
  period: z.enum(['daily', 'weekly', 'monthly', 'quarterly']),
  date: z.date(),
  
  // Financial metrics
  revenue: z.number().optional(),
  expenses: z.number().optional(),
  profit: z.number().optional(),
  cashFlow: z.number().optional(),
  
  // Operational metrics
  customerCount: z.number().optional(),
  newCustomers: z.number().optional(),
  churnRate: z.number().optional(),
  averageOrderValue: z.number().optional(),
  
  // Efficiency metrics
  automationSavings: z.number().optional(), // hours saved
  costSavings: z.number().optional(), // dollars saved
  errorReduction: z.number().optional(), // percentage
  
  // Health scores (0-100)
  overallHealth: z.number().min(0).max(100),
  financialHealth: z.number().min(0).max(100),
  operationalHealth: z.number().min(0).max(100),
  complianceHealth: z.number().min(0).max(100),
});

export type BusinessMetrics = z.infer<typeof BusinessMetricsSchema>;

// AI Copilot configuration
export const CopilotConfigSchema = z.object({
  businessId: z.string(),
  businessName: z.string(),
  industry: z.string(),
  size: z.enum(['solo', 'micro', 'small', 'medium']), // 1, 2-10, 11-50, 51-200 employees
  
  // AI preferences
  aiProvider: z.enum(['openai', 'anthropic', 'local']),
  model: z.string(),
  temperature: z.number().min(0).max(2).default(0.7),
  maxTokens: z.number().default(1000),
  
  // Business context
  primaryGoals: z.array(z.string()),
  currentChallenges: z.array(z.string()),
  existingTools: z.array(z.string()),
  
  // Automation preferences
  riskTolerance: z.enum(['conservative', 'moderate', 'aggressive']),
  automationLevel: z.enum(['manual_approval', 'semi_automatic', 'fully_automatic']),
  
  // Notification preferences
  notificationChannels: z.array(z.enum(['email', 'slack', 'sms', 'webhook'])),
  reportingFrequency: z.enum(['daily', 'weekly', 'monthly']),
});

export type CopilotConfig = z.infer<typeof CopilotConfigSchema>;

// Common response types
export interface CopilotResponse {
  success: boolean;
  message: string;
  data?: any;
  suggestions?: string[];
  nextActions?: string[];
  estimatedImpact?: {
    timeSaving?: number; // hours per week
    costSaving?: number; // dollars per month
    efficiency?: number; // percentage improvement
  };
}

// Error types
export class CopilotError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: any
  ) {
    super(message);
    this.name = 'CopilotError';
  }
}

// Template types for common SMB workflows
export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  industry: string[];
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  estimatedSetupTime: number; // minutes
  estimatedTimeSaving: number; // hours per week
  requiredIntegrations: string[];
  template: Omit<Workflow, 'id' | 'createdBy' | 'createdAt'>;
  instructions: string[];
  tips: string[];
}

// Popular SMB workflow templates
export const WORKFLOW_TEMPLATES: WorkflowTemplate[] = [
  {
    id: 'invoice-reminders',
    name: 'Automated Invoice Reminders',
    description: 'Automatically send payment reminders for overdue invoices',
    category: 'finance',
    industry: ['all'],
    difficulty: 'beginner',
    estimatedSetupTime: 10,
    estimatedTimeSaving: 3,
    requiredIntegrations: ['quickbooks', 'email'],
    template: {
      name: 'Invoice Payment Reminders',
      description: 'Send automated reminders for overdue invoices',
      category: 'finance',
      steps: [],
      isActive: true,
      runCount: 0,
      successRate: 0,
      estimatedTimeSaving: 3,
    },
    instructions: [
      'Connect your QuickBooks account',
      'Set up email templates for reminders',
      'Configure reminder schedule (7, 14, 30 days)',
      'Test with a sample invoice'
    ],
    tips: [
      'Use friendly but firm language in reminders',
      'Include payment links for easy processing',
      'Set up escalation for severely overdue accounts'
    ]
  },
  {
    id: 'lead-followup',
    name: 'Lead Follow-up Automation',
    description: 'Automatically follow up with new leads and prospects',
    category: 'sales',
    industry: ['all'],
    difficulty: 'beginner',
    estimatedSetupTime: 15,
    estimatedTimeSaving: 5,
    requiredIntegrations: ['crm', 'email'],
    template: {
      name: 'Lead Follow-up Sequence',
      description: 'Automated follow-up sequence for new leads',
      category: 'sales',
      steps: [],
      isActive: true,
      runCount: 0,
      successRate: 0,
      estimatedTimeSaving: 5,
    },
    instructions: [
      'Connect your CRM system',
      'Create follow-up email templates',
      'Set up timing sequence (immediate, 3 days, 1 week, 2 weeks)',
      'Configure lead scoring triggers'
    ],
    tips: [
      'Personalize emails with lead information',
      'Provide value in each follow-up',
      'Track open and response rates'
    ]
  }
];
