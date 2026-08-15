"use client";

import { useEffect, useState } from "react";

export default function SettingsTab() {
  const [apiKey, setApiKey] = useState("");
  const [keyName, setKeyName] = useState("");
  const [apiKeys, setApiKeys] = useState<{ id: string; key: string; name: string }[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    loadApiKeys();
  }, []);

  async function loadApiKeys() {
    setIsLoading(true);
    try {
      const res = await fetch("/api/settings/api-keys");
      if (!res.ok) {
        throw new Error("Failed to load API keys");
      }
      const data = await res.json();
      setApiKeys(data);
    } catch (err) {
      console.error(err);
      setError("Could not load API keys.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleAddApiKey(e: React.FormEvent) {
    e.preventDefault();

    if (!keyName.trim() || !apiKey.trim()) {
      setError("Please enter both a name and API key.");
      return;
    }

    setError("");
    setSuccess("");
    setIsSaving(true);

    try {
      const res = await fetch("/api/settings/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: keyName.trim(),
          key: apiKey.trim(),
        }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(data?.error || "Failed to save API key.");
      }

      setApiKeys((prev) => [...prev, data]);
      setKeyName("");
      setApiKey("");
      setSuccess("API key added successfully.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error saving API key.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDeleteApiKey(id: string) {
    try {
      const res = await fetch(`/api/settings/api-keys/${id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        throw new Error("Failed to delete API key.");
      }

      setApiKeys((prev) => prev.filter((item) => item.id !== id));
      setSuccess("API key deleted.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error deleting API key.");
    }
  }

  return (
    <div className="h-full overflow-y-auto bg-[var(--background)] p-6 text-[var(--foreground)]">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card-bg)] p-6 shadow-lg shadow-[var(--shadow)]">
          <h2 className="text-xl font-semibold text-[var(--foreground)]">Settings</h2>
          <p className="mt-2 text-sm text-[var(--foreground-muted)]">
            Add another API key if you want to use an alternate provider.
          </p>
        </div>

        <div className="rounded-xl border border-[var(--border)] bg-[var(--card-bg)] p-6 shadow-lg shadow-[var(--shadow)]">
          <h3 className="mb-4 text-lg font-semibold text-[var(--foreground)]">API Keys</h3>

          {error && (
            <div className="mb-4 rounded border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
              {error}
            </div>
          )}

          {success && (
            <div className="mb-4 rounded border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
              {success}
            </div>
          )}

          <form onSubmit={handleAddApiKey} className="space-y-3">
            <div>
              <label className="mb-1 block text-sm text-[var(--foreground-muted)]">Key Name</label>
              <input
                type="text"
                value={keyName}
                onChange={(e) => setKeyName(e.target.value)}
                placeholder="e.g. OpenAI backup"
                className="w-full rounded-md border border-[var(--border)] bg-[var(--input-bg)] px-3 py-2 text-[var(--foreground)] outline-none placeholder:text-[var(--foreground-muted)]"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm text-[var(--foreground-muted)]">API Key</label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Paste API key"
                className="w-full rounded-md border border-[var(--border)] bg-[var(--input-bg)] px-3 py-2 text-[var(--foreground)] outline-none placeholder:text-[var(--foreground-muted)]"
              />
            </div>

            <button
              type="submit"
              disabled={isSaving}
              className="w-full rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-[var(--accent-foreground)] disabled:opacity-60"
            >
              {isSaving ? "Saving..." : "Add API Key"}
            </button>
          </form>
        </div>

        <div className="rounded-xl border border-[var(--border)] bg-[var(--card-bg)] p-6 shadow-lg shadow-[var(--shadow)]">
          <h3 className="mb-4 text-lg font-semibold text-[var(--foreground)]">Your Saved Keys</h3>

          {isLoading ? (
            <p className="text-sm text-[var(--foreground-muted)]">Loading...</p>
          ) : apiKeys.length === 0 ? (
            <p className="text-sm text-[var(--foreground-muted)]">No API keys added yet.</p>
          ) : (
            <div className="space-y-2">
              {apiKeys.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-[var(--border)] bg-[var(--background-soft)] px-3 py-2"
                >
                  <div>
                    <p className="font-medium text-[var(--foreground)]">{item.name}</p>
                    <p className="text-xs text-[var(--foreground-muted)]">
                      {item.key.slice(0, 6)}••••••{item.key.slice(-4)}
                    </p>
                  </div>

                  <button
                    onClick={() => handleDeleteApiKey(item.id)}
                    className="rounded border border-red-500/40 bg-red-500/10 px-2 py-1 text-xs text-red-200"
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