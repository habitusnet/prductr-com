import OpenAI from "openai";
import type { Connector } from "./index";

export interface OpenAIConfig {
  apiKey: string;
  model?: string;
  organization?: string;
}

export class OpenAIConnector implements Connector {
  name = "OpenAI";
  type = "openai";
  private client: OpenAI | null = null;
  private config: OpenAIConfig;

  constructor(config: OpenAIConfig) {
    this.config = {
      model: "gpt-4-turbo-preview",
      ...config,
    };
  }

  isConnected(): boolean {
    return this.client !== null;
  }

  async connect(): Promise<void> {
    this.client = new OpenAI({
      apiKey: this.config.apiKey,
      organization: this.config.organization,
    });
  }

  async disconnect(): Promise<void> {
    this.client = null;
  }

  async sendMessage(
    messages: Array<{ role: "system" | "user" | "assistant"; content: string }>,
  ) {
    if (!this.client) throw new Error("Not connected");

    const response = await this.client.chat.completions.create({
      model: this.config.model!,
      messages,
    });

    return {
      content: response.choices[0]?.message?.content || "",
      usage: {
        inputTokens: response.usage?.prompt_tokens || 0,
        outputTokens: response.usage?.completion_tokens || 0,
      },
      finishReason: response.choices[0]?.finish_reason,
    };
  }

  async analyzeTask(taskDescription: string, projectContext: string) {
    return this.sendMessage([
      {
        role: "system",
        content:
          "You are a task analysis assistant. Analyze the given task and provide: 1) Estimated complexity (low/medium/high), 2) Estimated tokens needed, 3) Required capabilities, 4) Potential risks or blockers.",
      },
      {
        role: "user",
        content: `Analyze this task and provide an estimate:\n\nTask: ${taskDescription}\n\nProject Context:\n${projectContext}`,
      },
    ]);
  }

  getCostEstimate(inputTokens: number, outputTokens: number): number {
    // GPT-4 Turbo pricing
    const inputCost = (inputTokens / 1_000_000) * 10.0;
    const outputCost = (outputTokens / 1_000_000) * 30.0;
    return inputCost + outputCost;
  }
}
