import { EventEmitter } from "eventemitter3";

export interface McpClientConfig {
  serverUrl: string;
  observerId: string;
}

export type AgentStatus = "idle" | "working" | "blocked";

interface McpClientEvents {
  connected: () => void;
  disconnected: () => void;
  error: (error: Error) => void;
}

interface TaskUpdate {
  status?: "in_progress" | "completed" | "failed" | "blocked";
  notes?: string;
  blockedBy?: string[];
  tokensUsed?: number;
}

interface Agent {
  id: string;
  name: string;
  status: string;
  [key: string]: unknown;
}

/**
 * ObserverMcpClient wraps MCP tool calls for the Observer Agent.
 * Extends EventEmitter to handle connection state and errors.
 */
export class ObserverMcpClient extends EventEmitter<McpClientEvents> {
  private config: McpClientConfig;
  private connected: boolean = false;

  constructor(config: McpClientConfig) {
    super();
    this.config = config;
  }

  /**
   * Register as observer agent with lead role and oversight capabilities
   */
  async connect(): Promise<void> {
    try {
      await this.call("conductor_request_access", {
        agentId: this.config.observerId,
        agentName: "Observer Agent",
        agentType: "claude",
        requestedRole: "lead",
        capabilities: ["oversight", "task-management", "agent-control"],
      });

      this.connected = true;
      this.emit("connected");
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.emit("error", err);
      throw err;
    }
  }

  /**
   * Close connection
   */
  disconnect(): void {
    this.connected = false;
    this.emit("disconnected");
  }

  /**
   * Check connection status
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Update task status and metadata
   */
  async updateTask(taskId: string, update: TaskUpdate): Promise<void> {
    this.ensureConnected();

    try {
      const params: Record<string, unknown> = {
        taskId,
      };

      // Only include fields that are provided
      if (update.status !== undefined) {
        params["status"] = update.status;
      }
      if (update.notes !== undefined) {
        params["notes"] = update.notes;
      }
      if (update.blockedBy !== undefined) {
        params["blockedBy"] = update.blockedBy;
      }
      if (update.tokensUsed !== undefined) {
        params["tokensUsed"] = update.tokensUsed;
      }

      await this.call("conductor_update_task", params);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.emit("error", err);
      throw err;
    }
  }

  /**
   * Release lock on a file
   */
  async unlockFile(filePath: string, agentId: string): Promise<void> {
    this.ensureConnected();

    try {
      await this.call("conductor_unlock_file", {
        filePath,
        agentId,
      });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.emit("error", err);
      throw err;
    }
  }

  /**
   * List all registered agents and their status
   */
  async listAgents(): Promise<Agent[]> {
    this.ensureConnected();

    try {
      const result = await this.call("conductor_list_agents", {});
      const content = result.content?.[0];

      if (content?.type === "text" && typeof content.text === "string") {
        return JSON.parse(content.text);
      }

      return [];
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.emit("error", err);
      throw err;
    }
  }

  /**
   * Send heartbeat to indicate agent is active
   */
  async sendHeartbeat(agentId: string, status: AgentStatus): Promise<void> {
    this.ensureConnected();

    try {
      await this.call("conductor_heartbeat", {
        agentId,
        status,
      });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.emit("error", err);
      throw err;
    }
  }

  /**
   * Save a checkpoint for context rollover
   */
  async saveCheckpoint(
    agentId: string,
    taskId: string | undefined,
    stage: string,
    tokenCount: number,
  ): Promise<void> {
    this.ensureConnected();

    try {
      const params: Record<string, unknown> = {
        agentId,
        stage,
        checkpointType: "context_exhaustion",
        tokenCount,
      };
      if (taskId) {
        params["taskId"] = taskId;
      }

      await this.call("conductor_checkpoint", params);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.emit("error", err);
      throw err;
    }
  }

  /**
   * Internal method to call MCP tools.
   * In tests, this can be mocked. In production, it should be implemented
   * to connect to the actual MCP server via the configured serverUrl.
   */
  protected async call(
    toolName: string,
    params: Record<string, unknown>
  ): Promise<{ content: Array<{ type: string; text?: string }> }> {
    // This is a placeholder that will be mocked in tests or overridden
    // in a real implementation to communicate with the MCP server
    throw new Error(
      `MCP call not implemented: ${toolName}. Override this method in a subclass.`
    );
  }

  private ensureConnected(): void {
    if (!this.connected) {
      throw new Error("Not connected to MCP server");
    }
  }
}
