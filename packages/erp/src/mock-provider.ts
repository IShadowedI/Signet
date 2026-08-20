import {
  ErpCustomer,
  ErpOrderRequest,
  ErpOrderResult,
  ErpProduct,
  ErpProvider,
} from "./types";

/**
 * Zero-credential provider used for local development and demos. It returns a
 * small apparel catalog so the platform runs end-to-end without a real ERP.
 */
export class MockErpProvider implements ErpProvider {
  readonly name = "mock";

  async ping(): Promise<boolean> {
    return true;
  }

  async listProducts(): Promise<ErpProduct[]> {
    const sizes = ["S", "M", "L", "XL", "2XL"];
    const build = (
      erpId: string,
      sku: string,
      name: string,
      brand: string,
      basePrice: number,
      colors: string[],
      imageUrl: string,
      description: string,
    ): ErpProduct => ({
      erpId,
      sku,
      name,
      brand,
      description,
      imageUrl,
      variants: colors.flatMap((color) =>
        sizes.map((size) => ({
          sku: `${sku}-${color}-${size}`.toUpperCase().replace(/\s+/g, ""),
          size,
          color,
          price: basePrice + (size === "2XL" ? 2 : 0),
          available: 250,
        })),
      ),
    });

    return [
      build(
        "ERP-1001",
        "POLO-CLASSIC",
        "Classic Piqué Polo",
        "Signature",
        24.0,
        ["Navy", "Black", "White"],
        "https://picsum.photos/seed/polo/600/600",
        "Wrinkle-resistant piqué polo, ideal for embroidered logos.",
      ),
      build(
        "ERP-1002",
        "TEE-COTTON",
        "Ring-Spun Cotton Tee",
        "Signature",
        12.5,
        ["Black", "Heather Grey", "Red"],
        "https://picsum.photos/seed/tee/600/600",
        "Soft ring-spun cotton crew tee for screen printing.",
      ),
      build(
        "ERP-1003",
        "JACKET-SOFTSHELL",
        "Soft Shell Jacket",
        "Signature",
        58.0,
        ["Black", "Navy"],
        "https://picsum.photos/seed/jacket/600/600",
        "Water-resistant soft shell with left-chest logo area.",
      ),
      build(
        "ERP-1004",
        "CAP-STRUCTURED",
        "Structured Twill Cap",
        "Signature",
        14.0,
        ["Black", "Navy", "Khaki"],
        "https://picsum.photos/seed/cap/600/600",
        "Six-panel structured cap, embroidery ready.",
      ),
    ];
  }

  async listCustomers(): Promise<ErpCustomer[]> {
    return [
      { erpId: "C-FORD", code: "FORD", name: "Ford Motor Company" },
      { erpId: "C-ACME", code: "ACME", name: "Acme Industrial" },
    ];
  }

  async submitOrder(order: ErpOrderRequest): Promise<ErpOrderResult> {
    return {
      erpOrderId: `MOCK-${Date.now()}`,
      status: "Open",
    };
  }
}
