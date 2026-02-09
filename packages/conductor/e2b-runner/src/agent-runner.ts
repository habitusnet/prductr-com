/**
 * E2B Agent Runner
 * Runs Conductor agents in E2B sandboxes
 */

import { SandboxManager } from "./sandbox-manager.js";
import type {
  AgentRunnerConfig,
  AgentExecutionResult,
  SandboxInstance,
  SandboxEvent,
  E2BRunnerOptions,
  StreamingAgentConfig,
  StreamingCallbacks,
} from "./types.js";

/**
 * Setup scripts for different agent types
 */
const AGENT_SETUP_SCRIPTS: Record<string, string[]> = {
  "claude-code": [
    // Install Claude Code CLI
    "curl -fsSL https://claude.ai/install.sh | sh || true",
    // Verify installation
    'which claude || echo "Claude Code not found, using npx"',
  ],
  aider: [
    // Install aider via pip
    "pip install aider-chat",
    // Verify installation
    "aider --version",
  ],
  copilot: [
    // Install GitHub CLI
    "curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | sudo dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg",
    'echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | sudo tee /etc/apt/sources.list.d/github-cli.list > /dev/null',
    "sudo apt update && sudo apt install gh -y || (curl -fsSL https://github.com/cli/cli/releases/download/v2.40.1/gh_2.40.1_linux_amd64.tar.gz | tar xz && sudo mv gh_2.40.1_linux_amd64/bin/gh /usr/local/bin/)",
    // Install Copilot extension
    "gh extension install github/gh-copilot || true",
    // Verify installation
    'gh copilot --version || echo "Copilot extension installed"',
  ],
  crush: [
    // Install Crush via Go or direct binary
    "which go && go install github.com/charmbracelet/crush@latest || (curl -fsSL https://github.com/charmbracelet/crush/releases/latest/download/crush_Linux_x86_64.tar.gz | tar xz -C /usr/local/bin crush)",
    // Verify installation
    'crush --version || echo "Crush installed"',
  ],
  zencoder: [
    // Z.ai uses Claude Code with different API endpoint
    // Install Claude Code CLI (same as claude-code setup)
    "curl -fsSL https://claude.ai/install.sh | sh || true",
    // Verify installation
    'which claude || echo "Claude Code not found, using npx"',
    // Note: Z.ai env vars (ANTHROPIC_BASE_URL, ANTHROPIC_AUTH_TOKEN) set at runtime
  ],
  custom: [],
};

/**
 * Agent run commands for different types
 */
const AGENT_RUN_COMMANDS: Record<
  string,
  (config: AgentRunnerConfig) => string
> = {
  "claude-code": (config) => {
    const mcpConfig = `--mcp-server ${config.mcpServerUrl}`;
    const workDir = config.workDir ? `--work-dir ${config.workDir}` : "";
    return `claude ${mcpConfig} ${workDir} --non-interactive`;
  },
  aider: (config) => {
    const workDir = config.workDir || ".";
    return `cd ${workDir} && aider --no-auto-commits --yes`;
  },
  copilot: (config) => {
    const workDir = config.workDir || ".";
    // GitHub Copilot CLI for code suggestions
    return `cd ${workDir} && gh copilot suggest -t shell "complete the current task"`;
  },
  crush: (config) => {
    const workDir = config.workDir || ".";
    // Crush AI coding agent - uses config file for MCP, --yolo for autonomous mode
    return `cd ${workDir} && crush --yolo`;
  },
  zencoder: (config) => {
    // Z.ai runs Claude Code with GLM-4.7 via Anthropic-compatible proxy
    // Requires: ANTHROPIC_BASE_URL=https://api.z.ai/api/anthropic
    //           ANTHROPIC_AUTH_TOKEN=your_zai_api_key
    const mcpConfig = config.mcpServerUrl
      ? `--mcp-server ${config.mcpServerUrl}`
      : "";
    const workDir = config.workDir ? `--work-dir ${config.workDir}` : "";
    return `claude ${mcpConfig} ${workDir} --non-interactive`;
  },
  custom: (config) => {
    return config.env?.AGENT_COMMAND || 'echo "No custom command specified"';
  },
};

/**
 * Runs agents in E2B sandboxes
 */
export class AgentRunner {
  private sandboxManager: SandboxManager;
  private runningAgents: Map<string, { sandboxId: string; startTime: Date }> =
    new Map();

  constructor(options: E2BRunnerOptions = {}) {
    this.sandboxManager = new SandboxManager({
      ...options,
      onEvent: (event) => {
        this.handleSandboxEvent(event);
        options.onEvent?.(event);
      },
    });
  }

  /**
   * Start an agent in a new sandbox
   */
  async startAgent(config: AgentRunnerConfig): Promise<SandboxInstance> {
    const { agentId, projectId, type, gitRepo, gitBranch, setupCommands, env } =
      config;

    // Check if agent is already running
    if (this.runningAgents.has(agentId)) {
      throw new Error(`Agent ${agentId} is already running`);
    }

    // Create sandbox
    const instance = await this.sandboxManager.createSandbox(
      agentId,
      projectId,
      {
        ...config.sandbox,
        env: {
          ...env,
          CONDUCTOR_MCP_URL: config.mcpServerUrl,
          CONDUCTOR_AGENT_ID: agentId,
          CONDUCTOR_PROJECT_ID: projectId,
        },
        metadata: {
          agentType: type,
          ...(config.sandbox?.metadata || {}),
        },
      },
    );

    try {
      // Clone git repository if specified
      if (gitRepo) {
        const branch = gitBranch ? `-b ${gitBranch}` : "";
        const workDir = config.workDir || "/home/user/workspace";
        await this.sandboxManager.executeCommand(
          instance.id,
          `git clone ${branch} ${gitRepo} ${workDir}`,
          { timeout: 120 },
        );
      }

      // Run setup scripts for agent type
      const typeSetup = AGENT_SETUP_SCRIPTS[type] || [];
      for (const cmd of typeSetup) {
        await this.sandboxManager.executeCommand(instance.id, cmd, {
          timeout: 60,
        });
      }

      // Run custom setup commands
      if (setupCommands) {
        for (const cmd of setupCommands) {
          await this.sandboxManager.executeCommand(instance.id, cmd, {
            timeout: 60,
          });
        }
      }

      // Track running agent
      this.runningAgents.set(agentId, {
        sandboxId: instance.id,
        startTime: new Date(),
      });

      return instance;
    } catch (error) {
      // Cleanup on setup failure
      await this.sandboxManager.stopSandbox(instance.id);
      throw error;
    }
  }

  /**
   * Run an agent and wait for completion
   */
  async runAgent(config: AgentRunnerConfig): Promise<AgentExecutionResult> {
    const startTime = Date.now();
    let instance: SandboxInstance | undefined;

    try {
      instance = await this.startAgent(config);

      // Get the run command for this agent type
      const getCommand = AGENT_RUN_COMMANDS[config.type];
      if (!getCommand) {
        throw new Error(`Unknown agent type: ${config.type}`);
      }

      const command = getCommand(config);
      const timeout = config.sandbox?.timeout || 300;

      // Execute the agent
      const result = await this.sandboxManager.executeCommand(
        instance.id,
        command,
        {
          cwd: config.workDir,
          timeout,
          env: config.env,
        },
      );

      const duration = Date.now() - startTime;

      return {
        sandboxId: instance.id,
        agentId: config.agentId,
        success: result.exitCode === 0,
        exitCode: result.exitCode,
        stdout: result.stdout,
        stderr: result.stderr,
        duration,
      };
    } catch (error) {
      const duration = Date.now() - startTime;

      return {
        sandboxId: instance?.id || "unknown",
        agentId: config.agentId,
        success: false,
        duration,
        error: String(error),
      };
    } finally {
      // Cleanup
      if (instance) {
        this.runningAgents.delete(config.agentId);
        await this.sandboxManager.stopSandbox(instance.id);
      }
    }
  }

  /**
   * Run an agent with streaming output
   */
  async runAgentStreaming(
    config: StreamingAgentConfig,
  ): Promise<AgentExecutionResult> {
    const startTime = Date.now();
    let instance: SandboxInstance | undefined;
    const callbacks = config.streaming || {};

    try {
      instance = await this.startAgent(config);

      // Get the run command for this agent type
      const getCommand = AGENT_RUN_COMMANDS[config.type];
      if (!getCommand) {
        throw new Error(`Unknown agent type: ${config.type}`);
      }

      const command = getCommand(config);
      const timeout = config.sandbox?.timeout || 300;

      // Execute the agent with streaming
      const result = await this.sandboxManager.executeCommandStreaming(
        instance.id,
        command,
        {
          cwd: config.workDir,
          timeout,
          env: config.env,
          callbacks,
        },
      );

      const duration = Date.now() - startTime;

      return {
        sandboxId: instance.id,
        agentId: config.agentId,
        success: result.exitCode === 0,
        exitCode: result.exitCode,
        stdout: result.stdout,
        stderr: result.stderr,
        duration,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      callbacks.onError?.(
        error instanceof Error ? error : new Error(String(error)),
      );

      return {
        sandboxId: instance?.id || "unknown",
        agentId: config.agentId,
        success: false,
        duration,
        error: String(error),
      };
    } finally {
      // Cleanup
      if (instance) {
        this.runningAgents.delete(config.agentId);
        await this.sandboxManager.stopSandbox(instance.id);
      }
    }
  }

  /**
   * Execute a command in a running agent's sandbox with streaming output
   */
  async executeInAgentStreaming(
    agentId: string,
    command: string,
    options: { cwd?: string; timeout?: number; callbacks: StreamingCallbacks },
  ): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    const agentInfo = this.runningAgents.get(agentId);
    if (!agentInfo) {
      throw new Error(`Agent ${agentId} is not running`);
    }

    return this.sandboxManager.executeCommandStreaming(
      agentInfo.sandboxId,
      command,
      options,
    );
  }

  /**
   * Execute a command in a running agent's sandbox
   */
  async executeInAgent(
    agentId: string,
    command: string,
    options: { cwd?: string; timeout?: number } = {},
  ): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    const agentInfo = this.runningAgents.get(agentId);
    if (!agentInfo) {
      throw new Error(`Agent ${agentId} is not running`);
    }

    return this.sandboxManager.executeCommand(
      agentInfo.sandboxId,
      command,
      options,
    );
  }

  /**
   * Stop a running agent
   */
  async stopAgent(agentId: string): Promise<void> {
    const agentInfo = this.runningAgents.get(agentId);
    if (!agentInfo) {
      return; // Agent not running
    }

    await this.sandboxManager.stopSandbox(agentInfo.sandboxId);
    this.runningAgents.delete(agentId);
  }

  /**
   * Check if an agent is running
   */
  isAgentRunning(agentId: string): boolean {
    return this.runningAgents.has(agentId);
  }

  /**
   * Get running agent info
   */
  getRunningAgent(
    agentId: string,
  ):
    | { sandboxId: string; startTime: Date; instance: SandboxInstance }
    | undefined {
    const agentInfo = this.runningAgents.get(agentId);
    if (!agentInfo) return undefined;

    const instance = this.sandboxManager.getInstance(agentInfo.sandboxId);
    if (!instance) return undefined;

    return {
      ...agentInfo,
      instance,
    };
  }

  /**
   * List all running agents
   */
  listRunningAgents(): Array<{
    agentId: string;
    sandboxId: string;
    startTime: Date;
  }> {
    return Array.from(this.runningAgents.entries()).map(([agentId, info]) => ({
      agentId,
      ...info,
    }));
  }

  /**
   * Stop all running agents
   */
  async stopAllAgents(): Promise<void> {
    const agents = Array.from(this.runningAgents.keys());
    await Promise.all(agents.map((agentId) => this.stopAgent(agentId)));
  }

  /**
   * Get sandbox manager for direct access
   */
  getSandboxManager(): SandboxManager {
    return this.sandboxManager;
  }

  /**
   * Handle sandbox events
   */
  private handleSandboxEvent(event: SandboxEvent): void {
    // Clean up running agents when sandbox stops
    if (
      event.type === "sandbox:stopped" ||
      event.type === "sandbox:failed" ||
      event.type === "sandbox:timeout"
    ) {
      if (event.agentId) {
        this.runningAgents.delete(event.agentId);
      }
    }
  }

  /**
   * Get runner statistics
   */
  getStats(): {
    runningAgents: number;
    sandboxes: ReturnType<SandboxManager["getStats"]>;
  } {
    return {
      runningAgents: this.runningAgents.size,
      sandboxes: this.sandboxManager.getStats(),
    };
  }
}

/**
 * Create a pre-configured agent runner for Claude Code
 */
export function createClaudeCodeRunner(
  mcpServerUrl: string,
  options: E2BRunnerOptions = {},
): {
  runner: AgentRunner;
  startAgent: (
    agentId: string,
    projectId: string,
    gitRepo?: string,
  ) => Promise<SandboxInstance>;
  runAgent: (
    agentId: string,
    projectId: string,
    gitRepo?: string,
  ) => Promise<AgentExecutionResult>;
} {
  const runner = new AgentRunner(options);

  return {
    runner,
    startAgent: (agentId, projectId, gitRepo) =>
      runner.startAgent({
        type: "claude-code",
        agentId,
        projectId,
        mcpServerUrl,
        gitRepo,
        workDir: "/home/user/workspace",
      }),
    runAgent: (agentId, projectId, gitRepo) =>
      runner.runAgent({
        type: "claude-code",
        agentId,
        projectId,
        mcpServerUrl,
        gitRepo,
        workDir: "/home/user/workspace",
      }),
  };
}

/**
 * Create a pre-configured agent runner for Aider
 */
export function createAiderRunner(options: E2BRunnerOptions = {}): {
  runner: AgentRunner;
  startAgent: (
    agentId: string,
    projectId: string,
    gitRepo: string,
  ) => Promise<SandboxInstance>;
  runAgent: (
    agentId: string,
    projectId: string,
    gitRepo: string,
  ) => Promise<AgentExecutionResult>;
} {
  const runner = new AgentRunner(options);

  return {
    runner,
    startAgent: (agentId, projectId, gitRepo) =>
      runner.startAgent({
        type: "aider",
        agentId,
        projectId,
        mcpServerUrl: "", // Aider doesn't use MCP
        gitRepo,
        workDir: "/home/user/workspace",
        env: {
          OPENAI_API_KEY: process.env.OPENAI_API_KEY || "",
          ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || "",
        },
      }),
    runAgent: (agentId, projectId, gitRepo) =>
      runner.runAgent({
        type: "aider",
        agentId,
        projectId,
        mcpServerUrl: "",
        gitRepo,
        workDir: "/home/user/workspace",
        env: {
          OPENAI_API_KEY: process.env.OPENAI_API_KEY || "",
          ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || "",
        },
      }),
  };
}

/**
 * Create a pre-configured agent runner for Z.ai (GLM-4.7 via Claude Code)
 *
 * Z.ai provides an Anthropic-compatible API proxy that routes Claude Code
 * requests to GLM-4.7 models. Subscription plans start at $3/month.
 *
 * @see https://docs.z.ai/devpack/tool/claude
 */
export function createZaiRunner(
  mcpServerUrl: string,
  options: E2BRunnerOptions = {},
): {
  runner: AgentRunner;
  startAgent: (
    agentId: string,
    projectId: string,
    gitRepo?: string,
  ) => Promise<SandboxInstance>;
  runAgent: (
    agentId: string,
    projectId: string,
    gitRepo?: string,
  ) => Promise<AgentExecutionResult>;
} {
  const runner = new AgentRunner(options);

  // Z.ai environment variables for Anthropic-compatible proxy
  const zaiEnv = {
    ANTHROPIC_BASE_URL: "https://api.z.ai/api/anthropic",
    ANTHROPIC_AUTH_TOKEN: process.env.ZAI_API_KEY || "",
    API_TIMEOUT_MS: "3000000",
  };

  return {
    runner,
    startAgent: (agentId, projectId, gitRepo) =>
      runner.startAgent({
        type: "zencoder",
        agentId,
        projectId,
        mcpServerUrl,
        gitRepo,
        workDir: "/home/user/workspace",
        env: zaiEnv,
      }),
    runAgent: (agentId, projectId, gitRepo) =>
      runner.runAgent({
        type: "zencoder",
        agentId,
        projectId,
        mcpServerUrl,
        gitRepo,
        workDir: "/home/user/workspace",
        env: zaiEnv,
      }),
  };
}

// Backwards compatibility alias
export const createZencoderRunner = createZaiRunner;
