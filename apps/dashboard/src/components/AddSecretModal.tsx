"use client";

import { useState } from "react";

const SECRET_OPTIONS = [
  { name: "E2B_API_KEY", provider: "E2B", description: "E2B sandbox API key" },
  {
    name: "ANTHROPIC_API_KEY",
    provider: "Anthropic",
    description: "Claude API key",
  },
  { name: "OPENAI_API_KEY", provider: "OpenAI", description: "OpenAI API key" },
  {
    name: "GOOGLE_AI_API_KEY",
    provider: "Google",
    description: "Google AI API key",
  },
  {
    name: "ZAI_API_KEY",
    provider: "ZAI",
    description: "ZAI API key",
  },
  {
    name: "GITHUB_TOKEN",
    provider: "GitHub",
    description: "GitHub personal access token",
  },
  {
    name: "CONDUCTOR_DATABASE_URL",
    provider: "Database",
    description: "Database connection string",
  },
];

interface AddSecretModalProps {
  open: boolean;
  existingNames: string[];
  onClose: () => void;
  onSave: (name: string, value: string, provider: string) => Promise<void>;
}

export function AddSecretModal({
  open,
  existingNames,
  onClose,
  onSave,
}: AddSecretModalProps) {
  const [name, setName] = useState("");
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const availableSecrets = SECRET_OPTIONS.filter(
    (s) => !existingNames.includes(s.name),
  );
  const selectedOption = SECRET_OPTIONS.find((s) => s.name === name);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!name || !value) {
      setError("Please select a secret and enter a value");
      return;
    }

    setSaving(true);
    try {
      await onSave(name, value, selectedOption?.provider || "");
      setName("");
      setValue("");
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save secret");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />
      <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 w-full max-w-md mx-4">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Add API Key
          </h3>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 text-sm text-red-700 bg-red-50 dark:bg-red-900/20 dark:text-red-400 rounded-md">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Secret Name
            </label>
            {availableSecrets.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                All available secrets have been added.
              </p>
            ) : (
              <select
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-conductor-500 focus:border-transparent"
              >
                <option value="">Select a secret...</option>
                {availableSecrets.map((opt) => (
                  <option key={opt.name} value={opt.name}>
                    {opt.name} ({opt.provider})
                  </option>
                ))}
              </select>
            )}
            {selectedOption && (
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {selectedOption.description}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Value
            </label>
            <input
              type="password"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="Enter secret value..."
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-conductor-500 focus:border-transparent font-mono text-sm"
            />
          </div>

          <div className="flex justify-end space-x-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !name || !value}
              className="px-4 py-2 text-sm text-white bg-conductor-600 hover:bg-conductor-700 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? "Saving..." : "Save Secret"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
