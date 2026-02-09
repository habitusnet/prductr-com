/**
 * @conductor/secrets
 *
 * Unified secrets management for Conductor with support for:
 * - Doppler (default)
 * - Google Secret Manager / Firebase
 * - Cloudflare Workers KV
 * - Environment variables (fallback)
 */

// Type exports
export type {
  SecretsProvider,
  SecretValue,
  SecretsConfig,
  DopplerConfig,
  GoogleSecretConfig,
  CloudflareConfig,
  SecretsClient,
  ConductorSecretName,
} from "./types.js";

export { CONDUCTOR_SECRETS } from "./types.js";

// Provider exports
export { DopplerProvider, createDopplerFromEnv } from "./providers/doppler.js";
export { GoogleSecretProvider, createGoogleFromEnv } from "./providers/google.js";
export { CloudflareProvider, createCloudflareFromEnv } from "./providers/cloudflare.js";
export { EnvProvider, createEnvProvider } from "./providers/env.js";

// Encryption utilities for user secrets
export {
  encrypt,
  decrypt,
  reencrypt,
  generateMasterKey,
  validateMasterKey,
  type EncryptedData,
  type EncryptionConfig,
} from "./encryption.js";

// User secrets service (combines encryption + DB storage)
export {
  createUserSecretsService,
  resolveSecret,
  type UserSecretsService,
  type UserSecretsRepository,
  type StoredSecret,
  type SecretResolutionOptions,
} from "./user-secrets.js";

import type { SecretsClient, SecretsConfig, SecretsProvider } from "./types.js";
import { DopplerProvider } from "./providers/doppler.js";
import { GoogleSecretProvider } from "./providers/google.js";
import { CloudflareProvider } from "./providers/cloudflare.js";
import { EnvProvider } from "./providers/env.js";

/**
 * Create a secrets client from configuration
 */
export function createSecretsClient(config: SecretsConfig): SecretsClient {
  const cacheTtl = config.cacheTtlSeconds ?? 300;

  switch (config.provider) {
    case "doppler":
      if (!config.doppler) {
        throw new Error("Doppler configuration is required when provider is 'doppler'");
      }
      return new DopplerProvider(config.doppler, cacheTtl);

    case "google":
      if (!config.google) {
        throw new Error("Google configuration is required when provider is 'google'");
      }
      return new GoogleSecretProvider(config.google, cacheTtl);

    case "cloudflare":
      if (!config.cloudflare) {
        throw new Error("Cloudflare configuration is required when provider is 'cloudflare'");
      }
      return new CloudflareProvider(config.cloudflare, cacheTtl);

    case "env":
      return new EnvProvider();

    default:
      throw new Error(`Unknown secrets provider: ${config.provider}`);
  }
}

/**
 * Auto-detect and create a secrets client from environment variables
 *
 * Detection order:
 * 1. Doppler (if DOPPLER_TOKEN is set)
 * 2. Google Secret Manager (if GOOGLE_CLOUD_PROJECT or GCP_PROJECT_ID is set)
 * 3. Cloudflare (if CF_ACCOUNT_ID and CF_KV_NAMESPACE_ID are set)
 * 4. Environment variables (fallback)
 */
export function createSecretsClientFromEnv(): SecretsClient {
  // Try Doppler first (our default)
  if (process.env.DOPPLER_TOKEN) {
    return new DopplerProvider({
      token: process.env.DOPPLER_TOKEN,
      project: process.env.DOPPLER_PROJECT,
      config: process.env.DOPPLER_CONFIG,
    });
  }

  // Try Google Secret Manager
  const gcpProject =
    process.env.GOOGLE_CLOUD_PROJECT ||
    process.env.GCP_PROJECT_ID ||
    process.env.FIREBASE_PROJECT_ID;

  if (gcpProject && process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    return new GoogleSecretProvider({
      projectId: gcpProject,
      keyFilePath: process.env.GOOGLE_APPLICATION_CREDENTIALS,
    });
  }

  // Try Cloudflare
  if (
    process.env.CF_ACCOUNT_ID &&
    process.env.CF_API_TOKEN &&
    (process.env.CF_KV_NAMESPACE_ID || process.env.CF_SECRETS_NAMESPACE_ID)
  ) {
    return new CloudflareProvider({
      accountId: process.env.CF_ACCOUNT_ID,
      apiToken: process.env.CF_API_TOKEN,
      namespaceId:
        process.env.CF_KV_NAMESPACE_ID || process.env.CF_SECRETS_NAMESPACE_ID || "",
    });
  }

  // Fallback to environment variables
  console.warn(
    "[secrets] No secrets provider configured, falling back to environment variables",
  );
  return new EnvProvider();
}

/**
 * Get the detected secrets provider type from environment
 */
export function detectSecretsProvider(): SecretsProvider {
  if (process.env.DOPPLER_TOKEN) return "doppler";

  const gcpProject =
    process.env.GOOGLE_CLOUD_PROJECT ||
    process.env.GCP_PROJECT_ID ||
    process.env.FIREBASE_PROJECT_ID;

  if (gcpProject && process.env.GOOGLE_APPLICATION_CREDENTIALS) return "google";

  if (
    process.env.CF_ACCOUNT_ID &&
    process.env.CF_API_TOKEN &&
    (process.env.CF_KV_NAMESPACE_ID || process.env.CF_SECRETS_NAMESPACE_ID)
  ) {
    return "cloudflare";
  }

  return "env";
}

// Default singleton instance (lazy initialized)
let defaultClient: SecretsClient | null = null;

/**
 * Get the default secrets client (auto-detected from environment)
 */
export function getSecretsClient(): SecretsClient {
  if (!defaultClient) {
    defaultClient = createSecretsClientFromEnv();
  }
  return defaultClient;
}

/**
 * Convenience function to get a single secret
 */
export async function getSecret(name: string): Promise<string | undefined> {
  return getSecretsClient().get(name);
}

/**
 * Convenience function to get multiple secrets
 */
export async function getSecrets(names: string[]): Promise<Record<string, string>> {
  return getSecretsClient().getMany(names);
}

/**
 * Convenience function to require a secret (throws if not found)
 */
export async function requireSecret(name: string): Promise<string> {
  const value = await getSecret(name);
  if (value === undefined) {
    throw new Error(`Required secret '${name}' not found`);
  }
  return value;
}
