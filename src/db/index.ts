import { neon } from "@neondatabase/serverless";
import { drizzle, type NeonHttpDatabase } from "drizzle-orm/neon-http";
import { drizzle as drizzleNode } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";
import { isLocalMode } from "@/lib/local-mode";

type DB = NeonHttpDatabase<typeof schema>;

let _db: DB | null = null;

function getDb(): DB {
  if (_db) return _db;
  const connectionString =
    process.env.DATABASE_URL ?? process.env.POSTGRES_URL ?? "";
  if (!connectionString) {
    throw new Error(
      "Missing DATABASE_URL. Add a Postgres (Neon) database in Vercel or set it in .env.local."
    );
  }
  // The local database is a plain Postgres container, which the Neon HTTP
  // driver cannot address, so local mode uses node-postgres instead.
  _db = isLocalMode()
    ? (drizzleNode(new Pool({ connectionString }), { schema }) as unknown as DB)
    : drizzle(neon(connectionString), { schema });
  return _db;
}

// Lazy proxy so importing this module never connects or throws at build time.
export const db = new Proxy({} as DB, {
  get(_target, prop) {
    const instance = getDb();
    const value = instance[prop as keyof DB];
    return typeof value === "function" ? value.bind(instance) : value;
  },
});

export { schema };
