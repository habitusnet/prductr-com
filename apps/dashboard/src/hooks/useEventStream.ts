"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import type { EventType, StreamEvent } from "@/lib/event-stream";

export interface EventStreamState {
  connected: boolean;
  lastEvent: StreamEvent | null;
  events: StreamEvent[];
  error: string | null;
}

export interface UseEventStreamOptions {
  /** URL of the SSE endpoint */
  url?: string;
  /** Maximum number of events to keep in history */
  maxEvents?: number;
  /** Event types to listen for (empty = all) */
  eventTypes?: EventType[];
  /** Callback when any event is received */
  onEvent?: (event: StreamEvent) => void;
  /** Callback when connection state changes */
  onConnectionChange?: (connected: boolean) => void;
  /** Auto-reconnect on disconnect */
  autoReconnect?: boolean;
  /** Reconnect delay in ms */
  reconnectDelay?: number;
}

/**
 * React hook for consuming Server-Sent Events
 */
export function useEventStream(
  options: UseEventStreamOptions = {},
): EventStreamState & {
  clearEvents: () => void;
  reconnect: () => void;
} {
  const {
    url = "/api/events",
    maxEvents = 100,
    eventTypes = [],
    onEvent,
    onConnectionChange,
    autoReconnect = true,
    reconnectDelay = 3000,
  } = options;

  const [state, setState] = useState<EventStreamState>({
    connected: false,
    lastEvent: null,
    events: [],
    error: null,
  });

  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const mountedRef = useRef(true);

  const connect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    const eventSource = new EventSource(url);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      if (!mountedRef.current) return;
      setState((prev) => ({ ...prev, connected: true, error: null }));
      onConnectionChange?.(true);
    };

    eventSource.onerror = () => {
      if (!mountedRef.current) return;
      setState((prev) => ({
        ...prev,
        connected: false,
        error: "Connection lost",
      }));
      onConnectionChange?.(false);

      // Auto-reconnect
      if (autoReconnect && mountedRef.current) {
        reconnectTimeoutRef.current = setTimeout(() => {
          if (mountedRef.current) {
            connect();
          }
        }, reconnectDelay);
      }
    };

    // Listen for all event types
    const allEventTypes: EventType[] = [
      "task:created",
      "task:updated",
      "task:completed",
      "task:failed",
      "agent:registered",
      "agent:heartbeat",
      "agent:offline",
      "sandbox:started",
      "sandbox:stopped",
      "cost:recorded",
      "conflict:detected",
      "lock:acquired",
      "lock:released",
      "heartbeat",
    ];

    const typesToListen = eventTypes.length > 0 ? eventTypes : allEventTypes;

    for (const eventType of typesToListen) {
      eventSource.addEventListener(eventType, (e: MessageEvent) => {
        if (!mountedRef.current) return;

        try {
          const event: StreamEvent = JSON.parse(e.data);

          setState((prev) => {
            const newEvents = [event, ...prev.events].slice(0, maxEvents);
            return {
              ...prev,
              lastEvent: event,
              events: newEvents,
            };
          });

          onEvent?.(event);
        } catch (err) {
          console.error("Failed to parse SSE event:", err);
        }
      });
    }
  }, [
    url,
    maxEvents,
    eventTypes,
    onEvent,
    onConnectionChange,
    autoReconnect,
    reconnectDelay,
  ]);

  const clearEvents = useCallback(() => {
    setState((prev) => ({ ...prev, events: [], lastEvent: null }));
  }, []);

  const reconnect = useCallback(() => {
    connect();
  }, [connect]);

  useEffect(() => {
    mountedRef.current = true;
    connect();

    return () => {
      mountedRef.current = false;
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [connect]);

  return {
    ...state,
    clearEvents,
    reconnect,
  };
}

/**
 * Hook to subscribe to specific event types with callbacks
 */
export function useEventSubscription(
  eventType: EventType | EventType[],
  callback: (event: StreamEvent) => void,
) {
  const types = Array.isArray(eventType) ? eventType : [eventType];

  useEventStream({
    eventTypes: types,
    onEvent: callback,
  });
}
