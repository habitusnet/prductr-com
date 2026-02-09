/**
 * Z.ai Connector
 * Anthropic-compatible API proxy for GLM-4.7 models via z.ai
 *
 * Z.ai provides cost-effective subscription-based pricing ($3-99/month)
 * that works with existing tools like Claude Code, Cline, Roo Code, etc.
 *
 * Integration: Z.ai acts as a drop-in replacement for Anthropic's API:
 * - Set ANTHROPIC_BASE_URL=https://api.z.ai/api/anthropic
 * - Set ANTHROPIC_AUTH_TOKEN=your_zai_api_key
 *
 * Model mapping (automatic):
 * - claude-opus-4 -> GLM-4.7
 * - claude-sonnet-4 -> GLM-4.7
 * - claude-haiku -> GLM-4.5-Air
 *
 * @see https://docs.z.ai/devpack/tool/claude
 */

import type { Connector } from "./index.js";

export interface ZaiConfig {
  apiKey: string;
  model?: string;
  baseUrl?: string;
}

// Anthropic-compatible message format
interface AnthropicMessage {
  role: "user" | "assistant";
  content: string;
}

interface AnthropicResponse {
  id: string;
  type: "message";
  role: "assistant";
  content: Array<{ type: "text"; text: string }>;
  model: string;
  stop_reason: string;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

export class ZaiConnector implements Connector {
  name = "Z.ai";
  type = "zai";
  private apiKey: string | null = null;
  private config: ZaiConfig;

  constructor(config: ZaiConfig) {
    this.config = {
      model: "claude-sonnet-4-20250514", // Maps to GLM-4.7 via z.ai
      baseUrl: "https://api.z.ai/api/anthropic",
      ...config,
    };
  }

  isConnected(): boolean {
    return this.apiKey !== null;
  }

  async connect(): Promise<void> {
    this.apiKey = this.config.apiKey;
    if (!this.apiKey || this.apiKey.length < 10) {
      this.apiKey = null;
      throw new Error("Invalid Z.ai API key format");
    }
  }

  async disconnect(): Promise<void> {
    this.apiKey = null;
  }

  /**
   * Send message using Anthropic-compatible API format
   */
  async sendMessage(
    messages: AnthropicMessage[],
    system?: string,
  ) {
    if (!this.apiKey) throw new Error("Not connected");

    const response = await fetch(
      `${this.config.baseUrl}/v1/messages`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": this.apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: this.config.model,
          max_tokens: 4096,
          system,
          messages,
        }),
      },
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Z.ai API error: ${response.status} - ${error}`);
    }

    const data = (await response.json()) as AnthropicResponse;

    return {
      content: data.content[0]?.text || "",
      usage: {
        inputTokens: data.usage?.input_tokens || 0,
        outputTokens: data.usage?.output_tokens || 0,
      },
      finishReason: data.stop_reason,
      model: data.model,
    };
  }

  async analyzeTask(taskDescription: string, projectContext: string) {
    return this.sendMessage(
      [
        {
          role: "user",
          content: `Analyze this task and provide an estimate:\n\nTask: ${taskDescription}\n\nProject Context:\n${projectContext}`,
        },
      ],
      "You are a task analysis assistant. Analyze the given task and provide: 1) Estimated complexity (low/medium/high), 2) Estimated tokens needed, 3) Required capabilities, 4) Potential risks or blockers.",
    );
  }

  async generateCode(prompt: string, language: string) {
    return this.sendMessage(
      [{ role: "user", content: prompt }],
      `You are an expert ${language} developer. Generate clean, well-documented code following best practices.`,
    );
  }

  async reviewCode(code: string, language: string) {
    return this.sendMessage(
      [{ role: "user", content: `Review this ${language} code:\n\n${code}` }],
      `You are an expert code reviewer specializing in ${language}. Review the code for bugs, security issues, and best practices.`,
    );
  }

  getCostEstimate(_inputTokens: number, _outputTokens: number): number {
    // Z.ai uses subscription pricing - effectively $0/token within plan limits
    // Lite: ~120 prompts/5hrs ($3/mo), Pro: ~600 prompts/5hrs ($15/mo)
    return 0;
  }

  /**
   * Get subscription plan info
   */
  static getPlans(): Array<{
    name: string;
    price: number;
    promptsPer5Hours: number;
  }> {
    return [
      { name: "Lite", price: 3, promptsPer5Hours: 120 },
      { name: "Pro", price: 15, promptsPer5Hours: 600 },
      { name: "Max", price: 99, promptsPer5Hours: 2400 },
    ];
  }

  /**
   * Get environment variables for Claude Code integration
   */
  static getClaudeCodeEnv(apiKey: string): Record<string, string> {
    return {
      ANTHROPIC_AUTH_TOKEN: apiKey,
      ANTHROPIC_BASE_URL: "https://api.z.ai/api/anthropic",
      API_TIMEOUT_MS: "3000000",
    };
  }
}

// Re-export with old name for backwards compatibility
export { ZaiConnector as ZencoderConnector };
export type { ZaiConfig as ZencoderConfig };
