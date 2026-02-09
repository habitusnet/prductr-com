// Connector exports
import { GitHubConnector, type GitHubConfig } from "./github";
import { ClaudeConnector, type ClaudeConfig } from "./claude";
import { GeminiConnector, type GeminiConfig } from "./gemini";
import { OpenAIConnector, type OpenAIConfig } from "./openai";
import { WebhookConnector, type WebhookConfig } from "./webhook";
import { ZaiConnector, type ZaiConfig } from "./zencoder";

export { GitHubConnector, type GitHubConfig } from "./github";
export { ClaudeConnector, type ClaudeConfig } from "./claude";
export { GeminiConnector, type GeminiConfig } from "./gemini";
export { OpenAIConnector, type OpenAIConfig } from "./openai";
export { WebhookConnector, type WebhookConfig } from "./webhook";
export {
  ZaiConnector,
  ZencoderConnector, // Backwards compatibility alias
  type ZaiConfig,
  type ZencoderConfig, // Backwards compatibility alias
} from "./zencoder";

// Base connector interface
export interface Connector {
  name: string;
  type: string;
  isConnected(): boolean;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
}

// Connector factory
export function createConnector(
  type: string,
  config: Record<string, unknown>,
): Connector {
  switch (type) {
    case "github":
      return new GitHubConnector(config as unknown as GitHubConfig);
    case "claude":
      return new ClaudeConnector(config as unknown as ClaudeConfig);
    case "gemini":
      return new GeminiConnector(config as unknown as GeminiConfig);
    case "openai":
      return new OpenAIConnector(config as unknown as OpenAIConfig);
    case "webhook":
      return new WebhookConnector(config as unknown as WebhookConfig);
    case "zai":
    case "zencoder": // Backwards compatibility
      return new ZaiConnector(config as unknown as ZaiConfig);
    default:
      throw new Error(`Unknown connector type: ${type}`);
  }
}
