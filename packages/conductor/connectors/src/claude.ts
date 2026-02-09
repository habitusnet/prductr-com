import Anthropic from "@anthropic-ai/sdk";
import type { Connector } from "./index";

export interface ClaudeConfig {
  apiKey: string;
  model?: string;
  maxTokens?: number;
}

export class ClaudeConnector implements Connector {
  name = "Claude";
  type = "claude";
  private client: Anthropic | null = null;
  private config: ClaudeConfig;

  constructor(config: ClaudeConfig) {
    this.config = {
      model: "claude-sonnet-4-20250514",
      maxTokens: 4096,
      ...config,
    };
  }

  isConnected(): boolean {
    return this.client !== null;
  }

  async connect(): Promise<void> {
    this.client = new Anthropic({ apiKey: this.config.apiKey });
  }

  async disconnect(): Promise<void> {
    this.client = null;
  }

  async sendMessage(
    messages: Array<{ role: "user" | "assistant"; content: string }>,
    systemPrompt?: string,
  ) {
    if (!this.client) throw new Error("Not connected");

    const response = await this.client.messages.create({
      model: this.config.model!,
      max_tokens: this.config.maxTokens!,
      system: systemPrompt,
      messages,
    });

    const firstBlock = response.content[0];
    const content =
      firstBlock && firstBlock.type === "text" ? firstBlock.text : "";

    return {
      content,
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      },
      stopReason: response.stop_reason,
    };
  }

  // Task-specific methods
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

  async generateImplementationPlan(task: string, codebaseContext: string) {
    return this.sendMessage(
      [
        {
          role: "user",
          content: `Generate an implementation plan for:\n\nTask: ${task}\n\nCodebase Context:\n${codebaseContext}`,
        },
      ],
      "You are a software architect. Generate a detailed, step-by-step implementation plan for the given task. Include files to modify, key functions, and testing approach.",
    );
  }

  getCostEstimate(inputTokens: number, outputTokens: number): number {
    // Claude pricing (as of late 2024)
    const inputCost = (inputTokens / 1_000_000) * 3.0; // $3 per 1M input
    const outputCost = (outputTokens / 1_000_000) * 15.0; // $15 per 1M output
    return inputCost + outputCost;
  }
}
