import type { Connector } from "./index";
import type { Message } from "@conductor/core";

export interface WebhookConfig {
  url: string;
  secret?: string;
  headers?: Record<string, string>;
  events?: string[]; // Filter which events to send
}

export class WebhookConnector implements Connector {
  name = "Webhook";
  type = "webhook";
  private config: WebhookConfig;
  private connected = false;

  constructor(config: WebhookConfig) {
    this.config = config;
  }

  isConnected(): boolean {
    return this.connected;
  }

  async connect(): Promise<void> {
    // Verify webhook is reachable
    try {
      const response = await fetch(this.config.url, {
        method: "HEAD",
        headers: this.config.headers,
      });
      this.connected = response.ok;
    } catch {
      this.connected = true; // Assume ok, will fail on send if not
    }
  }

  async disconnect(): Promise<void> {
    this.connected = false;
  }

  async send(event: Message): Promise<boolean> {
    // Filter events if configured
    if (this.config.events && !this.config.events.includes(event.type)) {
      return true; // Skip filtered events
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...this.config.headers,
    };

    // Add signature if secret is configured
    if (this.config.secret) {
      const payload = JSON.stringify(event);
      const signature = await this.sign(payload, this.config.secret);
      headers["X-Conductor-Signature"] = signature;
    }

    try {
      const response = await fetch(this.config.url, {
        method: "POST",
        headers,
        body: JSON.stringify({
          event: event.type,
          timestamp: event.timestamp,
          source: event.source,
          organizationId: event.organizationId,
          projectId: event.projectId,
          payload: event.payload,
        }),
      });
      return response.ok;
    } catch (error) {
      console.error("Webhook send failed:", error);
      return false;
    }
  }

  private async sign(payload: string, secret: string): Promise<string> {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const signature = await crypto.subtle.sign(
      "HMAC",
      key,
      encoder.encode(payload),
    );
    return Array.from(new Uint8Array(signature))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }
}
