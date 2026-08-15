"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";

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
        router.push(`/chat/${newConversation._id}?tab=chat`);
      }
    } finally {
      setIsCreating(false);
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
          conversations.map((conversation) => (
            <button
              key={conversation._id}
              onClick={() => router.push(`/chat/${conversation._id}?tab=chat`)}
              className={`mb-2 block w-full rounded-md border px-3 py-2 text-left text-sm ${
                activeId === conversation._id
                  ? "border-[var(--border)] bg-[var(--background-soft)] text-[var(--foreground)]"
                  : "border-transparent text-[var(--foreground-muted)] hover:bg-white/5 hover:text-[var(--foreground)]"
              }`}
            >
              {conversation.title}
            </button>
          ))
        )}
      </div>
    </aside>
  );
}