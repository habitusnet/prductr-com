"use client";

import { useEffect, useState, useCallback } from "react";
import { useEvents } from "@/components/EventProvider";

interface CostEvent {
  id: string;
  agentId: string;
  model: string;
  taskId: string;
  tokensInput: number;
  tokensOutput: number;
  cost: number;
  createdAt: string;
}

interface AgentUsage {
  agentId: string;
  cost: number;
  tokens: number;
  percentage: number;
}

interface DailySpend {
  date: string;
  amount: number;
}

interface Budget {
  total: number;
  spent: number;
  alertThreshold: number;
}

interface CostsData {
  events: CostEvent[];
  budget: Budget | null;
  byAgent: AgentUsage[];
  dailySpend: DailySpend[];
  totalSpend: number;
}

export default function CostsPage() {
  const [data, setData] = useState<CostsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<"7d" | "30d" | "all">("7d");
  const { refreshTrigger } = useEvents();

  const fetchCosts = useCallback(async () => {
    try {
      const res = await fetch("/api/costs");
      const json = await res.json();
      if (json.error) {
        setError(json.error);
      } else {
        setData(json);
        setError(null);
      }
    } catch (err) {
      setError("Failed to fetch costs");
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchCosts();
  }, [fetchCosts]);

  // Refetch when real-time events trigger refresh
  useEffect(() => {
    if (refreshTrigger > 0) {
      fetchCosts();
    }
  }, [refreshTrigger, fetchCosts]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-conductor-600"></div>
      </div>
    );
  }

  const budget = data?.budget;
  const percentUsed = budget ? (budget.spent / budget.total) * 100 : 0;
  const isNearLimit = budget ? percentUsed >= budget.alertThreshold : false;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Costs
          </h1>
          <p className="mt-1 text-gray-600 dark:text-gray-400">
            Track spending and usage across agents
          </p>
        </div>
        <div className="flex gap-2">
          <TimeRangeButton
            label="7 Days"
            value="7d"
            current={timeRange}
            onChange={setTimeRange}
          />
          <TimeRangeButton
            label="30 Days"
            value="30d"
            current={timeRange}
            onChange={setTimeRange}
          />
          <TimeRangeButton
            label="All Time"
            value="all"
            current={timeRange}
            onChange={setTimeRange}
          />
        </div>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-red-700 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Budget Overview */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Budget Status
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Monthly spending limit
            </p>
          </div>
          <button className="text-sm text-conductor-600 hover:text-conductor-700 dark:text-conductor-400 font-medium">
            Edit Budget
          </button>
        </div>

        {budget ? (
          <>
            <div className="flex items-end gap-4 mb-4">
              <div className="text-4xl font-bold text-gray-900 dark:text-white">
                ${budget.spent.toFixed(2)}
              </div>
              <div className="text-lg text-gray-500 dark:text-gray-400 mb-1">
                / ${budget.total.toFixed(2)}
              </div>
            </div>

            <div className="relative h-4 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className={`absolute inset-y-0 left-0 rounded-full transition-all ${
                  isNearLimit ? "bg-red-500" : "bg-conductor-500"
                }`}
                style={{ width: `${Math.min(percentUsed, 100)}%` }}
              />
              <div
                className="absolute inset-y-0 border-r-2 border-dashed border-orange-400"
                style={{ left: `${budget.alertThreshold}%` }}
              />
            </div>

            <div className="flex justify-between mt-2 text-sm">
              <span
                className={
                  isNearLimit
                    ? "text-red-600 dark:text-red-400 font-medium"
                    : "text-gray-600 dark:text-gray-400"
                }
              >
                {percentUsed.toFixed(1)}% used
              </span>
              <span className="text-gray-500 dark:text-gray-400">
                ${(budget.total - budget.spent).toFixed(2)} remaining
              </span>
            </div>

            {isNearLimit && (
              <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <p className="text-sm text-red-700 dark:text-red-400">
                  Warning: You&apos;ve exceeded {budget.alertThreshold}% of your
                  budget. Consider reviewing task assignments.
                </p>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-8">
            <div className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
              ${data?.totalSpend.toFixed(2) || "0.00"}
            </div>
            <p className="text-gray-500 dark:text-gray-400">
              Total spent (no budget set)
            </p>
            <p className="text-sm text-gray-400 dark:text-gray-500 mt-2">
              Set a budget using the CLI:{" "}
              <code className="bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded">
                conductor budget --set 100
              </code>
            </p>
          </div>
        )}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Daily Spend Chart */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Daily Spending
          </h2>
          {data?.dailySpend && data.dailySpend.length > 0 ? (
            <div className="h-48 flex items-end gap-2">
              {data.dailySpend.map((day) => {
                const maxAmount = Math.max(
                  ...data.dailySpend.map((d) => d.amount),
                  0.01,
                );
                const height = (day.amount / maxAmount) * 100;
                return (
                  <div
                    key={day.date}
                    className="flex-1 flex flex-col items-center gap-1"
                  >
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      ${day.amount.toFixed(2)}
                    </div>
                    <div
                      className="w-full bg-conductor-500 rounded-t transition-all hover:bg-conductor-600"
                      style={{ height: `${height}%`, minHeight: "8px" }}
                    />
                    <div className="text-xs text-gray-400 dark:text-gray-500">
                      {new Date(day.date).toLocaleDateString("en-US", {
                        weekday: "short",
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="h-48 flex items-center justify-center text-gray-500 dark:text-gray-400">
              No spending data available
            </div>
          )}
        </div>

        {/* Usage by Agent */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Usage by Agent
          </h2>
          {data?.byAgent && data.byAgent.length > 0 ? (
            <div className="space-y-4">
              {data.byAgent.map((agent) => (
                <AgentUsageRow key={agent.agentId} {...agent} />
              ))}
            </div>
          ) : (
            <div className="h-32 flex items-center justify-center text-gray-500 dark:text-gray-400">
              No agent usage data available
            </div>
          )}
        </div>
      </div>

      {/* Recent Transactions */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Recent Usage
          </h2>
        </div>
        {data?.events && data.events.length > 0 ? (
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Time
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Agent
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Model
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Tokens
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Cost
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {data.events.map((event) => (
                <tr
                  key={event.id}
                  className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                >
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    {formatDateTime(new Date(event.createdAt))}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <AgentBadge agentId={event.agentId} />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">
                    {event.model}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    <span className="text-green-600 dark:text-green-400">
                      {(event.tokensInput / 1000).toFixed(1)}k
                    </span>
                    {" / "}
                    <span className="text-blue-600 dark:text-blue-400">
                      {(event.tokensOutput / 1000).toFixed(1)}k
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white text-right">
                    ${event.cost.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
            No cost events recorded yet
          </div>
        )}
      </div>

      {/* Cost Tips */}
      <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-6">
        <h2 className="text-lg font-semibold text-green-800 dark:text-green-200 mb-2">
          Cost Optimization Tips
        </h2>
        <ul className="list-disc list-inside text-green-700 dark:text-green-300 space-y-2">
          <li>
            Use Gemini for high-volume, simpler tasks - it&apos;s 60x cheaper
            than Claude Opus
          </li>
          <li>
            Set token estimates on tasks to help the auction system choose
            cost-effective agents
          </li>
          <li>
            Review completed tasks for token efficiency and adjust future
            estimates
          </li>
          <li>
            Consider zone-based conflict resolution to reduce agent coordination
            overhead
          </li>
        </ul>
      </div>
    </div>
  );
}

function TimeRangeButton({
  label,
  value,
  current,
  onChange,
}: {
  label: string;
  value: "7d" | "30d" | "all";
  current: string;
  onChange: (v: "7d" | "30d" | "all") => void;
}) {
  return (
    <button
      onClick={() => onChange(value)}
      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
        current === value
          ? "bg-conductor-600 text-white"
          : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
      }`}
    >
      {label}
    </button>
  );
}

function AgentUsageRow({
  agentId,
  cost,
  tokens,
  percentage,
}: {
  agentId: string;
  cost: number;
  tokens: number;
  percentage: number;
}) {
  const colors: Record<string, string> = {
    claude: "bg-orange-500",
    gemini: "bg-blue-500",
    codex: "bg-green-500",
    gpt4: "bg-purple-500",
  };

  return (
    <div>
      <div className="flex justify-between mb-1">
        <div className="flex items-center gap-2">
          <div
            className={`w-3 h-3 rounded-full ${colors[agentId] || "bg-gray-500"}`}
          />
          <span className="text-sm font-medium text-gray-900 dark:text-white">
            {agentId}
          </span>
        </div>
        <div className="text-sm text-gray-600 dark:text-gray-400">
          ${cost.toFixed(2)} ({(tokens / 1000).toFixed(0)}k tokens)
        </div>
      </div>
      <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${colors[agentId] || "bg-gray-500"}`}
          style={{ width: `${percentage}%` }}
        />
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

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colors[agentId] || "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300"}`}
    >
      {agentId}
    </span>
  );
}

function formatDateTime(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));

  if (hours < 24) {
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
  }
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
