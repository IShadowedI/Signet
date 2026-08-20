import "dotenv/config";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { Pool } from "pg";

/**
 * Applies every drizzle/*.sql file in filename order to the active database.
 * Hand-run instead of via `drizzle-kit generate` because drizzle-kit's
 * version-detection breaks inside npm workspaces; these files are kept in
 * sync with src/schema.ts and are idempotent (IF NOT EXISTS everywhere).
 */
async function main() {
  const dir = join(__dirname, "..", "drizzle");
  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  if (process.env.DATABASE_URL) {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    for (const file of files) {
      await pool.query(readFileSync(join(dir, file), "utf-8"));
    }
    await pool.end();
  } else {
    const client = new PGlite(process.env.PGLITE_DATA ?? "./pgdata");
    for (const file of files) {
      await client.exec(readFileSync(join(dir, file), "utf-8"));
    }
    await client.close();
  }

  console.log(`Applied ${files.length} migration file(s): ${files.join(", ")}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});


