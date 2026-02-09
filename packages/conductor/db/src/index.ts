import Database from "better-sqlite3";
import { drizzle as drizzleSqlite } from "drizzle-orm/better-sqlite3";
import { neon } from "@neondatabase/serverless";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-http";
import * as schema from "./schema";

export * from "./schema";

export type DatabaseType = "sqlite" | "neon";

export interface DatabaseConfig {
  type: DatabaseType;
  url: string; // File path for SQLite, connection string for Neon
}

// SQLite connection (local development)
export function createSqliteDb(filePath: string) {
  const sqlite = new Database(filePath);
  sqlite.pragma("journal_mode = WAL");
  return drizzleSqlite(sqlite, { schema });
}

// Neon connection (production)
export function createNeonDb(connectionString: string) {
  const sql = neon(connectionString);
  return drizzleNeon(sql, { schema });
}

// Auto-detect and create appropriate database connection
export function createDb(config: DatabaseConfig) {
  if (config.type === "sqlite") {
    return createSqliteDb(config.url);
  } else {
    return createNeonDb(config.url);
  }
}

// Default: SQLite for local development
let defaultDb: ReturnType<typeof createSqliteDb> | null = null;

export function getDb(config?: DatabaseConfig) {
  if (config) {
    return createDb(config);
  }

  if (!defaultDb) {
    const dbPath = process.env["CONDUCTOR_DB_PATH"] || "./conductor.db";
    defaultDb = createSqliteDb(dbPath);
  }

  return defaultDb;
}

// Repository interfaces for type-safe operations
export { createOrganizationRepository } from "./repositories/organization";
export { createProjectRepository } from "./repositories/project";
export { createTaskRepository } from "./repositories/task";
export { createAgentRepository } from "./repositories/agent";
export {
  createUserRepository,
  createUserSecretsRepository,
  type User,
  type UserSecret,
} from "./repositories/user";

// Organization context helpers for API routes
export {
  extractOrgContext,
  requireOrgContext,
  hasRole,
  verifyResourceAccess,
  type OrgContext,
} from "./org-context";
