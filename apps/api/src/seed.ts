import "dotenv/config";
import { randomBytes } from "node:crypto";
import { MockErpProvider } from "@signet/erp";
import { hashPassword } from "./auth";
import { db } from "./db";
import {
  addresses,
  contacts,
  internalUsers,
  products,
  productVariants,
  tenantProducts,
  tenants,
  users,
} from "./schema";
import { ensureReturnConfig } from "./routes/admin/helpers";

/**
 * Seeds the commerce core from the mock ERP catalog and creates two demo
 * tenants ("ford" and "acme") with their own branding, catalogs, pricing
 * overrides, buyers (with login passwords), and sample CRM data.
 */
async function main() {
  const erp = new MockErpProvider();
  const erpProducts = await erp.listProducts();

  for (const p of erpProducts) {
    const [product] = await db
      .insert(products)
      .values({
        erpId: p.erpId,
        sku: p.sku,
        name: p.name,
        description: p.description,
        brand: p.brand,
        imageUrl: p.imageUrl,
      })
      .onConflictDoUpdate({
        target: products.erpId,
        set: { sku: p.sku, name: p.name, description: p.description, brand: p.brand, imageUrl: p.imageUrl },
      })
      .returning();

    for (const v of p.variants) {
      await db
        .insert(productVariants)
        .values({
          productId: product.id,
          sku: v.sku,
          size: v.size,
          color: v.color,
          price: v.price,
          available: v.available,
        })
        .onConflictDoUpdate({
          target: productVariants.sku,
          set: { size: v.size, color: v.color, price: v.price, available: v.available },
        });
    }
  }

  const allProducts = await db.select().from(products);

  const [signature] = await db
    .insert(tenants)
    .values({
      slug: "signature-imagewear",
      name: "Signature Imagewear",
      erpCustomerCode: "SIGNATURE",
      primaryColor: "#152943",
      accentColor: "#ff6b00",
      heroHeadline: "Signature Imagewear",
      heroSubtext: "Branded apparel and uniform programs",
    })
    .onConflictDoUpdate({ target: tenants.slug, set: { name: "Signature Imagewear" } })
    .returning();

  const [ford] = await db
    .insert(tenants)
    .values({
      slug: "ford",
      name: "Ford Motor Company",
      parentTenantId: signature.id,
      domain: "ford.localhost",
      erpCustomerCode: "FORD",
      primaryColor: "#00274d",
      accentColor: "#1f6feb",
      heroHeadline: "Ford Team Store",
      heroSubtext: "Official apparel for Ford employees",
      logoUrl: "https://picsum.photos/seed/fordlogo/160/48",
      punchoutEnabled: true,
      punchoutSharedSecret: randomBytes(24).toString("hex"),
    })
    .onConflictDoUpdate({ target: tenants.slug, set: { name: "Ford Motor Company", parentTenantId: signature.id } })
    .returning();

  const [acme] = await db
    .insert(tenants)
    .values({
      slug: "acme",
      name: "Acme Industrial",
      parentTenantId: signature.id,
      domain: "acme.localhost",
      erpCustomerCode: "ACME",
      primaryColor: "#7c2d12",
      accentColor: "#ea580c",
      heroHeadline: "Acme Uniform Program",
      heroSubtext: "Workwear and safety apparel",
      logoUrl: "https://picsum.photos/seed/acmelogo/160/48",
    })
    .onConflictDoUpdate({ target: tenants.slug, set: { name: "Acme Industrial", parentTenantId: signature.id } })
    .returning();

  // Ford carries the full catalog; the polo is contract-priced lower.
  for (const [i, product] of allProducts.entries()) {
    await db
      .insert(tenantProducts)
      .values({
        tenantId: ford.id,
        productId: product.id,
        priceOverride: i === 0 ? 21.5 : null,
      })
      .onConflictDoNothing({ target: [tenantProducts.tenantId, tenantProducts.productId] });
  }

  // Acme carries a curated subset (no caps).
  for (const product of allProducts.filter((p) => p.sku !== "CAP-STRUCTURED")) {
    await db
      .insert(tenantProducts)
      .values({ tenantId: acme.id, productId: product.id })
      .onConflictDoNothing({ target: [tenantProducts.tenantId, tenantProducts.productId] });
  }

  const buyerPassword = await hashPassword("password123");

  const [fordBuyer] = await db
    .insert(users)
    .values({
      tenantId: ford.id,
      email: "buyer@ford.com",
      name: "Pat Buyer",
      role: "buyer",
      passwordHash: buyerPassword,
      allotmentBalance: 250,
    })
    .onConflictDoUpdate({ target: [users.tenantId, users.email], set: { passwordHash: buyerPassword } })
    .returning();

  const [acmeBuyer] = await db
    .insert(users)
    .values({
      tenantId: acme.id,
      email: "buyer@acme.com",
      name: "Sam Buyer",
      role: "buyer",
      passwordHash: buyerPassword,
      allotmentBalance: 150,
    })
    .onConflictDoUpdate({ target: [users.tenantId, users.email], set: { passwordHash: buyerPassword } })
    .returning();

  // Internal staff accounts: Signet owner, client admin, and client employee.
  await db
    .insert(internalUsers)
    .values({
      email: "signet-owner@signet.local",
      username: "signet-owner",
      name: "Signet Owner",
      role: "owner",
      passwordHash: await hashPassword("7lI0923X?oe39Pnd"),
    })
    .onConflictDoUpdate({
      target: internalUsers.email,
      set: { username: "signet-owner", name: "Signet Owner", role: "owner", tenantId: null, passwordHash: await hashPassword("7lI0923X?oe39Pnd") },
    });

  await db
    .insert(internalUsers)
    .values({
      email: "admin@signature-imagewear.local",
      username: "signature-admin",
      name: "Signature Imagewear Admin",
      role: "admin",
      tenantId: signature.id,
      passwordHash: await hashPassword("admin123"),
    })
    .onConflictDoUpdate({
      target: internalUsers.email,
      set: { username: "signature-admin", name: "Signature Imagewear Admin", role: "admin", tenantId: signature.id, passwordHash: await hashPassword("admin123") },
    });

  await db
    .insert(internalUsers)
    .values({
      email: "employee@signature-imagewear.local",
      username: "signature-employee",
      name: "Signature Imagewear Employee",
      role: "employee",
      tenantId: signature.id,
      passwordHash: await hashPassword("employee123"),
    })
    .onConflictDoUpdate({
      target: internalUsers.email,
      set: { username: "signature-employee", name: "Signature Imagewear Employee", role: "employee", tenantId: signature.id, passwordHash: await hashPassword("employee123") },
    });

  // Sample CRM data so the admin CRM tabs aren't empty on first load.
  await db.insert(contacts).values({
    tenantId: ford.id,
    userId: fordBuyer.id,
    name: "Pat Buyer",
    email: "buyer@ford.com",
    phone: "313-555-0100",
    title: "Uniform Program Coordinator",
  });
  await db.insert(addresses).values({
    tenantId: ford.id,
    userId: fordBuyer.id,
    label: "Dearborn HQ",
    line1: "1 American Rd",
    city: "Dearborn",
    state: "MI",
    postalCode: "48126",
    isDefault: true,
  });

  await ensureReturnConfig();

  console.log(
    `Seeded ${allProducts.length} products, tenants: ford, acme.\n` +
      `Owner login: signet-owner / 7lI0923X?oe39Pnd (http://localhost:3001/owner/login)\n` +
      `Company staff: signature-admin / admin123 or signature-employee / employee123 (http://localhost:3001/login)\n` +
      `Buyer logins: buyer@ford.com / password123, buyer@acme.com / password123\n` +
      `Storefront: http://localhost:3000/?tenant=ford`,
  );
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

