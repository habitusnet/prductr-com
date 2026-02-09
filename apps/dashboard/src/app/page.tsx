"use client";

import { useEffect, useState, useCallback } from "react";
import { ActionForwardPanel } from "@/components/ActionForwardPanel";
import { AccessQueuePanel } from "@/components/AccessQueuePanel";
import { OnboardingConfigPanel } from "@/components/OnboardingConfigPanel";
import { useEvents } from "@/components/EventProvider";

interface ProjectStatus {
  project: { id: string; name: string; conflictStrategy: string } | null;
  tasks: {
    total: number;
    pending: number;
    claimed: number;
    inProgress: number;
    completed: number;
    failed: number;
    blocked: number;
  };
  agents: {
    total: number;
    idle: number;
    working: number;
    blocked: number;
    offline: number;
  };
  budget: {
    total: number;
    spent: number;
    remaining: number;
    percentUsed: string;
    alertThreshold: number;
  } | null;
  conflicts: number;
}

export default function DashboardPage() {
  const [status, setStatus] = useState<ProjectStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { refreshTrigger, connected } = useEvents();

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/project");
      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else {
        setStatus(data);
        setError(null);
      }
    } catch (err) {
      setError("Failed to connect to API");
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // Refetch when real-time events trigger refresh
  useEffect(() => {
    if (refreshTrigger > 0) {
      fetchStatus();
    }
  }, [refreshTrigger, fetchStatus]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-conductor-600"></div>
      </div>
    );
  }

  const hasData = status && (status.tasks.total > 0 || status.agents.total > 0);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          {status?.project?.name || "Conductor Dashboard"}
        </h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          Multi-LLM orchestration overview
        </p>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-red-700 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Total Tasks"
          value={status?.tasks.total.toString() || "0"}
          subtitle={`${status?.tasks.inProgress || 0} in progress`}
          color="blue"
        />
        <StatCard
          title="Active Agents"
          value={(status
            ? status.agents.total - status.agents.offline
            : 0
          ).toString()}
          subtitle={`${status?.agents.working || 0} working`}
          color="green"
        />
        <StatCard
          title="Budget Used"
          value={
            status?.budget ? `$${status.budget.spent.toFixed(2)}` : "$0.00"
          }
          subtitle={
            status?.budget
              ? `${status.budget.percentUsed}% of $${status.budget.total}`
              : "No budget set"
          }
          color="purple"
        />
        <StatCard
          title="Conflicts"
          value={(status?.conflicts || 0).toString()}
          subtitle="0 unresolved"
          color="red"
        />
      </div>

      {/* Action Forward Panel */}
      <ActionForwardPanel onRefresh={fetchStatus} />

      {/* Access Queue Panel */}
      <AccessQueuePanel onRefresh={fetchStatus} />

      {/* Onboarding Configuration */}
      <OnboardingConfigPanel onRefresh={fetchStatus} />

      {/* Navigation Links */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Navigation
        </h2>
        <div className="flex flex-wrap gap-4">
          <a
            href="/tasks"
            className="px-4 py-2 bg-conductor-600 text-white rounded-lg hover:bg-conductor-700 transition-colors"
          >
            View Tasks
          </a>
          <a
            href="/agents"
            className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
          >
            View Agents
          </a>
          <a
            href="/costs"
            className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
          >
            View Costs
          </a>
        </div>
      </div>

      {/* Setup Instructions - only show if no data */}
      {!hasData && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-amber-800 dark:text-amber-200 mb-2">
            Getting Started
          </h2>
          <p className="text-amber-700 dark:text-amber-300 mb-4">
            No project data found. To connect to a Conductor project:
          </p>
          <ol className="list-decimal list-inside text-amber-700 dark:text-amber-300 space-y-2">
            <li>
              Initialize a project:{" "}
              <code className="bg-amber-100 dark:bg-amber-900 px-2 py-1 rounded">
                conductor init
              </code>
            </li>
            <li>
              Set environment variable:{" "}
              <code className="bg-amber-100 dark:bg-amber-900 px-2 py-1 rounded">
                CONDUCTOR_DB=./conductor.db
              </code>
            </li>
            <li>
              Set project ID:{" "}
              <code className="bg-amber-100 dark:bg-amber-900 px-2 py-1 rounded">
                CONDUCTOR_PROJECT_ID=your-project-id
              </code>
            </li>
            <li>Restart the dashboard</li>
          </ol>
        </div>
      )}

      {/* Task Status Overview */}
      {hasData && status && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Task Status
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
            <StatusBadge
              label="Pending"
              count={status.tasks.pending}
              color="gray"
            />
            <StatusBadge
              label="Claimed"
              count={status.tasks.claimed}
              color="blue"
            />
            <StatusBadge
              label="In Progress"
              count={status.tasks.inProgress}
              color="yellow"
            />
            <StatusBadge
              label="Completed"
              count={status.tasks.completed}
              color="green"
            />
            <StatusBadge
              label="Failed"
              count={status.tasks.failed}
              color="red"
            />
            <StatusBadge
              label="Blocked"
              count={status.tasks.blocked}
              color="orange"
            />
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({
  title,
  value,
  subtitle,
  color,
}: {
  title: string;
  value: string;
  subtitle: string;
  color: "blue" | "green" | "purple" | "red";
}) {
  const colorClasses = {
    blue: "bg-blue-500",
    green: "bg-green-500",
    purple: "bg-purple-500",
    red: "bg-red-500",
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <div className="flex items-center">
        <div className={`w-3 h-3 rounded-full ${colorClasses[color]} mr-3`} />
        <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
          {title}
        </h3>
      </div>
      <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-white">
        {value}
      </p>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
        {subtitle}
      </p>
    </div>
  );
}

function StatusBadge({
  label,
  count,
  color,
}: {
  label: string;
  count: number;
  color: "gray" | "blue" | "yellow" | "green" | "red" | "orange";
}) {
  const colorClasses = {
    gray: "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300",
    blue: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    yellow:
      "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
    green:
      "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    red: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    orange:
      "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  };

  return (
    <div className={`px-4 py-3 rounded-lg ${colorClasses[color]}`}>
      <div className="text-2xl font-bold">{count}</div>
      <div className="text-sm">{label}</div>
    </div>
  );
}
