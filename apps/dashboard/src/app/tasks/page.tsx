"use client";

import { useEffect, useState, useCallback } from "react";
import { useEvents } from "@/components/EventProvider";

type TaskStatus =
  | "pending"
  | "claimed"
  | "in_progress"
  | "completed"
  | "failed"
  | "blocked"
  | "cancelled";
type TaskPriority = "critical" | "high" | "medium" | "low";
type SortField = "createdAt" | "priority" | "status";
type SortDir = "asc" | "desc";

interface Task {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  assignedTo?: string;
  files: string[];
  tags: string[];
  estimatedTokens?: number;
  actualTokens?: number;
  createdAt: string;
  completedAt?: string;
  blockedBy?: string[];
  metadata?: Record<string, unknown>;
}

interface AgentOption {
  id: string;
  name: string;
}

const PRIORITY_WEIGHT: Record<TaskPriority, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState<SortField>("createdAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [agents, setAgents] = useState<AgentOption[]>([]);
  const [actionPending, setActionPending] = useState(false);
  const { refreshTrigger } = useEvents();

  const fetchTasks = useCallback(async () => {
    try {
      const res = await fetch("/api/tasks");
      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else {
        setTasks(data.tasks || []);
        setError(null);
      }
    } catch (err) {
      setError("Failed to fetch tasks");
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  // Refetch when real-time events trigger refresh
  useEffect(() => {
    if (refreshTrigger > 0) {
      fetchTasks();
    }
  }, [refreshTrigger, fetchTasks]);

  // Fetch agents for reassignment (once)
  useEffect(() => {
    fetch("/api/agents")
      .then((r) => r.json())
      .then((data) =>
        setAgents(
          (data.agents || []).map((a: any) => ({ id: a.id, name: a.name })),
        ),
      )
      .catch(() => {});
  }, []);

  // Filter pipeline
  const filteredTasks = tasks
    .filter((t) => statusFilter === "all" || t.status === statusFilter)
    .filter((t) => priorityFilter === "all" || t.priority === priorityFilter)
    .filter(
      (t) =>
        !searchQuery ||
        t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.id.toLowerCase().includes(searchQuery.toLowerCase()),
    )
    .sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "createdAt":
          cmp =
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          break;
        case "priority":
          cmp = PRIORITY_WEIGHT[a.priority] - PRIORITY_WEIGHT[b.priority];
          break;
        case "status":
          cmp = a.status.localeCompare(b.status);
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });

  const statusCounts = {
    pending: tasks.filter((t) => t.status === "pending").length,
    in_progress: tasks.filter((t) => t.status === "in_progress").length,
    completed: tasks.filter((t) => t.status === "completed").length,
    blocked: tasks.filter((t) => t.status === "blocked").length,
  };

  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  }

  function sortIndicator(field: SortField) {
    if (sortField !== field) return "";
    return sortDir === "asc" ? " \u25B2" : " \u25BC";
  }

  async function handleStatusChange(taskId: string, newStatus: string) {
    setActionPending(true);
    try {
      const actionType =
        newStatus === "pending" ? "unblock_task" : "cancel_task";
      await fetch("/api/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actionType, actionId: taskId }),
      });
      await fetchTasks();
      // Update selected task if open
      if (selectedTask?.id === taskId) {
        setSelectedTask((prev) =>
          prev ? { ...prev, status: newStatus as TaskStatus } : null,
        );
      }
    } finally {
      setActionPending(false);
    }
  }

  async function handleReassign(taskId: string, newAgentId: string) {
    setActionPending(true);
    try {
      await fetch("/api/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actionType: "reassign_task",
          actionId: taskId,
          data: { newAgentId },
        }),
      });
      await fetchTasks();
    } finally {
      setActionPending(false);
    }
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
            Tasks
          </h1>
          <p className="mt-1 text-gray-600 dark:text-gray-400">
            Manage and monitor task assignments
          </p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-red-700 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Search */}
      <input
        type="text"
        placeholder="Search tasks by title, description, or ID..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-conductor-500"
      />

      {/* Status Filters */}
      <div className="flex flex-wrap gap-3">
        <FilterButton
          label="All"
          count={tasks.length}
          active={statusFilter === "all"}
          onClick={() => setStatusFilter("all")}
        />
        <FilterButton
          label="Pending"
          count={statusCounts.pending}
          active={statusFilter === "pending"}
          onClick={() => setStatusFilter("pending")}
        />
        <FilterButton
          label="In Progress"
          count={statusCounts.in_progress}
          active={statusFilter === "in_progress"}
          onClick={() => setStatusFilter("in_progress")}
        />
        <FilterButton
          label="Completed"
          count={statusCounts.completed}
          active={statusFilter === "completed"}
          onClick={() => setStatusFilter("completed")}
        />
        <FilterButton
          label="Blocked"
          count={statusCounts.blocked}
          active={statusFilter === "blocked"}
          onClick={() => setStatusFilter("blocked")}
        />
      </div>

      {/* Priority Filters */}
      <div className="flex flex-wrap gap-2">
        <span className="text-sm text-gray-500 dark:text-gray-400 self-center mr-1">
          Priority:
        </span>
        {(["all", "critical", "high", "medium", "low"] as const).map((p) => (
          <button
            key={p}
            onClick={() => setPriorityFilter(p)}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
              priorityFilter === p
                ? "bg-conductor-600 text-white"
                : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
            }`}
          >
            {p === "all"
              ? "All"
              : p.charAt(0).toUpperCase() + p.slice(1)}
          </button>
        ))}
      </div>

      <div className="flex gap-6">
        {/* Task List */}
        <div className={`flex-1 ${selectedTask ? "max-w-[60%]" : ""}`}>
          {filteredTasks.length > 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-900">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Task
                    </th>
                    <th
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-700 dark:hover:text-gray-200"
                      onClick={() => handleSort("status")}
                    >
                      Status{sortIndicator("status")}
                    </th>
                    <th
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-700 dark:hover:text-gray-200"
                      onClick={() => handleSort("priority")}
                    >
                      Priority{sortIndicator("priority")}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Agent
                    </th>
                    <th
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-700 dark:hover:text-gray-200"
                      onClick={() => handleSort("createdAt")}
                    >
                      Created{sortIndicator("createdAt")}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {filteredTasks.map((task) => (
                    <tr
                      key={task.id}
                      onClick={() => setSelectedTask(task)}
                      className={`cursor-pointer transition-colors ${
                        selectedTask?.id === task.id
                          ? "bg-conductor-50 dark:bg-conductor-900/20"
                          : "hover:bg-gray-50 dark:hover:bg-gray-700/50"
                      }`}
                    >
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {task.title}
                        </div>
                        {task.tags.length > 0 && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {task.tags.slice(0, 3).map((tag) => (
                              <span
                                key={tag}
                                className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300"
                              >
                                {tag}
                              </span>
                            ))}
                            {task.tags.length > 3 && (
                              <span className="text-xs text-gray-400">
                                +{task.tags.length - 3}
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <StatusBadge status={task.status} />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <PriorityBadge priority={task.priority} />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {task.assignedTo ? (
                          <AgentBadge agentId={task.assignedTo} />
                        ) : (
                          <span className="text-sm text-gray-400 dark:text-gray-500 italic">
                            Unassigned
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {formatDate(task.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8 text-center">
              <p className="text-gray-500 dark:text-gray-400">
                {statusFilter === "all" && !searchQuery
                  ? "No tasks found. Create tasks using the CLI."
                  : "No tasks match your filters."}
              </p>
            </div>
          )}
        </div>

        {/* Detail Side Panel */}
        {selectedTask && (
          <div className="w-[40%] bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white truncate">
                {selectedTask.title}
              </h3>
              <button
                onClick={() => setSelectedTask(null)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xl leading-none"
              >
                x
              </button>
            </div>
            <div className="p-6 space-y-5 overflow-y-auto max-h-[calc(100vh-300px)]">
              {/* ID */}
              <div>
                <div className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                  ID
                </div>
                <code className="text-sm text-gray-700 dark:text-gray-300">
                  {selectedTask.id}
                </code>
              </div>

              {/* Description */}
              {selectedTask.description && (
                <div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                    Description
                  </div>
                  <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                    {selectedTask.description}
                  </p>
                </div>
              )}

              {/* Status + Priority */}
              <div className="flex gap-4">
                <div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                    Status
                  </div>
                  <StatusBadge status={selectedTask.status} />
                </div>
                <div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                    Priority
                  </div>
                  <PriorityBadge priority={selectedTask.priority} />
                </div>
              </div>

              {/* Agent */}
              <div>
                <div className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                  Assigned To
                </div>
                {selectedTask.assignedTo ? (
                  <AgentBadge agentId={selectedTask.assignedTo} />
                ) : (
                  <span className="text-sm text-gray-400 italic">
                    Unassigned
                  </span>
                )}
              </div>

              {/* Files */}
              {selectedTask.files.length > 0 && (
                <div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                    Files ({selectedTask.files.length})
                  </div>
                  <div className="space-y-1">
                    {selectedTask.files.map((f) => (
                      <code
                        key={f}
                        className="block text-xs text-gray-600 dark:text-gray-400"
                      >
                        {f}
                      </code>
                    ))}
                  </div>
                </div>
              )}

              {/* Tags */}
              {selectedTask.tags.length > 0 && (
                <div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                    Tags
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {selectedTask.tags.map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Tokens */}
              <div>
                <div className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                  Tokens
                </div>
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  {selectedTask.actualTokens
                    ? `${(selectedTask.actualTokens / 1000).toFixed(1)}k actual`
                    : selectedTask.estimatedTokens
                      ? `~${(selectedTask.estimatedTokens / 1000).toFixed(1)}k estimated`
                      : "-"}
                </span>
              </div>

              {/* Blocked By */}
              {selectedTask.blockedBy && selectedTask.blockedBy.length > 0 && (
                <div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                    Blocked By
                  </div>
                  <div className="space-y-1">
                    {selectedTask.blockedBy.map((id) => (
                      <code
                        key={id}
                        className="block text-xs text-orange-600 dark:text-orange-400"
                      >
                        {id}
                      </code>
                    ))}
                  </div>
                </div>
              )}

              {/* Dates */}
              <div className="flex gap-4 text-sm">
                <div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                    Created
                  </div>
                  <span className="text-gray-700 dark:text-gray-300">
                    {formatDate(selectedTask.createdAt)}
                  </span>
                </div>
                {selectedTask.completedAt && (
                  <div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                      Completed
                    </div>
                    <span className="text-gray-700 dark:text-gray-300">
                      {formatDate(selectedTask.completedAt)}
                    </span>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="border-t border-gray-200 dark:border-gray-700 pt-4 space-y-3">
                <div className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  Actions
                </div>

                {/* Status change */}
                <div className="flex gap-2">
                  {selectedTask.status === "blocked" && (
                    <button
                      onClick={() =>
                        handleStatusChange(selectedTask.id, "pending")
                      }
                      disabled={actionPending}
                      className="px-3 py-1.5 text-sm bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded hover:bg-green-200 dark:hover:bg-green-900/50 disabled:opacity-50"
                    >
                      Unblock
                    </button>
                  )}
                  {selectedTask.status !== "cancelled" &&
                    selectedTask.status !== "completed" && (
                      <button
                        onClick={() =>
                          handleStatusChange(selectedTask.id, "cancelled")
                        }
                        disabled={actionPending}
                        className="px-3 py-1.5 text-sm bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded hover:bg-red-200 dark:hover:bg-red-900/50 disabled:opacity-50"
                      >
                        Cancel Task
                      </button>
                    )}
                </div>

                {/* Reassignment */}
                {agents.length > 0 && (
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                      Reassign to agent
                    </label>
                    <select
                      onChange={(e) => {
                        if (e.target.value) {
                          handleReassign(selectedTask.id, e.target.value);
                          e.target.value = "";
                        }
                      }}
                      disabled={actionPending}
                      className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50"
                      defaultValue=""
                    >
                      <option value="" disabled>
                        Select agent...
                      </option>
                      {agents.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name} ({a.id})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MiniStat label="Total Tasks" value={tasks.length} />
        <MiniStat label="In Progress" value={statusCounts.in_progress} />
        <MiniStat label="Completed" value={statusCounts.completed} />
        <MiniStat label="Blocked" value={statusCounts.blocked} />
      </div>
    </div>
  );
}

function FilterButton({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
        active
          ? "bg-conductor-600 text-white"
          : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
      }`}
    >
      {label}
      <span
        className={`ml-1.5 ${active ? "text-conductor-200" : "text-gray-400 dark:text-gray-500"}`}
      >
        {count}
      </span>
    </button>
  );
}

function StatusBadge({ status }: { status: TaskStatus }) {
  const styles: Record<TaskStatus, string> = {
    pending: "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300",
    claimed: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    in_progress:
      "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
    completed:
      "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    failed: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    blocked:
      "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
    cancelled: "bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-500",
  };

  const labels: Record<TaskStatus, string> = {
    pending: "Pending",
    claimed: "Claimed",
    in_progress: "In Progress",
    completed: "Completed",
    failed: "Failed",
    blocked: "Blocked",
    cancelled: "Cancelled",
  };

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${styles[status]}`}
    >
      {labels[status]}
    </span>
  );
}

function PriorityBadge({ priority }: { priority: TaskPriority }) {
  const styles: Record<TaskPriority, string> = {
    critical: "text-red-600 dark:text-red-400",
    high: "text-orange-600 dark:text-orange-400",
    medium: "text-yellow-600 dark:text-yellow-400",
    low: "text-gray-600 dark:text-gray-400",
  };

  const icons: Record<TaskPriority, string> = {
    critical: "!!!",
    high: "!!",
    medium: "!",
    low: "-",
  };

  return (
    <span className={`text-sm font-medium ${styles[priority]}`}>
      {icons[priority]} {priority.charAt(0).toUpperCase() + priority.slice(1)}
    </span>
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

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colors[agentId] || "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300"}`}
    >
      {agentId}
    </span>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
      <div className="text-sm text-gray-500 dark:text-gray-400">{label}</div>
      <div className="text-2xl font-bold text-gray-900 dark:text-white">
        {value}
      </div>
    </div>
  );
}

function formatDate(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
  return date.toLocaleDateString();
}
