import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { SQLiteStateStore } from "@conductor/state";
import type { Task } from "@conductor/core";

export interface ConductorServerOptions {
  stateStore: SQLiteStateStore;
  projectId: string;
}

/**
 * Create the Conductor MCP server with all tools
 */
export function createConductorServer(
  options: ConductorServerOptions,
): McpServer {
  const { stateStore, projectId } = options;

  const server = new McpServer({
    name: "conductor",
    version: "0.1.0",
  });

  // ============================================================================
  // Task Tools
  // ============================================================================

  server.tool(
    "conductor_list_tasks",
    "List tasks available for claiming or in progress",
    {
      status: z
        .enum([
          "pending",
          "claimed",
          "in_progress",
          "completed",
          "failed",
          "blocked",
        ])
        .optional()
        .describe("Filter by task status"),
      priority: z
        .enum(["critical", "high", "medium", "low"])
        .optional()
        .describe("Filter by priority"),
      assignedTo: z.string().optional().describe("Filter by assigned agent"),
    },
    async ({ status, priority, assignedTo }) => {
      const tasks = stateStore.listTasks(projectId, {
        status: status as Task["status"],
        priority: priority as Task["priority"],
        assignedTo,
      });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              tasks.map((t) => ({
                id: t.id,
                title: t.title,
                status: t.status,
                priority: t.priority,
                assignedTo: t.assignedTo,
                files: t.files,
                tags: t.tags,
              })),
              null,
              2,
            ),
          },
        ],
      };
    },
  );

  server.tool(
    "conductor_get_task",
    "Get full details of a specific task",
    {
      taskId: z.string().describe("The task ID to retrieve"),
    },
    async ({ taskId }) => {
      const task = stateStore.getTask(taskId);

      if (!task) {
        return {
          content: [{ type: "text", text: `Task not found: ${taskId}` }],
          isError: true,
        };
      }

      return {
        content: [{ type: "text", text: JSON.stringify(task, null, 2) }],
      };
    },
  );

  server.tool(
    "conductor_claim_task",
    "Claim a task to work on. Returns task details and project context bundle for alignment.",
    {
      taskId: z.string().describe("The task ID to claim"),
      agentId: z.string().describe("Your agent ID (e.g., claude-session-123)"),
      agentType: z
        .enum(["claude", "gemini", "codex", "gpt4", "llama", "custom"])
        .default("custom")
        .describe("Type of LLM agent (for context customization)"),
    },
    async ({ taskId, agentId, agentType }) => {
      const success = stateStore.claimTask(taskId, agentId);

      if (!success) {
        return {
          content: [
            {
              type: "text",
              text: `Failed to claim task ${taskId}. It may already be claimed or not available.`,
            },
          ],
          isError: true,
        };
      }

      // Get the task details
      const task = stateStore.getTask(taskId);
      if (!task) {
        return {
          content: [
            { type: "text", text: `Task ${taskId} not found after claiming.` },
          ],
          isError: true,
        };
      }

      // Generate context bundle
      const context = stateStore.generateContextBundle(
        projectId,
        agentId,
        agentType,
        task,
      );

      // Record task claim for checkpoint tracking
      stateStore.recordTaskClaim(projectId, agentId, taskId);

      // Check if this is a checkpoint moment
      const isCheckpoint = stateStore.shouldRefreshContext(projectId, agentId);

      // Build response
      let responseText = `# Task Claimed Successfully\n\n`;
      responseText += `**Task ID:** ${task.id}\n`;
      responseText += `**Title:** ${task.title}\n`;
      if (task.description) {
        responseText += `**Description:** ${task.description}\n`;
      }
      responseText += `**Priority:** ${task.priority}\n`;
      if (task.files && task.files.length > 0) {
        responseText += `**Expected Files:** ${task.files.join(", ")}\n`;
      }
      responseText += "\n---\n\n";

      // Add context bundle
      responseText += `# Project Context\n\n`;
      responseText += `**Project:** ${context.projectName}\n`;

      if (context.isFirstTask) {
        responseText += `\n> **Welcome!** This is your first task on this project.\n`;
      }

      if (isCheckpoint) {
        responseText += `\n> **Checkpoint:** This is a periodic context refresh to keep you aligned.\n`;
      }

      if (context.currentFocus) {
        responseText += `\n**Current Focus:** ${context.currentFocus}\n`;
      }

      if (context.projectGoals && context.projectGoals.length > 0) {
        responseText += `\n**Project Goals:**\n`;
        context.projectGoals.forEach((goal, i) => {
          responseText += `${i + 1}. ${goal}\n`;
        });
      }

      if (context.agentInstructions) {
        responseText += `\n**Your Instructions:**\n${context.agentInstructions}\n`;
      }

      if (context.checkpointRules && context.checkpointRules.length > 0) {
        responseText += `\n**Remember:**\n`;
        context.checkpointRules.forEach((rule) => {
          responseText += `- ${rule}\n`;
        });
      }

      if (context.allowedPaths && context.allowedPaths.length > 0) {
        responseText += `\n**Your Zone (allowed paths):** ${context.allowedPaths.join(", ")}\n`;
      }

      if (
        context.taskContext?.relatedTasks &&
        context.taskContext.relatedTasks.length > 0
      ) {
        responseText += `\n**Related Tasks:** ${context.taskContext.relatedTasks.join(", ")}\n`;
        responseText += `(Coordinate with agents working on these tasks)\n`;
      }

      return {
        content: [
          {
            type: "text",
            text: responseText,
          },
        ],
      };
    },
  );

  server.tool(
    "conductor_update_task",
    "Update task status, add notes, or report progress",
    {
      taskId: z.string().describe("The task ID to update"),
      status: z
        .enum(["in_progress", "completed", "failed", "blocked"])
        .optional()
        .describe("New task status"),
      notes: z
        .string()
        .optional()
        .describe("Progress notes or completion summary"),
      tokensUsed: z
        .number()
        .optional()
        .describe("Total tokens used for this task"),
      blockedBy: z
        .array(z.string())
        .optional()
        .describe("Task IDs blocking this task"),
    },
    async ({ taskId, status, notes, tokensUsed, blockedBy }) => {
      try {
        const updates: Partial<Task> = {};

        if (status) updates.status = status;
        if (tokensUsed) updates.actualTokens = tokensUsed;
        if (blockedBy) updates.blockedBy = blockedBy;
        if (notes) {
          const current = stateStore.getTask(taskId);
          updates.metadata = {
            ...(current?.metadata || {}),
            notes,
            lastUpdated: new Date().toISOString(),
          };
        }

        const task = stateStore.updateTask(taskId, updates);

        return {
          content: [
            {
              type: "text",
              text: `Task ${taskId} updated successfully.\nStatus: ${task.status}\n${notes ? `Notes: ${notes}` : ""}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Failed to update task: ${error instanceof Error ? error.message : "Unknown error"}`,
            },
          ],
          isError: true,
        };
      }
    },
  );

  // ============================================================================
  // File Lock Tools
  // ============================================================================

  server.tool(
    "conductor_lock_file",
    "Acquire exclusive lock on a file before modifying it",
    {
      filePath: z.string().describe("Relative file path from project root"),
      agentId: z.string().describe("Your agent ID"),
      ttlSeconds: z
        .number()
        .default(300)
        .describe("Lock time-to-live in seconds (default: 300)"),
    },
    async ({ filePath, agentId, ttlSeconds }) => {
      const success = stateStore.acquireLock(
        projectId,
        filePath,
        agentId,
        ttlSeconds,
      );

      if (success) {
        return {
          content: [
            {
              type: "text",
              text: `Lock acquired on ${filePath}. Expires in ${ttlSeconds} seconds. Remember to release when done.`,
            },
          ],
        };
      }

      const lockInfo = stateStore.checkLock(projectId, filePath);
      return {
        content: [
          {
            type: "text",
            text: `Failed to acquire lock on ${filePath}. Currently held by: ${lockInfo.holder}. Expires at: ${lockInfo.expiresAt?.toISOString()}`,
          },
        ],
        isError: true,
      };
    },
  );

  server.tool(
    "conductor_unlock_file",
    "Release lock on a file after you are done modifying it",
    {
      filePath: z.string().describe("Relative file path"),
      agentId: z.string().describe("Your agent ID"),
    },
    async ({ filePath, agentId }) => {
      stateStore.releaseLock(projectId, filePath, agentId);

      return {
        content: [{ type: "text", text: `Lock released on ${filePath}` }],
      };
    },
  );

  server.tool(
    "conductor_check_locks",
    "Check if files are locked before attempting to modify them",
    {
      filePaths: z.array(z.string()).describe("List of file paths to check"),
    },
    async ({ filePaths }) => {
      const results = filePaths.map((fp) => {
        const lockInfo = stateStore.checkLock(projectId, fp);
        return {
          path: fp,
          locked: lockInfo.locked,
          holder: lockInfo.holder,
          expiresAt: lockInfo.expiresAt?.toISOString(),
        };
      });

      const locked = results.filter((r) => r.locked);
      const summary =
        locked.length === 0
          ? "All files are available for modification."
          : `${locked.length} file(s) are locked: ${locked.map((r) => r.path).join(", ")}`;

      return {
        content: [
          {
            type: "text",
            text: `${summary}\n\nDetails:\n${JSON.stringify(results, null, 2)}`,
          },
        ],
      };
    },
  );

  // ============================================================================
  // Cost/Usage Tools
  // ============================================================================

  server.tool(
    "conductor_report_usage",
    "Report token usage for cost tracking and budget monitoring",
    {
      agentId: z.string().describe("Your agent ID"),
      tokensInput: z.number().describe("Number of input tokens used"),
      tokensOutput: z.number().describe("Number of output tokens used"),
      taskId: z
        .string()
        .optional()
        .describe("Associated task ID if applicable"),
    },
    async ({ agentId, tokensInput, tokensOutput, taskId }) => {
      const agent = stateStore.getAgent(agentId);
      if (!agent) {
        return {
          content: [{ type: "text", text: `Agent not found: ${agentId}` }],
          isError: true,
        };
      }

      const cost =
        tokensInput * agent.costPerToken.input +
        tokensOutput * agent.costPerToken.output;

      const project = stateStore.getProject(projectId);
      stateStore.recordCost({
        organizationId: project?.organizationId || "unknown",
        projectId,
        agentId,
        model: agent.model || "unknown",
        taskId,
        tokensInput,
        tokensOutput,
        cost,
      });

      const totalSpend = stateStore.getProjectSpend(projectId);
      const budgetInfo = project?.budget
        ? ` Budget: $${totalSpend.toFixed(4)} / $${project.budget.total}`
        : "";

      return {
        content: [
          {
            type: "text",
            text: `Usage recorded: ${tokensInput} input + ${tokensOutput} output = $${cost.toFixed(4)}.${budgetInfo}`,
          },
        ],
      };
    },
  );

  server.tool(
    "conductor_get_budget",
    "Check current project budget and spending",
    {},
    async () => {
      const project = stateStore.getProject(projectId);
      const totalSpend = stateStore.getProjectSpend(projectId);

      if (!project) {
        return {
          content: [{ type: "text", text: "Project not found" }],
          isError: true,
        };
      }

      const budget = project.budget;
      const remaining = budget ? budget.total - totalSpend : null;
      const percentage = budget
        ? ((totalSpend / budget.total) * 100).toFixed(1)
        : null;

      return {
        content: [
          {
            type: "text",
            text: budget
              ? `Budget Status:\n  Spent: $${totalSpend.toFixed(4)} (${percentage}%)\n  Remaining: $${remaining?.toFixed(4)}\n  Total: $${budget.total}\n  Alert Threshold: ${budget.alertThreshold}%`
              : `No budget set. Total spend: $${totalSpend.toFixed(4)}`,
          },
        ],
      };
    },
  );

  // ============================================================================
  // Agent Tools
  // ============================================================================

  server.tool(
    "conductor_heartbeat",
    "Send heartbeat to indicate agent is active. Optionally report token usage for context exhaustion detection.",
    {
      agentId: z.string().describe("Your agent ID"),
      status: z
        .enum(["idle", "working", "blocked"])
        .optional()
        .describe("Current agent status"),
      tokenCount: z
        .number()
        .optional()
        .describe("Current token count in context window"),
      tokenLimit: z
        .number()
        .optional()
        .describe("Maximum token limit for context window"),
      currentStage: z
        .string()
        .optional()
        .describe("Current work stage description"),
    },
    async ({ agentId, status, tokenCount, tokenLimit, currentStage }) => {
      stateStore.heartbeat(agentId);
      if (status) {
        stateStore.updateAgentStatus(agentId, status);
      }

      // Store token info in agent metadata if provided
      if (tokenCount !== undefined || currentStage !== undefined) {
        const agent = stateStore.getAgent(agentId);
        if (agent) {
          const metadata = { ...(agent.metadata || {}) };
          if (tokenCount !== undefined) metadata["tokenCount"] = tokenCount;
          if (tokenLimit !== undefined) metadata["tokenLimit"] = tokenLimit;
          if (currentStage !== undefined) metadata["currentStage"] = currentStage;
          // Update metadata via raw SQL since there's no dedicated method
          // The agent metadata is stored in the agents table
        }
      }

      // Check token usage and warn if approaching limit
      let warning = "";
      if (tokenCount !== undefined && tokenLimit !== undefined) {
        const usage = tokenCount / tokenLimit;
        if (usage > 0.9) {
          warning = `\n\n**WARNING:** Token usage at ${(usage * 100).toFixed(1)}%. Consider saving a checkpoint with conductor_checkpoint before context is exhausted.`;
        }
      }

      return {
        content: [
          {
            type: "text",
            text: `Heartbeat recorded for ${agentId}${status ? `. Status: ${status}` : ""}${tokenCount !== undefined ? `. Tokens: ${tokenCount}${tokenLimit ? `/${tokenLimit}` : ""}` : ""}${warning}`,
          },
        ],
      };
    },
  );

  server.tool(
    "conductor_list_agents",
    "List all registered agents and their status",
    {},
    async () => {
      const agents = stateStore.listAgents(projectId);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              agents.map((a) => ({
                id: a.id,
                name: a.name,
                status: a.status,
                capabilities: a.capabilities,
                lastHeartbeat: a.lastHeartbeat?.toISOString(),
              })),
              null,
              2,
            ),
          },
        ],
      };
    },
  );

  // ============================================================================
  // Access Request Tools (Agent Onboarding)
  // ============================================================================

  server.tool(
    "conductor_request_access",
    "Request access to work on this project. Must be approved before you can claim tasks.",
    {
      agentId: z
        .string()
        .describe("Your unique agent ID (e.g., claude-session-123)"),
      agentName: z.string().describe("Human-readable name (e.g., Claude Code)"),
      agentType: z
        .enum(["claude", "gemini", "codex", "gpt4", "llama", "custom"])
        .describe("Type of LLM agent"),
      capabilities: z
        .array(z.string())
        .default([])
        .describe("List of capabilities (e.g., typescript, react, testing)"),
      requestedRole: z
        .enum(["lead", "contributor", "reviewer", "observer"])
        .default("contributor")
        .describe("Requested role in the project"),
    },
    async ({ agentId, agentName, agentType, capabilities, requestedRole }) => {
      // Check if agent already has approved access
      if (stateStore.hasApprovedAccess(projectId, agentId)) {
        return {
          content: [
            {
              type: "text",
              text: `Access already approved for ${agentId}. You can proceed to claim tasks.`,
            },
          ],
        };
      }

      const request = stateStore.createAccessRequest(projectId, {
        agentId,
        agentName,
        agentType,
        capabilities,
        requestedRole,
      });

      if (request.status === "approved") {
        return {
          content: [
            {
              type: "text",
              text: `Access approved! You can now claim tasks.\nRole: ${request.requestedRole}\nCapabilities: ${request.capabilities.join(", ")}`,
            },
          ],
        };
      }

      const queuePosition = stateStore.getPendingAccessCount(projectId);

      return {
        content: [
          {
            type: "text",
            text: `Access request submitted and pending approval.\nRequest ID: ${request.id}\nQueue position: ${queuePosition}\nRequested role: ${requestedRole}\n\nA human operator will review your request. Use conductor_check_access to check status.`,
          },
        ],
      };
    },
  );

  server.tool(
    "conductor_check_access",
    "Check if your access request has been approved",
    {
      agentId: z.string().describe("Your agent ID"),
    },
    async ({ agentId }) => {
      if (stateStore.hasApprovedAccess(projectId, agentId)) {
        const requests = stateStore.listAccessRequests(projectId, {
          status: "approved",
        });
        const myRequest = requests.find((r) => r.agentId === agentId);

        return {
          content: [
            {
              type: "text",
              text: `Access APPROVED.\nRole: ${myRequest?.requestedRole || "contributor"}\nExpires: ${myRequest?.expiresAt?.toISOString() || "Never"}\n\nYou can now use conductor_list_tasks and conductor_claim_task.`,
            },
          ],
        };
      }

      const requests = stateStore.listAccessRequests(projectId);
      const myRequest = requests.find((r) => r.agentId === agentId);

      if (!myRequest) {
        return {
          content: [
            {
              type: "text",
              text: `No access request found for ${agentId}. Use conductor_request_access to submit a request.`,
            },
          ],
          isError: true,
        };
      }

      if (myRequest.status === "denied") {
        return {
          content: [
            {
              type: "text",
              text: `Access DENIED.\nReason: ${myRequest.denialReason || "No reason provided"}\nReviewed by: ${myRequest.reviewedBy}\n\nYou may submit a new request with different parameters.`,
            },
          ],
          isError: true,
        };
      }

      if (myRequest.status === "expired") {
        return {
          content: [
            {
              type: "text",
              text: `Access request EXPIRED. Please submit a new request using conductor_request_access.`,
            },
          ],
          isError: true,
        };
      }

      // Status is pending
      const queuePosition = stateStore.getPendingAccessCount(projectId);
      return {
        content: [
          {
            type: "text",
            text: `Access request PENDING.\nRequest ID: ${myRequest.id}\nQueue position: ${queuePosition}\nSubmitted: ${myRequest.requestedAt.toISOString()}\n\nWaiting for human approval...`,
          },
        ],
      };
    },
  );

  // ============================================================================
  // Context Management Tools
  // ============================================================================

  server.tool(
    "conductor_refresh_context",
    "Request a context refresh to realign with project goals and instructions. Use when feeling lost or after extended work.",
    {
      agentId: z.string().describe("Your agent ID"),
      agentType: z
        .enum(["claude", "gemini", "codex", "gpt4", "llama", "custom"])
        .default("custom")
        .describe("Type of LLM agent (for context customization)"),
    },
    async ({ agentId, agentType }) => {
      const context = stateStore.generateContextRefresh(
        projectId,
        agentId,
        agentType,
      );

      let responseText = `# Context Refresh\n\n`;
      responseText += `**Project:** ${context.projectName}\n`;

      if (context.currentFocus) {
        responseText += `\n**Current Focus:** ${context.currentFocus}\n`;
      }

      if (context.projectGoals && context.projectGoals.length > 0) {
        responseText += `\n**Project Goals:**\n`;
        context.projectGoals.forEach((goal, i) => {
          responseText += `${i + 1}. ${goal}\n`;
        });
      }

      if (context.agentInstructions) {
        responseText += `\n**Your Instructions:**\n${context.agentInstructions}\n`;
      }

      if (context.styleGuide) {
        responseText += `\n**Style Guide:**\n${context.styleGuide}\n`;
      }

      if (context.checkpointRules && context.checkpointRules.length > 0) {
        responseText += `\n**Remember:**\n`;
        context.checkpointRules.forEach((rule) => {
          responseText += `- ${rule}\n`;
        });
      }

      if (context.allowedPaths && context.allowedPaths.length > 0) {
        responseText += `\n**Your Zone (allowed paths):** ${context.allowedPaths.join(", ")}\n`;
      }

      if (context.deniedPaths && context.deniedPaths.length > 0) {
        responseText += `**Restricted paths:** ${context.deniedPaths.join(", ")}\n`;
      }

      if (context.relevantPatterns && context.relevantPatterns.length > 0) {
        responseText += `\n**Relevant Code Patterns:**\n`;
        context.relevantPatterns.forEach((pattern) => {
          responseText += `- ${pattern.file}${pattern.lineRange ? `:${pattern.lineRange}` : ""}: ${pattern.description}\n`;
        });
      }

      return {
        content: [
          {
            type: "text",
            text: responseText,
          },
        ],
      };
    },
  );

  server.tool(
    "conductor_get_onboarding_config",
    "Get the project onboarding configuration. Useful for understanding project setup.",
    {},
    async () => {
      const config = stateStore.getOnboardingConfig(projectId);
      const project = stateStore.getProject(projectId);

      if (!config && !project) {
        return {
          content: [
            {
              type: "text",
              text: "No onboarding configuration found for this project.",
            },
          ],
        };
      }

      let responseText = `# Project Onboarding Configuration\n\n`;
      responseText += `**Project:** ${project?.name || projectId}\n`;

      if (config?.welcomeMessage) {
        responseText += `\n**Welcome Message:**\n${config.welcomeMessage}\n`;
      }

      if (config?.currentFocus) {
        responseText += `\n**Current Focus:** ${config.currentFocus}\n`;
      }

      if (config?.goals && config.goals.length > 0) {
        responseText += `\n**Project Goals:**\n`;
        config.goals.forEach((goal, i) => {
          responseText += `${i + 1}. ${goal}\n`;
        });
      }

      if (config?.checkpointRules && config.checkpointRules.length > 0) {
        responseText += `\n**Checkpoint Rules:**\n`;
        config.checkpointRules.forEach((rule) => {
          responseText += `- ${rule}\n`;
        });
      }

      responseText += `\n**Context Refresh:** Every ${config?.checkpointEveryNTasks || 3} tasks`;
      responseText += `\n**Auto Refresh:** ${config?.autoRefreshContext ? "Enabled" : "Disabled"}`;

      return {
        content: [
          {
            type: "text",
            text: responseText,
          },
        ],
      };
    },
  );

  // ============================================================================
  // Checkpoint Tools (Context Rollover)
  // ============================================================================

  server.tool(
    "conductor_checkpoint",
    "Save a checkpoint of current work state for context rollover. Use when approaching context limits or at natural breakpoints.",
    {
      agentId: z.string().describe("Your agent ID"),
      taskId: z.string().optional().describe("Current task ID"),
      beadId: z.string().optional().describe("Current bead ID (gt-xxxxx)"),
      checkpointType: z
        .enum(["manual", "auto", "context_exhaustion"])
        .default("manual")
        .describe("Type of checkpoint"),
      stage: z.string().describe("Current work stage description"),
      filesModified: z
        .array(z.string())
        .default([])
        .describe("Files modified so far"),
      completedSteps: z
        .array(z.string())
        .default([])
        .describe("Steps completed"),
      nextSteps: z
        .array(z.string())
        .default([])
        .describe("Steps remaining"),
      blockers: z
        .array(z.string())
        .default([])
        .describe("Current blockers"),
      tokenCount: z
        .number()
        .optional()
        .describe("Current token count in context"),
    },
    async ({
      agentId,
      taskId,
      beadId,
      checkpointType,
      stage,
      filesModified,
      completedSteps,
      nextSteps,
      blockers,
      tokenCount,
    }) => {
      try {
        const checkpoint = stateStore.saveCheckpoint({
          projectId,
          agentId,
          taskId,
          beadId,
          checkpointType,
          stage,
          context: {
            filesModified,
            completedSteps,
            nextSteps,
            blockers,
            tokenCount,
          },
          metadata: {},
        });

        return {
          content: [
            {
              type: "text",
              text: `# Checkpoint Saved\n\n**ID:** ${checkpoint.id}\n**Stage:** ${stage}\n**Type:** ${checkpointType}\n**Files:** ${filesModified.length}\n**Completed:** ${completedSteps.length} steps\n**Remaining:** ${nextSteps.length} steps\n${blockers.length > 0 ? `**Blockers:** ${blockers.join(", ")}` : ""}\n\nA new session can resume from this checkpoint using conductor_resume_from_checkpoint.`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Failed to save checkpoint: ${error instanceof Error ? error.message : "Unknown error"}`,
            },
          ],
          isError: true,
        };
      }
    },
  );

  server.tool(
    "conductor_resume_from_checkpoint",
    "Resume work from the latest checkpoint for a task. Returns continuation context for a new session.",
    {
      taskId: z.string().describe("The task ID to resume"),
    },
    async ({ taskId }) => {
      const checkpoint = stateStore.getLatestCheckpoint(taskId);

      if (!checkpoint) {
        return {
          content: [
            {
              type: "text",
              text: `No checkpoint found for task ${taskId}. Starting fresh.`,
            },
          ],
        };
      }

      const task = stateStore.getTask(taskId);

      let responseText = `# Resuming from Checkpoint\n\n`;
      responseText += `**Checkpoint ID:** ${checkpoint.id}\n`;
      responseText += `**Created:** ${checkpoint.createdAt.toISOString()}\n`;
      responseText += `**Type:** ${checkpoint.checkpointType}\n`;
      responseText += `**Stage:** ${checkpoint.stage}\n`;

      if (task) {
        responseText += `\n## Task\n`;
        responseText += `**Title:** ${task.title}\n`;
        if (task.description) {
          responseText += `**Description:** ${task.description}\n`;
        }
      }

      if (checkpoint.beadId) {
        responseText += `**Bead:** ${checkpoint.beadId}\n`;
      }

      const ctx = checkpoint.context;

      if (ctx.completedSteps && ctx.completedSteps.length > 0) {
        responseText += `\n## Completed Steps\n`;
        ctx.completedSteps.forEach((step: string, i: number) => {
          responseText += `${i + 1}. ${step}\n`;
        });
      }

      if (ctx.nextSteps && ctx.nextSteps.length > 0) {
        responseText += `\n## Next Steps (continue from here)\n`;
        ctx.nextSteps.forEach((step: string, i: number) => {
          responseText += `${i + 1}. ${step}\n`;
        });
      }

      if (ctx.filesModified && ctx.filesModified.length > 0) {
        responseText += `\n## Files Modified\n`;
        ctx.filesModified.forEach((file: string) => {
          responseText += `- ${file}\n`;
        });
      }

      if (ctx.blockers && ctx.blockers.length > 0) {
        responseText += `\n## Blockers\n`;
        ctx.blockers.forEach((blocker: string) => {
          responseText += `- ${blocker}\n`;
        });
      }

      if (ctx.tokenCount) {
        responseText += `\n**Previous token count:** ${ctx.tokenCount}\n`;
      }

      return {
        content: [
          {
            type: "text",
            text: responseText,
          },
        ],
      };
    },
  );

  // ============================================================================
  // Bead Import Tools (Gastown Integration)
  // ============================================================================

  server.tool(
    "conductor_import_beads",
    "Import beads and convoys from .gt/ directory as Conductor tasks",
    {
      beadDir: z
        .string()
        .describe("Path to beads directory (e.g., .gt/beads)"),
      convoyDir: z
        .string()
        .optional()
        .describe("Path to convoys directory (e.g., .gt/convoys)"),
    },
    async ({ beadDir, convoyDir }) => {
      try {
        const result = stateStore.importBeadsFromDirectory(
          projectId,
          beadDir,
          convoyDir,
        );

        let responseText = `# Bead Import Summary\n\n`;
        responseText += `**Imported:** ${result.imported}\n`;
        responseText += `**Skipped (already imported):** ${result.skipped}\n`;

        if (result.errors.length > 0) {
          responseText += `\n## Errors\n`;
          result.errors.forEach((err) => {
            responseText += `- ${err}\n`;
          });
        }

        return {
          content: [{ type: "text", text: responseText }],
          isError: result.errors.length > 0 && result.imported === 0,
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Failed to import beads: ${error instanceof Error ? error.message : "Unknown error"}`,
            },
          ],
          isError: true,
        };
      }
    },
  );

  server.tool(
    "conductor_complete_bead",
    "Mark a task and its associated bead as complete. Syncs status back to .gt/beads/{id}.json",
    {
      taskId: z.string().describe("The task ID to complete"),
      beadPath: z
        .string()
        .optional()
        .describe(
          "Path to bead JSON file for sync (e.g., .gt/beads/gt-w5y2c.json)",
        ),
      notes: z
        .string()
        .optional()
        .describe("Completion notes or summary"),
    },
    async ({ taskId, beadPath, notes }) => {
      try {
        // Update task status
        const updates: Partial<Task> = { status: "completed" };
        if (notes) {
          const current = stateStore.getTask(taskId);
          updates.metadata = {
            ...(current?.metadata || {}),
            completionNotes: notes,
            completedAt: new Date().toISOString(),
          };
        }

        const task = stateStore.updateTask(taskId, updates);
        const beadInfo = stateStore.updateBeadStatus(taskId);

        let responseText = `# Bead Completed\n\n`;
        responseText += `**Task:** ${task.title}\n`;
        responseText += `**Status:** completed\n`;

        if (beadInfo) {
          responseText += `**Bead:** ${beadInfo.beadId} → ${beadInfo.status}\n`;

          // Sync to file if path provided
          if (beadPath) {
            const synced = stateStore.syncBeadToFile(beadInfo.beadId, beadPath);
            responseText += synced
              ? `**File synced:** ${beadPath}\n`
              : `**File sync failed:** ${beadPath}\n`;
          }
        }

        return {
          content: [{ type: "text", text: responseText }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Failed to complete bead: ${error instanceof Error ? error.message : "Unknown error"}`,
            },
          ],
          isError: true,
        };
      }
    },
  );

  // ============================================================================
  // Zone Tools
  // ============================================================================

  server.tool(
    "conductor_get_zones",
    "Get the zone ownership configuration for this project",
    {},
    async () => {
      const zoneConfig = stateStore.getProjectZoneConfig(projectId);

      if (!zoneConfig) {
        return {
          content: [
            {
              type: "text",
              text: "No zone configuration set for this project. All files are accessible to all agents.",
            },
          ],
        };
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(zoneConfig, null, 2),
          },
        ],
      };
    },
  );

  // ============================================================================
  // Health Tools
  // ============================================================================

  server.tool(
    "conductor_health_status",
    "Get health status of all registered agents based on heartbeat freshness",
    {},
    async () => {
      const agents = stateStore.listAgents(projectId);
      const now = Date.now();

      // Calculate health status based on last heartbeat
      const statuses = agents.map((agent) => {
        const lastHeartbeat = agent.lastHeartbeat;
        const timeSinceHeartbeat = lastHeartbeat
          ? now - lastHeartbeat.getTime()
          : Infinity;

        let status: "healthy" | "warning" | "critical" | "offline";
        if (timeSinceHeartbeat < 5 * 60 * 1000) {
          // < 5 minutes
          status = "healthy";
        } else if (timeSinceHeartbeat < 15 * 60 * 1000) {
          // < 15 minutes
          status = "warning";
        } else if (timeSinceHeartbeat < 60 * 60 * 1000) {
          // < 1 hour
          status = "critical";
        } else {
          status = "offline";
        }

        return {
          agentId: agent.id,
          agentName: agent.name,
          status,
          lastHeartbeat: agent.lastHeartbeat,
          timeSinceHeartbeat: Math.floor(timeSinceHeartbeat / 1000), // seconds
        };
      });

      const summary = {
        healthy: statuses.filter((s) => s.status === "healthy").length,
        warning: statuses.filter((s) => s.status === "warning").length,
        critical: statuses.filter((s) => s.status === "critical").length,
        offline: statuses.filter((s) => s.status === "offline").length,
      };

      return {
        content: [
          {
            type: "text",
            text: `Agent Health Summary: ${summary.healthy} healthy, ${summary.warning} warning, ${summary.critical} critical, ${summary.offline} offline\n\n${JSON.stringify(
              statuses.map((s) => ({
                ...s,
                lastHeartbeat: s.lastHeartbeat?.toISOString() ?? null,
              })),
              null,
              2,
            )}`,
          },
        ],
      };
    },
  );

  // ============================================================================
  // Resources
  // ============================================================================

  server.resource(
    `conductor://project/${projectId}/status`,
    "Current project status including tasks, agents, and budget",
    async () => {
      const project = stateStore.getProject(projectId);
      const tasks = stateStore.listTasks(projectId);
      const agents = stateStore.listAgents(projectId);
      const spend = stateStore.getProjectSpend(projectId);

      const taskSummary = {
        total: tasks.length,
        pending: tasks.filter((t) => t.status === "pending").length,
        inProgress: tasks.filter((t) => t.status === "in_progress").length,
        completed: tasks.filter((t) => t.status === "completed").length,
        failed: tasks.filter((t) => t.status === "failed").length,
        blocked: tasks.filter((t) => t.status === "blocked").length,
      };

      return {
        contents: [
          {
            uri: `conductor://project/${projectId}/status`,
            mimeType: "application/json",
            text: JSON.stringify(
              {
                project: {
                  id: project?.id,
                  name: project?.name,
                  conflictStrategy: project?.conflictStrategy,
                },
                tasks: taskSummary,
                agents: agents.map((a) => ({
                  id: a.id,
                  status: a.status,
                  lastHeartbeat: a.lastHeartbeat,
                })),
                budget: project?.budget
                  ? {
                      spent: spend,
                      total: project.budget.total,
                      remaining: project.budget.total - spend,
                      percentUsed: (
                        (spend / project.budget.total) *
                        100
                      ).toFixed(1),
                    }
                  : null,
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );

  return server;
}
