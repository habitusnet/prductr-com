"use client";

type HealthStatus = "healthy" | "warning" | "critical" | "offline" | "unknown";

interface HealthIndicatorProps {
  status: HealthStatus;
  lastHeartbeat?: string | null;
  showLabel?: boolean;
}

const statusConfig: Record<
  HealthStatus,
  { color: string; bg: string; text: string; label: string }
> = {
  healthy: {
    color: "bg-green-500",
    bg: "bg-green-100 dark:bg-green-900/30",
    text: "text-green-700 dark:text-green-400",
    label: "Healthy",
  },
  warning: {
    color: "bg-yellow-500",
    bg: "bg-yellow-100 dark:bg-yellow-900/30",
    text: "text-yellow-700 dark:text-yellow-400",
    label: "Warning",
  },
  critical: {
    color: "bg-red-500 animate-pulse",
    bg: "bg-red-100 dark:bg-red-900/30",
    text: "text-red-700 dark:text-red-400",
    label: "Critical",
  },
  offline: {
    color: "bg-gray-400",
    bg: "bg-gray-100 dark:bg-gray-700",
    text: "text-gray-500 dark:text-gray-400",
    label: "Offline",
  },
  unknown: {
    color: "bg-gray-300",
    bg: "bg-gray-100 dark:bg-gray-700",
    text: "text-gray-400 dark:text-gray-500",
    label: "Unknown",
  },
};

export default function HealthIndicator({
  status,
  lastHeartbeat,
  showLabel = true,
}: HealthIndicatorProps) {
  const config = statusConfig[status] || statusConfig.unknown;

  const timeSince = lastHeartbeat
    ? formatTimeSince(
        Math.floor(
          (Date.now() - new Date(lastHeartbeat).getTime()) / 1000,
        ),
      )
    : null;

  return (
    <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full ${config.bg}`}>
      <div className={`w-2 h-2 rounded-full ${config.color}`} />
      {showLabel && (
        <span className={`text-xs font-medium ${config.text}`}>
          {config.label}
        </span>
      )}
      {timeSince && showLabel && (
        <span className={`text-xs ${config.text} opacity-75`}>
          ({timeSince})
        </span>
      )}
    </div>
  );
}

function formatTimeSince(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86400)}d`;
}

/**
 * Derive health status from seconds since last heartbeat.
 * Mirrors the thresholds in HealthMonitor (2m/5m/10m).
 */
export function deriveHealthStatus(
  secondsSinceHeartbeat: number | null,
): HealthStatus {
  if (secondsSinceHeartbeat === null) return "offline";
  if (secondsSinceHeartbeat >= 600) return "offline";
  if (secondsSinceHeartbeat >= 300) return "critical";
  if (secondsSinceHeartbeat >= 120) return "warning";
  return "healthy";
}
