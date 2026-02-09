import { Command } from "commander";
import path from "path";
import fs from "fs";
import chalk from "chalk";
import { SQLiteStateStore } from "@conductor/state";
import { createAgentProfile, DEFAULT_AGENT_PROFILES } from "@conductor/core";
import type { ConflictStrategy, TaskPriority } from "@conductor/core";
import { AgentRunner, SandboxManager } from "@conductor/e2b-runner";
import type { AgentRunnerType } from "@conductor/e2b-runner";

export const program = new Command();

program
  .name("conductor")
  .description(
    "Multi-LLM orchestration framework for autonomous agent coordination",
  )
  .version("0.1.0");

// Helper to get or create store
function getStore(): SQLiteStateStore {
  const dbPath = process.env["CONDUCTOR_DB"] || "./conductor.db";
  return new SQLiteStateStore(dbPath);
}

// Helper to find project in current directory
function findProject(store: SQLiteStateStore): string | null {
  const configPath = path.join(process.cwd(), ".conductor.json");
  if (fs.existsSync(configPath)) {
    const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    return config.projectId;
  }
  return null;
}

// ============================================================================
// Init Command
// ============================================================================

program
  .command("init")
  .description("Initialize Conductor in current directory")
  .option("-n, --name <name>", "Project name")
  .option(
    "-s, --strategy <strategy>",
    "Conflict strategy (lock, merge, zone, review)",
    "lock",
  )
  .option("-b, --budget <amount>", "Budget limit in USD")
  .action((options) => {
    const store = getStore();
    const name = options.name || path.basename(process.cwd());

    const slug = name.toLowerCase().replace(/[^a-z0-9-]/g, "-");
    const project = store.createProject({
      name,
      slug,
      organizationId: crypto.randomUUID(), // Default org for local projects
      rootPath: process.cwd(),
      gitBranch: "main",
      conflictStrategy: options.strategy as ConflictStrategy,
      settings: {},
      isActive: true,
      budget: options.budget
        ? {
            total: parseFloat(options.budget),
            spent: 0,
            currency: "USD",
            alertThreshold: 80,
          }
        : undefined,
    });

    // Write config file
    fs.writeFileSync(
      path.join(process.cwd(), ".conductor.json"),
      JSON.stringify({ projectId: project.id }, null, 2),
    );

    console.log(chalk.green("✓ Conductor initialized"));
    console.log(`  Project: ${chalk.bold(project.name)}`);
    console.log(`  ID: ${project.id}`);
    console.log(`  Strategy: ${project.conflictStrategy}`);
    if (project.budget) {
      console.log(`  Budget: $${project.budget.total}`);
    }
    console.log();
    console.log(chalk.dim("Next steps:"));
    console.log(chalk.dim("  conductor agent:register -i claude"));
    console.log(chalk.dim('  conductor task:add -t "Your first task"'));
  });

// ============================================================================
// Agent Commands
// ============================================================================

const agentCmd = program.command("agent").description("Manage agents");

agentCmd
  .command("register")
  .description("Register an agent with the project")
  .requiredOption("-i, --id <id>", "Agent ID (e.g., claude, gemini, codex)")
  .option("-n, --name <name>", "Agent display name")
  .option("-c, --capabilities <caps...>", "Agent capabilities")
  .action((options) => {
    const store = getStore();
    const projectId = findProject(store);
    if (!projectId) {
      console.error(
        chalk.red(
          "Error: Not in a Conductor project. Run `conductor init` first.",
        ),
      );
      process.exit(1);
    }

    const profile = createAgentProfile(options.id, {
      name: options.name,
      capabilities: options.capabilities,
    });

    store.registerAgent(projectId, profile);

    console.log(chalk.green(`✓ Registered agent: ${profile.name}`));
    console.log(`  ID: ${profile.id}`);
    console.log(`  Capabilities: ${profile.capabilities.join(", ")}`);
  });

agentCmd
  .command("list")
  .description("List all registered agents")
  .action(() => {
    const store = getStore();
    const projectId = findProject(store);
    if (!projectId) {
      console.error(chalk.red("Error: Not in a Conductor project."));
      process.exit(1);
    }

    const agents = store.listAgents(projectId);

    if (agents.length === 0) {
      console.log(chalk.dim("No agents registered."));
      console.log(
        chalk.dim("Register one with: conductor agent:register -i claude"),
      );
      return;
    }

    console.log(chalk.bold("\nRegistered Agents:\n"));
    for (const agent of agents) {
      const statusColor =
        agent.status === "working"
          ? chalk.green
          : agent.status === "blocked"
            ? chalk.red
            : chalk.gray;

      console.log(`  ${chalk.bold(agent.name)} (${agent.id})`);
      console.log(`    Status: ${statusColor(agent.status)}`);
      console.log(
        `    Capabilities: ${agent.capabilities.slice(0, 5).join(", ")}${agent.capabilities.length > 5 ? "..." : ""}`,
      );
      if (agent.lastHeartbeat) {
        console.log(`    Last seen: ${agent.lastHeartbeat.toLocaleString()}`);
      }
      console.log();
    }
  });

agentCmd
  .command("profiles")
  .description("Show available agent profiles")
  .action(() => {
    console.log(chalk.bold("\nAvailable Agent Profiles:\n"));
    for (const [id, profile] of Object.entries(DEFAULT_AGENT_PROFILES)) {
      console.log(`  ${chalk.bold(profile.name)} (${id})`);
      console.log(`    Capabilities: ${profile.capabilities.join(", ")}`);
      console.log(
        `    Cost: $${(profile.costPerToken.input * 1_000_000).toFixed(2)}/M input, $${(profile.costPerToken.output * 1_000_000).toFixed(2)}/M output`,
      );
      console.log();
    }
  });

// ============================================================================
// Task Commands
// ============================================================================

const taskCmd = program.command("task").description("Manage tasks");

taskCmd
  .command("add")
  .description("Add a new task")
  .requiredOption("-t, --title <title>", "Task title")
  .option("-d, --description <desc>", "Task description")
  .option(
    "-p, --priority <priority>",
    "Priority (critical, high, medium, low)",
    "medium",
  )
  .option("--deps <deps...>", "Task dependencies (task IDs)")
  .option("--files <files...>", "Related files")
  .option(
    "--tags <tags...>",
    "Task tags (use requires:X for capability requirements)",
  )
  .action((options) => {
    const store = getStore();
    const projectId = findProject(store);
    if (!projectId) {
      console.error(chalk.red("Error: Not in a Conductor project."));
      process.exit(1);
    }

    const task = store.createTask(projectId, {
      title: options.title,
      description: options.description,
      priority: options.priority as TaskPriority,
      dependencies: options.deps || [],
      files: options.files || [],
      tags: options.tags || [],
      status: "pending",
      metadata: {},
    });

    console.log(chalk.green(`✓ Created task: ${task.title}`));
    console.log(`  ID: ${task.id}`);
    console.log(`  Priority: ${task.priority}`);
    if (task.files.length > 0) {
      console.log(`  Files: ${task.files.join(", ")}`);
    }
  });

taskCmd
  .command("list")
  .description("List all tasks")
  .option("-s, --status <status>", "Filter by status")
  .option("-p, --priority <priority>", "Filter by priority")
  .option("-a, --assigned <agent>", "Filter by assigned agent")
  .action((options) => {
    const store = getStore();
    const projectId = findProject(store);
    if (!projectId) {
      console.error(chalk.red("Error: Not in a Conductor project."));
      process.exit(1);
    }

    const tasks = store.listTasks(projectId, {
      status: options.status,
      priority: options.priority,
      assignedTo: options.assigned,
    });

    if (tasks.length === 0) {
      console.log(chalk.dim("No tasks found."));
      return;
    }

    console.log(chalk.bold(`\nTasks (${tasks.length}):\n`));

    for (const task of tasks) {
      const statusEmoji =
        task.status === "completed"
          ? "✓"
          : task.status === "in_progress"
            ? "▶"
            : task.status === "failed"
              ? "✗"
              : task.status === "blocked"
                ? "⏸"
                : "○";

      const statusColor =
        task.status === "completed"
          ? chalk.green
          : task.status === "in_progress"
            ? chalk.blue
            : task.status === "failed"
              ? chalk.red
              : task.status === "blocked"
                ? chalk.yellow
                : chalk.gray;

      const priorityColor =
        task.priority === "critical"
          ? chalk.red
          : task.priority === "high"
            ? chalk.yellow
            : chalk.gray;

      console.log(
        `  ${statusColor(statusEmoji)} ${chalk.bold(task.title)} ${priorityColor(`[${task.priority}]`)}`,
      );
      console.log(chalk.dim(`    ID: ${task.id.slice(0, 8)}...`));
      if (task.assignedTo) {
        console.log(chalk.dim(`    Assigned: ${task.assignedTo}`));
      }
      console.log();
    }
  });

taskCmd
  .command("show <taskId>")
  .description("Show task details")
  .action((taskId) => {
    const store = getStore();
    const task = store.getTask(taskId);

    if (!task) {
      console.error(chalk.red(`Task not found: ${taskId}`));
      process.exit(1);
    }

    console.log(chalk.bold(`\n${task.title}\n`));
    console.log(`ID: ${task.id}`);
    console.log(`Status: ${task.status}`);
    console.log(`Priority: ${task.priority}`);
    if (task.description) console.log(`Description: ${task.description}`);
    if (task.assignedTo) console.log(`Assigned to: ${task.assignedTo}`);
    if (task.files.length > 0) console.log(`Files: ${task.files.join(", ")}`);
    if (task.tags.length > 0) console.log(`Tags: ${task.tags.join(", ")}`);
    if (task.dependencies.length > 0)
      console.log(`Dependencies: ${task.dependencies.join(", ")}`);
    console.log(`Created: ${task.createdAt.toLocaleString()}`);
    if (task.startedAt)
      console.log(`Started: ${task.startedAt.toLocaleString()}`);
    if (task.completedAt)
      console.log(`Completed: ${task.completedAt.toLocaleString()}`);
  });

// ============================================================================
// Status Command
// ============================================================================

program
  .command("status")
  .description("Show project status overview")
  .action(() => {
    const store = getStore();
    const projectId = findProject(store);
    if (!projectId) {
      console.error(chalk.red("Error: Not in a Conductor project."));
      process.exit(1);
    }

    const project = store.getProject(projectId);
    const tasks = store.listTasks(projectId);
    const agents = store.listAgents(projectId);
    const spend = store.getProjectSpend(projectId);

    if (!project) {
      console.error(chalk.red("Project not found."));
      process.exit(1);
    }

    console.log(chalk.bold(`\n${project.name}\n`));

    // Task summary
    const pending = tasks.filter((t) => t.status === "pending").length;
    const inProgress = tasks.filter((t) => t.status === "in_progress").length;
    const completed = tasks.filter((t) => t.status === "completed").length;
    const blocked = tasks.filter((t) => t.status === "blocked").length;

    console.log(chalk.bold("Tasks:"));
    console.log(`  ○ Pending: ${pending}`);
    console.log(`  ▶ In Progress: ${inProgress}`);
    console.log(`  ✓ Completed: ${completed}`);
    if (blocked > 0) console.log(chalk.yellow(`  ⏸ Blocked: ${blocked}`));
    console.log();

    // Agent summary
    console.log(chalk.bold("Agents:"));
    if (agents.length === 0) {
      console.log(chalk.dim("  None registered"));
    } else {
      for (const agent of agents) {
        const statusIcon =
          agent.status === "working"
            ? "🟢"
            : agent.status === "blocked"
              ? "🔴"
              : "⚪";
        console.log(`  ${statusIcon} ${agent.name}: ${agent.status}`);
      }
    }
    console.log();

    // Budget
    if (project.budget) {
      const pct = ((spend / project.budget.total) * 100).toFixed(1);
      const remaining = project.budget.total - spend;
      const budgetColor = parseFloat(pct) > 80 ? chalk.red : chalk.green;

      console.log(chalk.bold("Budget:"));
      console.log(`  Spent: ${budgetColor(`$${spend.toFixed(4)} (${pct}%)`)}`);
      console.log(`  Remaining: $${remaining.toFixed(4)}`);
      console.log(`  Total: $${project.budget.total}`);
    } else if (spend > 0) {
      console.log(chalk.bold("Spending:"));
      console.log(`  Total: $${spend.toFixed(4)}`);
    }
  });

// ============================================================================
// Serve Command
// ============================================================================

program
  .command("serve")
  .description("Start MCP server (stdio mode)")
  .action(() => {
    const store = getStore();
    const projectId = findProject(store);
    if (!projectId) {
      console.error(chalk.red("Error: Not in a Conductor project."));
      process.exit(1);
    }

    console.log(chalk.dim("Starting MCP server..."));
    console.log(chalk.dim("Use with Claude CLI:"));
    console.log(
      chalk.dim(`  CONDUCTOR_PROJECT=${projectId} npx @conductor/mcp-server`),
    );

    // In a full implementation, we'd spawn the MCP server process here
    console.log();
    console.log(chalk.yellow("Note: Run the MCP server directly with:"));
    console.log(`  CONDUCTOR_PROJECT=${projectId} npx @conductor/mcp-server`);
  });

// ============================================================================
// E2B Sandbox Commands
// ============================================================================

// Singleton instances for sandbox management
let sandboxManager: SandboxManager | null = null;
let agentRunner: AgentRunner | null = null;

function getSandboxManager(): SandboxManager {
  if (!sandboxManager) {
    sandboxManager = new SandboxManager({
      onEvent: (event) => {
        const timestamp = event.timestamp.toLocaleTimeString();
        switch (event.type) {
          case "sandbox:created":
            console.log(chalk.dim(`[${timestamp}] Sandbox creating...`));
            break;
          case "sandbox:started":
            console.log(
              chalk.green(`[${timestamp}] Sandbox ${event.sandboxId} started`),
            );
            break;
          case "sandbox:stopped":
            console.log(
              chalk.yellow(`[${timestamp}] Sandbox ${event.sandboxId} stopped`),
            );
            break;
          case "sandbox:failed":
            console.log(
              chalk.red(
                `[${timestamp}] Sandbox failed: ${event.data?.["error"]}`,
              ),
            );
            break;
          case "sandbox:timeout":
            console.log(
              chalk.red(`[${timestamp}] Sandbox ${event.sandboxId} timed out`),
            );
            break;
        }
      },
    });
  }
  return sandboxManager;
}

function getAgentRunner(): AgentRunner {
  if (!agentRunner) {
    agentRunner = new AgentRunner({
      onEvent: (event) => {
        const timestamp = event.timestamp.toLocaleTimeString();
        console.log(
          chalk.dim(`[${timestamp}] ${event.type}: ${event.sandboxId}`),
        );
      },
    });
  }
  return agentRunner;
}

const sandboxCmd = program
  .command("sandbox")
  .description("Manage E2B sandboxes for agent execution");

sandboxCmd
  .command("create")
  .description("Create a new E2B sandbox")
  .requiredOption("-a, --agent <agentId>", "Agent ID")
  .option("-t, --template <template>", "E2B template (default: base)", "base")
  .option("--timeout <seconds>", "Sandbox timeout in seconds", "300")
  .action(async (options) => {
    const store = getStore();
    const projectId = findProject(store);
    if (!projectId) {
      console.error(chalk.red("Error: Not in a Conductor project."));
      process.exit(1);
    }

    console.log(chalk.dim("Creating E2B sandbox..."));

    try {
      const manager = getSandboxManager();
      const instance = await manager.createSandbox(options.agent, projectId, {
        template: options.template,
        timeout: parseInt(options.timeout),
      });

      console.log(chalk.green(`\n✓ Sandbox created`));
      console.log(`  ID: ${instance.id}`);
      console.log(`  Agent: ${instance.agentId}`);
      console.log(`  Template: ${instance.template}`);
      console.log(`  Status: ${instance.status}`);
      console.log();
      console.log(chalk.dim("Run commands with:"));
      console.log(
        chalk.dim(`  conductor sandbox exec ${instance.id} "ls -la"`),
      );
    } catch (error) {
      console.error(chalk.red(`Failed to create sandbox: ${error}`));
      process.exit(1);
    }
  });

sandboxCmd
  .command("list")
  .description("List running sandboxes")
  .option(
    "-s, --status <status>",
    "Filter by status (running, stopped, failed, timeout)",
  )
  .option("-a, --agent <agentId>", "Filter by agent ID")
  .action((options) => {
    const manager = getSandboxManager();
    const instances = manager.listInstances({
      status: options.status,
      agentId: options.agent,
    });

    if (instances.length === 0) {
      console.log(chalk.dim("No sandboxes found."));
      return;
    }

    console.log(chalk.bold(`\nSandboxes (${instances.length}):\n`));

    for (const instance of instances) {
      const statusColor =
        instance.status === "running"
          ? chalk.green
          : instance.status === "stopped"
            ? chalk.gray
            : chalk.red;

      console.log(`  ${chalk.bold(instance.id)}`);
      console.log(`    Agent: ${instance.agentId}`);
      console.log(`    Status: ${statusColor(instance.status)}`);
      console.log(`    Template: ${instance.template}`);
      console.log(`    Started: ${instance.startedAt.toLocaleString()}`);
      console.log(
        `    Last Activity: ${instance.lastActivityAt.toLocaleString()}`,
      );
      console.log();
    }
  });

sandboxCmd
  .command("exec <sandboxId> <command>")
  .description("Execute a command in a sandbox")
  .option("--cwd <directory>", "Working directory")
  .option("--timeout <seconds>", "Command timeout in seconds", "60")
  .action(async (sandboxId, command, options) => {
    try {
      const manager = getSandboxManager();
      const result = await manager.executeCommand(sandboxId, command, {
        cwd: options.cwd,
        timeout: parseInt(options.timeout),
      });

      if (result.stdout) {
        console.log(result.stdout);
      }
      if (result.stderr) {
        console.error(chalk.yellow(result.stderr));
      }

      if (result.exitCode !== 0) {
        console.log(chalk.red(`\nExit code: ${result.exitCode}`));
        process.exit(result.exitCode);
      }
    } catch (error) {
      console.error(chalk.red(`Failed to execute command: ${error}`));
      process.exit(1);
    }
  });

sandboxCmd
  .command("stop <sandboxId>")
  .description("Stop a running sandbox")
  .action(async (sandboxId) => {
    try {
      const manager = getSandboxManager();
      await manager.stopSandbox(sandboxId);
      console.log(chalk.green(`✓ Sandbox ${sandboxId} stopped`));
    } catch (error) {
      console.error(chalk.red(`Failed to stop sandbox: ${error}`));
      process.exit(1);
    }
  });

sandboxCmd
  .command("stop-all")
  .description("Stop all running sandboxes")
  .action(async () => {
    const manager = getSandboxManager();
    const running = manager.listInstances({ status: "running" });

    if (running.length === 0) {
      console.log(chalk.dim("No running sandboxes to stop."));
      return;
    }

    console.log(chalk.dim(`Stopping ${running.length} sandbox(es)...`));
    await manager.stopAll();
    console.log(chalk.green(`✓ All sandboxes stopped`));
  });

sandboxCmd
  .command("stats")
  .description("Show sandbox statistics")
  .action(() => {
    const manager = getSandboxManager();
    const stats = manager.getStats();

    console.log(chalk.bold("\nSandbox Statistics:\n"));
    console.log(`  Total: ${stats.total}`);
    console.log(`  ${chalk.green("Running")}: ${stats.running}`);
    console.log(`  ${chalk.gray("Stopped")}: ${stats.stopped}`);
    console.log(`  ${chalk.red("Failed")}: ${stats.failed}`);
    console.log(`  ${chalk.yellow("Timeout")}: ${stats.timeout}`);
  });

// ============================================================================
// Agent Spawn Commands (E2B-based)
// ============================================================================

const spawnCmd = program
  .command("spawn")
  .description("Spawn agents in E2B sandboxes");

spawnCmd
  .command("agent")
  .description("Spawn an agent in an E2B sandbox")
  .requiredOption("-i, --id <agentId>", "Agent ID")
  .requiredOption(
    "-t, --type <type>",
    "Agent type (claude-code, aider, copilot, crush, custom)",
  )
  .option("-r, --repo <gitRepo>", "Git repository to clone")
  .option("-b, --branch <branch>", "Git branch to checkout")
  .option("-m, --mcp <url>", "MCP server URL")
  .option(
    "-w, --workdir <path>",
    "Working directory in sandbox",
    "/home/user/workspace",
  )
  .option("--timeout <seconds>", "Sandbox timeout in seconds", "300")
  .option("--run", "Run agent immediately (wait for completion)")
  .action(async (options) => {
    const store = getStore();
    const projectId = findProject(store);
    if (!projectId) {
      console.error(chalk.red("Error: Not in a Conductor project."));
      process.exit(1);
    }

    const agentType = options.type as AgentRunnerType;
    if (
      !["claude-code", "aider", "copilot", "crush", "custom"].includes(
        agentType,
      )
    ) {
      console.error(chalk.red(`Invalid agent type: ${options.type}`));
      console.log(
        chalk.dim("Valid types: claude-code, aider, copilot, crush, custom"),
      );
      process.exit(1);
    }

    const mcpUrl =
      options.mcp ||
      process.env["CONDUCTOR_MCP_URL"] ||
      "http://localhost:3001";

    console.log(chalk.dim(`Spawning ${options.type} agent...`));

    try {
      const runner = getAgentRunner();

      if (options.run) {
        // Run agent and wait for completion
        console.log(chalk.dim("Running agent (waiting for completion)..."));
        const result = await runner.runAgent({
          type: agentType,
          agentId: options.id,
          projectId,
          mcpServerUrl: mcpUrl,
          gitRepo: options.repo,
          gitBranch: options.branch,
          workDir: options.workdir,
          sandbox: {
            timeout: parseInt(options.timeout),
          },
        });

        if (result.success) {
          console.log(chalk.green(`\n✓ Agent completed successfully`));
          console.log(`  Duration: ${(result.duration / 1000).toFixed(1)}s`);
          if (result.stdout) {
            console.log(chalk.dim("\nOutput:"));
            console.log(result.stdout);
          }
        } else {
          console.log(chalk.red(`\n✗ Agent failed`));
          console.log(`  Exit code: ${result.exitCode || "N/A"}`);
          if (result.error) {
            console.log(`  Error: ${result.error}`);
          }
          if (result.stderr) {
            console.log(chalk.yellow("\nStderr:"));
            console.log(result.stderr);
          }
          process.exit(1);
        }
      } else {
        // Start agent without waiting
        const instance = await runner.startAgent({
          type: agentType,
          agentId: options.id,
          projectId,
          mcpServerUrl: mcpUrl,
          gitRepo: options.repo,
          gitBranch: options.branch,
          workDir: options.workdir,
          sandbox: {
            timeout: parseInt(options.timeout),
          },
        });

        console.log(chalk.green(`\n✓ Agent spawned`));
        console.log(`  Sandbox ID: ${instance.id}`);
        console.log(`  Agent ID: ${options.id}`);
        console.log(`  Type: ${options.type}`);
        console.log(`  Status: ${instance.status}`);
        console.log();
        console.log(chalk.dim("Monitor with:"));
        console.log(chalk.dim(`  conductor spawn status ${options.id}`));
        console.log(chalk.dim("Stop with:"));
        console.log(chalk.dim(`  conductor spawn stop ${options.id}`));
      }
    } catch (error) {
      console.error(chalk.red(`Failed to spawn agent: ${error}`));
      process.exit(1);
    }
  });

spawnCmd
  .command("status [agentId]")
  .description("Show status of spawned agents")
  .action((agentId) => {
    const runner = getAgentRunner();

    if (agentId) {
      const info = runner.getRunningAgent(agentId);
      if (!info) {
        console.log(chalk.dim(`Agent ${agentId} is not running.`));
        return;
      }

      console.log(chalk.bold(`\nAgent: ${agentId}\n`));
      console.log(`  Sandbox ID: ${info.sandboxId}`);
      console.log(`  Status: ${chalk.green(info.instance.status)}`);
      console.log(`  Started: ${info.startTime.toLocaleString()}`);
      console.log(
        `  Last Activity: ${info.instance.lastActivityAt.toLocaleString()}`,
      );
    } else {
      const agents = runner.listRunningAgents();

      if (agents.length === 0) {
        console.log(chalk.dim("No agents currently running."));
        return;
      }

      console.log(chalk.bold(`\nRunning Agents (${agents.length}):\n`));
      for (const agent of agents) {
        const runtime = Math.floor(
          (Date.now() - agent.startTime.getTime()) / 1000,
        );
        console.log(`  ${chalk.bold(agent.agentId)}`);
        console.log(`    Sandbox: ${agent.sandboxId}`);
        console.log(`    Running for: ${runtime}s`);
        console.log();
      }
    }
  });

spawnCmd
  .command("stop <agentId>")
  .description("Stop a running agent")
  .action(async (agentId) => {
    try {
      const runner = getAgentRunner();
      await runner.stopAgent(agentId);
      console.log(chalk.green(`✓ Agent ${agentId} stopped`));
    } catch (error) {
      console.error(chalk.red(`Failed to stop agent: ${error}`));
      process.exit(1);
    }
  });

spawnCmd
  .command("stop-all")
  .description("Stop all running agents")
  .action(async () => {
    const runner = getAgentRunner();
    const agents = runner.listRunningAgents();

    if (agents.length === 0) {
      console.log(chalk.dim("No running agents to stop."));
      return;
    }

    console.log(chalk.dim(`Stopping ${agents.length} agent(s)...`));
    await runner.stopAllAgents();
    console.log(chalk.green(`✓ All agents stopped`));
  });

spawnCmd
  .command("exec <agentId> <command>")
  .description("Execute a command in a running agent sandbox")
  .option("--cwd <directory>", "Working directory")
  .option("--timeout <seconds>", "Command timeout in seconds", "60")
  .action(async (agentId, command, options) => {
    try {
      const runner = getAgentRunner();
      const result = await runner.executeInAgent(agentId, command, {
        cwd: options.cwd,
        timeout: parseInt(options.timeout),
      });

      if (result.stdout) {
        console.log(result.stdout);
      }
      if (result.stderr) {
        console.error(chalk.yellow(result.stderr));
      }

      if (result.exitCode !== 0) {
        console.log(chalk.red(`\nExit code: ${result.exitCode}`));
        process.exit(result.exitCode);
      }
    } catch (error) {
      console.error(chalk.red(`Failed to execute command: ${error}`));
      process.exit(1);
    }
  });

// ============================================================================
// Import Beads Command (Gastown Integration)
// ============================================================================

program
  .command("import-beads")
  .description("Import beads and convoys from .gt/ directory as Conductor tasks")
  .option("--beads <path>", "Path to beads directory", ".gt/beads")
  .option("--convoys <path>", "Path to convoys directory", ".gt/convoys")
  .option("-p, --project <id>", "Project ID (auto-detected from .conductor.json)")
  .action((options) => {
    const store = getStore();

    try {
      const projectId = options.project || findProject(store);
      if (!projectId) {
        console.error(
          chalk.red("No project found. Run 'conductor init' first or specify --project."),
        );
        process.exit(1);
      }

      const beadDir = path.resolve(options.beads);
      const convoyDir = path.resolve(options.convoys);

      console.log(chalk.blue(`Importing beads from ${beadDir}...`));

      const result = store.importBeadsFromDirectory(
        projectId,
        beadDir,
        fs.existsSync(convoyDir) ? convoyDir : undefined,
      );

      console.log(chalk.green(`\nImport complete:`));
      console.log(`  Imported: ${chalk.bold(String(result.imported))}`);
      console.log(`  Skipped:  ${chalk.bold(String(result.skipped))}`);

      if (result.errors.length > 0) {
        console.log(chalk.yellow(`\n  Errors:`));
        result.errors.forEach((err) => {
          console.log(chalk.yellow(`    - ${err}`));
        });
      }
    } finally {
      store.close();
    }
  });

export default program;
