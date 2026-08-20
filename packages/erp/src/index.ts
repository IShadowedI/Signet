export * from "./types";
export { MockErpProvider } from "./mock-provider";
export { AcumaticaErpProvider, AcumaticaConfig } from "./acumatica-provider";
export { Sage100ErpProvider, Sage100Config, NetSuiteErpProvider, NetSuiteConfig } from "./stub-providers";
export { appendOrderToCsv, CsvOrderLine } from "./csv-sync";

import { ErpCustomer, ErpOrderRequest, ErpOrderResult, ErpProduct, ErpProvider } from "./types";
import { MockErpProvider } from "./mock-provider";
import { AcumaticaErpProvider } from "./acumatica-provider";
import { Sage100ErpProvider, NetSuiteErpProvider } from "./stub-providers";

/**
 * The universal fallback integration: no direct API calls at all, since the
 * order is already appended to the CSV export (csv-sync.ts) that any ERP can
 * import. Useful for clients who aren't ready for (or don't offer) a live API.
 */
class CsvOnlyErpProvider implements ErpProvider {
  readonly name = "csv";
  async ping(): Promise<boolean> {
    return true;
  }
  async listProducts(): Promise<ErpProduct[]> {
    return [];
  }
  async listCustomers(): Promise<ErpCustomer[]> {
    return [];
  }
  async submitOrder(_order: ErpOrderRequest): Promise<ErpOrderResult> {
    return { erpOrderId: `CSV-${Date.now()}`, status: "queued-for-csv-export" };
  }
}

/**
 * Resolves the active ERP provider from environment configuration. Add new
 * ERPs (Sage, NetSuite, ...) as additional cases — nothing else in the platform
 * needs to change.
 */
export function createErpProvider(env: NodeJS.ProcessEnv = process.env): ErpProvider {
  const provider = (env.ERP_PROVIDER ?? "mock").toLowerCase();

  switch (provider) {
    case "acumatica":
      return new AcumaticaErpProvider({
        baseUrl: env.ACUMATICA_BASE_URL ?? "",
        username: env.ACUMATICA_USERNAME ?? "",
        password: env.ACUMATICA_PASSWORD ?? "",
        tenant: env.ACUMATICA_TENANT,
        branch: env.ACUMATICA_BRANCH,
      });
    case "sage100":
      return new Sage100ErpProvider({ baseUrl: env.SAGE100_BASE_URL ?? "", apiKey: env.SAGE100_API_KEY ?? "" });
    case "netsuite":
      return new NetSuiteErpProvider({
        accountId: env.NETSUITE_ACCOUNT_ID ?? "",
        consumerKey: env.NETSUITE_CONSUMER_KEY ?? "",
        consumerSecret: env.NETSUITE_CONSUMER_SECRET ?? "",
        tokenId: env.NETSUITE_TOKEN_ID ?? "",
        tokenSecret: env.NETSUITE_TOKEN_SECRET ?? "",
      });
    case "csv":
      return new CsvOnlyErpProvider();
    case "mock":
      return new MockErpProvider();
    default:
      throw new Error(`Unknown ERP_PROVIDER "${provider}"`);
  }
}

