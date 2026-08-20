/**
 * Canonical shapes Signet uses internally. Each ErpProvider is responsible for
 * mapping its ERP's native payloads to/from these types so the rest of the
 * platform never depends on a specific ERP (Acumatica, Sage, etc.).
 */

export interface ErpProductVariant {
  /** ERP inventory id / SKU for this specific size+color, e.g. "TSHIRT-RED-L" */
  sku: string;
  size?: string;
  color?: string;
  /** List price before any customer-specific pricing. */
  price: number;
  available: number;
}

export interface ErpProduct {
  /** Stable ERP identifier for the product family. */
  erpId: string;
  sku: string;
  name: string;
  description?: string;
  brand?: string;
  imageUrl?: string;
  variants: ErpProductVariant[];
}

export interface ErpCustomer {
  erpId: string;
  /** Acumatica customer id / Sage customer number. */
  code: string;
  name: string;
}

export interface ErpOrderLine {
  sku: string;
  quantity: number;
}

export interface ErpOrderRequest {
  customerCode: string;
  lines: ErpOrderLine[];
  /** Purchase order / reference supplied by the buyer. */
  poNumber?: string;
}

export interface ErpOrderResult {
  erpOrderId: string;
  status: string;
}

export interface ErpProvider {
  readonly name: string;
  /** Verify credentials / connectivity. Returns true when the ERP is reachable. */
  ping(): Promise<boolean>;
  listProducts(): Promise<ErpProduct[]>;
  listCustomers(): Promise<ErpCustomer[]>;
  submitOrder(order: ErpOrderRequest): Promise<ErpOrderResult>;
}
