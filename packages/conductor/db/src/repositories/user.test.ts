import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { sql } from "drizzle-orm";
import * as schema from "../schema.js";
import { createUserRepository, createUserSecretsRepository } from "./user.js";

describe("user repository", () => {
  let db: ReturnType<typeof drizzle>;
  let userRepo: ReturnType<typeof createUserRepository>;

  beforeEach(() => {
    const sqlite = new Database(":memory:");
    db = drizzle(sqlite, { schema });

    // Create users table
    db.run(sql`
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

    userRepo = createUserRepository(db);
  });

  describe("create", () => {
    it("should create a user", async () => {
      const user = await userRepo.create({
        id: "user-1",
        email: "test@example.com",
        name: "Test User",
      });

      expect(user.id).toBe("user-1");
      expect(user.email).toBe("test@example.com");
      expect(user.name).toBe("Test User");
    });

    it("should create user with OAuth provider", async () => {
      const user = await userRepo.create({
        id: "user-2",
        email: "oauth@example.com",
        authProvider: "google",
        authProviderId: "google-123",
      });

      expect(user.authProvider).toBe("google");
      expect(user.authProviderId).toBe("google-123");
    });
  });

  describe("findById", () => {
    it("should find user by id", async () => {
      await userRepo.create({
        id: "user-1",
        email: "test@example.com",
      });

      const found = await userRepo.findById("user-1");
      expect(found?.email).toBe("test@example.com");
    });

    it("should return null for non-existent user", async () => {
      const found = await userRepo.findById("non-existent");
      expect(found).toBeNull();
    });
  });

  describe("findByEmail", () => {
    it("should find user by email", async () => {
      await userRepo.create({
        id: "user-1",
        email: "test@example.com",
      });

      const found = await userRepo.findByEmail("test@example.com");
      expect(found?.id).toBe("user-1");
    });
  });

  describe("findByAuthProvider", () => {
    it("should find user by auth provider", async () => {
      await userRepo.create({
        id: "user-1",
        email: "github@example.com",
        authProvider: "github",
        authProviderId: "gh-456",
      });

      const found = await userRepo.findByAuthProvider("github", "gh-456");
      expect(found?.id).toBe("user-1");
    });
  });

  describe("update", () => {
    it("should update user fields", async () => {
      await userRepo.create({
        id: "user-1",
        email: "test@example.com",
      });

      const updated = await userRepo.update("user-1", { name: "Updated Name" });
      expect(updated.name).toBe("Updated Name");
    });
  });

  describe("updateLastLogin", () => {
    it("should update last login timestamp", async () => {
      await userRepo.create({
        id: "user-1",
        email: "test@example.com",
      });

      const updated = await userRepo.updateLastLogin("user-1");
      expect(updated.lastLoginAt).toBeDefined();
    });
  });

  describe("delete", () => {
    it("should delete user", async () => {
      await userRepo.create({
        id: "user-1",
        email: "test@example.com",
      });

      await userRepo.delete("user-1");
      const found = await userRepo.findById("user-1");
      expect(found).toBeNull();
    });
  });
});

describe("user secrets repository", () => {
  let db: ReturnType<typeof drizzle>;
  let userRepo: ReturnType<typeof createUserRepository>;
  let secretsRepo: ReturnType<typeof createUserSecretsRepository>;

  beforeEach(() => {
    const sqlite = new Database(":memory:");
    db = drizzle(sqlite, { schema });

    // Create tables
    db.run(sql`
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

    db.run(sql`
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

    userRepo = createUserRepository(db);
    secretsRepo = createUserSecretsRepository(db);
  });

  describe("create", () => {
    it("should create a secret", async () => {
      await userRepo.create({ id: "user-1", email: "test@example.com" });

      const secret = await secretsRepo.create({
        id: "secret-1",
        userId: "user-1",
        name: "API_KEY",
        encryptedValue: "encrypted123",
        iv: "iv123",
        authTag: "tag123",
        provider: "openai",
      });

      expect(secret.id).toBe("secret-1");
      expect(secret.name).toBe("API_KEY");
      expect(secret.provider).toBe("openai");
    });
  });

  describe("findByUserIdAndName", () => {
    it("should find secret by user and name", async () => {
      await userRepo.create({ id: "user-1", email: "test@example.com" });
      await secretsRepo.create({
        id: "secret-1",
        userId: "user-1",
        name: "API_KEY",
        encryptedValue: "encrypted123",
        iv: "iv123",
        authTag: "tag123",
      });

      const found = await secretsRepo.findByUserIdAndName("user-1", "API_KEY");
      expect(found?.id).toBe("secret-1");
    });

    it("should return null for non-existent secret", async () => {
      const found = await secretsRepo.findByUserIdAndName("user-1", "NO_KEY");
      expect(found).toBeNull();
    });
  });

  describe("listByUserId", () => {
    it("should list all secrets for a user", async () => {
      await userRepo.create({ id: "user-1", email: "test@example.com" });
      await secretsRepo.create({
        id: "secret-1",
        userId: "user-1",
        name: "KEY_1",
        encryptedValue: "enc1",
        iv: "iv1",
        authTag: "tag1",
      });
      await secretsRepo.create({
        id: "secret-2",
        userId: "user-1",
        name: "KEY_2",
        encryptedValue: "enc2",
        iv: "iv2",
        authTag: "tag2",
      });

      const secrets = await secretsRepo.listByUserId("user-1");
      expect(secrets).toHaveLength(2);
    });
  });

  describe("upsert", () => {
    it("should create new secret if not exists", async () => {
      await userRepo.create({ id: "user-1", email: "test@example.com" });

      const secret = await secretsRepo.upsert({
        id: "secret-1",
        userId: "user-1",
        name: "NEW_KEY",
        encryptedValue: "enc",
        iv: "iv",
        authTag: "tag",
      });

      expect(secret.name).toBe("NEW_KEY");
    });

    it("should update existing secret", async () => {
      await userRepo.create({ id: "user-1", email: "test@example.com" });
      await secretsRepo.create({
        id: "secret-1",
        userId: "user-1",
        name: "KEY",
        encryptedValue: "old",
        iv: "iv",
        authTag: "tag",
      });

      await secretsRepo.upsert({
        id: "secret-2",
        userId: "user-1",
        name: "KEY",
        encryptedValue: "new",
        iv: "newiv",
        authTag: "newtag",
      });

      const found = await secretsRepo.findByUserIdAndName("user-1", "KEY");
      expect(found?.encryptedValue).toBe("new");
    });
  });

  describe("delete", () => {
    it("should delete secret by id", async () => {
      await userRepo.create({ id: "user-1", email: "test@example.com" });
      await secretsRepo.create({
        id: "secret-1",
        userId: "user-1",
        name: "KEY",
        encryptedValue: "enc",
        iv: "iv",
        authTag: "tag",
      });

      await secretsRepo.delete("secret-1");
      const found = await secretsRepo.findById("secret-1");
      expect(found).toBeNull();
    });
  });

  describe("deleteByUserIdAndName", () => {
    it("should delete secret by user and name", async () => {
      await userRepo.create({ id: "user-1", email: "test@example.com" });
      await secretsRepo.create({
        id: "secret-1",
        userId: "user-1",
        name: "KEY",
        encryptedValue: "enc",
        iv: "iv",
        authTag: "tag",
      });

      await secretsRepo.deleteByUserIdAndName("user-1", "KEY");
      const found = await secretsRepo.findByUserIdAndName("user-1", "KEY");
      expect(found).toBeNull();
    });
  });

  describe("deleteAllForUser", () => {
    it("should delete all secrets for a user", async () => {
      await userRepo.create({ id: "user-1", email: "test@example.com" });
      await secretsRepo.create({
        id: "s1",
        userId: "user-1",
        name: "K1",
        encryptedValue: "e",
        iv: "i",
        authTag: "t",
      });
      await secretsRepo.create({
        id: "s2",
        userId: "user-1",
        name: "K2",
        encryptedValue: "e",
        iv: "i",
        authTag: "t",
      });

      await secretsRepo.deleteAllForUser("user-1");
      const secrets = await secretsRepo.listByUserId("user-1");
      expect(secrets).toHaveLength(0);
    });
  });
});
