import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import dotenv from 'dotenv';
import path from 'path';

import { AIBusinessCopilot } from '@nexus/ai-business-copilot';
import { CopilotConfig } from '@nexus/ai-business-copilot';

// Load environment variables
dotenv.config();

const app: express.Application = express();
const server = createServer(app);
const io = new SocketIOServer(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 8080;

// Middleware
app.use(helmet());
app.use(cors() as any);
app.use(compression() as any);
// app.use(morgan('combined')); // Temporarily disabled due to type issues
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve static files
app.use(express.static(path.join(__dirname, '../public')));

// Demo configuration for AI Business Copilot
const demoConfig: CopilotConfig = {
  businessId: 'demo-business-001',
  businessName: 'Demo SMB Company',
  industry: 'Professional Services',
  size: 'small',
  aiProvider: 'openai',
  model: 'gpt-4',
  temperature: 0.7,
  maxTokens: 1000,
  primaryGoals: [
    'Automate repetitive tasks',
    'Improve customer service',
    'Reduce operational costs',
    'Scale business operations'
  ],
  currentChallenges: [
    'Manual invoice processing',
    'Inconsistent follow-ups',
    'Time-consuming reporting',
    'Scattered business tools'
  ],
  existingTools: [
    'QuickBooks',
    'Gmail',
    'Slack',
    'Google Workspace'
  ],
  riskTolerance: 'moderate',
  automationLevel: 'semi_automatic',
  notificationChannels: ['email', 'slack'],
  reportingFrequency: 'weekly'
};

// Initialize AI Business Copilot
const copilot = new AIBusinessCopilot(demoConfig);

// API Routes

/**
 * Health check endpoint
 */
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'AI Business Copilot Demo',
    version: '1.0.0'
  });
});

/**
 * Chat with AI Copilot
 */
app.post('/api/chat', async (req, res) => {
  try {
    const { message, userId = 'demo-user' } = req.body;

    if (!message) {
      return res.status(400).json({
        error: 'Message is required'
      });
    }

    const response = await copilot.chat(message, userId);
    
    // Emit to connected clients for real-time updates
    io.emit('chat_response', {
      userId,
      message,
      response: response.message,
      timestamp: new Date().toISOString()
    });

    res.json(response);
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({
      error: 'Failed to process chat message',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Analyze business for automation opportunities
 */
app.post('/api/analyze', async (req, res) => {
  try {
    const insights = await copilot.analyzeBusinessForAutomation();
    
    res.json({
      success: true,
      insights,
      summary: {
        totalOpportunities: insights.length,
        estimatedTimeSaving: insights.reduce((sum, insight) => 
          sum + (insight.potentialTimeSaving || 0), 0
        ),
        estimatedCostSaving: insights.reduce((sum, insight) => 
          sum + (insight.potentialSaving || 0), 0
        )
      }
    });
  } catch (error) {
    console.error('Analysis error:', error);
    res.status(500).json({
      error: 'Failed to analyze business',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Create workflow from description
 */
app.post('/api/workflows', async (req, res) => {
  try {
    const { description } = req.body;

    if (!description) {
      return res.status(400).json({
        error: 'Workflow description is required'
      });
    }

    const workflow = await copilot.createWorkflowFromDescription(description);
    
    res.json({
      success: true,
      workflow,
      message: 'Workflow created successfully. Review and activate when ready.'
    });
  } catch (error) {
    console.error('Workflow creation error:', error);
    res.status(500).json({
      error: 'Failed to create workflow',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get workflow templates
 */
app.get('/api/workflow-templates', (req, res) => {
  try {
    const templates = copilot.getRelevantWorkflowTemplates();
    
    res.json({
      success: true,
      templates,
      count: templates.length
    });
  } catch (error) {
    console.error('Template retrieval error:', error);
    res.status(500).json({
      error: 'Failed to get workflow templates',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Generate business health report
 */
app.get('/api/health-report', async (req, res) => {
  try {
    const report = await copilot.generateBusinessHealthReport();
    
    res.json({
      success: true,
      report,
      generatedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Health report error:', error);
    res.status(500).json({
      error: 'Failed to generate health report',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get conversation history
 */
app.get('/api/conversation', (req, res) => {
  try {
    const history = copilot.getConversationHistory();
    
    res.json({
      success: true,
      conversation: history.filter(msg => msg.role !== 'system'), // Exclude system messages
      count: history.length
    });
  } catch (error) {
    console.error('Conversation history error:', error);
    res.status(500).json({
      error: 'Failed to get conversation history',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Demo scenarios endpoint
 */
app.get('/api/demo-scenarios', (req, res) => {
  const scenarios = [
    {
      id: 'invoice-automation',
      title: 'Automate Invoice Reminders',
      description: 'Set up automated payment reminders for overdue invoices',
      prompt: 'Help me automate invoice payment reminders for customers who are 7, 14, and 30 days overdue',
      category: 'finance',
      estimatedTime: '10 minutes',
      timeSaving: '3 hours/week'
    },
    {
      id: 'lead-followup',
      title: 'Lead Follow-up Automation',
      description: 'Automatically follow up with new leads and prospects',
      prompt: 'Create an automated follow-up sequence for new leads that contacts them after 1 day, 3 days, and 1 week',
      category: 'sales',
      estimatedTime: '15 minutes',
      timeSaving: '5 hours/week'
    },
    {
      id: 'expense-tracking',
      title: 'Expense Tracking & Categorization',
      description: 'Automatically categorize and track business expenses',
      prompt: 'Help me set up automatic expense categorization and monthly reporting from my bank transactions',
      category: 'finance',
      estimatedTime: '20 minutes',
      timeSaving: '4 hours/week'
    },
    {
      id: 'customer-onboarding',
      title: 'Customer Onboarding Workflow',
      description: 'Streamline new customer onboarding process',
      prompt: 'Create an automated onboarding workflow for new customers including welcome emails, document collection, and setup scheduling',
      category: 'operations',
      estimatedTime: '25 minutes',
      timeSaving: '6 hours/week'
    },
    {
      id: 'social-media',
      title: 'Social Media Content Scheduling',
      description: 'Automate social media posting and engagement',
      prompt: 'Help me automate social media posting across LinkedIn, Twitter, and Facebook with content from our blog',
      category: 'marketing',
      estimatedTime: '30 minutes',
      timeSaving: '8 hours/week'
    }
  ];

  res.json({
    success: true,
    scenarios,
    totalTimeSaving: scenarios.reduce((sum, scenario) => 
      sum + parseInt(scenario.timeSaving.split(' ')[0]), 0
    )
  });
});

/**
 * Serve demo frontend
 */
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Socket.IO for real-time communication
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('chat_message', async (data) => {
    try {
      const { message, userId = socket.id } = data;
      const response = await copilot.chat(message, userId);
      
      socket.emit('chat_response', {
        message,
        response: response.message,
        suggestions: response.suggestions,
        nextActions: response.nextActions,
        estimatedImpact: response.estimatedImpact,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      socket.emit('chat_error', {
        error: 'Failed to process message',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    details: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Not found',
    path: req.originalUrl
  });
});

// Start server
server.listen(PORT, () => {
  console.log(`🚀 AI Business Copilot Demo Server running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
  console.log(`💬 Demo UI: http://localhost:${PORT}`);
  console.log(`🤖 AI Model: ${demoConfig.model}`);
  console.log(`🏢 Demo Business: ${demoConfig.businessName}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

export default app;
