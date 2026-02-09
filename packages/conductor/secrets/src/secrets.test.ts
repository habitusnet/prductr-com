/**
 * Secrets Package Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  EnvProvider,
  createSecretsClient,
  createSecretsClientFromEnv,
  detectSecretsProvider,
  CONDUCTOR_SECRETS,
} from "./index.js";

describe("Secrets Package", () => {
  describe("CONDUCTOR_SECRETS", () => {
    it("should define all expected secret names", () => {
      expect(CONDUCTOR_SECRETS.ANTHROPIC_API_KEY).toBe("ANTHROPIC_API_KEY");
      expect(CONDUCTOR_SECRETS.OPENAI_API_KEY).toBe("OPENAI_API_KEY");
      expect(CONDUCTOR_SECRETS.ZAI_API_KEY).toBe("ZAI_API_KEY");
      expect(CONDUCTOR_SECRETS.E2B_API_KEY).toBe("E2B_API_KEY");
      expect(CONDUCTOR_SECRETS.GITHUB_TOKEN).toBe("GITHUB_TOKEN");
    });
  });

  describe("EnvProvider", () => {
    const originalEnv = process.env;

    beforeEach(() => {
      process.env = { ...originalEnv };
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    it("should get a secret from environment", async () => {
      process.env.TEST_SECRET = "test-value";
      const provider = new EnvProvider();

      const value = await provider.get("TEST_SECRET");
      expect(value).toBe("test-value");
    });

    it("should return undefined for missing secret", async () => {
      const provider = new EnvProvider();
      const value = await provider.get("NONEXISTENT_SECRET");
      expect(value).toBeUndefined();
    });

    it("should get multiple secrets", async () => {
      process.env.SECRET_A = "value-a";
      process.env.SECRET_B = "value-b";
      const provider = new EnvProvider();

      const secrets = await provider.getMany(["SECRET_A", "SECRET_B", "SECRET_C"]);
      expect(secrets).toEqual({
        SECRET_A: "value-a",
        SECRET_B: "value-b",
      });
    });

    it("should check if secret exists", async () => {
      process.env.EXISTS = "yes";
      const provider = new EnvProvider();

      expect(await provider.has("EXISTS")).toBe(true);
      expect(await provider.has("NOT_EXISTS")).toBe(false);
    });

    it("should support prefix", async () => {
      process.env.APP_SECRET = "prefixed-value";
      const provider = new EnvProvider("APP_");

      const value = await provider.get("SECRET");
      expect(value).toBe("prefixed-value");
    });

    it("should return provider name", () => {
      const provider = new EnvProvider();
      expect(provider.getProvider()).toBe("env");
    });
  });

  describe("createSecretsClient", () => {
    it("should create env provider", () => {
      const client = createSecretsClient({ provider: "env" });
      expect(client.getProvider()).toBe("env");
    });

    it("should throw for doppler without config", () => {
      expect(() =>
        createSecretsClient({ provider: "doppler" }),
      ).toThrow("Doppler configuration is required");
    });

    it("should throw for google without config", () => {
      expect(() =>
        createSecretsClient({ provider: "google" }),
      ).toThrow("Google configuration is required");
    });

    it("should throw for cloudflare without config", () => {
      expect(() =>
        createSecretsClient({ provider: "cloudflare" }),
      ).toThrow("Cloudflare configuration is required");
    });

    it("should throw for unknown provider", () => {
      expect(() =>
        createSecretsClient({ provider: "unknown" as any }),
      ).toThrow("Unknown secrets provider");
    });
  });

  describe("detectSecretsProvider", () => {
    const originalEnv = process.env;

    beforeEach(() => {
      process.env = { ...originalEnv };
      // Clear all provider-related env vars
      delete process.env.DOPPLER_TOKEN;
      delete process.env.GOOGLE_CLOUD_PROJECT;
      delete process.env.GCP_PROJECT_ID;
      delete process.env.FIREBASE_PROJECT_ID;
      delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
      delete process.env.CF_ACCOUNT_ID;
      delete process.env.CF_API_TOKEN;
      delete process.env.CF_KV_NAMESPACE_ID;
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    it("should detect doppler when DOPPLER_TOKEN is set", () => {
      process.env.DOPPLER_TOKEN = "dp.st.xxx";
      expect(detectSecretsProvider()).toBe("doppler");
    });

    it("should detect google when GCP credentials are set", () => {
      process.env.GOOGLE_CLOUD_PROJECT = "my-project";
      process.env.GOOGLE_APPLICATION_CREDENTIALS = "/path/to/key.json";
      expect(detectSecretsProvider()).toBe("google");
    });

    it("should detect cloudflare when CF vars are set", () => {
      process.env.CF_ACCOUNT_ID = "account123";
      process.env.CF_API_TOKEN = "token123";
      process.env.CF_KV_NAMESPACE_ID = "namespace123";
      expect(detectSecretsProvider()).toBe("cloudflare");
    });

    it("should fallback to env when nothing is configured", () => {
      expect(detectSecretsProvider()).toBe("env");
    });

    it("should prefer doppler over other providers", () => {
      process.env.DOPPLER_TOKEN = "dp.st.xxx";
      process.env.GOOGLE_CLOUD_PROJECT = "my-project";
      process.env.GOOGLE_APPLICATION_CREDENTIALS = "/path/to/key.json";
      expect(detectSecretsProvider()).toBe("doppler");
    });
  });

  describe("createSecretsClientFromEnv", () => {
    const originalEnv = process.env;
    const originalWarn = console.warn;

    beforeEach(() => {
      process.env = { ...originalEnv };
      console.warn = vi.fn();
      // Clear all provider-related env vars
      delete process.env.DOPPLER_TOKEN;
      delete process.env.GOOGLE_CLOUD_PROJECT;
      delete process.env.GCP_PROJECT_ID;
      delete process.env.FIREBASE_PROJECT_ID;
      delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
      delete process.env.CF_ACCOUNT_ID;
      delete process.env.CF_API_TOKEN;
      delete process.env.CF_KV_NAMESPACE_ID;
    });

    afterEach(() => {
      process.env = originalEnv;
      console.warn = originalWarn;
    });

    it("should create doppler client when token is set", () => {
      process.env.DOPPLER_TOKEN = "dp.st.xxx";
      const client = createSecretsClientFromEnv();
      expect(client.getProvider()).toBe("doppler");
    });

    it("should fallback to env and warn when nothing configured", () => {
      const client = createSecretsClientFromEnv();
      expect(client.getProvider()).toBe("env");
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining("falling back to environment variables"),
      );
    });
  });
});
