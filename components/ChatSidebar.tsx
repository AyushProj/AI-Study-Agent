"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import OverflowMenu from "./OverflowMenu";

interface ConversationSummary {
  _id: string;
  title: string;
}

export default function ChatSidebar() {
  const router = useRouter();
  const params = useParams();
  const activeId = params?.conversationId as string | undefined;

  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  async function loadConversations() {
    const res = await fetch("/api/conversations");
    if (res.ok) {
      const data = await res.json();
      setConversations(data);
    }
    setIsLoading(false);
  }

  useEffect(() => {
    loadConversations();
  }, []);

  async function handleCreateConversation() {
    setIsCreating(true);

    try {
      const res = await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "New Chat" }),
      });

      if (res.ok) {
        const newConversation = await res.json();
        // The sidebar lives in a shared layout that doesn't remount on
        // navigation, so without this the new chat only shows up after a
        // manual refresh — this was the actual bug behind issue #4.
        await loadConversations();
        router.push(`/chat/${newConversation._id}?tab=chat`);
      }
    } finally {
      setIsCreating(false);
    }
  }

  function startEditing(conversation: ConversationSummary) {
    setEditingId(conversation._id);
    setEditValue(conversation.title);
  }

  async function saveTitle(id: string) {
    const trimmed = editValue.trim();
    setEditingId(null);
    if (!trimmed) return;

    const previous = conversations;
    setConversations((prev) =>
      prev.map((c) => (c._id === id ? { ...c, title: trimmed } : c))
    );

    const res = await fetch(`/api/conversations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: trimmed }),
    });

    if (!res.ok) {
      setConversations(previous);
    }
  }

  async function handleDelete(id: string) {
    const confirmed = window.confirm("Delete this chat? This can't be undone.");
    if (!confirmed) return;

    const previous = conversations;
    setConversations((prev) => prev.filter((c) => c._id !== id));

    const res = await fetch(`/api/conversations/${id}`, { method: "DELETE" });

    if (!res.ok) {
      setConversations(previous);
      return;
    }

    if (activeId === id) {
      router.push("/chat");
    }
  }

  return (
    <aside className="flex h-full w-72 flex-col border-r border-[var(--border)] bg-[var(--sidebar-bg)]">
      <div className="border-b border-[var(--border)] p-4">
        <button
          onClick={handleCreateConversation}
          disabled={isCreating}
          className="w-full rounded-md bg-[var(--accent)] px-3 py-2 text-sm font-medium text-[var(--accent-foreground)] disabled:opacity-60"
        >
          {isCreating ? "Creating..." : "+ New chat"}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {isLoading ? (
          <p className="p-2 text-sm text-[var(--foreground-muted)]">Loading...</p>
        ) : conversations.length === 0 ? (
          <p className="p-2 text-sm text-[var(--foreground-muted)]">No chats yet.</p>
        ) : (
          conversations.map((conversation) => {
            const isActive = activeId === conversation._id;
            return (
              <div
                key={conversation._id}
                className={`group mb-2 flex items-center gap-1 rounded-md border px-2 ${
                  isActive
                    ? "border-[var(--border)] bg-[var(--background-soft)]"
                    : "border-transparent hover:bg-white/5"
                }`}
              >
                {editingId === conversation._id ? (
                  <input
                    autoFocus
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onBlur={() => saveTitle(conversation._id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") saveTitle(conversation._id);
                      if (e.key === "Escape") setEditingId(null);
                    }}
                    className="flex-1 bg-transparent border-b border-[var(--border)] outline-none py-2 text-sm text-[var(--foreground)]"
                  />
                ) : (
                  <>
                    <button
                      onClick={() => router.push(`/chat/${conversation._id}?tab=chat`)}
                      className={`flex-1 truncate rounded-md py-2 text-left text-sm ${
                        isActive
                          ? "text-[var(--foreground)]"
                          : "text-[var(--foreground-muted)] group-hover:text-[var(--foreground)]"
                      }`}
                    >
                      {conversation.title}
                    </button>
                    <div className="opacity-0 group-hover:opacity-100">
                      <OverflowMenu
                        items={[
                          { label: "Rename", onClick: () => startEditing(conversation) },
                          { label: "Delete", onClick: () => handleDelete(conversation._id), danger: true },
                        ]}
                      />
                    </div>
                  </>
                )}
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
}