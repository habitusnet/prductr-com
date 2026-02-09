#!/usr/bin/env npx tsx
/**
 * Dashboard Database Setup Script
 *
 * Creates the users and user_secrets tables if they don't exist,
 * and optionally creates an initial admin user.
 *
 * Usage:
 *   npx tsx scripts/setup-db.ts
 *   npx tsx scripts/setup-db.ts --admin-email admin@example.com
 */

import Database from "better-sqlite3";
import { randomUUID } from "crypto";

const dbPath = process.env.CONDUCTOR_DB_PATH || "./conductor.db";

console.log(`Setting up database at: ${dbPath}`);

const db = new Database(dbPath);
db.pragma("journal_mode = WAL");

// Create users table
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    name TEXT,
    password_hash TEXT,
    auth_provider TEXT DEFAULT 'local',
    auth_provider_id TEXT,
    avatar_url TEXT,
    is_active INTEGER DEFAULT 1,
    last_login_at TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  )
`);

// Create user_secrets table
db.exec(`
  CREATE TABLE IF NOT EXISTS user_secrets (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    encrypted_value TEXT NOT NULL,
    iv TEXT NOT NULL,
    auth_tag TEXT NOT NULL,
    provider TEXT,
    expires_at TEXT,
    last_used_at TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  )
`);

// Create index for user_secrets lookup
db.exec(`
  CREATE UNIQUE INDEX IF NOT EXISTS idx_user_secrets_user_name
  ON user_secrets(user_id, name)
`);

console.log("Tables created successfully.");

// Check for --admin-email flag
const adminEmailIndex = process.argv.indexOf("--admin-email");
if (adminEmailIndex !== -1 && process.argv[adminEmailIndex + 1]) {
  const email = process.argv[adminEmailIndex + 1];

  const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(email);
  if (existing) {
    console.log(`Admin user already exists: ${email}`);
  } else {
    const id = randomUUID();
    db.prepare(
      "INSERT INTO users (id, email, name, auth_provider) VALUES (?, ?, ?, ?)",
    ).run(id, email, "Admin", "local");
    console.log(`Created admin user: ${email} (id: ${id})`);
  }
}

const userCount = db.prepare("SELECT COUNT(*) as count FROM users").get() as {
  count: number;
};
console.log(`Total users: ${userCount.count}`);

db.close();
console.log("Done.");
