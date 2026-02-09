"use client";

import { useEffect, useState, useCallback } from "react";
import { useEvents } from "@/components/EventProvider";
import HealthIndicator, {
  deriveHealthStatus,
} from "@/components/HealthIndicator";

type AgentStatus = "idle" | "working" | "blocked" | "offline";
type Provider = "anthropic" | "google" | "openai" | "meta" | "custom";

interface Agent {
  id: string;
  name: string;
  provider: Provider;
  model: string;
  status: AgentStatus;
  capabilities: string[];
  costPerToken?: { input: number; output: number };
  currentTaskId?: string;
  totalSpend?: number;
  metadata?: Record<string, unknown>;
  lastHeartbeat?: string;
  totalTokens?: { input: number; output: number };
}

interface PendingTask {
  id: string;
  title: string;
}

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { refreshTrigger } = useEvents();

  const fetchAgents = useCallback(async () => {
    try {
      const res = await fetch("/api/agents");
      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else {
        setAgents(data.agents || []);
        setError(null);
      }
    } catch (err) {
      setError("Failed to fetch agents");
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  // Refetch when real-time events trigger refresh
  useEffect(() => {
    if (refreshTrigger > 0) {
      fetchAgents();
    }
  }, [refreshTrigger, fetchAgents]);

  const activeAgents = agents.filter((a) => a.status !== "offline").length;
  const workingAgents = agents.filter((a) => a.status === "working").length;

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
            Agents
          </h1>
          <p className="mt-1 text-gray-600 dark:text-gray-400">
            Monitor and manage connected LLM agents
          </p>
        </div>
        <button className="px-4 py-2 bg-conductor-600 text-white rounded-lg hover:bg-conductor-700 transition-colors">
          + Register Agent
        </button>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-red-700 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Status Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatusCard label="Total Agents" value={agents.length} color="blue" />
        <StatusCard label="Active" value={activeAgents} color="green" />
        <StatusCard label="Working" value={workingAgents} color="yellow" />
        <StatusCard
          label="Offline"
          value={agents.length - activeAgents}
          color="gray"
        />
      </div>

      {/* Agent Cards */}
      {agents.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {agents.map((agent) => (
            <AgentCard key={agent.id} agent={agent} onAction={fetchAgents} />
          ))}
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8 text-center">
          <p className="text-gray-500 dark:text-gray-400">
            No agents registered. Connect an agent using the MCP server.
          </p>
        </div>
      )}

      {/* Instructions */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
        <h2 className="text-lg font-semibold text-blue-800 dark:text-blue-200 mb-2">
          Connecting Agents
        </h2>
        <p className="text-blue-700 dark:text-blue-300 mb-4">
          Agents connect via the Conductor MCP server. Each agent needs:
        </p>
        <ol className="list-decimal list-inside text-blue-700 dark:text-blue-300 space-y-2">
          <li>
            A valid API key for their provider (Anthropic, Google, OpenAI)
          </li>
          <li>The Conductor MCP server added to their configuration</li>
          <li>Access to the project directory or repository</li>
        </ol>
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
  color: "blue" | "green" | "yellow" | "gray";
}) {
  const colorClasses = {
    blue: "bg-blue-500",
    green: "bg-green-500",
    yellow: "bg-yellow-500",
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

function AgentCard({
  agent,
  onAction,
}: {
  agent: Agent;
  onAction: () => void;
}) {
  const [actionPending, setActionPending] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [pendingTasks, setPendingTasks] = useState<PendingTask[]>([]);

  const statusStyles: Record<
    AgentStatus,
    { bg: string; text: string; dot: string }
  > = {
    idle: {
      bg: "bg-gray-100 dark:bg-gray-700",
      text: "text-gray-700 dark:text-gray-300",
      dot: "bg-gray-500",
    },
    working: {
      bg: "bg-green-100 dark:bg-green-900/30",
      text: "text-green-700 dark:text-green-400",
      dot: "bg-green-500 animate-pulse",
    },
    blocked: {
      bg: "bg-orange-100 dark:bg-orange-900/30",
      text: "text-orange-700 dark:text-orange-400",
      dot: "bg-orange-500",
    },
    offline: {
      bg: "bg-red-100 dark:bg-red-900/30",
      text: "text-red-700 dark:text-red-400",
      dot: "bg-red-500",
    },
  };

  const providerColors: Record<Provider, string> = {
    anthropic: "text-orange-600 dark:text-orange-400",
    google: "text-blue-600 dark:text-blue-400",
    openai: "text-green-600 dark:text-green-400",
    meta: "text-blue-600 dark:text-blue-400",
    custom: "text-gray-600 dark:text-gray-400",
  };

  const style = statusStyles[agent.status];
  const timeSinceHeartbeat = agent.lastHeartbeat
    ? Math.floor((Date.now() - new Date(agent.lastHeartbeat).getTime()) / 1000)
    : null;

  // Compute uptime from metadata.startedAt or first heartbeat
  const startedAt =
    (agent.metadata?.startedAt as string) || agent.lastHeartbeat;
  const uptimeSeconds = startedAt
    ? Math.max(
        0,
        Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000),
      )
    : null;

  async function handlePause() {
    setActionPending(true);
    try {
      await fetch("/api/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actionType: "pause_agent",
          data: { agentId: agent.id },
        }),
      });
      onAction();
    } finally {
      setActionPending(false);
    }
  }

  async function handleResume() {
    setActionPending(true);
    try {
      await fetch("/api/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actionType: "resume_agent",
          data: { agentId: agent.id },
        }),
      });
      onAction();
    } finally {
      setActionPending(false);
    }
  }

  async function openAssignModal() {
    setShowAssignModal(true);
    try {
      const res = await fetch("/api/tasks?status=pending");
      const data = await res.json();
      setPendingTasks(
        (data.tasks || []).map((t: any) => ({ id: t.id, title: t.title })),
      );
    } catch {
      setPendingTasks([]);
    }
  }

  async function handleAssignTask(taskId: string) {
    setActionPending(true);
    setShowAssignModal(false);
    try {
      await fetch("/api/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actionType: "reassign_task",
          actionId: taskId,
          data: { newAgentId: agent.id },
        }),
      });
      onAction();
    } finally {
      setActionPending(false);
    }
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
      <div className="p-6">
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-gray-200 to-gray-300 dark:from-gray-600 dark:to-gray-700 flex items-center justify-center text-xl font-bold text-gray-600 dark:text-gray-300">
              {agent.name.charAt(0)}
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {agent.name}
              </h3>
              <p
                className={`text-sm ${providerColors[agent.provider] || providerColors.custom}`}
              >
                {agent.model}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <HealthIndicator
              status={deriveHealthStatus(
                agent.lastHeartbeat
                  ? Math.floor(
                      (Date.now() - new Date(agent.lastHeartbeat).getTime()) /
                        1000,
                    )
                  : null,
              )}
              lastHeartbeat={agent.lastHeartbeat}
              showLabel={false}
            />
            <div
              className={`flex items-center gap-2 px-3 py-1 rounded-full ${style.bg}`}
            >
              <div className={`w-2 h-2 rounded-full ${style.dot}`} />
              <span className={`text-sm font-medium ${style.text}`}>
                {agent.status.charAt(0).toUpperCase() + agent.status.slice(1)}
              </span>
            </div>
          </div>
        </div>

        {agent.currentTaskId && (
          <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
            <div className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">
              Current Task
            </div>
            <div className="text-sm font-medium text-gray-900 dark:text-white mt-1">
              {agent.currentTaskId}
            </div>
          </div>
        )}

        {agent.capabilities.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {agent.capabilities.map((cap) => (
              <span
                key={cap}
                className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300"
              >
                {cap}
              </span>
            ))}
          </div>
        )}

        <div className="mt-4 grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-lg font-semibold text-gray-900 dark:text-white">
              ${(agent.totalSpend ?? 0).toFixed(2)}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              Total Spend
            </div>
          </div>
          <div>
            <div className="text-lg font-semibold text-gray-900 dark:text-white">
              {agent.totalTokens
                ? `${((agent.totalTokens.input + agent.totalTokens.output) / 1000).toFixed(1)}k`
                : `$${(agent.costPerToken?.input ?? 0).toFixed(4)}/$${(agent.costPerToken?.output ?? 0).toFixed(4)}`}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              {agent.totalTokens ? "Total Tokens" : "Cost/Token (in/out)"}
            </div>
          </div>
          <div>
            <div className="text-lg font-semibold text-gray-900 dark:text-white">
              {uptimeSeconds !== null
                ? formatUptime(uptimeSeconds)
                : "-"}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              Uptime
            </div>
          </div>
        </div>
      </div>

      <div className="px-6 py-3 bg-gray-50 dark:bg-gray-700/50 border-t border-gray-200 dark:border-gray-700 flex justify-between items-center text-sm">
        <span className="text-gray-500 dark:text-gray-400">
          {timeSinceHeartbeat !== null
            ? `Last heartbeat: ${formatTimeSince(timeSinceHeartbeat)}`
            : "No heartbeat recorded"}
        </span>
        <div className="flex gap-2">
          {(agent.status === "working" || agent.status === "idle") && (
            <button
              onClick={handlePause}
              disabled={actionPending}
              className="text-orange-600 hover:text-orange-700 dark:text-orange-400 dark:hover:text-orange-300 font-medium disabled:opacity-50"
            >
              Pause
            </button>
          )}
          {agent.status === "blocked" && (
            <button
              onClick={handleResume}
              disabled={actionPending}
              className="text-green-600 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300 font-medium disabled:opacity-50"
            >
              Resume
            </button>
          )}
          <button
            onClick={openAssignModal}
            disabled={actionPending}
            className="text-conductor-600 hover:text-conductor-700 dark:text-conductor-400 dark:hover:text-conductor-300 font-medium disabled:opacity-50"
          >
            Assign Task
          </button>
        </div>
      </div>

      {/* Assign Task Modal */}
      {showAssignModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Assign Task to {agent.name}
            </h3>
            {pendingTasks.length > 0 ? (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {pendingTasks.map((task) => (
                  <button
                    key={task.id}
                    onClick={() => handleAssignTask(task.id)}
                    className="w-full text-left px-4 py-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    <div className="text-sm font-medium text-gray-900 dark:text-white">
                      {task.title}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {task.id}
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 dark:text-gray-400 text-sm">
                No pending tasks available.
              </p>
            )}
            <div className="mt-4 flex justify-end">
              <button
                onClick={() => setShowAssignModal(false)}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function formatUptime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainingMins = minutes % 60;
  if (hours < 24) return `${hours}h ${remainingMins}m`;
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  return `${days}d ${remainingHours}h`;
}

function formatTimeSince(seconds: number): string {
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}
