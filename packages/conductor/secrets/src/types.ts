/**
 * Secrets Management Types
 */

export type SecretsProvider = "doppler" | "google" | "cloudflare" | "env";

export interface SecretValue {
  name: string;
  value: string;
  version?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface SecretsConfig {
  /** Provider to use (default: doppler) */
  provider: SecretsProvider;

  /** Doppler configuration */
  doppler?: DopplerConfig;

  /** Google Secret Manager configuration */
  google?: GoogleSecretConfig;

  /** Cloudflare configuration */
  cloudflare?: CloudflareConfig;

  /** Cache TTL in seconds (default: 300) */
  cacheTtlSeconds?: number;

  /** Enable caching (default: true) */
  cacheEnabled?: boolean;
}

export interface DopplerConfig {
  /** Doppler service token (dp.st.xxx) or personal token */
  token: string;

  /** Project name */
  project?: string;

  /** Config/environment name (e.g., 'dev', 'staging', 'production') */
  config?: string;
}

export interface GoogleSecretConfig {
  /** GCP project ID */
  projectId: string;

  /** Path to service account key file (optional if using ADC) */
  keyFilePath?: string;
}

export interface CloudflareConfig {
  /** Cloudflare account ID */
  accountId: string;

  /** Cloudflare API token with Workers KV access */
  apiToken: string;

  /** KV namespace ID for secrets */
  namespaceId: string;
}

export interface SecretsClient {
  /** Get a single secret by name */
  get(name: string): Promise<string | undefined>;

  /** Get multiple secrets by names */
  getMany(names: string[]): Promise<Record<string, string>>;

  /** Get all secrets */
  getAll(): Promise<Record<string, string>>;

  /** Check if a secret exists */
  has(name: string): Promise<boolean>;

  /** Clear the cache */
  clearCache(): void;

  /** Get the provider name */
  getProvider(): SecretsProvider;
}

/**
 * Well-known secret names used by Conductor
 */
export const CONDUCTOR_SECRETS = {
  // LLM Provider Keys
  ANTHROPIC_API_KEY: "ANTHROPIC_API_KEY",
  OPENAI_API_KEY: "OPENAI_API_KEY",
  GOOGLE_AI_API_KEY: "GOOGLE_AI_API_KEY",
  ZAI_API_KEY: "ZAI_API_KEY",

  // Infrastructure
  E2B_API_KEY: "E2B_API_KEY",
  GITHUB_TOKEN: "GITHUB_TOKEN",

  // Database
  CONDUCTOR_DATABASE_URL: "CONDUCTOR_DATABASE_URL",

  // Firebase
  FIREBASE_PROJECT_ID: "FIREBASE_PROJECT_ID",
  FIREBASE_API_KEY: "FIREBASE_API_KEY",
  FIREBASE_SERVICE_ACCOUNT: "FIREBASE_SERVICE_ACCOUNT",

  // Cloudflare
  CF_ACCOUNT_ID: "CF_ACCOUNT_ID",
  CF_API_TOKEN: "CF_API_TOKEN",
} as const;

export type ConductorSecretName =
  (typeof CONDUCTOR_SECRETS)[keyof typeof CONDUCTOR_SECRETS];
