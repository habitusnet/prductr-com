import { GoogleGenerativeAI } from "@google/generative-ai";
import type { Connector } from "./index";

export interface GeminiConfig {
  apiKey: string;
  model?: string;
}

export class GeminiConnector implements Connector {
  name = "Gemini";
  type = "gemini";
  private client: GoogleGenerativeAI | null = null;
  private config: GeminiConfig;

  constructor(config: GeminiConfig) {
    this.config = {
      model: "gemini-pro",
      ...config,
    };
  }

  isConnected(): boolean {
    return this.client !== null;
  }

  async connect(): Promise<void> {
    this.client = new GoogleGenerativeAI(this.config.apiKey);
  }

  async disconnect(): Promise<void> {
    this.client = null;
  }

  async sendMessage(prompt: string, systemInstruction?: string) {
    if (!this.client) throw new Error("Not connected");

    const model = this.client.getGenerativeModel({
      model: this.config.model!,
      systemInstruction,
    });

    const result = await model.generateContent(prompt);
    const response = result.response;

    return {
      content: response.text(),
      usage: {
        // Gemini doesn't expose token counts directly in the same way
        inputTokens: 0,
        outputTokens: 0,
      },
    };
  }

  async analyzeTask(taskDescription: string, projectContext: string) {
    return this.sendMessage(
      `Analyze this task and provide an estimate:\n\nTask: ${taskDescription}\n\nProject Context:\n${projectContext}`,
      "You are a task analysis assistant. Analyze the given task and provide: 1) Estimated complexity (low/medium/high), 2) Estimated effort, 3) Required capabilities, 4) Potential risks or blockers.",
    );
  }

  async generateCode(prompt: string, language: string) {
    return this.sendMessage(
      `Generate ${language} code for:\n\n${prompt}`,
      `You are an expert ${language} developer. Generate clean, well-documented code.`,
    );
  }

  getCostEstimate(inputTokens: number, outputTokens: number): number {
    // Gemini Pro pricing (approximate)
    const inputCost = (inputTokens / 1_000_000) * 0.5;
    const outputCost = (outputTokens / 1_000_000) * 1.5;
    return inputCost + outputCost;
  }
}
