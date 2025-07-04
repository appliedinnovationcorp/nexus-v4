declare module 'node-quickbooks' {
  export class QuickBooks {
    constructor(
      consumerKey: string,
      consumerSecret: string,
      accessToken: string,
      useSandbox: boolean,
      companyId: string,
      useOAuth2: boolean,
      enableDebugging?: boolean,
      minorVersion?: number | null,
      oauthVersion?: string,
      refreshToken?: string
    );
    
    createCustomer(customer: any, callback: (err: any, result: any) => void): void;
    getCustomers(callback: (err: any, result: any) => void): void;
    getCustomer(id: string, callback: (err: any, result: any) => void): void;
    createItem(item: any, callback: (err: any, result: any) => void): void;
    getItems(callback: (err: any, result: any) => void): void;
    createInvoice(invoice: any, callback: (err: any, result: any) => void): void;
    findInvoices(criteria: any, callback: (err: any, result: any) => void): void;
    findCustomers(criteria: any, callback: (err: any, result: any) => void): void;
    findItems(criteria: any, callback: (err: any, result: any) => void): void;
    getCompanyInfo(companyId: string, callback: (err: any, result: any) => void): void;
  }

  export = QuickBooks;
}
