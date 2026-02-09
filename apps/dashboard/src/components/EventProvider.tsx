"use client";

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { useEventStream, type EventStreamState } from "@/hooks/useEventStream";
import type { StreamEvent, EventType } from "@/lib/event-stream";

interface Toast {
  id: string;
  type: "info" | "success" | "warning" | "error";
  message: string;
  timestamp: Date;
}

interface EventContextValue extends EventStreamState {
  toasts: Toast[];
  dismissToast: (id: string) => void;
  clearToasts: () => void;
  refreshTrigger: number;
}

const EventContext = createContext<EventContextValue | null>(null);

/**
 * Map event types to toast configurations
 */
function getToastConfig(
  event: StreamEvent,
): { type: Toast["type"]; message: string } | null {
  switch (event.type) {
    case "task:created":
      return {
        type: "info",
        message: `New task created: ${event.data.taskId}`,
      };
    case "task:completed":
      return {
        type: "success",
        message: `Task completed: ${event.data.taskId}`,
      };
    case "task:failed":
      return { type: "error", message: `Task failed: ${event.data.taskId}` };
    case "agent:registered":
      return {
        type: "info",
        message: `Agent connected: ${event.data.agentId}`,
      };
    case "agent:offline":
      return {
        type: "warning",
        message: `Agent offline: ${event.data.agentId}`,
      };
    case "cost:recorded":
      return {
        type: "info",
        message: `Cost recorded: $${(event.data.delta as number).toFixed(2)}`,
      };
    case "conflict:detected":
      return { type: "warning", message: "File conflict detected!" };
    case "sandbox:started":
      return { type: "success", message: "Sandbox started" };
    case "sandbox:stopped":
      return { type: "info", message: "Sandbox stopped" };
    default:
      return null;
  }
}

export function EventProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleEvent = useCallback((event: StreamEvent) => {
    // Skip heartbeats
    if (event.type === "heartbeat") return;

    // Trigger data refresh for relevant events
    const refreshEvents: EventType[] = [
      "task:created",
      "task:updated",
      "task:completed",
      "task:failed",
      "agent:registered",
      "agent:heartbeat",
      "agent:offline",
      "cost:recorded",
      "sandbox:started",
      "sandbox:stopped",
    ];

    if (refreshEvents.includes(event.type)) {
      setRefreshTrigger((prev) => prev + 1);
    }

    // Create toast notification
    const toastConfig = getToastConfig(event);
    if (toastConfig) {
      const toast: Toast = {
        id: `${event.type}-${Date.now()}`,
        ...toastConfig,
        timestamp: new Date(),
      };

      setToasts((prev) => [toast, ...prev].slice(0, 5));

      // Auto-dismiss after 5 seconds
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== toast.id));
      }, 5000);
    }
  }, []);

  const eventStream = useEventStream({
    onEvent: handleEvent,
  });

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const clearToasts = useCallback(() => {
    setToasts([]);
  }, []);

  const value: EventContextValue = {
    ...eventStream,
    toasts,
    dismissToast,
    clearToasts,
    refreshTrigger,
  };

  return (
    <EventContext.Provider value={value}>
      <>
        {children}
        <ToastContainer toasts={toasts} onDismiss={dismissToast} />
        <ConnectionIndicator connected={eventStream.connected} />
      </>
    </EventContext.Provider>
  );
}

/**
 * Hook to access event context
 */
export function useEvents(): EventContextValue {
  const context = useContext(EventContext);
  if (!context) {
    throw new Error("useEvents must be used within an EventProvider");
  }
  return context;
}

/**
 * Toast notification container
 */
function ToastContainer({
  toasts,
  onDismiss,
}: {
  toasts: Toast[];
  onDismiss: (id: string) => void;
}) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`
            flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg
            animate-slide-in-right
            ${
              toast.type === "success"
                ? "bg-green-600 text-white"
                : toast.type === "error"
                  ? "bg-red-600 text-white"
                  : toast.type === "warning"
                    ? "bg-yellow-500 text-white"
                    : "bg-gray-800 text-white"
            }
          `}
        >
          <span className="text-lg">
            {toast.type === "success" && "✓"}
            {toast.type === "error" && "✕"}
            {toast.type === "warning" && "⚠"}
            {toast.type === "info" && "ℹ"}
          </span>
          <span className="text-sm font-medium">{toast.message}</span>
          <button
            onClick={() => onDismiss(toast.id)}
            className="ml-2 text-white/70 hover:text-white"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}

/**
 * Connection status indicator
 */
function ConnectionIndicator({ connected }: { connected: boolean }) {
  return (
    <div className="fixed bottom-4 left-4 z-50">
      <div
        className={`
          flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium
          ${
            connected
              ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
              : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
          }
        `}
      >
        <div
          className={`w-2 h-2 rounded-full ${
            connected ? "bg-green-500 animate-pulse" : "bg-red-500"
          }`}
        />
        {connected ? "Live" : "Disconnected"}
      </div>
    </div>
  );
}
