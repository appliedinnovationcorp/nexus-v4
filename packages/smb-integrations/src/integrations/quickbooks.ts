import QuickBooks from 'node-quickbooks';
import { EventEmitter } from 'events';
import { Integration } from '../types';

/**
 * QuickBooks Integration for SMB Business Copilot
 * Handles accounting data, invoices, customers, and financial automation
 */
export class QuickBooksIntegration extends EventEmitter {
  private qbo: QuickBooks | null = null;
  private config: Integration;
  private isConnected = false;

  constructor(config: Integration) {
    super();
    this.config = config;
  }

  /**
   * Connect to QuickBooks using OAuth
   */
  async connect(accessToken: string, refreshToken: string, companyId: string): Promise<void> {
    try {
      this.qbo = new QuickBooks(
        process.env.QB_CONSUMER_KEY!,
        process.env.QB_CONSUMER_SECRET!,
        accessToken,
        false, // Use sandbox for development
        companyId,
        true, // Use OAuth 2.0
        true, // Enable debugging
        null, // Minor version
        '2.0', // OAuth version
        refreshToken
      );

      // Test connection
      await this.testConnection();
      this.isConnected = true;
      
      this.emit('connected', { integration: 'quickbooks', companyId });
    } catch (error) {
      this.emit('error', { integration: 'quickbooks', error });
      throw error;
    }
  }

  /**
   * Get overdue invoices for automated reminders
   */
  async getOverdueInvoices(): Promise<any[]> {
    if (!this.qbo || !this.isConnected) {
      throw new Error('QuickBooks not connected');
    }

    return new Promise((resolve, reject) => {
      const today = new Date().toISOString().split('T')[0];
      
      this.qbo!.findInvoices([
        { field: 'DueDate', operator: '<', value: today },
        { field: 'Balance', operator: '>', value: '0' }
      ], (err: any, invoices: any) => {
        if (err) {
          reject(err);
        } else {
          resolve(invoices.QueryResponse?.Invoice || []);
        }
      });
    });
  }

  /**
   * Get customer information for personalized communications
   */
  async getCustomer(customerId: string): Promise<any> {
    if (!this.qbo || !this.isConnected) {
      throw new Error('QuickBooks not connected');
    }

    return new Promise((resolve, reject) => {
      this.qbo!.getCustomer(customerId, (err: any, customer: any) => {
        if (err) {
          reject(err);
        } else {
          resolve(customer);
        }
      });
    });
  }

  /**
   * Create automated invoice
   */
  async createInvoice(invoiceData: {
    customerId: string;
    items: Array<{
      description: string;
      quantity: number;
      rate: number;
    }>;
    dueDate?: Date;
  }): Promise<any> {
    if (!this.qbo || !this.isConnected) {
      throw new Error('QuickBooks not connected');
    }

    const invoice = {
      CustomerRef: { value: invoiceData.customerId },
      Line: invoiceData.items.map((item, index) => ({
        Id: (index + 1).toString(),
        LineNum: index + 1,
        Amount: item.quantity * item.rate,
        DetailType: 'SalesItemLineDetail',
        SalesItemLineDetail: {
          ItemRef: { value: '1' }, // Default item - would be configurable
          Qty: item.quantity,
          UnitPrice: item.rate,
        },
        Description: item.description,
      })),
      DueDate: invoiceData.dueDate?.toISOString().split('T')[0] || 
               new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 30 days from now
    };

    return new Promise((resolve, reject) => {
      this.qbo!.createInvoice(invoice, (err: any, createdInvoice: any) => {
        if (err) {
          reject(err);
        } else {
          this.emit('invoice_created', { invoice: createdInvoice });
          resolve(createdInvoice);
        }
      });
    });
  }

  /**
   * Get financial summary for business health analysis
   */
  async getFinancialSummary(): Promise<{
    totalRevenue: number;
    totalExpenses: number;
    netIncome: number;
    outstandingInvoices: number;
    overdueAmount: number;
  }> {
    if (!this.qbo || !this.isConnected) {
      throw new Error('QuickBooks not connected');
    }

    try {
      // Get profit & loss report
      const profitLoss = await this.getProfitLossReport();
      
      // Get outstanding invoices
      const outstandingInvoices = await this.getOutstandingInvoices();
      
      // Get overdue invoices
      const overdueInvoices = await this.getOverdueInvoices();

      const overdueAmount = overdueInvoices.reduce((sum, invoice) => 
        sum + parseFloat(invoice.Balance || '0'), 0
      );

      const outstandingAmount = outstandingInvoices.reduce((sum, invoice) => 
        sum + parseFloat(invoice.Balance || '0'), 0
      );

      return {
        totalRevenue: profitLoss.totalRevenue || 0,
        totalExpenses: profitLoss.totalExpenses || 0,
        netIncome: (profitLoss.totalRevenue || 0) - (profitLoss.totalExpenses || 0),
        outstandingInvoices: outstandingAmount,
        overdueAmount,
      };
    } catch (error) {
      this.emit('error', { integration: 'quickbooks', operation: 'financial_summary', error });
      throw error;
    }
  }

  /**
   * Get customers for CRM automation
   */
  async getCustomers(limit = 100): Promise<any[]> {
    if (!this.qbo || !this.isConnected) {
      throw new Error('QuickBooks not connected');
    }

    return new Promise((resolve, reject) => {
      this.qbo!.findCustomers({ limit }, (err: any, customers: any) => {
        if (err) {
          reject(err);
        } else {
          resolve(customers.QueryResponse?.Customer || []);
        }
      });
    });
  }

  /**
   * Sync data for automation workflows
   */
  async syncData(): Promise<{
    customers: any[];
    invoices: any[];
    items: any[];
    lastSync: Date;
  }> {
    if (!this.qbo || !this.isConnected) {
      throw new Error('QuickBooks not connected');
    }

    try {
      const [customers, invoices, items] = await Promise.all([
        this.getCustomers(),
        this.getRecentInvoices(),
        this.getItems(),
      ]);

      const syncData = {
        customers,
        invoices,
        items,
        lastSync: new Date(),
      };

      this.emit('data_synced', { integration: 'quickbooks', recordCount: customers.length + invoices.length + items.length });
      
      return syncData;
    } catch (error) {
      this.emit('error', { integration: 'quickbooks', operation: 'sync_data', error });
      throw error;
    }
  }

  /**
   * Private helper methods
   */
  private async testConnection(): Promise<void> {
    if (!this.qbo) {
      throw new Error('QuickBooks client not initialized');
    }

    return new Promise((resolve, reject) => {
      this.qbo!.getCompanyInfo('1', (err: any, companyInfo: any) => {
        if (err) {
          reject(new Error(`QuickBooks connection failed: ${err.message}`));
        } else {
          resolve();
        }
      });
    });
  }

  private async getProfitLossReport(): Promise<{ totalRevenue: number; totalExpenses: number }> {
    // Simplified - would implement actual P&L report retrieval
    return { totalRevenue: 0, totalExpenses: 0 };
  }

  private async getOutstandingInvoices(): Promise<any[]> {
    return new Promise((resolve, reject) => {
      this.qbo!.findInvoices([
        { field: 'Balance', operator: '>', value: '0' }
      ], (err: any, invoices: any) => {
        if (err) {
          reject(err);
        } else {
          resolve(invoices.QueryResponse?.Invoice || []);
        }
      });
    });
  }

  private async getRecentInvoices(days = 30): Promise<any[]> {
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    return new Promise((resolve, reject) => {
      this.qbo!.findInvoices([
        { field: 'TxnDate', operator: '>=', value: startDate }
      ], (err: any, invoices: any) => {
        if (err) {
          reject(err);
        } else {
          resolve(invoices.QueryResponse?.Invoice || []);
        }
      });
    });
  }

  private async getItems(): Promise<any[]> {
    return new Promise((resolve, reject) => {
      this.qbo!.findItems({}, (err: any, items: any) => {
        if (err) {
          reject(err);
        } else {
          resolve(items.QueryResponse?.Item || []);
        }
      });
    });
  }

  /**
   * Disconnect and cleanup
   */
  async disconnect(): Promise<void> {
    this.qbo = null;
    this.isConnected = false;
    this.emit('disconnected', { integration: 'quickbooks' });
  }

  /**
   * Get connection status
   */
  getStatus(): { connected: boolean; lastSync?: Date } {
    return {
      connected: this.isConnected,
      lastSync: this.config.lastSync,
    };
  }
}
