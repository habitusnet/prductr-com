"use client";

import { useEffect, useState, useCallback } from "react";

interface ZoneDefinition {
  pattern: string;
  owners: string[];
  shared: boolean;
  description?: string;
}

interface ZoneConfig {
  zones: ZoneDefinition[];
  defaultPolicy: "allow" | "deny";
}

export default function ZoneMap() {
  const [config, setConfig] = useState<ZoneConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchZones = useCallback(async () => {
    try {
      const res = await fetch("/api/zones");
      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else {
        setConfig(data.config || null);
        setError(null);
      }
    } catch {
      setError("Failed to fetch zone configuration");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchZones();
  }, [fetchZones]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-conductor-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
        <p className="text-red-700 dark:text-red-400">{error}</p>
      </div>
    );
  }

  if (!config || config.zones.length === 0) {
    return (
      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-6 text-center">
        <p className="text-gray-500 dark:text-gray-400">
          No zone configuration. All files are accessible to all agents.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          Zone Map
        </h2>
        <span
          className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
            config.defaultPolicy === "deny"
              ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400"
              : "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
          }`}
        >
          Default: {config.defaultPolicy}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {config.zones.map((zone, idx) => (
          <div
            key={idx}
            className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 border border-gray-200 dark:border-gray-700"
          >
            <div className="flex items-start justify-between">
              <code className="text-sm font-mono text-conductor-600 dark:text-conductor-400">
                {zone.pattern}
              </code>
              {zone.shared && (
                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400">
                  Shared
                </span>
              )}
            </div>

            {zone.description && (
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                {zone.description}
              </p>
            )}

            <div className="mt-3">
              <div className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-1">
                {zone.shared ? "Accessible by all" : "Owners"}
              </div>
              {zone.owners.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {zone.owners.map((owner) => (
                    <span
                      key={owner}
                      className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
                    >
                      {owner}
                    </span>
                  ))}
                </div>
              ) : (
                <span className="text-xs text-gray-400 dark:text-gray-500 italic">
                  No specific owners
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
