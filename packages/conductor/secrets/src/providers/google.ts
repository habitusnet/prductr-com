/**
 * Google Secret Manager Provider
 *
 * Fallback secrets provider using Google Cloud Secret Manager.
 * Also works with Firebase projects that have Secret Manager enabled.
 *
 * @see https://cloud.google.com/secret-manager/docs/reference/libraries
 */

import type { GoogleSecretConfig, SecretsClient, SecretsProvider } from "../types.js";

// Lazy import to avoid requiring the dependency when not used
let SecretManagerServiceClient: typeof import("@google-cloud/secret-manager").SecretManagerServiceClient;

export class GoogleSecretProvider implements SecretsClient {
  private config: GoogleSecretConfig;
  private client: InstanceType<typeof SecretManagerServiceClient> | null = null;
  private cache: Map<string, { value: string; expiresAt: number }> = new Map();
  private cacheTtl: number;

  constructor(config: GoogleSecretConfig, cacheTtlSeconds = 300) {
    this.config = config;
    this.cacheTtl = cacheTtlSeconds * 1000;
  }

  getProvider(): SecretsProvider {
    return "google";
  }

  private async getClient(): Promise<InstanceType<typeof SecretManagerServiceClient>> {
    if (this.client) return this.client;

    // Lazy load the SDK
    if (!SecretManagerServiceClient) {
      const module = await import("@google-cloud/secret-manager");
      SecretManagerServiceClient = module.SecretManagerServiceClient;
    }

    const options: { projectId: string; keyFilename?: string } = {
      projectId: this.config.projectId,
    };

    if (this.config.keyFilePath) {
      options.keyFilename = this.config.keyFilePath;
    }

    this.client = new SecretManagerServiceClient(options);
    return this.client;
  }

  async get(name: string): Promise<string | undefined> {
    // Check cache first
    const cached = this.cache.get(name);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value;
    }

    try {
      const client = await this.getClient();
      const secretName = `projects/${this.config.projectId}/secrets/${name}/versions/latest`;

      const [version] = await client.accessSecretVersion({ name: secretName });
      const payload = version.payload?.data;

      if (!payload) return undefined;

      const value =
        typeof payload === "string"
          ? payload
          : Buffer.from(payload).toString("utf8");

      // Cache the value
      this.cache.set(name, {
        value,
        expiresAt: Date.now() + this.cacheTtl,
      });

      return value;
    } catch (error) {
      // Return undefined for not found errors
      if (error instanceof Error && error.message.includes("NOT_FOUND")) {
        return undefined;
      }
      throw error;
    }
  }

  async getMany(names: string[]): Promise<Record<string, string>> {
    const results = await Promise.all(
      names.map(async (name) => {
        const value = await this.get(name);
        return [name, value] as const;
      }),
    );

    const result: Record<string, string> = {};
    for (const [name, value] of results) {
      if (value !== undefined) {
        result[name] = value;
      }
    }

    return result;
  }

  async getAll(): Promise<Record<string, string>> {
    const client = await this.getClient();
    const parent = `projects/${this.config.projectId}`;

    const [secrets] = await client.listSecrets({ parent });
    const names = secrets
      .map((s) => s.name?.split("/").pop())
      .filter((n): n is string => !!n);

    return this.getMany(names);
  }

  async has(name: string): Promise<boolean> {
    const value = await this.get(name);
    return value !== undefined;
  }

  clearCache(): void {
    this.cache.clear();
  }
}

/**
 * Create a Google Secret Manager provider from environment variables
 */
export function createGoogleFromEnv(): GoogleSecretProvider {
  const projectId =
    process.env.GOOGLE_CLOUD_PROJECT ||
    process.env.GCP_PROJECT_ID ||
    process.env.FIREBASE_PROJECT_ID;

  if (!projectId) {
    throw new Error(
      "GOOGLE_CLOUD_PROJECT, GCP_PROJECT_ID, or FIREBASE_PROJECT_ID environment variable is required",
    );
  }

  return new GoogleSecretProvider({
    projectId,
    keyFilePath: process.env.GOOGLE_APPLICATION_CREDENTIALS,
  });
}
