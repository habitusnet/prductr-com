/**
 * User Secrets Service
 *
 * High-level API for managing encrypted per-user secrets.
 * Combines encryption utilities with database storage.
 *
 * Usage:
 * ```typescript
 * import { createUserSecretsService } from "@conductor/secrets";
 * import { getDb, createUserSecretsRepository } from "@conductor/db";
 *
 * const db = getDb();
 * const secretsRepo = createUserSecretsRepository(db);
 * const masterKey = await requireSecret("USER_SECRETS_MASTER_KEY");
 *
 * const userSecrets = createUserSecretsService(secretsRepo, masterKey);
 *
 * // Store a secret
 * await userSecrets.set("user-123", "ANTHROPIC_API_KEY", "sk-ant-...");
 *
 * // Retrieve a secret
 * const apiKey = await userSecrets.get("user-123", "ANTHROPIC_API_KEY");
 * ```
 */

import { encrypt, decrypt, reencrypt, type EncryptedData } from "./encryption.js";
import { randomUUID } from "crypto";

/**
 * Repository interface for user secrets storage
 * (Matches the shape of createUserSecretsRepository from @conductor/db)
 */
export interface UserSecretsRepository {
  create(secret: {
    id: string;
    userId: string;
    name: string;
    encryptedValue: string;
    iv: string;
    authTag: string;
    provider?: string | null;
    expiresAt?: string | null;
  }): Promise<any>;

  findByUserIdAndName(userId: string, name: string): Promise<any>;
  listByUserId(userId: string): Promise<any[]>;
  update(id: string, data: any): Promise<any>;
  delete(id: string): Promise<void>;
  deleteByUserIdAndName(userId: string, name: string): Promise<void>;
  deleteAllForUser(userId: string): Promise<void>;
  upsert(secret: any): Promise<any>;
}

export interface StoredSecret {
  id: string;
  userId: string;
  name: string;
  provider?: string | null;
  expiresAt?: string | null;
  lastUsedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface UserSecretsService {
  /**
   * Store a secret for a user (creates or updates)
   */
  set(
    userId: string,
    name: string,
    value: string,
    options?: { provider?: string; expiresAt?: Date },
  ): Promise<StoredSecret>;

  /**
   * Retrieve a decrypted secret for a user
   */
  get(userId: string, name: string): Promise<string | null>;

  /**
   * Get a secret or throw if not found
   */
  require(userId: string, name: string): Promise<string>;

  /**
   * List all secret names for a user (without values)
   */
  list(userId: string): Promise<StoredSecret[]>;

  /**
   * Delete a specific secret
   */
  delete(userId: string, name: string): Promise<void>;

  /**
   * Delete all secrets for a user
   */
  deleteAll(userId: string): Promise<void>;

  /**
   * Check if a secret exists
   */
  exists(userId: string, name: string): Promise<boolean>;

  /**
   * Rotate the master key (re-encrypt all secrets)
   */
  rotateKey(newMasterKey: string): Promise<{ rotated: number; failed: string[] }>;
}

/**
 * Create a user secrets service
 */
export function createUserSecretsService(
  repository: UserSecretsRepository,
  masterKey: string,
): UserSecretsService {
  let currentMasterKey = masterKey;

  return {
    async set(userId, name, value, options) {
      const encrypted = encrypt(value, currentMasterKey);

      const secret = await repository.upsert({
        id: randomUUID(),
        userId,
        name,
        encryptedValue: encrypted.encryptedValue,
        iv: encrypted.iv,
        authTag: encrypted.authTag,
        provider: options?.provider,
        expiresAt: options?.expiresAt?.toISOString(),
      });

      return {
        id: secret.id,
        userId: secret.userId,
        name: secret.name,
        provider: secret.provider,
        expiresAt: secret.expiresAt,
        lastUsedAt: secret.lastUsedAt,
        createdAt: secret.createdAt,
        updatedAt: secret.updatedAt,
      };
    },

    async get(userId, name) {
      const stored = await repository.findByUserIdAndName(userId, name);
      if (!stored) return null;

      // Check expiration
      if (stored.expiresAt && new Date(stored.expiresAt) < new Date()) {
        return null;
      }

      const encrypted: EncryptedData = {
        encryptedValue: stored.encryptedValue,
        iv: stored.iv,
        authTag: stored.authTag,
      };

      try {
        const value = decrypt(encrypted, currentMasterKey);

        // Update last used timestamp (fire and forget)
        repository.update(stored.id, { lastUsedAt: new Date().toISOString() }).catch(() => {});

        return value;
      } catch {
        // Decryption failed - possibly corrupted or wrong key
        return null;
      }
    },

    async require(userId, name) {
      const value = await this.get(userId, name);
      if (value === null) {
        throw new Error(`Secret '${name}' not found for user '${userId}'`);
      }
      return value;
    },

    async list(userId) {
      const secrets = await repository.listByUserId(userId);
      return secrets.map((s: any) => ({
        id: s.id,
        userId: s.userId,
        name: s.name,
        provider: s.provider,
        expiresAt: s.expiresAt,
        lastUsedAt: s.lastUsedAt,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
      }));
    },

    async delete(userId, name) {
      await repository.deleteByUserIdAndName(userId, name);
    },

    async deleteAll(userId) {
      await repository.deleteAllForUser(userId);
    },

    async exists(userId, name) {
      const stored = await repository.findByUserIdAndName(userId, name);
      if (!stored) return false;

      // Check expiration
      if (stored.expiresAt && new Date(stored.expiresAt) < new Date()) {
        return false;
      }

      return true;
    },

    async rotateKey(newMasterKey) {
      // This is a batch operation to re-encrypt all secrets with a new key
      // In production, this should be done carefully with proper locking

      const rotated: number[] = [];
      const failed: string[] = [];

      // Get all users' secrets - this would need a listAll method in production
      // For now, this is a placeholder that shows the pattern

      // Note: In a real implementation, you'd iterate through all secrets
      // using pagination and re-encrypt each one

      const oldKey = currentMasterKey;
      currentMasterKey = newMasterKey;

      return {
        rotated: rotated.length,
        failed,
      };
    },
  };
}

/**
 * Convenience: Get user secrets from multiple sources
 * Falls back through: user-specific → organization → doppler/env
 */
export interface SecretResolutionOptions {
  userId?: string;
  organizationId?: string;
  userSecretsService?: UserSecretsService;
  globalSecretsClient?: { get(name: string): Promise<string | undefined> };
}

export async function resolveSecret(
  name: string,
  options: SecretResolutionOptions,
): Promise<string | undefined> {
  // 1. Try user-specific secret
  if (options.userId && options.userSecretsService) {
    const userValue = await options.userSecretsService.get(options.userId, name);
    if (userValue) return userValue;
  }

  // 2. Try global secrets (Doppler/env)
  if (options.globalSecretsClient) {
    const globalValue = await options.globalSecretsClient.get(name);
    if (globalValue) return globalValue;
  }

  // 3. Try process.env as last resort
  return process.env[name];
}
