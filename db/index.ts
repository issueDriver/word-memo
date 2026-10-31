import "server-only";

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required to initialize Drizzle ORM.");
}

const globalForDrizzle = globalThis as typeof globalThis & {
  wordMemoPostgres?: ReturnType<typeof postgres>;
};

const client = globalForDrizzle.wordMemoPostgres ?? postgres(databaseUrl, {
  prepare: false,
});

if (process.env.NODE_ENV !== "production") {
  globalForDrizzle.wordMemoPostgres = client;
}

export const db = drizzle(client, { schema });
