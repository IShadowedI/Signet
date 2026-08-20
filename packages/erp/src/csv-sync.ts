import { appendFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

export interface CsvOrderLine {
  orderId: string;
  createdAt: string;
  tenantSlug: string;
  customerCode: string;
  poNumber?: string;
  paymentMethod: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  erpOrderId?: string | null;
  status: string;
}

const HEADER =
  "OrderID,CreatedAt,TenantSlug,CustomerCode,PONumber,PaymentMethod,SKU,Quantity,UnitPrice,ExtendedPrice,ERPOrderID,Status\n";

function csvEscape(value: unknown): string {
  const str = String(value ?? "");
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

/**
 * Universal ERP sync: every product purchase becomes one CSV row per line
 * item, appended to a single flat file. This works with literally any ERP
 * that supports CSV import (Acumatica, Sage 100, NetSuite, ...) so it's the
 * baseline integration that always runs, independent of whichever
 * ErpProvider (mock/Acumatica/direct API) is also configured.
 */
export function appendOrderToCsv(filePath: string, lines: CsvOrderLine[]): void {
  if (!existsSync(filePath)) {
    mkdirSync(dirname(filePath), { recursive: true });
    writeFileSync(filePath, HEADER);
  }
  const rows = lines
    .map((l) =>
      [
        l.orderId,
        l.createdAt,
        l.tenantSlug,
        l.customerCode,
        l.poNumber ?? "",
        l.paymentMethod,
        l.sku,
        l.quantity,
        l.unitPrice.toFixed(2),
        (l.quantity * l.unitPrice).toFixed(2),
        l.erpOrderId ?? "",
        l.status,
      ]
        .map(csvEscape)
        .join(","),
    )
    .join("\n");
  appendFileSync(filePath, rows + "\n");
}
