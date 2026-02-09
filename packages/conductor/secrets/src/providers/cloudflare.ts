/**
 * Cloudflare Secrets Provider
 *
 * Uses Cloudflare Workers KV for secrets storage.
 * Suitable for edge deployments on Cloudflare Pages/Workers.
 *
 * @see https://developers.cloudflare.com/kv/api/
 */

import type { CloudflareConfig, SecretsClient, SecretsProvider } from "../types.js";

interface KVListResult {
  result: Array<{ name: string }>;
  success: boolean;
  errors: Array<{ message: string }>;
}

export class CloudflareProvider implements SecretsClient {
  private config: CloudflareConfig;
  private cache: Map<string, { value: string; expiresAt: number }> = new Map();
  private cacheTtl: number;
  private baseUrl: string;

  constructor(config: CloudflareConfig, cacheTtlSeconds = 300) {
    this.config = config;
    this.cacheTtl = cacheTtlSeconds * 1000;
    this.baseUrl = `https://api.cloudflare.com/client/v4/accounts/${config.accountId}/storage/kv/namespaces/${config.namespaceId}`;
  }

  getProvider(): SecretsProvider {
    return "cloudflare";
  }

  private get headers(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.config.apiToken}`,
      "Content-Type": "application/json",
    };
  }

  async get(name: string): Promise<string | undefined> {
    // Check cache first
    const cached = this.cache.get(name);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value;
    }

    try {
      const response = await fetch(`${this.baseUrl}/values/${encodeURIComponent(name)}`, {
        method: "GET",
        headers: this.headers,
      });

      if (response.status === 404) {
        return undefined;
      }

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Cloudflare KV error: ${response.status} - ${error}`);
      }

      const value = await response.text();

      // Cache the value
      this.cache.set(name, {
        value,
        expiresAt: Date.now() + this.cacheTtl,
      });

      return value;
    } catch (error) {
      if (error instanceof Error && error.message.includes("404")) {
        return undefined;
      }
      throw error;
    }
  }

  async getMany(names: string[]): Promise<Record<string, string>> {
    // Cloudflare KV doesn't have bulk read, so we fetch in parallel
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
    const response = await fetch(`${this.baseUrl}/keys`, {
      method: "GET",
      headers: this.headers,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Cloudflare KV error: ${response.status} - ${error}`);
    }

    const data = (await response.json()) as KVListResult;

    if (!data.success) {
      throw new Error(`Cloudflare KV error: ${data.errors.map((e) => e.message).join(", ")}`);
    }

    const names = data.result.map((item) => item.name);
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
 * Create a Cloudflare provider from environment variables
 */
export function createCloudflareFromEnv(): CloudflareProvider {
  const accountId = process.env.CF_ACCOUNT_ID;
  const apiToken = process.env.CF_API_TOKEN;
  const namespaceId = process.env.CF_KV_NAMESPACE_ID || process.env.CF_SECRETS_NAMESPACE_ID;

  if (!accountId || !apiToken || !namespaceId) {
    throw new Error(
      "CF_ACCOUNT_ID, CF_API_TOKEN, and CF_KV_NAMESPACE_ID environment variables are required",
    );
  }

  return new CloudflareProvider({
    accountId,
    apiToken,
    namespaceId,
  });
}
