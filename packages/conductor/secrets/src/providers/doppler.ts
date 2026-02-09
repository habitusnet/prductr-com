/**
 * Doppler Secrets Provider
 *
 * Default secrets provider for Conductor.
 * Uses Doppler's Node SDK for secure secret retrieval.
 *
 * @see https://docs.doppler.com/docs/sdk-javascript
 */

import type { DopplerConfig, SecretsClient, SecretsProvider } from "../types.js";

interface DopplerSecret {
  name: string;
  value: {
    raw: string;
    computed: string;
  };
}

interface DopplerSecretsResponse {
  secrets: Record<string, DopplerSecret>;
}

export class DopplerProvider implements SecretsClient {
  private config: DopplerConfig;
  private cache: Map<string, { value: string; expiresAt: number }> = new Map();
  private cacheTtl: number;
  private allSecretsCache: { secrets: Record<string, string>; expiresAt: number } | null = null;

  constructor(config: DopplerConfig, cacheTtlSeconds = 300) {
    this.config = config;
    this.cacheTtl = cacheTtlSeconds * 1000;
  }

  getProvider(): SecretsProvider {
    return "doppler";
  }

  async get(name: string): Promise<string | undefined> {
    // Check cache first
    const cached = this.cache.get(name);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value;
    }

    // Fetch all secrets (Doppler doesn't have single-secret endpoint for service tokens)
    const secrets = await this.getAll();
    return secrets[name];
  }

  async getMany(names: string[]): Promise<Record<string, string>> {
    const secrets = await this.getAll();
    const result: Record<string, string> = {};

    for (const name of names) {
      if (secrets[name] !== undefined) {
        result[name] = secrets[name];
      }
    }

    return result;
  }

  async getAll(): Promise<Record<string, string>> {
    // Check all-secrets cache
    if (this.allSecretsCache && this.allSecretsCache.expiresAt > Date.now()) {
      return this.allSecretsCache.secrets;
    }

    const secrets = await this.fetchSecrets();

    // Update caches
    this.allSecretsCache = {
      secrets,
      expiresAt: Date.now() + this.cacheTtl,
    };

    for (const [name, value] of Object.entries(secrets)) {
      this.cache.set(name, {
        value,
        expiresAt: Date.now() + this.cacheTtl,
      });
    }

    return secrets;
  }

  async has(name: string): Promise<boolean> {
    const value = await this.get(name);
    return value !== undefined;
  }

  clearCache(): void {
    this.cache.clear();
    this.allSecretsCache = null;
  }

  private async fetchSecrets(): Promise<Record<string, string>> {
    const baseUrl = "https://api.doppler.com/v3";
    const endpoint = `${baseUrl}/configs/config/secrets`;

    const params = new URLSearchParams();
    if (this.config.project) params.set("project", this.config.project);
    if (this.config.config) params.set("config", this.config.config);

    const url = params.toString() ? `${endpoint}?${params}` : endpoint;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${this.config.token}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Doppler API error: ${response.status} - ${error}`);
    }

    const data = (await response.json()) as DopplerSecretsResponse;

    // Transform Doppler response to simple key-value pairs
    const result: Record<string, string> = {};
    for (const [name, secret] of Object.entries(data.secrets)) {
      result[name] = secret.value?.computed ?? secret.value?.raw ?? "";
    }

    return result;
  }
}

/**
 * Create a Doppler provider from environment variables
 */
export function createDopplerFromEnv(): DopplerProvider {
  const token = process.env.DOPPLER_TOKEN;
  if (!token) {
    throw new Error("DOPPLER_TOKEN environment variable is required");
  }

  return new DopplerProvider({
    token,
    project: process.env.DOPPLER_PROJECT,
    config: process.env.DOPPLER_CONFIG,
  });
}
