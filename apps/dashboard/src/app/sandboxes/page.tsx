"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useEvents } from "@/components/EventProvider";

type SandboxStatus = "pending" | "running" | "stopped" | "failed" | "timeout";
type AgentType = "claude-code" | "aider" | "custom";

const MAX_SCROLLBACK = 1000;

interface Sandbox {
  id: string;
  agentId: string;
  projectId: string;
  status: SandboxStatus;
  template: string;
  startedAt: string;
  lastActivityAt: string;
  metadata: Record<string, unknown>;
  runningAgent?: {
    agentId: string;
    startTime: string;
  } | null;
}

interface RunningAgent {
  agentId: string;
  sandboxId: string;
  startTime: string;
}

interface SandboxStats {
  total: number;
  running: number;
  stopped: number;
  failed: number;
  timeout: number;
}

interface SpawnFormData {
  agentId: string;
  type: AgentType;
  gitRepo: string;
  gitBranch: string;
  template: string;
  timeout: number;
}

interface TerminalLine {
  type: "stdin" | "stdout" | "stderr" | "system";
  text: string;
}

/**
 * Sanitize text for safe HTML rendering.
 * Escapes HTML entities first, then converts ANSI color codes to styled spans.
 */
function sanitizeAndConvertAnsi(text: string): string {
  // Step 1: Escape ALL HTML entities to prevent XSS
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");

  // Step 2: Convert known ANSI escape codes to safe inline styles
  // Only specific color codes are handled — all others are stripped
  return escaped
    .replace(/\x1b\[0m/g, "</span>")
    .replace(/\x1b\[1m/g, '<span style="font-weight:bold">')
    .replace(/\x1b\[30m/g, '<span style="color:#555">')
    .replace(/\x1b\[31m/g, '<span style="color:#f87171">')
    .replace(/\x1b\[32m/g, '<span style="color:#4ade80">')
    .replace(/\x1b\[33m/g, '<span style="color:#facc15">')
    .replace(/\x1b\[34m/g, '<span style="color:#60a5fa">')
    .replace(/\x1b\[35m/g, '<span style="color:#c084fc">')
    .replace(/\x1b\[36m/g, '<span style="color:#22d3ee">')
    .replace(/\x1b\[37m/g, '<span style="color:#e5e7eb">')
    .replace(/\x1b\[90m/g, '<span style="color:#6b7280">')
    .replace(/\x1b\[91m/g, '<span style="color:#fca5a5">')
    .replace(/\x1b\[92m/g, '<span style="color:#86efac">')
    .replace(/\x1b\[93m/g, '<span style="color:#fde047">')
    .replace(/\x1b\[94m/g, '<span style="color:#93c5fd">')
    .replace(/\x1b\[95m/g, '<span style="color:#d8b4fe">')
    .replace(/\x1b\[96m/g, '<span style="color:#67e8f9">')
    .replace(/\x1b\[97m/g, '<span style="color:#f9fafb">')
    .replace(/\x1b\[\d+m/g, ""); // strip remaining unrecognized codes
}

export default function SandboxesPage() {
  const [sandboxes, setSandboxes] = useState<Sandbox[]>([]);
  const [runningAgents, setRunningAgents] = useState<RunningAgent[]>([]);
  const [stats, setStats] = useState<SandboxStats>({
    total: 0,
    running: 0,
    stopped: 0,
    failed: 0,
    timeout: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showSpawnModal, setShowSpawnModal] = useState(false);
  const [showTerminal, setShowTerminal] = useState<string | null>(null);
  const [terminalOutput, setTerminalOutput] = useState<TerminalLine[]>([]);
  const [terminalCommand, setTerminalCommand] = useState("");
  const [spawning, setSpawning] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const [streaming, setStreaming] = useState(false);
  const terminalRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const { refreshTrigger } = useEvents();

  const [spawnForm, setSpawnForm] = useState<SpawnFormData>({
    agentId: "",
    type: "claude-code",
    gitRepo: "",
    gitBranch: "main",
    template: "base",
    timeout: 300,
  });

  // Auto-scroll effect
  useEffect(() => {
    if (autoScroll && terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [terminalOutput, autoScroll]);

  // Cleanup EventSource on unmount or terminal close
  useEffect(() => {
    return () => {
      eventSourceRef.current?.close();
    };
  }, []);

  const fetchSandboxes = useCallback(async () => {
    try {
      const res = await fetch("/api/sandboxes");
      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else {
        setSandboxes(data.sandboxes || []);
        setRunningAgents(data.runningAgents || []);
        setStats(
          data.stats || {
            total: 0,
            running: 0,
            stopped: 0,
            failed: 0,
            timeout: 0,
          },
        );
        setError(null);
      }
    } catch (err) {
      setError("Failed to fetch sandboxes");
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchSandboxes();
  }, [fetchSandboxes]);

  // Refetch when real-time events trigger refresh
  useEffect(() => {
    if (refreshTrigger > 0) {
      fetchSandboxes();
    }
  }, [refreshTrigger, fetchSandboxes]);

  function addTerminalLine(line: TerminalLine) {
    setTerminalOutput((prev) => {
      const next = [...prev, line];
      return next.length > MAX_SCROLLBACK ? next.slice(-MAX_SCROLLBACK) : next;
    });
  }

  async function handleSpawn() {
    if (!spawnForm.agentId.trim()) {
      setError("Agent ID is required");
      return;
    }

    setSpawning(true);
    setError(null);

    try {
      const res = await fetch("/api/sandboxes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "spawn",
          ...spawnForm,
        }),
      });

      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else {
        setShowSpawnModal(false);
        setSpawnForm({
          agentId: "",
          type: "claude-code",
          gitRepo: "",
          gitBranch: "main",
          template: "base",
          timeout: 300,
        });
        fetchSandboxes();
      }
    } catch (err) {
      setError("Failed to spawn agent");
    } finally {
      setSpawning(false);
    }
  }

  async function handleStop(sandboxId?: string, agentId?: string) {
    try {
      const params = new URLSearchParams();
      if (sandboxId) params.set("sandboxId", sandboxId);
      if (agentId) params.set("agentId", agentId);

      await fetch(`/api/sandboxes?${params}`, { method: "DELETE" });
      fetchSandboxes();
    } catch (err) {
      setError("Failed to stop sandbox");
    }
  }

  async function handleStopAll() {
    if (!confirm("Stop all running sandboxes and agents?")) return;
    try {
      await fetch("/api/sandboxes?all=true", { method: "DELETE" });
      fetchSandboxes();
    } catch (err) {
      setError("Failed to stop all sandboxes");
    }
  }

  function executeCommand(sandboxId: string) {
    if (!terminalCommand.trim()) return;

    const cmd = terminalCommand;
    setTerminalCommand("");
    addTerminalLine({ type: "stdin", text: `$ ${cmd}` });

    // Close any existing stream
    eventSourceRef.current?.close();

    // Use SSE streaming endpoint
    const params = new URLSearchParams({
      sandboxId,
      command: cmd,
    });
    const es = new EventSource(`/api/sandboxes/stream?${params}`);
    eventSourceRef.current = es;
    setStreaming(true);

    es.addEventListener("stdout", (e) => {
      const { data } = JSON.parse(e.data);
      addTerminalLine({ type: "stdout", text: data });
    });

    es.addEventListener("stderr", (e) => {
      const { data } = JSON.parse(e.data);
      addTerminalLine({ type: "stderr", text: data });
    });

    es.addEventListener("complete", (e) => {
      const { exitCode } = JSON.parse(e.data);
      if (exitCode !== 0) {
        addTerminalLine({
          type: "system",
          text: `[exit code: ${exitCode}]`,
        });
      }
      es.close();
      eventSourceRef.current = null;
      setStreaming(false);
    });

    es.addEventListener("error", () => {
      // EventSource error — could be connection close or actual error
      if (es.readyState === EventSource.CLOSED) {
        setStreaming(false);
        return;
      }
      addTerminalLine({ type: "stderr", text: "[connection error]" });
      es.close();
      eventSourceRef.current = null;
      setStreaming(false);
    });
  }

  function handleCopyOutput() {
    const text = terminalOutput.map((l) => l.text).join("\n");
    navigator.clipboard.writeText(text);
  }

  function handleDownloadLog() {
    const text = terminalOutput.map((l) => l.text).join("\n");
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sandbox-${showTerminal}-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-conductor-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Sandboxes
          </h1>
          <p className="mt-1 text-gray-600 dark:text-gray-400">
            Manage E2B cloud sandboxes for agent execution
          </p>
        </div>
        <div className="flex gap-2">
          {stats.running > 0 && (
            <button
              onClick={handleStopAll}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              Stop All
            </button>
          )}
          <button
            onClick={() => setShowSpawnModal(true)}
            className="px-4 py-2 bg-conductor-600 text-white rounded-lg hover:bg-conductor-700 transition-colors"
          >
            + Spawn Agent
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-red-700 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* E2B API Key Warning */}
      {!process.env.NEXT_PUBLIC_E2B_CONFIGURED && sandboxes.length === 0 && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
          <h3 className="font-semibold text-yellow-800 dark:text-yellow-200">
            E2B API Key Required
          </h3>
          <p className="text-yellow-700 dark:text-yellow-300 text-sm mt-1">
            Set the{" "}
            <code className="bg-yellow-100 dark:bg-yellow-800 px-1 rounded">
              E2B_API_KEY
            </code>{" "}
            environment variable to use cloud sandboxes. Get your key at{" "}
            <a
              href="https://e2b.dev"
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              e2b.dev
            </a>
          </p>
        </div>
      )}

      {/* Status Overview */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <StatusCard label="Total" value={stats.total} color="blue" />
        <StatusCard label="Running" value={stats.running} color="green" />
        <StatusCard label="Stopped" value={stats.stopped} color="gray" />
        <StatusCard label="Failed" value={stats.failed} color="red" />
        <StatusCard label="Timeout" value={stats.timeout} color="yellow" />
      </div>

      {/* Running Agents */}
      {runningAgents.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Running Agents ({runningAgents.length})
            </h2>
          </div>
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {runningAgents.map((agent) => (
              <div
                key={agent.agentId}
                className="px-6 py-4 flex justify-between items-center"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                    <span className="font-medium text-gray-900 dark:text-white">
                      {agent.agentId}
                    </span>
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    Sandbox: {agent.sandboxId} • Started:{" "}
                    {formatTime(agent.startTime)}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      eventSourceRef.current?.close();
                      setShowTerminal(agent.sandboxId);
                      setTerminalOutput([
                        {
                          type: "system",
                          text: `Connected to sandbox ${agent.sandboxId}`,
                        },
                      ]);
                    }}
                    className="px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600"
                  >
                    Terminal
                  </button>
                  <button
                    onClick={() => handleStop(undefined, agent.agentId)}
                    className="px-3 py-1.5 text-sm bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded hover:bg-red-200 dark:hover:bg-red-900/50"
                  >
                    Stop
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sandbox List */}
      {sandboxes.length > 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              All Sandboxes ({sandboxes.length})
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700/50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Sandbox ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Agent
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Template
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Started
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {sandboxes.map((sandbox) => (
                  <tr
                    key={sandbox.id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700/30"
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <code className="text-sm text-gray-900 dark:text-gray-100">
                        {sandbox.id}
                      </code>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">
                      {sandbox.agentId}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <SandboxStatusBadge status={sandbox.status} />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {sandbox.template}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {formatTime(sandbox.startedAt)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex gap-2">
                        {sandbox.status === "running" && (
                          <>
                            <button
                              onClick={() => {
                                eventSourceRef.current?.close();
                                setShowTerminal(sandbox.id);
                                setTerminalOutput([
                                  {
                                    type: "system",
                                    text: `Connected to sandbox ${sandbox.id}`,
                                  },
                                ]);
                              }}
                              className="text-sm text-conductor-600 hover:text-conductor-700 dark:text-conductor-400"
                            >
                              Terminal
                            </button>
                            <button
                              onClick={() => handleStop(sandbox.id)}
                              className="text-sm text-red-600 hover:text-red-700 dark:text-red-400"
                            >
                              Stop
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8 text-center">
          <p className="text-gray-500 dark:text-gray-400 mb-4">
            No sandboxes running. Spawn an agent to get started.
          </p>
          <button
            onClick={() => setShowSpawnModal(true)}
            className="px-4 py-2 bg-conductor-600 text-white rounded-lg hover:bg-conductor-700 transition-colors"
          >
            Spawn Agent
          </button>
        </div>
      )}

      {/* Spawn Modal */}
      {showSpawnModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
              Spawn Agent in E2B Sandbox
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Agent ID *
                </label>
                <input
                  type="text"
                  value={spawnForm.agentId}
                  onChange={(e) =>
                    setSpawnForm({ ...spawnForm, agentId: e.target.value })
                  }
                  placeholder="e.g., claude-1, aider-main"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Agent Type
                </label>
                <select
                  value={spawnForm.type}
                  onChange={(e) =>
                    setSpawnForm({
                      ...spawnForm,
                      type: e.target.value as AgentType,
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="claude-code">Claude Code</option>
                  <option value="aider">Aider</option>
                  <option value="custom">Custom</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Git Repository (optional)
                </label>
                <input
                  type="text"
                  value={spawnForm.gitRepo}
                  onChange={(e) =>
                    setSpawnForm({ ...spawnForm, gitRepo: e.target.value })
                  }
                  placeholder="https://github.com/org/repo"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Branch
                  </label>
                  <input
                    type="text"
                    value={spawnForm.gitBranch}
                    onChange={(e) =>
                      setSpawnForm({ ...spawnForm, gitBranch: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Timeout (s)
                  </label>
                  <input
                    type="number"
                    value={spawnForm.timeout}
                    onChange={(e) =>
                      setSpawnForm({
                        ...spawnForm,
                        timeout: parseInt(e.target.value),
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowSpawnModal(false)}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleSpawn}
                disabled={spawning || !spawnForm.agentId.trim()}
                className="px-4 py-2 bg-conductor-600 text-white rounded-lg hover:bg-conductor-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {spawning ? "Spawning..." : "Spawn Agent"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Terminal Modal */}
      {showTerminal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-900 rounded-lg shadow-xl max-w-3xl w-full mx-4 overflow-hidden">
            <div className="flex justify-between items-center px-4 py-2 bg-gray-800">
              <div className="flex items-center gap-2">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-500" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500" />
                  <div className="w-3 h-3 rounded-full bg-green-500" />
                </div>
                <span className="text-gray-400 text-sm ml-2">
                  Sandbox: {showTerminal}
                </span>
                {streaming && (
                  <span className="text-green-400 text-xs animate-pulse ml-2">
                    streaming...
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setAutoScroll(!autoScroll)}
                  className={`text-xs px-2 py-1 rounded ${
                    autoScroll
                      ? "bg-green-700 text-green-200"
                      : "bg-gray-700 text-gray-400"
                  }`}
                  title={autoScroll ? "Auto-scroll ON" : "Auto-scroll OFF"}
                >
                  Auto-scroll
                </button>
                <button
                  onClick={handleCopyOutput}
                  className="text-xs px-2 py-1 rounded bg-gray-700 text-gray-300 hover:bg-gray-600"
                  title="Copy terminal output"
                >
                  Copy
                </button>
                <button
                  onClick={handleDownloadLog}
                  className="text-xs px-2 py-1 rounded bg-gray-700 text-gray-300 hover:bg-gray-600"
                  title="Download as .txt"
                >
                  Download
                </button>
                <button
                  onClick={() => {
                    eventSourceRef.current?.close();
                    setShowTerminal(null);
                    setTerminalOutput([]);
                    setStreaming(false);
                  }}
                  className="text-gray-400 hover:text-white ml-2"
                >
                  x
                </button>
              </div>
            </div>
            <div
              ref={terminalRef}
              className="h-80 overflow-y-auto p-4 font-mono text-sm"
            >
              {terminalOutput.map((line, i) => {
                const colorClass =
                  line.type === "stderr"
                    ? "text-red-400"
                    : line.type === "system"
                      ? "text-gray-500"
                      : line.type === "stdin"
                        ? "text-white"
                        : "text-green-400";
                return (
                  <div
                    key={i}
                    className={`whitespace-pre-wrap ${colorClass}`}
                    dangerouslySetInnerHTML={{
                      __html: sanitizeAndConvertAnsi(line.text),
                    }}
                  />
                );
              })}
            </div>
            <div className="flex border-t border-gray-700">
              <span className="px-4 py-3 text-green-400 font-mono">$</span>
              <input
                type="text"
                value={terminalCommand}
                onChange={(e) => setTerminalCommand(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    executeCommand(showTerminal);
                  }
                }}
                placeholder="Enter command..."
                className="flex-1 bg-transparent text-green-400 font-mono py-3 pr-4 focus:outline-none"
                autoFocus
                disabled={streaming}
              />
            </div>
          </div>
        </div>
      )}

      {/* Info Section */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
        <h2 className="text-lg font-semibold text-blue-800 dark:text-blue-200 mb-2">
          About E2B Sandboxes
        </h2>
        <p className="text-blue-700 dark:text-blue-300 mb-4">
          E2B provides secure, isolated cloud environments for running AI
          agents. Each sandbox is a fresh Linux container with full shell
          access.
        </p>
        <ul className="list-disc list-inside text-blue-700 dark:text-blue-300 space-y-1">
          <li>Agents run in isolated containers with configurable resources</li>
          <li>Connect to your MCP server for task coordination</li>
          <li>Clone repositories and execute commands in real-time</li>
          <li>Automatically cleaned up after timeout</li>
        </ul>
      </div>
    </div>
  );
}

function StatusCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: "blue" | "green" | "yellow" | "red" | "gray";
}) {
  const colorClasses = {
    blue: "bg-blue-500",
    green: "bg-green-500",
    yellow: "bg-yellow-500",
    red: "bg-red-500",
    gray: "bg-gray-500",
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
      <div className="flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full ${colorClasses[color]}`} />
        <span className="text-sm text-gray-500 dark:text-gray-400">
          {label}
        </span>
      </div>
      <div className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
        {value}
      </div>
    </div>
  );
}

function SandboxStatusBadge({ status }: { status: SandboxStatus }) {
  const styles: Record<SandboxStatus, { bg: string; text: string }> = {
    pending: {
      bg: "bg-gray-100 dark:bg-gray-700",
      text: "text-gray-700 dark:text-gray-300",
    },
    running: {
      bg: "bg-green-100 dark:bg-green-900/30",
      text: "text-green-700 dark:text-green-400",
    },
    stopped: {
      bg: "bg-gray-100 dark:bg-gray-700",
      text: "text-gray-700 dark:text-gray-300",
    },
    failed: {
      bg: "bg-red-100 dark:bg-red-900/30",
      text: "text-red-700 dark:text-red-400",
    },
    timeout: {
      bg: "bg-yellow-100 dark:bg-yellow-900/30",
      text: "text-yellow-700 dark:text-yellow-400",
    },
  };

  const style = styles[status];

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${style.bg} ${style.text}`}
    >
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

function formatTime(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
  return date.toLocaleDateString();
}
