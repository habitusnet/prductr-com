/**
 * Environment Variables Provider
 *
 * Fallback provider that reads secrets from process.env.
 * Used when no external secrets manager is configured.
 *
 * WARNING: Environment variables are not encrypted at rest
 * and may be logged. Use only for development or when
 * secrets are injected by the deployment platform.
 */

import type { SecretsClient, SecretsProvider } from "../types.js";

export class EnvProvider implements SecretsClient {
  private prefix: string;

  constructor(prefix = "") {
    this.prefix = prefix;
  }

  getProvider(): SecretsProvider {
    return "env";
  }

  async get(name: string): Promise<string | undefined> {
    const key = this.prefix ? `${this.prefix}${name}` : name;
    return process.env[key];
  }

  async getMany(names: string[]): Promise<Record<string, string>> {
    const result: Record<string, string> = {};

    for (const name of names) {
      const value = await this.get(name);
      if (value !== undefined) {
        result[name] = value;
      }
    }

    return result;
  }

  async getAll(): Promise<Record<string, string>> {
    const result: Record<string, string> = {};

    for (const [key, value] of Object.entries(process.env)) {
      if (value !== undefined) {
        if (this.prefix) {
          if (key.startsWith(this.prefix)) {
            result[key.slice(this.prefix.length)] = value;
          }
        } else {
          result[key] = value;
        }
      }
    }

    return result;
  }

  async has(name: string): Promise<boolean> {
    const value = await this.get(name);
    return value !== undefined;
  }

  clearCache(): void {
    // No-op - env vars don't need caching
  }
}

/**
 * Create an environment provider
 */
export function createEnvProvider(prefix = ""): EnvProvider {
  return new EnvProvider(prefix);
}
