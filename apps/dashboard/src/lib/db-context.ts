/**
 * Database context for user-scoped operations (secrets, user management)
 *
 * Uses @conductor/db (Drizzle) and @conductor/secrets for encrypted storage.
 */

import { getDb, createUserRepository, createUserSecretsRepository } from "@conductor/db";
import { createUserSecretsService, validateMasterKey, type UserSecretsService } from "@conductor/secrets";

let cachedContext: {
  userRepo: ReturnType<typeof createUserRepository>;
  secretsRepo: ReturnType<typeof createUserSecretsRepository>;
  userSecrets: UserSecretsService;
} | null = null;

/**
 * Get database context with user and secrets repositories.
 *
 * The master key must be set in USER_SECRETS_MASTER_KEY env var.
 */
export function getDatabaseContext() {
  if (cachedContext) {
    return cachedContext;
  }

  const masterKey = process.env.USER_SECRETS_MASTER_KEY;
  if (!masterKey) {
    throw new Error(
      "USER_SECRETS_MASTER_KEY environment variable is required for secrets management",
    );
  }

  if (!validateMasterKey(masterKey)) {
    throw new Error(
      "USER_SECRETS_MASTER_KEY must be a 32-byte base64-encoded string. Generate with: openssl rand -base64 32",
    );
  }

  const db = getDb();
  const userRepo = createUserRepository(db);
  const secretsRepo = createUserSecretsRepository(db);
  const userSecrets = createUserSecretsService(secretsRepo, masterKey);

  cachedContext = { userRepo, secretsRepo, userSecrets };
  return cachedContext;
}
