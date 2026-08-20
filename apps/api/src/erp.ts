import { createErpProvider, ErpProvider } from "@signet/erp";

/** The active ERP provider, selected via ERP_PROVIDER env (mock | acumatica). */
export const erp: ErpProvider = createErpProvider();
