import { Injectable, Logger } from '@nestjs/common';

export interface Dashboard {
  id: string;
  name: string;
  description: string;
  widgets: Widget[];
  layout: DashboardLayout;
  isPublic: boolean;
  ownerId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Widget {
  id: string;
  type: 'chart' | 'metric' | 'table' | 'text' | 'image';
  title: string;
  config: {
    chartType?: 'line' | 'bar' | 'pie' | 'area' | 'scatter';
    dataSource: string;
    query: string;
    refreshInterval?: number;
    filters?: Record<string, any>;
  };
  position: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  styling: {
    backgroundColor?: string;
    textColor?: string;
    borderColor?: string;
  };
}

export interface DashboardLayout {
  columns: number;
  rows: number;
  gap: number;
  responsive: boolean;
}

export interface CustomReport {
  id: string;
  name: string;
  description: string;
  query: string;
  parameters: ReportParameter[];
  visualizations: ReportVisualization[];
  schedule?: {
    frequency: 'daily' | 'weekly' | 'monthly';
    time: string;
    recipients: string[];
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface ReportParameter {
  name: string;
  type: 'string' | 'number' | 'date' | 'boolean' | 'select';
  required: boolean;
  defaultValue?: any;
  options?: any[];
}

export interface ReportVisualization {
  id: string;
  type: 'chart' | 'table' | 'metric';
  title: string;
  config: Record<string, any>;
}

@Injectable()
export class AdvancedReportingService {
  private readonly logger = new Logger(AdvancedReportingService.name);
  private dashboards = new Map<string, Dashboard>();
  private customReports = new Map<string, CustomReport>();

  constructor() {
    this.initializeDefaultDashboards();
  }

  private initializeDefaultDashboards(): void {
    const executiveDashboard: Dashboard = {
      id: 'executive-dashboard',
      name: 'Executive Dashboard',
      description: 'High-level business metrics and KPIs',
      widgets: [
        {
          id: 'revenue-widget',
          type: 'metric',
          title: 'Total Revenue',
          config: {
            dataSource: 'payments',
            query: 'SELECT SUM(amount) FROM payments WHERE status = "succeeded"',
            refreshInterval: 300000, // 5 minutes
          },
          position: { x: 0, y: 0, width: 3, height: 2 },
          styling: { backgroundColor: '#4CAF50', textColor: '#FFFFFF' },
        },
        {
          id: 'users-widget',
          type: 'metric',
          title: 'Active Users',
          config: {
            dataSource: 'users',
            query: 'SELECT COUNT(*) FROM users WHERE last_login >= NOW() - INTERVAL 30 DAY',
            refreshInterval: 600000, // 10 minutes
          },
          position: { x: 3, y: 0, width: 3, height: 2 },
          styling: { backgroundColor: '#2196F3', textColor: '#FFFFFF' },
        },
        {
          id: 'revenue-chart',
          type: 'chart',
          title: 'Revenue Trend',
          config: {
            chartType: 'line',
            dataSource: 'payments',
            query: 'SELECT DATE(created_at) as date, SUM(amount) as revenue FROM payments GROUP BY DATE(created_at) ORDER BY date',
            refreshInterval: 900000, // 15 minutes
          },
          position: { x: 0, y: 2, width: 6, height: 4 },
          styling: {},
        },
      ],
      layout: {
        columns: 12,
        rows: 8,
        gap: 16,
        responsive: true,
      },
      isPublic: false,
      ownerId: 'admin',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.dashboards.set('executive-dashboard', executiveDashboard);
    this.logger.log('Initialized default dashboards');
  }

  async createDashboard(dashboardData: {
    name: string;
    description: string;
    ownerId: string;
    isPublic?: boolean;
  }): Promise<Dashboard> {
    const dashboardId = this.generateId();
    
    const dashboard: Dashboard = {
      id: dashboardId,
      name: dashboardData.name,
      description: dashboardData.description,
      widgets: [],
      layout: {
        columns: 12,
        rows: 8,
        gap: 16,
        responsive: true,
      },
      isPublic: dashboardData.isPublic || false,
      ownerId: dashboardData.ownerId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.dashboards.set(dashboardId, dashboard);
    this.logger.log(`Dashboard created: ${dashboardData.name} (${dashboardId})`);

    return dashboard;
  }

  async addWidget(dashboardId: string, widgetData: Omit<Widget, 'id'>): Promise<Widget> {
    const dashboard = this.dashboards.get(dashboardId);
    if (!dashboard) {
      throw new Error(`Dashboard ${dashboardId} not found`);
    }

    const widget: Widget = {
      ...widgetData,
      id: this.generateId(),
    };

    dashboard.widgets.push(widget);
    dashboard.updatedAt = new Date();
    this.dashboards.set(dashboardId, dashboard);

    this.logger.log(`Widget added to dashboard ${dashboardId}: ${widget.title}`);
    return widget;
  }

  async createCustomReport(reportData: {
    name: string;
    description: string;
    query: string;
    parameters?: ReportParameter[];
    visualizations?: ReportVisualization[];
  }): Promise<CustomReport> {
    const reportId = this.generateId();
    
    const report: CustomReport = {
      id: reportId,
      name: reportData.name,
      description: reportData.description,
      query: reportData.query,
      parameters: reportData.parameters || [],
      visualizations: reportData.visualizations || [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.customReports.set(reportId, report);
    this.logger.log(`Custom report created: ${reportData.name} (${reportId})`);

    return report;
  }

  async generateReport(reportId: string, parameters: Record<string, any> = {}): Promise<{
    data: any[];
    visualizations: any[];
    generatedAt: Date;
  }> {
    const report = this.customReports.get(reportId);
    if (!report) {
      throw new Error(`Report ${reportId} not found`);
    }

    // Simulate query execution
    const data = this.executeQuery(report.query, parameters);
    
    // Generate visualizations
    const visualizations = report.visualizations.map(viz => ({
      id: viz.id,
      type: viz.type,
      title: viz.title,
      data: this.processDataForVisualization(data, viz.config),
    }));

    return {
      data,
      visualizations,
      generatedAt: new Date(),
    };
  }

  private executeQuery(query: string, parameters: Record<string, any>): any[] {
    // Simulate query execution with mock data
    const mockData = [];
    const recordCount = Math.floor(Math.random() * 100) + 10;
    
    for (let i = 0; i < recordCount; i++) {
      mockData.push({
        id: i + 1,
        date: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
        value: Math.floor(Math.random() * 1000) + 100,
        category: ['A', 'B', 'C'][Math.floor(Math.random() * 3)],
        status: ['active', 'inactive'][Math.floor(Math.random() * 2)],
      });
    }
    
    return mockData;
  }

  private processDataForVisualization(data: any[], config: Record<string, any>): any {
    // Process data based on visualization type and config
    switch (config.type) {
      case 'chart':
        return {
          labels: data.map(d => d.date?.toISOString().split('T')[0] || d.id),
          datasets: [{
            label: 'Value',
            data: data.map(d => d.value),
          }],
        };
      case 'table':
        return {
          columns: Object.keys(data[0] || {}),
          rows: data,
        };
      case 'metric':
        return {
          value: data.reduce((sum, d) => sum + (d.value || 0), 0),
          count: data.length,
        };
      default:
        return data;
    }
  }

  async getDashboardData(dashboardId: string): Promise<{
    dashboard: Dashboard;
    widgetData: Record<string, any>;
  }> {
    const dashboard = this.dashboards.get(dashboardId);
    if (!dashboard) {
      throw new Error(`Dashboard ${dashboardId} not found`);
    }

    const widgetData: Record<string, any> = {};
    
    for (const widget of dashboard.widgets) {
      try {
        const data = this.executeQuery(widget.config.query, {});
        widgetData[widget.id] = this.processDataForVisualization(data, widget.config);
      } catch (error) {
        this.logger.error(`Failed to load data for widget ${widget.id}:`, error);
        widgetData[widget.id] = { error: 'Failed to load data' };
      }
    }

    return {
      dashboard,
      widgetData,
    };
  }

  async getReportingAnalytics(): Promise<{
    totalDashboards: number;
    totalReports: number;
    mostViewedDashboards: Array<{ id: string; name: string; views: number }>;
    reportExecutions: number;
    avgExecutionTime: number;
  }> {
    return {
      totalDashboards: this.dashboards.size,
      totalReports: this.customReports.size,
      mostViewedDashboards: [
        { id: 'executive-dashboard', name: 'Executive Dashboard', views: 1250 },
        { id: 'sales-dashboard', name: 'Sales Dashboard', views: 890 },
        { id: 'operations-dashboard', name: 'Operations Dashboard', views: 650 },
      ],
      reportExecutions: 5420,
      avgExecutionTime: 1250, // milliseconds
    };
  }

  private generateId(): string {
    return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Public API methods
  async getDashboard(dashboardId: string): Promise<Dashboard | undefined> {
    return this.dashboards.get(dashboardId);
  }

  async getAllDashboards(ownerId?: string): Promise<Dashboard[]> {
    const dashboards = Array.from(this.dashboards.values());
    
    if (ownerId) {
      return dashboards.filter(d => d.ownerId === ownerId || d.isPublic);
    }
    
    return dashboards.filter(d => d.isPublic);
  }

  async getCustomReport(reportId: string): Promise<CustomReport | undefined> {
    return this.customReports.get(reportId);
  }

  async getAllCustomReports(): Promise<CustomReport[]> {
    return Array.from(this.customReports.values());
  }
}
