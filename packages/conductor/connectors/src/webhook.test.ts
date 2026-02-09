import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { WebhookConnector } from "./webhook";

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// Mock crypto.subtle
const mockSign = vi.fn();
const mockImportKey = vi.fn();
vi.stubGlobal("crypto", {
  subtle: {
    importKey: mockImportKey,
    sign: mockSign,
  },
});

describe("WebhookConnector", () => {
  let connector: WebhookConnector;

  beforeEach(() => {
    vi.clearAllMocks();
    connector = new WebhookConnector({
      url: "https://example.com/webhook",
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("constructor", () => {
    it("should initialize with required config", () => {
      expect(connector.name).toBe("Webhook");
      expect(connector.type).toBe("webhook");
    });

    it("should accept optional headers", () => {
      const connectorWithHeaders = new WebhookConnector({
        url: "https://example.com/webhook",
        headers: { "X-Custom-Header": "value" },
      });
      expect(connectorWithHeaders.name).toBe("Webhook");
    });

    it("should accept optional secret", () => {
      const connectorWithSecret = new WebhookConnector({
        url: "https://example.com/webhook",
        secret: "my-secret",
      });
      expect(connectorWithSecret.name).toBe("Webhook");
    });

    it("should accept optional events filter", () => {
      const connectorWithEvents = new WebhookConnector({
        url: "https://example.com/webhook",
        events: ["task.created", "task.completed"],
      });
      expect(connectorWithEvents.name).toBe("Webhook");
    });
  });

  describe("isConnected", () => {
    it("should return false when not connected", () => {
      expect(connector.isConnected()).toBe(false);
    });

    it("should return true when connected", async () => {
      mockFetch.mockResolvedValue({ ok: true });
      await connector.connect();
      expect(connector.isConnected()).toBe(true);
    });
  });

  describe("connect", () => {
    it("should verify webhook is reachable with HEAD request", async () => {
      mockFetch.mockResolvedValue({ ok: true });

      await connector.connect();

      expect(mockFetch).toHaveBeenCalledWith("https://example.com/webhook", {
        method: "HEAD",
        headers: undefined,
      });
      expect(connector.isConnected()).toBe(true);
    });

    it("should pass custom headers in HEAD request", async () => {
      const connectorWithHeaders = new WebhookConnector({
        url: "https://example.com/webhook",
        headers: { Authorization: "Bearer token" },
      });
      mockFetch.mockResolvedValue({ ok: true });

      await connectorWithHeaders.connect();

      expect(mockFetch).toHaveBeenCalledWith("https://example.com/webhook", {
        method: "HEAD",
        headers: { Authorization: "Bearer token" },
      });
    });

    it("should set connected to false if HEAD request fails", async () => {
      mockFetch.mockResolvedValue({ ok: false });

      await connector.connect();

      expect(connector.isConnected()).toBe(false);
    });

    it("should assume connected on network error", async () => {
      mockFetch.mockRejectedValue(new Error("Network error"));

      await connector.connect();

      expect(connector.isConnected()).toBe(true);
    });
  });

  describe("disconnect", () => {
    it("should set connected state to false", async () => {
      mockFetch.mockResolvedValue({ ok: true });
      await connector.connect();
      expect(connector.isConnected()).toBe(true);

      await connector.disconnect();
      expect(connector.isConnected()).toBe(false);
    });
  });

  describe("send", () => {
    const mockMessage = {
      id: "msg-123",
      type: "task:created" as const,
      timestamp: new Date("2024-01-01T00:00:00Z"),
      source: "system" as const,
      organizationId: "org-1",
      projectId: "project-1",
      payload: { taskId: "task-123" },
    };

    it("should send event to webhook", async () => {
      mockFetch.mockResolvedValue({ ok: true });

      const result = await connector.send(mockMessage);

      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith("https://example.com/webhook", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: expect.stringContaining("task:created"),
      });
    });

    it("should include custom headers in POST request", async () => {
      const connectorWithHeaders = new WebhookConnector({
        url: "https://example.com/webhook",
        headers: { "X-Custom": "value" },
      });
      mockFetch.mockResolvedValue({ ok: true });

      await connectorWithHeaders.send(mockMessage);

      expect(mockFetch).toHaveBeenCalledWith(
        "https://example.com/webhook",
        expect.objectContaining({
          headers: {
            "Content-Type": "application/json",
            "X-Custom": "value",
          },
        }),
      );
    });

    it("should sign payload when secret is configured", async () => {
      const connectorWithSecret = new WebhookConnector({
        url: "https://example.com/webhook",
        secret: "my-secret",
      });

      const mockKey = { type: "secret" };
      mockImportKey.mockResolvedValue(mockKey);
      mockSign.mockResolvedValue(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]));
      mockFetch.mockResolvedValue({ ok: true });

      await connectorWithSecret.send(mockMessage);

      expect(mockImportKey).toHaveBeenCalledWith(
        "raw",
        expect.any(Uint8Array),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"],
      );
      expect(mockSign).toHaveBeenCalledWith(
        "HMAC",
        mockKey,
        expect.any(Uint8Array),
      );
      expect(mockFetch).toHaveBeenCalledWith(
        "https://example.com/webhook",
        expect.objectContaining({
          headers: expect.objectContaining({
            "X-Conductor-Signature": "0102030405060708",
          }),
        }),
      );
    });

    it("should skip filtered events", async () => {
      const connectorWithEvents = new WebhookConnector({
        url: "https://example.com/webhook",
        events: ["task:completed"],
      });

      const result = await connectorWithEvents.send(mockMessage);

      expect(result).toBe(true);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("should send events that match filter", async () => {
      const connectorWithEvents = new WebhookConnector({
        url: "https://example.com/webhook",
        events: ["task:created", "task:completed"],
      });
      mockFetch.mockResolvedValue({ ok: true });

      const result = await connectorWithEvents.send(mockMessage);

      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalled();
    });

    it("should return false on HTTP error", async () => {
      mockFetch.mockResolvedValue({ ok: false });

      const result = await connector.send(mockMessage);

      expect(result).toBe(false);
    });

    it("should return false on network error", async () => {
      mockFetch.mockRejectedValue(new Error("Network error"));

      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      const result = await connector.send(mockMessage);

      expect(result).toBe(false);
      expect(consoleSpy).toHaveBeenCalledWith(
        "Webhook send failed:",
        expect.any(Error),
      );
      consoleSpy.mockRestore();
    });

    it("should include all message fields in payload", async () => {
      mockFetch.mockResolvedValue({ ok: true });

      await connector.send(mockMessage);

      const callArgs = mockFetch.mock.calls[0];
      expect(callArgs).toBeDefined();
      const body = JSON.parse(callArgs![1].body);

      expect(body).toEqual({
        event: "task:created",
        timestamp: "2024-01-01T00:00:00.000Z",
        source: "system",
        organizationId: "org-1",
        projectId: "project-1",
        payload: { taskId: "task-123" },
      });
    });
  });
});
