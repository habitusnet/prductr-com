"use client";

import { useEffect, useState, useCallback } from "react";

interface OnboardingConfig {
  welcomeMessage: string;
  currentFocus: string;
  goals: string[];
  styleGuide: string;
  checkpointRules: string[];
  checkpointEveryNTasks: number;
  autoRefreshContext: boolean;
  agentInstructionsFiles: Record<string, string>;
}

interface OnboardingConfigPanelProps {
  onRefresh?: () => void;
}

const AGENT_TYPES = ["claude", "gemini", "codex", "gpt4", "llama"] as const;

export function OnboardingConfigPanel({
  onRefresh,
}: OnboardingConfigPanelProps) {
  const [config, setConfig] = useState<OnboardingConfig>({
    welcomeMessage: "",
    currentFocus: "",
    goals: [],
    styleGuide: "",
    checkpointRules: [],
    checkpointEveryNTasks: 3,
    autoRefreshContext: true,
    agentInstructionsFiles: {},
  });
  const [projectName, setProjectName] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  // Temporary input states for list items
  const [newGoal, setNewGoal] = useState("");
  const [newRule, setNewRule] = useState("");

  const fetchConfig = useCallback(async () => {
    try {
      const res = await fetch("/api/onboarding");
      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else {
        setConfig(data.config);
        setProjectName(data.projectName);
        setError(null);
      }
    } catch {
      setError("Failed to fetch onboarding config");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "save", ...config }),
      });
      const data = await res.json();
      if (data.success) {
        setSuccess("Configuration saved successfully");
        onRefresh?.();
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(data.error || "Failed to save");
      }
    } catch {
      setError("Failed to save configuration");
    } finally {
      setSaving(false);
    }
  };

  const addGoal = () => {
    if (newGoal.trim()) {
      setConfig({ ...config, goals: [...config.goals, newGoal.trim()] });
      setNewGoal("");
    }
  };

  const removeGoal = (index: number) => {
    setConfig({ ...config, goals: config.goals.filter((_, i) => i !== index) });
  };

  const addRule = () => {
    if (newRule.trim()) {
      setConfig({
        ...config,
        checkpointRules: [...config.checkpointRules, newRule.trim()],
      });
      setNewRule("");
    }
  };

  const removeRule = (index: number) => {
    setConfig({
      ...config,
      checkpointRules: config.checkpointRules.filter((_, i) => i !== index),
    });
  };

  const updateAgentInstructions = (agentType: string, value: string) => {
    setConfig({
      ...config,
      agentInstructionsFiles: {
        ...config.agentInstructionsFiles,
        [agentType]: value,
      },
    });
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
      <div
        className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Onboarding Configuration
          </h2>
          <span className="px-2 py-1 text-xs font-medium bg-conductor-100 text-conductor-700 dark:bg-conductor-900/30 dark:text-conductor-400 rounded">
            {projectName}
          </span>
        </div>
        <button className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
          <svg
            className={`w-5 h-5 transform transition-transform ${isExpanded ? "rotate-180" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </button>
      </div>

      {isExpanded && (
        <div className="p-6 space-y-6">
          {/* Error/Success Messages */}
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
            </div>
          )}
          {success && (
            <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
              <p className="text-sm text-green-700 dark:text-green-400">
                {success}
              </p>
            </div>
          )}

          {/* Welcome Message */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Welcome Message
            </label>
            <textarea
              value={config.welcomeMessage}
              onChange={(e) =>
                setConfig({ ...config, welcomeMessage: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-conductor-500 focus:border-conductor-500"
              rows={2}
              placeholder="Welcome message shown to new agents..."
            />
          </div>

          {/* Current Focus */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Current Focus
            </label>
            <input
              type="text"
              value={config.currentFocus}
              onChange={(e) =>
                setConfig({ ...config, currentFocus: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-conductor-500 focus:border-conductor-500"
              placeholder="What the team is currently working on..."
            />
          </div>

          {/* Project Goals */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Project Goals
            </label>
            <div className="space-y-2">
              {config.goals.map((goal, index) => (
                <div key={index} className="flex items-center gap-2">
                  <span className="flex-1 px-3 py-2 bg-gray-50 dark:bg-gray-700 rounded-md text-gray-900 dark:text-white text-sm">
                    {index + 1}. {goal}
                  </span>
                  <button
                    onClick={() => removeGoal(index)}
                    className="p-1 text-red-500 hover:text-red-700"
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
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>
              ))}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newGoal}
                  onChange={(e) => setNewGoal(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addGoal()}
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-conductor-500 focus:border-conductor-500"
                  placeholder="Add a project goal..."
                />
                <button
                  onClick={addGoal}
                  className="px-3 py-2 bg-conductor-600 text-white rounded-md hover:bg-conductor-700"
                >
                  Add
                </button>
              </div>
            </div>
          </div>

          {/* Style Guide */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Style Guide
            </label>
            <textarea
              value={config.styleGuide}
              onChange={(e) =>
                setConfig({ ...config, styleGuide: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-conductor-500 focus:border-conductor-500 font-mono text-sm"
              rows={4}
              placeholder="Code style expectations and guidelines..."
            />
          </div>

          {/* Checkpoint Rules */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Checkpoint Rules
            </label>
            <div className="space-y-2">
              {config.checkpointRules.map((rule, index) => (
                <div key={index} className="flex items-center gap-2">
                  <span className="flex-1 px-3 py-2 bg-amber-50 dark:bg-amber-900/20 rounded-md text-amber-800 dark:text-amber-300 text-sm">
                    {rule}
                  </span>
                  <button
                    onClick={() => removeRule(index)}
                    className="p-1 text-red-500 hover:text-red-700"
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
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>
              ))}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newRule}
                  onChange={(e) => setNewRule(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addRule()}
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-conductor-500 focus:border-conductor-500"
                  placeholder="Add a checkpoint rule (e.g., 'Run tests before commit')..."
                />
                <button
                  onClick={addRule}
                  className="px-3 py-2 bg-conductor-600 text-white rounded-md hover:bg-conductor-700"
                >
                  Add
                </button>
              </div>
            </div>
          </div>

          {/* Checkpoint Settings */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Refresh Context Every N Tasks
              </label>
              <input
                type="number"
                min={1}
                max={20}
                value={config.checkpointEveryNTasks}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    checkpointEveryNTasks: parseInt(e.target.value) || 3,
                  })
                }
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-conductor-500 focus:border-conductor-500"
              />
            </div>
            <div className="flex items-center">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.autoRefreshContext}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      autoRefreshContext: e.target.checked,
                    })
                  }
                  className="w-4 h-4 text-conductor-600 rounded focus:ring-conductor-500"
                />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Auto-refresh context on task claims
                </span>
              </label>
            </div>
          </div>

          {/* Agent-Specific Instructions */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Agent-Specific Instructions
            </label>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
              Custom instructions for each agent type. Can be file paths (e.g.,
              CLAUDE.md) or inline text.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {AGENT_TYPES.map((agentType) => (
                <div key={agentType}>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 capitalize">
                    {agentType}
                  </label>
                  <input
                    type="text"
                    value={config.agentInstructionsFiles[agentType] || ""}
                    onChange={(e) =>
                      updateAgentInstructions(agentType, e.target.value)
                    }
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 text-sm focus:ring-2 focus:ring-conductor-500 focus:border-conductor-500"
                    placeholder={`Instructions for ${agentType}...`}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Save Button */}
          <div className="flex justify-end pt-4 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 bg-conductor-600 text-white rounded-md hover:bg-conductor-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? "Saving..." : "Save Configuration"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
