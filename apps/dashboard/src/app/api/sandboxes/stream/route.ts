/**
 * SSE streaming endpoint for sandbox command execution
 *
 * Usage: EventSource('/api/sandboxes/stream?sandboxId=...&command=...')
 *
 * Events:
 *   - stdout: { data: string }
 *   - stderr: { data: string }
 *   - complete: { exitCode: number, duration: number }
 *   - error: { message: string }
 */

import { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { SandboxManager } from "@conductor/e2b-runner";
import { requireSession } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

let sandboxManager: SandboxManager | null = null;

function getSandboxManager(): SandboxManager {
  if (!sandboxManager) {
    sandboxManager = new SandboxManager({
      apiKey: process.env.E2B_API_KEY,
    });
  }
  return sandboxManager;
}

export async function GET(request: NextRequest) {
  const auth = await requireSession();
  if ("error" in auth) return auth.error;

  const { searchParams } = new URL(request.url);
  const sandboxId = searchParams.get("sandboxId");
  const command = searchParams.get("command");

  if (!sandboxId || !command) {
    return NextResponse.json(
      { error: "sandboxId and command are required" },
      { status: 400 },
    );
  }

  const encoder = new TextEncoder();
  let isConnected = true;

  const stream = new ReadableStream({
    async start(controller) {
      const formatEvent = (event: string, data: unknown) =>
        `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

      request.signal.addEventListener("abort", () => {
        isConnected = false;
      });

      try {
        const manager = getSandboxManager();
        const cwd = searchParams.get("cwd") || undefined;
        const timeout = searchParams.get("timeout")
          ? parseInt(searchParams.get("timeout")!, 10)
          : 60;

        await manager.executeCommandStreaming(sandboxId, command, {
          cwd,
          timeout,
          callbacks: {
            onStart: () => {
              if (!isConnected) return;
              try {
                controller.enqueue(
                  encoder.encode(
                    formatEvent("start", {
                      sandboxId,
                      command,
                      timestamp: new Date().toISOString(),
                    }),
                  ),
                );
              } catch {
                isConnected = false;
              }
            },
            onStdout: (data) => {
              if (!isConnected) return;
              try {
                controller.enqueue(
                  encoder.encode(formatEvent("stdout", { data })),
                );
              } catch {
                isConnected = false;
              }
            },
            onStderr: (data) => {
              if (!isConnected) return;
              try {
                controller.enqueue(
                  encoder.encode(formatEvent("stderr", { data })),
                );
              } catch {
                isConnected = false;
              }
            },
            onComplete: ({ exitCode, duration }) => {
              if (!isConnected) return;
              try {
                controller.enqueue(
                  encoder.encode(
                    formatEvent("complete", { exitCode, duration }),
                  ),
                );
                controller.close();
              } catch {
                isConnected = false;
              }
            },
            onError: (error) => {
              if (!isConnected) return;
              try {
                controller.enqueue(
                  encoder.encode(
                    formatEvent("error", { message: error.message }),
                  ),
                );
                controller.close();
              } catch {
                isConnected = false;
              }
            },
          },
        });
      } catch (error) {
        if (isConnected) {
          try {
            controller.enqueue(
              encoder.encode(
                formatEvent("error", {
                  message: error instanceof Error ? error.message : String(error),
                }),
              ),
            );
            controller.close();
          } catch {
            // Connection already closed
          }
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
