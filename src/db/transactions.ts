import "server-only";
import { sql } from "drizzle-orm";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

type Store = NodePgDatabase<typeof schema>;
export type DbTransaction = Parameters<Parameters<Store["transaction"]>[0]>[0];

let store: Store | undefined;

export function withDbTransaction<T>(work: (tx: DbTransaction) => Promise<T>): Promise<T> {
  if (!store) {
    const connectionString = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
    if (!connectionString) throw new Error("Database is not configured");
    const pool = new Pool({ connectionString, max: 2, connectionTimeoutMillis: 4_000, allowExitOnIdle: true });
    store = drizzle(pool, { schema });
  }
  return store.transaction(async (tx) => {
    await tx.execute(sql`set local statement_timeout = '5s'`);
    return work(tx);
  });
}
