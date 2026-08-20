import "dotenv/config";
import { PGlite } from "@electric-sql/pglite";
import { drizzle as drizzlePglite, PgliteDatabase } from "drizzle-orm/pglite";
import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

/**
 * Data layer that works on any CPU architecture (no native binaries):
 *  - dev  -> PGlite, an embedded Postgres compiled to WebAssembly (zero setup)
 *  - prod -> real Postgres via node-postgres (`pg`, pure JS)
 * Set DATABASE_URL to switch to Postgres; otherwise PGlite is used.
 */

export type DB = PgliteDatabase<typeof schema>;

export const usingPostgres = Boolean(process.env.DATABASE_URL);

function createDb(): DB {
  if (usingPostgres) {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    // The Drizzle query API is identical across drivers.
    return drizzlePg(pool, { schema }) as unknown as DB;
  }
  const client = new PGlite(process.env.PGLITE_DATA ?? "./pgdata");
  return drizzlePglite(client, { schema });
}

export const db = createDb();
export { schema };
