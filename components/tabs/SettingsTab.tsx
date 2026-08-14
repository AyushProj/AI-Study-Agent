"use client";

import { useState, useEffect } from "react";
import { useTheme } from "@/lib/theme-context";

export default function SettingsTab() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [apiKey, setApiKey] = useState("");
  const [apiKeys, setApiKeys] = useState<{ id: string; key: string; name: string }[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [keyName, setKeyName] = useState("");

  // Load API keys on mount
  useEffect(() => {
    loadApiKeys();
  }, []);

  async function loadApiKeys() {
    setIsLoading(true);
    try {
      const res = await fetch("/api/settings/api-keys");
      if (res.ok) {
        const data = await res.json();
        setApiKeys(data);
      }
    } catch (err) {
      console.error("Error loading API keys:", err);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleAddApiKey(e: React.FormEvent) {
    e.preventDefault();
    if (!apiKey.trim() || !keyName.trim()) {
      setError("Please enter both a name and API key");
      return;
    }

    setError("");
    setSuccess("");
    setIsSaving(true);

    try {
      const res = await fetch("/api/settings/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: keyName, key: apiKey }),
      });

      if (res.ok) {
        const newKey = await res.json();
        setApiKeys([...apiKeys, newKey]);
        setApiKey("");
        setKeyName("");
        setSuccess("API key added successfully!");
        setTimeout(() => setSuccess(""), 3000);
      } else {
        setError("Failed to save API key");
      }
    } catch (err) {
      setError("Error saving API key");
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDeleteApiKey(id: string) {
    if (!confirm("Delete this API key? This can't be undone.")) return;

    try {
      const res = await fetch(`/api/settings/api-keys/${id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        setApiKeys(apiKeys.filter((k) => k.id !== id));
        setSuccess("API key deleted");
        setTimeout(() => setSuccess(""), 3000);
      } else {
        setError("Failed to delete API key");
      }
    } catch (err) {
      setError("Error deleting API key");
      console.error(err);
    }
  }

  return (
    <div className="h-full overflow-y-auto p-6 space-y-8">
      {/* Theme Settings */}
      <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
        <h2 className="text-xl font-semibold text-white mb-4">Appearance</h2>
        <div className="space-y-3">
          <p className="text-sm text-gray-400">Theme</p>
          <div className="flex gap-3">
            {(["light", "dark", "system"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTheme(t)}
                className={`px-4 py-2 rounded text-sm font-medium transition ${
                  theme === t
                    ? "bg-accent text-accent-foreground"
                    : "bg-gray-800 text-gray-300 hover:bg-gray-700"
                }`}
              >
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Current: <span className="text-gray-400">{resolvedTheme}</span>
          </p>
        </div>
      </div>

      {/* API Keys Section */}
      <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
        <h2 className="text-xl font-semibold text-white mb-4">API Keys</h2>
        <p className="text-sm text-gray-400 mb-6">
          Manage your API keys for integrations and services.
        </p>

        {error && (
          <div className="bg-red-900/20 border border-red-800 text-red-200 text-sm p-3 rounded mb-4">
            {error}
          </div>
        )}
        {success && (
          <div className="bg-green-900/20 border border-green-800 text-green-200 text-sm p-3 rounded mb-4">
            {success}
          </div>
        )}

        {/* Add API Key Form */}
        <form onSubmit={handleAddApiKey} className="mb-6 space-y-3 p-4 bg-gray-800 rounded">
          <div>
            <label className="block text-sm text-gray-300 mb-2">Key Name</label>
            <input
              type="text"
              value={keyName}
              onChange={(e) => setKeyName(e.target.value)}
              placeholder="e.g., OpenAI Production"
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm focus:outline-none focus:border-accent"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-300 mb-2">API Key</label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Paste your API key here"
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm focus:outline-none focus:border-accent"
            />
          </div>
          <button
            type="submit"
            disabled={isSaving}
            className="w-full bg-accent text-accent-foreground py-2 rounded text-sm font-medium hover:bg-yellow-500 disabled:opacity-50"
          >
            {isSaving ? "Saving..." : "Add API Key"}
          </button>
        </form>

        {/* API Keys List */}
        <div className="space-y-2">
          <p className="text-sm text-gray-400 mb-3">Your API Keys:</p>
          {isLoading ? (
            <p className="text-sm text-gray-500">Loading...</p>
          ) : apiKeys.length === 0 ? (
            <p className="text-sm text-gray-500">No API keys added yet</p>
          ) : (
            <div className="space-y-2">
              {apiKeys.map((k) => (
                <div
                  key={k.id}
                  className="flex items-center justify-between bg-gray-800 p-3 rounded text-sm"
                >
                  <div>
                    <p className="text-white font-medium">{k.name}</p>
                    <p className="text-gray-500 text-xs">
                      {k.key.substring(0, 8)}...{k.key.substring(k.key.length - 4)}
                    </p>
                  </div>
                  <button
                    onClick={() => handleDeleteApiKey(k.id)}
                    className="text-red-400 hover:text-red-300 text-xs font-medium"
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}