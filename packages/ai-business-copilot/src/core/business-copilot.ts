import OpenAI from 'openai';
import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import {
  BusinessTask,
  CopilotMessage,
  CopilotResponse,
  CopilotConfig,
  BusinessInsight,
  Workflow,
  WorkflowTemplate,
  WORKFLOW_TEMPLATES,
  CopilotError,
} from '../types';

/**
 * AI Business Copilot - The GitHub Copilot for SMB Getting Things Done
 * 
 * Main AI assistant that helps SMBs automate workflows, optimize operations,
 * and get more done without technical complexity.
 */
export class AIBusinessCopilot extends EventEmitter {
  private openai: OpenAI;
  private config: CopilotConfig;
  private conversationHistory: CopilotMessage[] = [];
  private activeWorkflows: Map<string, Workflow> = new Map();
  private businessInsights: BusinessInsight[] = [];

  constructor(config: CopilotConfig) {
    super();
    this.config = config;
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    
    this.initializeSystemPrompt();
  }

  /**
   * Main chat interface - natural language business automation
   */
  async chat(message: string, userId: string): Promise<CopilotResponse> {
    try {
      // Add user message to conversation
      const userMessage: CopilotMessage = {
        id: uuidv4(),
        role: 'user',
        content: message,
        timestamp: new Date(),
      };
      this.conversationHistory.push(userMessage);

      // Analyze intent and generate response
      const intent = await this.analyzeIntent(message);
      const response = await this.generateResponse(message, intent);

      // Add assistant response to conversation
      const assistantMessage: CopilotMessage = {
        id: uuidv4(),
        role: 'assistant',
        content: response.message,
        timestamp: new Date(),
      };
      this.conversationHistory.push(assistantMessage);

      // Emit event for logging/analytics
      this.emit('chat_interaction', {
        userId,
        intent,
        userMessage: message,
        response: response.message,
      });

      return response;
    } catch (error) {
      throw new CopilotError(
        'Failed to process chat message',
        'CHAT_ERROR',
        error
      );
    }
  }

  /**
   * Analyze business and suggest automation opportunities
   */
  async analyzeBusinessForAutomation(): Promise<BusinessInsight[]> {
    try {
      const systemPrompt = `
        You are an AI business consultant specializing in SMB automation.
        Analyze the business context and suggest specific automation opportunities.
        
        Business: ${this.config.businessName}
        Industry: ${this.config.industry}
        Size: ${this.config.size}
        Goals: ${this.config.primaryGoals.join(', ')}
        Challenges: ${this.config.currentChallenges.join(', ')}
        Existing Tools: ${this.config.existingTools.join(', ')}
        
        Provide 5-7 specific automation suggestions with:
        1. Clear description of the automation
        2. Estimated time savings per week
        3. Implementation difficulty (low/medium/high)
        4. Required integrations
        5. Step-by-step implementation plan
      `;

      const completion = await this.openai.chat.completions.create({
        model: this.config.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: 'Analyze my business and suggest automation opportunities' }
        ],
        temperature: this.config.temperature,
        max_tokens: this.config.maxTokens,
      });

      const suggestions = this.parseAutomationSuggestions(completion.choices[0].message.content || '');
      this.businessInsights.push(...suggestions);

      this.emit('automation_analysis', {
        businessId: this.config.businessId,
        suggestions: suggestions.length,
      });

      return suggestions;
    } catch (error) {
      throw new CopilotError(
        'Failed to analyze business for automation',
        'ANALYSIS_ERROR',
        error
      );
    }
  }

  /**
   * Create workflow from natural language description
   */
  async createWorkflowFromDescription(description: string): Promise<Workflow> {
    try {
      const systemPrompt = `
        You are an expert workflow automation designer for SMBs.
        Convert natural language descriptions into structured workflows.
        
        Business Context:
        - Name: ${this.config.businessName}
        - Industry: ${this.config.industry}
        - Size: ${this.config.size}
        - Available Tools: ${this.config.existingTools.join(', ')}
        
        Create a detailed workflow with:
        1. Clear trigger conditions
        2. Step-by-step actions
        3. Error handling
        4. Success criteria
        5. Required integrations
        
        Return as structured JSON workflow definition.
      `;

      const completion = await this.openai.chat.completions.create({
        model: this.config.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Create a workflow for: ${description}` }
        ],
        temperature: 0.3, // Lower temperature for more structured output
        max_tokens: 1500,
      });

      const workflowData = this.parseWorkflowFromAI(completion.choices[0].message.content || '');
      const workflow: Workflow = {
        id: uuidv4(),
        ...workflowData,
        createdBy: 'ai-copilot',
        createdAt: new Date(),
        isActive: false, // Requires user activation
        runCount: 0,
        successRate: 0,
      };

      this.activeWorkflows.set(workflow.id, workflow);

      this.emit('workflow_created', {
        workflowId: workflow.id,
        description,
        category: workflow.category,
      });

      return workflow;
    } catch (error) {
      throw new CopilotError(
        'Failed to create workflow from description',
        'WORKFLOW_CREATION_ERROR',
        error
      );
    }
  }

  /**
   * Get workflow templates relevant to the business
   */
  getRelevantWorkflowTemplates(): WorkflowTemplate[] {
    return WORKFLOW_TEMPLATES.filter(template => 
      template.industry.includes('all') || 
      template.industry.includes(this.config.industry.toLowerCase())
    );
  }

  /**
   * Optimize existing business processes
   */
  async optimizeBusinessProcesses(): Promise<BusinessInsight[]> {
    try {
      const systemPrompt = `
        You are a business process optimization expert for SMBs.
        Analyze the current business setup and identify optimization opportunities.
        
        Focus on:
        1. Cost reduction opportunities
        2. Time-saving improvements
        3. Error reduction strategies
        4. Compliance improvements
        5. Growth enablement
        
        Business Context:
        - Name: ${this.config.businessName}
        - Industry: ${this.config.industry}
        - Size: ${this.config.size}
        - Current Tools: ${this.config.existingTools.join(', ')}
        - Challenges: ${this.config.currentChallenges.join(', ')}
      `;

      const completion = await this.openai.chat.completions.create({
        model: this.config.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: 'Analyze my business processes and suggest optimizations' }
        ],
        temperature: this.config.temperature,
        max_tokens: this.config.maxTokens,
      });

      const optimizations = this.parseOptimizationSuggestions(completion.choices[0].message.content || '');
      this.businessInsights.push(...optimizations);

      return optimizations;
    } catch (error) {
      throw new CopilotError(
        'Failed to optimize business processes',
        'OPTIMIZATION_ERROR',
        error
      );
    }
  }

  /**
   * Generate business health report
   */
  async generateBusinessHealthReport(): Promise<{
    overallScore: number;
    insights: BusinessInsight[];
    recommendations: string[];
    quickWins: string[];
  }> {
    try {
      const systemPrompt = `
        You are a business health analyst for SMBs.
        Provide a comprehensive health assessment with actionable recommendations.
        
        Business: ${this.config.businessName}
        Industry: ${this.config.industry}
        Size: ${this.config.size}
        Goals: ${this.config.primaryGoals.join(', ')}
        Challenges: ${this.config.currentChallenges.join(', ')}
        
        Assess:
        1. Operational efficiency
        2. Financial health indicators
        3. Technology utilization
        4. Growth potential
        5. Risk factors
        
        Provide:
        - Overall health score (0-100)
        - Top 5 recommendations
        - 3 quick wins (can implement this week)
        - Priority action items
      `;

      const completion = await this.openai.chat.completions.create({
        model: this.config.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: 'Generate a comprehensive business health report' }
        ],
        temperature: 0.3,
        max_tokens: 2000,
      });

      return this.parseHealthReport(completion.choices[0].message.content || '');
    } catch (error) {
      throw new CopilotError(
        'Failed to generate business health report',
        'HEALTH_REPORT_ERROR',
        error
      );
    }
  }

  /**
   * Private helper methods
   */
  private initializeSystemPrompt(): void {
    const systemMessage: CopilotMessage = {
      id: uuidv4(),
      role: 'system',
      content: `
        You are an AI Business Copilot - the "GitHub Copilot for SMB Getting Things Done".
        
        Your mission: Help small and medium businesses automate workflows, optimize operations, 
        and get more done without technical complexity.
        
        Business Context:
        - Business: ${this.config.businessName}
        - Industry: ${this.config.industry}
        - Size: ${this.config.size} (employees)
        - Goals: ${this.config.primaryGoals.join(', ')}
        - Challenges: ${this.config.currentChallenges.join(', ')}
        - Current Tools: ${this.config.existingTools.join(', ')}
        
        Your capabilities:
        1. Workflow automation design and implementation
        2. Business process optimization
        3. Cost reduction identification
        4. Compliance and security guidance
        5. Integration recommendations
        6. Performance monitoring and insights
        
        Communication style:
        - Clear, jargon-free explanations
        - Actionable recommendations
        - Step-by-step implementation guides
        - Focus on ROI and time savings
        - Empathetic to SMB resource constraints
        
        Always provide:
        - Estimated time savings
        - Implementation difficulty
        - Required resources/tools
        - Next steps
      `,
      timestamp: new Date(),
    };

    this.conversationHistory.push(systemMessage);
  }

  private async analyzeIntent(message: string): Promise<string> {
    const intentPrompt = `
      Analyze the user's intent from this message: "${message}"
      
      Possible intents:
      - automation_request: User wants to automate a process
      - optimization_inquiry: User asks about improving efficiency
      - integration_help: User needs help connecting tools
      - analysis_request: User wants business insights/analysis
      - workflow_creation: User wants to create a specific workflow
      - cost_optimization: User wants to reduce costs
      - compliance_help: User needs compliance assistance
      - general_question: General business question
      
      Return only the intent category.
    `;

    try {
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: intentPrompt }],
        temperature: 0.1,
        max_tokens: 50,
      });

      return completion.choices[0].message.content?.trim() || 'general_question';
    } catch (error) {
      return 'general_question';
    }
  }

  private async generateResponse(message: string, intent: string): Promise<CopilotResponse> {
    const completion = await this.openai.chat.completions.create({
      model: this.config.model,
      messages: [
        ...this.conversationHistory.slice(-10), // Keep last 10 messages for context
        { role: 'user', content: message }
      ],
      temperature: this.config.temperature,
      max_tokens: this.config.maxTokens,
    });

    const responseContent = completion.choices[0].message.content || '';
    
    return {
      success: true,
      message: responseContent,
      suggestions: this.extractSuggestions(responseContent),
      nextActions: this.extractNextActions(responseContent),
      estimatedImpact: this.extractEstimatedImpact(responseContent),
    };
  }

  private parseAutomationSuggestions(content: string): BusinessInsight[] {
    // Parse AI response and convert to BusinessInsight objects
    // This would include more sophisticated parsing logic
    const suggestions: BusinessInsight[] = [];
    
    // Simplified parsing - in production, use more robust parsing
    const lines = content.split('\n').filter(line => line.trim());
    
    lines.forEach((line, index) => {
      if (line.includes('automation') || line.includes('automate')) {
        suggestions.push({
          id: uuidv4(),
          title: `Automation Opportunity ${index + 1}`,
          description: line.trim(),
          category: 'efficiency',
          impact: 'medium',
          effort: 'medium',
          potentialTimeSaving: 2, // Default estimate
          actionItems: ['Analyze current process', 'Design automation', 'Implement solution'],
          priority: 5,
          createdAt: new Date(),
          status: 'new',
        });
      }
    });

    return suggestions;
  }

  private parseWorkflowFromAI(content: string): Omit<Workflow, 'id' | 'createdBy' | 'createdAt' | 'isActive' | 'runCount' | 'successRate'> {
    // Parse AI-generated workflow - simplified version
    return {
      name: 'AI Generated Workflow',
      description: content.substring(0, 200),
      category: 'operations',
      steps: [], // Would parse actual steps from AI response
      estimatedTimeSaving: 3,
    };
  }

  private parseOptimizationSuggestions(content: string): BusinessInsight[] {
    // Similar to parseAutomationSuggestions but focused on optimization
    return [];
  }

  private parseHealthReport(content: string): {
    overallScore: number;
    insights: BusinessInsight[];
    recommendations: string[];
    quickWins: string[];
  } {
    // Parse comprehensive health report from AI
    return {
      overallScore: 75, // Would extract from AI response
      insights: [],
      recommendations: [],
      quickWins: [],
    };
  }

  private extractSuggestions(content: string): string[] {
    // Extract actionable suggestions from AI response
    return [];
  }

  private extractNextActions(content: string): string[] {
    // Extract next steps from AI response
    return [];
  }

  private extractEstimatedImpact(content: string): { timeSaving?: number; costSaving?: number; efficiency?: number } {
    // Extract impact estimates from AI response
    return {};
  }

  /**
   * Public utility methods
   */
  getConversationHistory(): CopilotMessage[] {
    return this.conversationHistory;
  }

  getActiveWorkflows(): Workflow[] {
    return Array.from(this.activeWorkflows.values());
  }

  getBusinessInsights(): BusinessInsight[] {
    return this.businessInsights;
  }

  updateConfig(newConfig: Partial<CopilotConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.initializeSystemPrompt(); // Reinitialize with new context
  }
}
