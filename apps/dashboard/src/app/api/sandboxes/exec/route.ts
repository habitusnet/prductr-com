/**
 * E2B Sandbox Exec API
 * Execute commands in running sandboxes
 */

import { NextRequest, NextResponse } from "next/server";
import { AgentRunner, SandboxManager } from "@conductor/e2b-runner";
import { requireSession } from "@/lib/auth";
import { SandboxExecSchema, validateBody } from "@/lib/api-validation";

export const dynamic = "force-dynamic";

// Singleton instances (shared with main sandboxes route)
let sandboxManager: SandboxManager | null = null;
let agentRunner: AgentRunner | null = null;

function getSandboxManager(): SandboxManager {
  if (!sandboxManager) {
    sandboxManager = new SandboxManager({
      apiKey: process.env.E2B_API_KEY,
    });
  }
  return sandboxManager;
}

function getAgentRunner(): AgentRunner {
  if (!agentRunner) {
    agentRunner = new AgentRunner({
      apiKey: process.env.E2B_API_KEY,
    });
  }
  return agentRunner;
}

/**
 * POST /api/sandboxes/exec
 * Execute a command in a sandbox or agent
 */
export async function POST(request: NextRequest) {
  const auth = await requireSession();
  if ("error" in auth) return auth.error;

  try {
    const body = await request.json();

    const parsed = validateBody(SandboxExecSchema, body);
    if (!parsed.success) {
      return NextResponse.json(parsed.error, { status: 400 });
    }

    const { sandboxId, agentId, command, cwd, timeout } = parsed.data;

    let result: { stdout: string; stderr: string; exitCode: number };

    if (agentId) {
      const runner = getAgentRunner();
      result = await runner.executeInAgent(agentId, command, {
        cwd,
        timeout: timeout || 60,
      });
    } else {
      const manager = getSandboxManager();
      result = await manager.executeCommand(sandboxId!, command, {
        cwd,
        timeout: timeout || 60,
      });
    }

    return NextResponse.json({
      success: result.exitCode === 0,
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.exitCode,
    });
  } catch (error) {
    console.error("Failed to execute command:", error);
    return NextResponse.json(
      { error: `Failed to execute command: ${error}`, success: false },
      { status: 500 },
    );
  }
}
