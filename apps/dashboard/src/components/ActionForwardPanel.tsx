"use client";

import { useEffect, useState, useCallback } from "react";

// Types
interface PendingConflict {
  id: string;
  type: "conflict";
  filePath: string;
  agents: string[];
  strategy: string;
  createdAt: string;
}

interface PendingApproval {
  id: string;
  type: "approval";
  title: string;
  description: string;
  requestedBy: string;
  taskId?: string;
  createdAt: string;
}

interface PendingEscalation {
  id: string;
  type: "escalation";
  title: string;
  description: string;
  agentId: string;
  severity: "low" | "medium" | "high" | "critical";
  createdAt: string;
}

interface FileLock {
  filePath: string;
  agentId: string;
  lockedAt: string;
  expiresAt: string;
}

interface ActionsSummary {
  totalPending: number;
  conflictCount: number;
  approvalCount: number;
  escalationCount: number;
  lockCount: number;
  workingAgents: number;
  blockedAgents: number;
}

interface ActionsData {
  conflicts: PendingConflict[];
  approvals: PendingApproval[];
  escalations: PendingEscalation[];
  locks: FileLock[];
  summary: ActionsSummary;
}

interface ActionForwardPanelProps {
  onRefresh?: () => void;
}

export function ActionForwardPanel({ onRefresh }: ActionForwardPanelProps) {
  const [data, setData] = useState<ActionsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [executing, setExecuting] = useState<string | null>(null);
  const [showNewTaskForm, setShowNewTaskForm] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState("");

  const fetchActions = useCallback(async () => {
    try {
      const res = await fetch("/api/actions");
      const json = await res.json();
      if (json.error) {
        setError(json.error);
      } else {
        setData(json);
        setError(null);
      }
    } catch (err) {
      setError("Failed to fetch actions");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchActions();
    const interval = setInterval(fetchActions, 5000);
    return () => clearInterval(interval);
  }, [fetchActions]);

  async function executeAction(
    actionType: string,
    actionId?: string,
    resolution?: string,
    data?: Record<string, unknown>,
  ) {
    setExecuting(actionId || actionType);
    try {
      const res = await fetch("/api/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actionType, actionId, resolution, data }),
      });
      const json = await res.json();
      if (json.error) {
        alert(json.error);
      } else {
        fetchActions();
        onRefresh?.();
      }
    } catch (err) {
      alert("Action failed");
    } finally {
      setExecuting(null);
    }
  }

  async function createTask() {
    if (!newTaskTitle.trim()) return;
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTaskTitle.trim(),
          priority: "medium",
        }),
      });
      const json = await res.json();
      if (json.error) {
        alert(json.error);
      } else {
        setNewTaskTitle("");
        setShowNewTaskForm(false);
        fetchActions();
        onRefresh?.();
      }
    } catch (err) {
      alert("Failed to create task");
    }
  }

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <div className="animate-pulse flex space-x-4">
          <div className="flex-1 space-y-4 py-1">
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
            <div className="space-y-2">
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-5/6"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const hasPendingItems = data && data.summary.totalPending > 0;
  const hasLocks = data && data.locks.length > 0;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            Action Forward
            {hasPendingItems && (
              <span className="px-2 py-0.5 text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 rounded-full">
                {data.summary.totalPending}
              </span>
            )}
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Decisions and actions requiring attention
          </p>
        </div>
        <button
          onClick={fetchActions}
          className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          title="Refresh"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
        </button>
      </div>

      {error && (
        <div className="px-6 py-3 bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-800">
          <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Quick Actions */}
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
          Quick Actions
        </h3>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setShowNewTaskForm(!showNewTaskForm)}
            className="px-3 py-1.5 bg-conductor-600 text-white text-sm font-medium rounded-lg hover:bg-conductor-700 transition-colors flex items-center gap-1"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
            New Task
          </button>
          <button
            onClick={() => executeAction("pause_all")}
            disabled={executing === "pause_all"}
            className="px-3 py-1.5 bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 text-sm font-medium rounded-lg hover:bg-orange-200 dark:hover:bg-orange-900/50 transition-colors disabled:opacity-50 flex items-center gap-1"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            {executing === "pause_all" ? "Pausing..." : "Pause All"}
          </button>
          <button
            onClick={() => executeAction("resume_all")}
            disabled={executing === "resume_all"}
            className="px-3 py-1.5 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 text-sm font-medium rounded-lg hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors disabled:opacity-50 flex items-center gap-1"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            {executing === "resume_all" ? "Resuming..." : "Resume All"}
          </button>
        </div>

        {/* New Task Form */}
        {showNewTaskForm && (
          <div className="mt-3 flex gap-2">
            <input
              type="text"
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              placeholder="Task title..."
              className="flex-1 px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-conductor-500 focus:border-transparent"
              onKeyDown={(e) => e.key === "Enter" && createTask()}
            />
            <button
              onClick={createTask}
              className="px-3 py-1.5 bg-conductor-600 text-white text-sm font-medium rounded-lg hover:bg-conductor-700 transition-colors"
            >
              Create
            </button>
            <button
              onClick={() => {
                setShowNewTaskForm(false);
                setNewTaskTitle("");
              }}
              className="px-3 py-1.5 text-gray-600 dark:text-gray-400 text-sm hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      {/* Pending Decisions */}
      <div className="divide-y divide-gray-200 dark:divide-gray-700">
        {/* Conflicts */}
        {data?.conflicts.map((conflict) => (
          <ConflictItem
            key={conflict.id}
            conflict={conflict}
            executing={executing === conflict.id}
            onResolve={(resolution) =>
              executeAction("resolve_conflict", conflict.id, resolution)
            }
          />
        ))}

        {/* Escalations (Blocked Tasks) */}
        {data?.escalations.map((escalation) => (
          <EscalationItem
            key={escalation.id}
            escalation={escalation}
            executing={executing === escalation.id}
            onUnblock={() => executeAction("unblock_task", escalation.id)}
            onCancel={() => executeAction("cancel_task", escalation.id)}
          />
        ))}

        {/* Approvals */}
        {data?.approvals.map((approval) => (
          <ApprovalItem
            key={approval.id}
            approval={approval}
            executing={executing === approval.id}
            onApprove={() => executeAction("approve", approval.id)}
            onDeny={() => executeAction("deny", approval.id)}
          />
        ))}

        {/* No pending items */}
        {!hasPendingItems && !hasLocks && (
          <div className="px-6 py-8 text-center">
            <svg
              className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <p className="mt-2 text-gray-500 dark:text-gray-400">
              No pending decisions
            </p>
            <p className="text-sm text-gray-400 dark:text-gray-500">
              All agents operating normally
            </p>
          </div>
        )}
      </div>

      {/* Active Locks Section */}
      {hasLocks && (
        <div className="border-t border-gray-200 dark:border-gray-700">
          <div className="px-6 py-3 bg-gray-50 dark:bg-gray-900">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Active File Locks ({data.locks.length})
            </h3>
          </div>
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {data?.locks.map((lock) => (
              <LockItem
                key={`${lock.filePath}-${lock.agentId}`}
                lock={lock}
                executing={executing === lock.filePath}
                onRelease={() =>
                  executeAction("force_release_lock", undefined, undefined, {
                    filePath: lock.filePath,
                    agentId: lock.agentId,
                  })
                }
              />
            ))}
          </div>
        </div>
      )}

      {/* Status Bar */}
      <div className="px-6 py-3 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700">
        <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
          <span>
            {data?.summary.workingAgents || 0} agents working
            {(data?.summary.blockedAgents || 0) > 0 && (
              <span className="text-orange-600 dark:text-orange-400">
                {" "}
                ({data?.summary.blockedAgents} blocked)
              </span>
            )}
          </span>
          <span>Last updated: {new Date().toLocaleTimeString()}</span>
        </div>
      </div>
    </div>
  );
}

// Sub-components
function ConflictItem({
  conflict,
  executing,
  onResolve,
}: {
  conflict: PendingConflict;
  executing: boolean;
  onResolve: (resolution: string) => void;
}) {
  return (
    <div className="px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
          <svg
            className="w-4 h-4 text-red-600 dark:text-red-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-red-600 dark:text-red-400 uppercase">
              Conflict
            </span>
          </div>
          <p className="mt-1 text-sm font-medium text-gray-900 dark:text-white truncate">
            {conflict.filePath}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Modified by: {conflict.agents.join(" and ")}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              onClick={() => onResolve("accept_first")}
              disabled={executing}
              className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 rounded hover:bg-blue-200 dark:hover:bg-blue-900/50 disabled:opacity-50"
            >
              Accept {conflict.agents[0]}
            </button>
            {conflict.agents[1] && (
              <button
                onClick={() => onResolve("accept_second")}
                disabled={executing}
                className="px-2 py-1 text-xs font-medium bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 rounded hover:bg-purple-200 dark:hover:bg-purple-900/50 disabled:opacity-50"
              >
                Accept {conflict.agents[1]}
              </button>
            )}
            <button
              onClick={() => onResolve("merge")}
              disabled={executing}
              className="px-2 py-1 text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded hover:bg-green-200 dark:hover:bg-green-900/50 disabled:opacity-50"
            >
              Merge
            </button>
            <button
              onClick={() => onResolve("defer")}
              disabled={executing}
              className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50"
            >
              Defer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function EscalationItem({
  escalation,
  executing,
  onUnblock,
  onCancel,
}: {
  escalation: PendingEscalation;
  executing: boolean;
  onUnblock: () => void;
  onCancel: () => void;
}) {
  const severityColors = {
    low: "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300",
    medium:
      "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
    high: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
    critical: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  };

  return (
    <div className="px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
          <svg
            className="w-4 h-4 text-orange-600 dark:text-orange-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span
              className={`text-xs font-medium uppercase px-1.5 py-0.5 rounded ${severityColors[escalation.severity]}`}
            >
              {escalation.severity}
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              Escalation
            </span>
          </div>
          <p className="mt-1 text-sm font-medium text-gray-900 dark:text-white">
            {escalation.title}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Agent: {escalation.agentId}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              onClick={onUnblock}
              disabled={executing}
              className="px-2 py-1 text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded hover:bg-green-200 dark:hover:bg-green-900/50 disabled:opacity-50"
            >
              Unblock
            </button>
            <button
              onClick={onCancel}
              disabled={executing}
              className="px-2 py-1 text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 rounded hover:bg-red-200 dark:hover:bg-red-900/50 disabled:opacity-50"
            >
              Cancel Task
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ApprovalItem({
  approval,
  executing,
  onApprove,
  onDeny,
}: {
  approval: PendingApproval;
  executing: boolean;
  onApprove: () => void;
  onDeny: () => void;
}) {
  return (
    <div className="px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
          <svg
            className="w-4 h-4 text-blue-600 dark:text-blue-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-blue-600 dark:text-blue-400 uppercase">
              Approval
            </span>
          </div>
          <p className="mt-1 text-sm font-medium text-gray-900 dark:text-white">
            {approval.title}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Requested by: {approval.requestedBy}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              onClick={onApprove}
              disabled={executing}
              className="px-2 py-1 text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded hover:bg-green-200 dark:hover:bg-green-900/50 disabled:opacity-50"
            >
              Approve
            </button>
            <button
              onClick={onDeny}
              disabled={executing}
              className="px-2 py-1 text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 rounded hover:bg-red-200 dark:hover:bg-red-900/50 disabled:opacity-50"
            >
              Deny
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function LockItem({
  lock,
  executing,
  onRelease,
}: {
  lock: FileLock;
  executing: boolean;
  onRelease: () => void;
}) {
  const expiresAt = new Date(lock.expiresAt);
  const now = new Date();
  const remainingMs = expiresAt.getTime() - now.getTime();
  const remainingMins = Math.max(0, Math.floor(remainingMs / 60000));

  return (
    <div className="px-6 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <svg
              className="w-4 h-4 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
            <span className="text-sm text-gray-900 dark:text-white truncate">
              {lock.filePath}
            </span>
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 flex items-center gap-2">
            <AgentBadge agentId={lock.agentId} />
            <span>Expires in {remainingMins}m</span>
          </div>
        </div>
        <button
          onClick={onRelease}
          disabled={executing}
          className="px-2 py-1 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded disabled:opacity-50"
        >
          Force Release
        </button>
      </div>
    </div>
  );
}

function AgentBadge({ agentId }: { agentId: string }) {
  const colors: Record<string, string> = {
    claude:
      "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
    gemini: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    codex:
      "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    gpt4: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  };

  const baseId = agentId.split("-")[0].toLowerCase();

  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${colors[baseId] || "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300"}`}
    >
      {agentId}
    </span>
  );
}

export default ActionForwardPanel;
