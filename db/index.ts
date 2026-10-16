import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import * as schema from "./schema";

const dbPath = process.env.DB_PATH ?? "./store-crm.db";

export const sqlite = new Database(dbPath);
export const db: BetterSQLite3Database<typeof schema> = drizzle(sqlite, {
  schema,
});

// Zero-infra rule: a fresh clone runs with no setup step, so the file DB
// migrates itself on boot. Tests never import this module — they build their
// own :memory: db and migrate it explicitly.
migrate(db, { migrationsFolder: "./drizzle" });
