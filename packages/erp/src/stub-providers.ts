import { ErpCustomer, ErpOrderRequest, ErpOrderResult, ErpProduct, ErpProvider } from "./types";

export interface Sage100Config {
  baseUrl: string;
  apiKey: string;
  company?: string;
}

/**
 * Skeleton for Sage 100's Business Framework / Sage 100cloud API. Not yet
 * wired to a real Sage instance — flesh out `ping`/`listProducts`/
 * `listCustomers`/`submitOrder` once Signet has sandbox credentials. Until
 * then, the universal CSV export (see csv-sync.ts) is the working
 * integration path for Sage customers.
 */
export class Sage100ErpProvider implements ErpProvider {
  readonly name = "sage100";

  constructor(private config: Sage100Config) {}

  async ping(): Promise<boolean> {
    throw new Error("Sage 100 integration not yet implemented — use ERP_PROVIDER=csv or contact Signet engineering.");
  }

  async listProducts(): Promise<ErpProduct[]> {
    throw new Error("Sage 100 integration not yet implemented.");
  }

  async listCustomers(): Promise<ErpCustomer[]> {
    throw new Error("Sage 100 integration not yet implemented.");
  }

  async submitOrder(_order: ErpOrderRequest): Promise<ErpOrderResult> {
    throw new Error("Sage 100 integration not yet implemented.");
  }
}

export interface NetSuiteConfig {
  accountId: string;
  consumerKey: string;
  consumerSecret: string;
  tokenId: string;
  tokenSecret: string;
}

/**
 * Skeleton for Oracle NetSuite's SuiteTalk REST/SOAP API (OAuth 1.0a token
 * auth). Not yet wired to a real NetSuite account — flesh out once Signet has
 * sandbox credentials. Until then, the universal CSV export (csv-sync.ts) is
 * the working integration path for NetSuite customers.
 */
export class NetSuiteErpProvider implements ErpProvider {
  readonly name = "netsuite";

  constructor(private config: NetSuiteConfig) {}

  async ping(): Promise<boolean> {
    throw new Error("NetSuite integration not yet implemented — use ERP_PROVIDER=csv or contact Signet engineering.");
  }

  async listProducts(): Promise<ErpProduct[]> {
    throw new Error("NetSuite integration not yet implemented.");
  }

  async listCustomers(): Promise<ErpCustomer[]> {
    throw new Error("NetSuite integration not yet implemented.");
  }

  async submitOrder(_order: ErpOrderRequest): Promise<ErpOrderResult> {
    throw new Error("NetSuite integration not yet implemented.");
  }
}
