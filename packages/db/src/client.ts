import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export type Db = ReturnType<typeof drizzle<typeof schema>>;

export function createDb(connectionString: string): { db: Db; sql: ReturnType<typeof postgres> } {
  // prepare: false — compatível com pooler Supabase (PgBouncer / modo Transaction).
  const sql = postgres(connectionString, { max: 10, prepare: false });
  const db = drizzle(sql, { schema });
  return { db, sql };
}
