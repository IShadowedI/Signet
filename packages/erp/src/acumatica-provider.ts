import axios, { AxiosInstance } from "axios";
import {
  ErpCustomer,
  ErpOrderRequest,
  ErpOrderResult,
  ErpProduct,
  ErpProvider,
} from "./types";

export interface AcumaticaConfig {
  baseUrl: string; // e.g. https://your-instance.acumatica.com
  username: string;
  password: string;
  tenant?: string;
  branch?: string;
}

/**
 * Talks to Acumatica's contract-based REST API.
 *
 * Auth flow: POST /entity/auth/login with credentials to open a cookie-backed
 * session, then call the default endpoint entities (StockItem, Customer,
 * SalesOrder). This is intentionally thin — flesh out field mappings against
 * your Acumatica endpoint version as the integration hardens.
 *
 * Docs: {baseUrl}/entity/Default/ (Swagger) and the Acumatica REST API guide.
 */
export class AcumaticaErpProvider implements ErpProvider {
  readonly name = "acumatica";
  private client: AxiosInstance;
  private loggedIn = false;

  constructor(private config: AcumaticaConfig) {
    this.client = axios.create({
      baseURL: config.baseUrl.replace(/\/$/, ""),
      withCredentials: true,
      headers: { "Content-Type": "application/json" },
    });
  }

  private async login(): Promise<void> {
    if (this.loggedIn) return;
    await this.client.post("/entity/auth/login", {
      name: this.config.username,
      password: this.config.password,
      tenant: this.config.tenant,
      branch: this.config.branch,
    });
    this.loggedIn = true;
  }

  async ping(): Promise<boolean> {
    try {
      await this.login();
      return true;
    } catch {
      return false;
    }
  }

  async listProducts(): Promise<ErpProduct[]> {
    await this.login();
    // Default endpoint "StockItem"; $expand pulls the sales price + attributes.
    const { data } = await this.client.get(
      "/entity/Default/24.200.001/StockItem?$top=200",
    );
    return (data as any[]).map((item) => this.mapProduct(item));
  }

  async listCustomers(): Promise<ErpCustomer[]> {
    await this.login();
    const { data } = await this.client.get(
      "/entity/Default/24.200.001/Customer?$top=500",
    );
    return (data as any[]).map((c) => ({
      erpId: String(c.id ?? c.CustomerID?.value),
      code: String(c.CustomerID?.value ?? ""),
      name: String(c.CustomerName?.value ?? ""),
    }));
  }

  async submitOrder(order: ErpOrderRequest): Promise<ErpOrderResult> {
    await this.login();
    const payload = {
      OrderType: { value: "SO" },
      CustomerID: { value: order.customerCode },
      CustomerOrder: { value: order.poNumber ?? "" },
      Details: order.lines.map((l) => ({
        InventoryID: { value: l.sku },
        OrderQty: { value: l.quantity },
      })),
    };
    const { data } = await this.client.put(
      "/entity/Default/24.200.001/SalesOrder",
      payload,
    );
    return {
      erpOrderId: String((data as any).OrderNbr?.value ?? (data as any).id),
      status: String((data as any).Status?.value ?? "Open"),
    };
  }

  private mapProduct(item: any): ErpProduct {
    const sku = String(item.InventoryID?.value ?? "");
    const price = Number(item.DefaultPrice?.value ?? item.CurySpecificPrice?.value ?? 0);
    return {
      erpId: String(item.id ?? sku),
      sku,
      name: String(item.Description?.value ?? sku),
      description: String(item.Description?.value ?? ""),
      // Acumatica matrix items expose variants via template/matrix entities;
      // map those here once your item structure is confirmed.
      variants: [{ sku, price, available: 0 }],
    };
  }
}
