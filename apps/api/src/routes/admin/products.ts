import { Router } from "express";
import multer from "multer";
import { parse } from "csv-parse/sync";
import { eq } from "drizzle-orm";
import { db } from "../../db";
import { products, productVariants } from "../../schema";
import { requireInternalAuth } from "../../auth";

export const adminProductsRouter = Router();
adminProductsRouter.use(requireInternalAuth());

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

/** All products with their variants — the master catalog before per-tenant assignment. */
adminProductsRouter.get("/", async (_req, res) => {
  const rows = await db.query.products.findMany({ with: { variants: true } });
  res.json(rows);
});

/** Creates a single product with its variants (manual product entry form). */
adminProductsRouter.post("/", async (req, res) => {
  const { erpId, sku, name, description, brand, imageUrl, variants } = req.body ?? {};
  if (!sku || !name) return res.status(400).json({ error: "sku and name are required" });

  const [product] = await db
    .insert(products)
    .values({ erpId: erpId || `MANUAL-${sku}`, sku, name, description, brand, imageUrl })
    .returning();

  if (Array.isArray(variants)) {
    for (const v of variants) {
      await db.insert(productVariants).values({
        productId: product.id,
        sku: v.sku,
        size: v.size,
        color: v.color,
        price: Number(v.price ?? 0),
        available: Number(v.available ?? 0),
      });
    }
  }

  res.status(201).json(product);
});

/** Updates a product's core fields. */
adminProductsRouter.patch("/:id", async (req, res) => {
  const { name, description, brand, imageUrl } = req.body ?? {};
  const [updated] = await db
    .update(products)
    .set({
      ...(name !== undefined && { name }),
      ...(description !== undefined && { description }),
      ...(brand !== undefined && { brand }),
      ...(imageUrl !== undefined && { imageUrl }),
    })
    .where(eq(products.id, req.params.id))
    .returning();
  if (!updated) return res.status(404).json({ error: "Product not found" });
  res.json(updated);
});

/**
 * Bulk product upload from a CSV file — the "cleaner way to upload products"
 * this platform is meant to replace Signet's tooling for.
 *
 * Expected columns: sku, name, description, brand, imageUrl, size, color,
 * price, available. One row per size/color variant; rows sharing the same
 * `sku` prefix (product SKU) group into one product — pass `productSku` to
 * group explicitly, otherwise `sku` is treated as both the product and
 * variant SKU (single-variant products).
 */
adminProductsRouter.post("/import", upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "file is required (multipart form field 'file')" });

  let rows: Record<string, string>[];
  try {
    rows = parse(req.file.buffer.toString("utf-8"), { columns: true, skip_empty_lines: true, trim: true });
  } catch (e) {
    return res.status(400).json({ error: "Could not parse CSV", detail: String(e) });
  }

  const results = { productsCreated: 0, productsUpdated: 0, variantsUpserted: 0, errors: [] as string[] };
  const productCache = new Map<string, string>(); // productSku -> product.id

  for (const [i, row] of rows.entries()) {
    const productSku = (row.productSku || row.sku || "").trim();
    const variantSku = (row.sku || row.productSku || "").trim();
    if (!productSku || !variantSku || !row.name) {
      results.errors.push(`Row ${i + 2}: missing sku/productSku or name`);
      continue;
    }

    try {
      let productId = productCache.get(productSku);
      if (!productId) {
        const existing = await db.query.products.findFirst({ where: eq(products.sku, productSku) });
        if (existing) {
          await db
            .update(products)
            .set({
              name: row.name,
              description: row.description || null,
              brand: row.brand || null,
              imageUrl: row.imageUrl || null,
            })
            .where(eq(products.id, existing.id));
          productId = existing.id;
          results.productsUpdated++;
        } else {
          const [created] = await db
            .insert(products)
            .values({
              erpId: `CSV-${productSku}`,
              sku: productSku,
              name: row.name,
              description: row.description || null,
              brand: row.brand || null,
              imageUrl: row.imageUrl || null,
            })
            .returning();
          productId = created.id;
          results.productsCreated++;
        }
        productCache.set(productSku, productId);
      }

      const existingVariant = await db.query.productVariants.findFirst({ where: eq(productVariants.sku, variantSku) });
      const price = Number(row.price ?? 0);
      const available = Number(row.available ?? 0);
      if (existingVariant) {
        await db
          .update(productVariants)
          .set({ size: row.size || null, color: row.color || null, price, available })
          .where(eq(productVariants.id, existingVariant.id));
      } else {
        await db.insert(productVariants).values({
          productId,
          sku: variantSku,
          size: row.size || null,
          color: row.color || null,
          price,
          available,
        });
      }
      results.variantsUpserted++;
    } catch (e) {
      results.errors.push(`Row ${i + 2}: ${String(e)}`);
    }
  }

  res.json(results);
});
