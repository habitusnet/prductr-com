"use client";

import { useEffect, useState, useCallback } from "react";

interface AccessRequest {
  id: string;
  agentId: string;
  agentName: string;
  agentType: string;
  capabilities: string[];
  requestedRole: string;
  status: "pending" | "approved" | "denied" | "expired";
  requestedAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
  expiresAt?: string;
  denialReason?: string;
}

interface AccessRequestSummary {
  total: number;
  pending: number;
  approved: number;
  denied: number;
  expired: number;
}

interface AccessQueuePanelProps {
  onRefresh?: () => void;
}

export function AccessQueuePanel({ onRefresh }: AccessQueuePanelProps) {
  const [requests, setRequests] = useState<AccessRequest[]>([]);
  const [summary, setSummary] = useState<AccessRequestSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [executing, setExecuting] = useState<string | null>(null);
  const [filter, setFilter] = useState<
    "all" | "pending" | "approved" | "denied"
  >("pending");
  const [showDenyModal, setShowDenyModal] = useState<string | null>(null);
  const [denyReason, setDenyReason] = useState("");

  const fetchRequests = useCallback(async () => {
    try {
      const statusParam = filter === "all" ? "" : `?status=${filter}`;
      const res = await fetch(`/api/access-requests${statusParam}`);
      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else {
        setRequests(data.requests);
        setSummary(data.summary);
        setError(null);
      }
    } catch {
      setError("Failed to fetch access requests");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchRequests();
    const interval = setInterval(fetchRequests, 5000);
    return () => clearInterval(interval);
  }, [fetchRequests]);

  const executeAction = async (
    action: string,
    requestId: string,
    extra?: Record<string, unknown>,
  ) => {
    setExecuting(requestId);
    try {
      const res = await fetch("/api/access-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, requestId, ...extra }),
      });
      const data = await res.json();
      if (data.success) {
        fetchRequests();
        onRefresh?.();
      } else {
        setError(data.error || "Action failed");
      }
    } catch {
      setError("Failed to execute action");
    } finally {
      setExecuting(null);
      setShowDenyModal(null);
      setDenyReason("");
    }
  };

  const handleApprove = (requestId: string) => {
    executeAction("approve", requestId);
  };

  const handleDeny = (requestId: string) => {
    executeAction("deny", requestId, { reason: denyReason || undefined });
  };

  const handleExpireOld = () => {
    executeAction("expire_old", "", { olderThanHours: 24 });
  };

  const getAgentTypeColor = (agentType: string) => {
    switch (agentType) {
      case "claude":
        return "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400";
      case "gemini":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400";
      case "codex":
      case "gpt4":
        return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
      case "llama":
        return "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300";
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400";
      case "approved":
        return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
      case "denied":
        return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
      case "expired":
        return "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-400";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300";
    }
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <div className="animate-pulse flex space-x-4">
          <div className="flex-1 space-y-4">
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/4"></div>
            <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Access Queue
          </h2>
          {summary && summary.pending > 0 && (
            <span className="px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400 rounded-full">
              {summary.pending} pending
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExpireOld}
            className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
            title="Expire requests older than 24 hours"
          >
            Expire Old
          </button>
          <button
            onClick={fetchRequests}
            className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
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
      </div>

      {/* Summary Stats */}
      {summary && (
        <div className="px-6 py-3 bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
          <div className="flex gap-4 text-sm">
            <span className="text-gray-600 dark:text-gray-400">
              Total:{" "}
              <strong className="text-gray-900 dark:text-white">
                {summary.total}
              </strong>
            </span>
            <span className="text-yellow-600 dark:text-yellow-400">
              Pending: <strong>{summary.pending}</strong>
            </span>
            <span className="text-green-600 dark:text-green-400">
              Approved: <strong>{summary.approved}</strong>
            </span>
            <span className="text-red-600 dark:text-red-400">
              Denied: <strong>{summary.denied}</strong>
            </span>
          </div>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="px-6 py-2 border-b border-gray-200 dark:border-gray-700">
        <div className="flex gap-1">
          {(["pending", "approved", "denied", "all"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                filter === tab
                  ? "bg-conductor-100 text-conductor-700 dark:bg-conductor-900/30 dark:text-conductor-400"
                  : "text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="px-6 py-3 bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-800">
          <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Request List */}
      <div className="divide-y divide-gray-200 dark:divide-gray-700">
        {requests.length === 0 ? (
          <div className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
            <svg
              className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
              />
            </svg>
            <p className="mt-2">
              No {filter === "all" ? "" : filter} access requests
            </p>
          </div>
        ) : (
          requests.map((request) => (
            <div
              key={request.id}
              className="px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                {/* Request Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className={`px-2 py-0.5 text-xs font-medium rounded ${getAgentTypeColor(request.agentType)}`}
                    >
                      {request.agentType}
                    </span>
                    <span
                      className={`px-2 py-0.5 text-xs font-medium rounded ${getStatusBadge(request.status)}`}
                    >
                      {request.status}
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {formatTimeAgo(request.requestedAt)}
                    </span>
                  </div>
                  <h3 className="font-medium text-gray-900 dark:text-white truncate">
                    {request.agentName}
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                    {request.agentId}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    <span className="px-2 py-0.5 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded">
                      Role: {request.requestedRole}
                    </span>
                    {request.capabilities.slice(0, 3).map((cap) => (
                      <span
                        key={cap}
                        className="px-2 py-0.5 text-xs bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 rounded"
                      >
                        {cap}
                      </span>
                    ))}
                    {request.capabilities.length > 3 && (
                      <span className="px-2 py-0.5 text-xs bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 rounded">
                        +{request.capabilities.length - 3} more
                      </span>
                    )}
                  </div>
                  {request.denialReason && (
                    <p className="mt-2 text-sm text-red-600 dark:text-red-400">
                      Reason: {request.denialReason}
                    </p>
                  )}
                  {request.expiresAt && (
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      Expires:{" "}
                      {new Date(request.expiresAt).toLocaleDateString()}
                    </p>
                  )}
                </div>

                {/* Actions */}
                {request.status === "pending" && (
                  <div className="flex gap-2 flex-shrink-0">
                    <button
                      onClick={() => handleApprove(request.id)}
                      disabled={executing === request.id}
                      className="px-3 py-1.5 text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:opacity-50 rounded-md transition-colors"
                    >
                      {executing === request.id ? "Processing..." : "Approve"}
                    </button>
                    <button
                      onClick={() => setShowDenyModal(request.id)}
                      disabled={executing === request.id}
                      className="px-3 py-1.5 text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded-md transition-colors"
                    >
                      Deny
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Deny Modal */}
      {showDenyModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Deny Access Request
            </h3>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Reason (optional)
              </label>
              <textarea
                value={denyReason}
                onChange={(e) => setDenyReason(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-red-500 focus:border-red-500"
                rows={3}
                placeholder="Provide a reason for denying access..."
              />
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowDenyModal(null);
                  setDenyReason("");
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeny(showDenyModal)}
                disabled={executing === showDenyModal}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded-md"
              >
                {executing === showDenyModal ? "Denying..." : "Deny Access"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
