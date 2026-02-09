/**
 * E2B Sandbox Manager
 * Manages the lifecycle of E2B sandboxes for agent execution
 */

import { Sandbox } from "e2b";
import type {
  SandboxConfig,
  SandboxInstance,
  SandboxStatus,
  SandboxEvent,
  E2BRunnerOptions,
  FileOperation,
  FileOperationResult,
  StreamingCommandOptions,
  StreamingChunk,
} from "./types.js";

/**
 * Manages E2B sandbox lifecycle
 */
export class SandboxManager {
  private sandboxes: Map<string, Sandbox> = new Map();
  private instances: Map<string, SandboxInstance> = new Map();
  private options: Required<E2BRunnerOptions>;
  private healthMonitorTimer: ReturnType<typeof setInterval> | null = null;

  constructor(options: E2BRunnerOptions = {}) {
    this.options = {
      apiKey: options.apiKey || process.env.E2B_API_KEY || "",
      defaultTemplate: options.defaultTemplate || "base",
      defaultTimeout: options.defaultTimeout ?? 300,
      maxConcurrent: options.maxConcurrent ?? 10,
      autoCleanup: options.autoCleanup ?? true,
      onEvent: options.onEvent || (() => {}),
    };

    if (!this.options.apiKey) {
      console.warn(
        "E2B API key not provided. Set E2B_API_KEY environment variable.",
      );
    }
  }

  /**
   * Create and start a new sandbox
   */
  async createSandbox(
    agentId: string,
    projectId: string,
    config: SandboxConfig = {},
  ): Promise<SandboxInstance> {
    // Check concurrent limit
    const runningCount = Array.from(this.instances.values()).filter(
      (i) => i.status === "running",
    ).length;

    if (runningCount >= this.options.maxConcurrent) {
      throw new Error(
        `Maximum concurrent sandboxes (${this.options.maxConcurrent}) reached`,
      );
    }

    const template = config.template || this.options.defaultTemplate;
    const timeout = config.timeout ?? this.options.defaultTimeout;

    this.emitEvent({
      type: "sandbox:created",
      sandboxId: "pending",
      agentId,
      timestamp: new Date(),
      data: { template, timeout },
    });

    try {
      // Create the sandbox with retry for transient failures
      const sandbox = await this.withRetry(
        () =>
          Sandbox.create(template, {
            apiKey: this.options.apiKey,
            timeoutMs: timeout * 1000,
            metadata: {
              agentId,
              projectId,
              ...config.metadata,
            },
          }),
        1,
        2000,
      );

      const instance: SandboxInstance = {
        id: sandbox.sandboxId,
        agentId,
        projectId,
        status: "running",
        template,
        startedAt: new Date(),
        lastActivityAt: new Date(),
        metadata: config.metadata || {},
      };

      this.sandboxes.set(sandbox.sandboxId, sandbox);
      this.instances.set(sandbox.sandboxId, instance);

      this.emitEvent({
        type: "sandbox:started",
        sandboxId: sandbox.sandboxId,
        agentId,
        timestamp: new Date(),
        data: { template },
      });

      // Setup timeout handler
      if (timeout > 0) {
        setTimeout(() => {
          this.handleTimeout(sandbox.sandboxId);
        }, timeout * 1000);
      }

      return instance;
    } catch (error) {
      this.emitEvent({
        type: "sandbox:failed",
        sandboxId: "failed",
        agentId,
        timestamp: new Date(),
        data: { error: String(error) },
      });
      throw error;
    }
  }

  /**
   * Get a sandbox by ID
   */
  getSandbox(sandboxId: string): Sandbox | undefined {
    return this.sandboxes.get(sandboxId);
  }

  /**
   * Get sandbox instance info
   */
  getInstance(sandboxId: string): SandboxInstance | undefined {
    return this.instances.get(sandboxId);
  }

  /**
   * List all sandbox instances
   */
  listInstances(filter?: {
    status?: SandboxStatus;
    agentId?: string;
    projectId?: string;
  }): SandboxInstance[] {
    let instances = Array.from(this.instances.values());

    if (filter?.status) {
      instances = instances.filter((i) => i.status === filter.status);
    }
    if (filter?.agentId) {
      instances = instances.filter((i) => i.agentId === filter.agentId);
    }
    if (filter?.projectId) {
      instances = instances.filter((i) => i.projectId === filter.projectId);
    }

    return instances;
  }

  /**
   * Execute a command in a sandbox
   */
  async executeCommand(
    sandboxId: string,
    command: string,
    options: {
      cwd?: string;
      timeout?: number;
      env?: Record<string, string>;
    } = {},
  ): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    const sandbox = this.sandboxes.get(sandboxId);
    if (!sandbox) {
      throw new Error(`Sandbox ${sandboxId} not found`);
    }

    const instance = this.instances.get(sandboxId);
    if (instance) {
      instance.lastActivityAt = new Date();
    }

    const result = await sandbox.commands.run(command, {
      cwd: options.cwd,
      timeoutMs: options.timeout ? options.timeout * 1000 : undefined,
      envs: options.env,
    });

    return {
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.exitCode,
    };
  }

  /**
   * Execute a command with streaming output
   */
  async executeCommandStreaming(
    sandboxId: string,
    command: string,
    options: StreamingCommandOptions,
  ): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    const sandbox = this.sandboxes.get(sandboxId);
    if (!sandbox) {
      throw new Error(`Sandbox ${sandboxId} not found`);
    }

    const instance = this.instances.get(sandboxId);
    if (instance) {
      instance.lastActivityAt = new Date();
    }

    const { callbacks, cwd, timeout, env } = options;
    const startTime = Date.now();

    // Notify start
    callbacks.onStart?.();

    // Collect output for final result
    let stdout = "";
    let stderr = "";

    try {
      const result = await sandbox.commands.run(command, {
        cwd,
        timeoutMs: timeout ? timeout * 1000 : undefined,
        envs: env,
        onStdout: (data) => {
          stdout += data;
          callbacks.onStdout?.(data);
          const chunk: StreamingChunk = {
            type: "stdout",
            data,
            timestamp: new Date(),
          };
          callbacks.onOutput?.(chunk);
          if (instance) {
            instance.lastActivityAt = new Date();
          }
        },
        onStderr: (data) => {
          stderr += data;
          callbacks.onStderr?.(data);
          const chunk: StreamingChunk = {
            type: "stderr",
            data,
            timestamp: new Date(),
          };
          callbacks.onOutput?.(chunk);
          if (instance) {
            instance.lastActivityAt = new Date();
          }
        },
      });

      const duration = Date.now() - startTime;

      // Notify completion
      callbacks.onComplete?.({ exitCode: result.exitCode, duration });

      return {
        stdout,
        stderr,
        exitCode: result.exitCode,
      };
    } catch (error) {
      callbacks.onError?.(
        error instanceof Error ? error : new Error(String(error)),
      );
      throw error;
    }
  }

  /**
   * Perform file operations in a sandbox
   */
  async fileOperation(
    sandboxId: string,
    operation: FileOperation,
  ): Promise<FileOperationResult> {
    const sandbox = this.sandboxes.get(sandboxId);
    if (!sandbox) {
      throw new Error(`Sandbox ${sandboxId} not found`);
    }

    const instance = this.instances.get(sandboxId);
    if (instance) {
      instance.lastActivityAt = new Date();
    }

    try {
      switch (operation.type) {
        case "read": {
          const content = await sandbox.files.read(operation.path);
          return { success: true, path: operation.path, content };
        }

        case "write": {
          await sandbox.files.write(operation.path, operation.content || "");
          return { success: true, path: operation.path };
        }

        case "delete": {
          await sandbox.files.remove(operation.path);
          return { success: true, path: operation.path };
        }

        case "list": {
          const files = await sandbox.files.list(operation.path);
          return {
            success: true,
            path: operation.path,
            files: files.map((f) => f.name),
          };
        }

        case "exists": {
          try {
            await sandbox.files.read(operation.path);
            return { success: true, path: operation.path, exists: true };
          } catch {
            return { success: true, path: operation.path, exists: false };
          }
        }

        default:
          return {
            success: false,
            path: operation.path,
            error: `Unknown operation type: ${operation.type}`,
          };
      }
    } catch (error) {
      return {
        success: false,
        path: operation.path,
        error: String(error),
      };
    }
  }

  /**
   * Stop a sandbox
   */
  async stopSandbox(sandboxId: string): Promise<void> {
    const sandbox = this.sandboxes.get(sandboxId);
    const instance = this.instances.get(sandboxId);

    if (sandbox) {
      try {
        await sandbox.kill();
      } catch (error) {
        console.warn(`Failed to kill sandbox ${sandboxId}:`, error);
      }
      this.sandboxes.delete(sandboxId);
    }

    if (instance) {
      instance.status = "stopped";
      this.emitEvent({
        type: "sandbox:stopped",
        sandboxId,
        agentId: instance.agentId,
        timestamp: new Date(),
      });

      if (this.options.autoCleanup) {
        this.instances.delete(sandboxId);
      }
    }
  }

  /**
   * Stop all sandboxes for an agent
   */
  async stopAgentSandboxes(agentId: string): Promise<void> {
    const instances = this.listInstances({ agentId, status: "running" });
    await Promise.all(instances.map((i) => this.stopSandbox(i.id)));
  }

  /**
   * Stop all sandboxes for a project
   */
  async stopProjectSandboxes(projectId: string): Promise<void> {
    const instances = this.listInstances({ projectId, status: "running" });
    await Promise.all(instances.map((i) => this.stopSandbox(i.id)));
  }

  /**
   * Stop all running sandboxes
   */
  async stopAll(): Promise<void> {
    const instances = this.listInstances({ status: "running" });
    await Promise.all(instances.map((i) => this.stopSandbox(i.id)));
  }

  /**
   * Cleanup stopped sandboxes from memory
   */
  cleanup(): void {
    for (const [id, instance] of this.instances) {
      if (instance.status !== "running") {
        this.instances.delete(id);
        this.sandboxes.delete(id);
      }
    }
  }

  /**
   * Handle sandbox timeout
   */
  private handleTimeout(sandboxId: string): void {
    const instance = this.instances.get(sandboxId);
    if (instance && instance.status === "running") {
      instance.status = "timeout";
      this.emitEvent({
        type: "sandbox:timeout",
        sandboxId,
        agentId: instance.agentId,
        timestamp: new Date(),
      });

      // Stop the sandbox
      this.stopSandbox(sandboxId).catch(console.error);
    }
  }

  /**
   * Emit a sandbox event
   */
  private emitEvent(event: SandboxEvent): void {
    try {
      this.options.onEvent(event);
    } catch (error) {
      console.error("Error in event handler:", error);
    }
  }

  /**
   * Health check a sandbox by running a simple command
   */
  async healthCheck(sandboxId: string): Promise<boolean> {
    try {
      const result = await this.executeCommand(sandboxId, "echo ok", {
        timeout: 10,
      });
      return result.exitCode === 0;
    } catch {
      return false;
    }
  }

  /**
   * Stop sandboxes that have been running longer than maxAgeMs
   * Returns the IDs of stopped sandboxes
   */
  async cleanupStale(maxAgeMs: number): Promise<string[]> {
    const now = Date.now();
    const stale = Array.from(this.instances.values()).filter(
      (i) =>
        i.status === "running" &&
        now - i.startedAt.getTime() > maxAgeMs,
    );

    const stoppedIds: string[] = [];
    for (const instance of stale) {
      try {
        await this.stopSandbox(instance.id);
        stoppedIds.push(instance.id);
        this.emitEvent({
          type: "sandbox:stopped",
          sandboxId: instance.id,
          agentId: instance.agentId,
          timestamp: new Date(),
          data: { reason: "stale_cleanup" },
        });
      } catch (error) {
        console.warn(`Failed to cleanup stale sandbox ${instance.id}:`, error);
      }
    }
    return stoppedIds;
  }

  /**
   * Start periodic health monitoring of all running sandboxes
   */
  startHealthMonitor(intervalMs: number = 60000): void {
    this.stopHealthMonitor();

    this.healthMonitorTimer = setInterval(async () => {
      const running = this.listInstances({ status: "running" });
      for (const instance of running) {
        const healthy = await this.healthCheck(instance.id);
        if (!healthy) {
          instance.status = "failed";
          this.emitEvent({
            type: "sandbox:failed",
            sandboxId: instance.id,
            agentId: instance.agentId,
            timestamp: new Date(),
            data: { reason: "health_check_failed" },
          });
        }
      }
    }, intervalMs);
  }

  /**
   * Stop the health monitor loop
   */
  stopHealthMonitor(): void {
    if (this.healthMonitorTimer) {
      clearInterval(this.healthMonitorTimer);
      this.healthMonitorTimer = null;
    }
  }

  /**
   * Retry a function with backoff for transient failures
   */
  private async withRetry<T>(
    fn: () => Promise<T>,
    maxRetries: number,
    delayMs: number,
  ): Promise<T> {
    let lastError: unknown;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        if (attempt < maxRetries) {
          await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
      }
    }
    throw lastError;
  }

  /**
   * Get runner statistics
   */
  getStats(): {
    total: number;
    running: number;
    stopped: number;
    failed: number;
    timeout: number;
  } {
    const instances = Array.from(this.instances.values());
    return {
      total: instances.length,
      running: instances.filter((i) => i.status === "running").length,
      stopped: instances.filter((i) => i.status === "stopped").length,
      failed: instances.filter((i) => i.status === "failed").length,
      timeout: instances.filter((i) => i.status === "timeout").length,
    };
  }
}
