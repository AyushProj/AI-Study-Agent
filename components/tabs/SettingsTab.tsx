"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Spinner from "../Spinner";
import EmptyState from "../EmptyState";
import ErrorBanner from "../ErrorBanner";

export default function SettingsTab() {
  const router = useRouter();
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

  function handleBack() {
    // router.back() returns to whatever page the user actually came from —
    // "the last working page we were on," as requested. Falls back to
    // /chat only if there's nowhere to go back to (e.g. Settings was
    // opened directly via a bookmark or a fresh tab, with no history).
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push("/chat");
    }
  }

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
        <button
          onClick={handleBack}
          className="flex items-center gap-1.5 text-sm text-[var(--foreground-muted)] transition hover:text-[var(--foreground)]"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>

        <div className="rounded-xl border border-[var(--border)] bg-[var(--card-bg)] p-6 shadow-lg shadow-[var(--shadow)]">
          <h2 className="text-xl font-semibold text-[var(--foreground)]">Settings</h2>
          <p className="mt-2 text-sm text-[var(--foreground-muted)]">
            Add another API key if you want to use an alternate provider.
          </p>
        </div>

        <div className="rounded-xl border border-[var(--border)] bg-[var(--card-bg)] p-6 shadow-lg shadow-[var(--shadow)]">
          <h3 className="mb-4 text-lg font-semibold text-[var(--foreground)]">API Keys</h3>

          {error && (
            <div className="mb-4">
              <ErrorBanner message={error} />
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
            <Spinner label="Loading your keys..." />
          ) : apiKeys.length === 0 ? (
            <EmptyState
              icon={
                <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M15 7a2 2 0 012 2m4 0a6 6 0 11-12 0 6 6 0 0112 0zM7 12l-4 4m0 0l2 2m-2-2l2-2"
                  />
                </svg>
              }
              title="No API keys added yet"
              description="Add one above if you'd rather use your own key instead of the default."
            />
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