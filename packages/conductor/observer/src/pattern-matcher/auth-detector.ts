import { BaseDetector } from "./detector.js";
import type { DetectionEvent, AuthRequiredEvent } from "../types.js";

interface ProviderPattern {
  provider: string;
  patterns: RegExp[];
}

export class AuthDetector extends BaseDetector {
  readonly name = "auth";

  private readonly providerPatterns: ProviderPattern[] = [
    {
      provider: "anthropic",
      patterns: [/console\.anthropic\.com\/oauth/i, /claude\.ai\/oauth/i],
    },
    {
      provider: "google",
      patterns: [
        /accounts\.google\.com\/o\/oauth/i,
        /accounts\.google\.com\/signin/i,
      ],
    },
    {
      provider: "openai",
      patterns: [/auth\.openai\.com/i, /platform\.openai\.com\/login/i],
    },
    {
      provider: "github",
      patterns: [/github\.com\/login\/oauth/i, /github\.com\/login\/device/i],
    },
  ];

  private readonly genericAuthPatterns = [
    /authentication required/i,
    /please (log ?in|sign ?in|authenticate)/i,
    /session expired/i,
    /unauthorized.*please/i,
  ];

  private readonly urlPattern = /https?:\/\/[^\s'"<>)]+/g;

  protected doProcess(
    agentId: string,
    sandboxId: string,
    line: string,
  ): DetectionEvent | null {
    if (!line.trim()) return null;

    // Check provider-specific patterns
    for (const { provider, patterns } of this.providerPatterns) {
      for (const pattern of patterns) {
        if (pattern.test(line)) {
          const urls = line.match(this.urlPattern);
          const authUrl = urls?.find((url) => pattern.test(url));

          return this.createEvent(agentId, sandboxId, provider, authUrl);
        }
      }
    }

    // Check generic auth patterns
    for (const pattern of this.genericAuthPatterns) {
      if (pattern.test(line)) {
        return this.createEvent(agentId, sandboxId, "unknown");
      }
    }

    return null;
  }

  private createEvent(
    agentId: string,
    sandboxId: string,
    provider: string,
    authUrl?: string,
  ): AuthRequiredEvent {
    return {
      type: "auth_required",
      agentId,
      sandboxId,
      timestamp: new Date(),
      provider,
      authUrl,
    };
  }
}
