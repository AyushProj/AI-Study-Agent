"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

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
    setIsLoading(true);
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

  async function handleNewChat() {
    setIsCreating(true);
    const res = await fetch("/api/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "New Chat" }),
    });
    if (res.ok) {
      const conversation = await res.json();
      await loadConversations();
      router.push(`/chat/${conversation._id}`);
    }
    setIsCreating(false);
  }

  function startEditing(c: ConversationSummary) {
    setEditingId(c._id);
    setEditValue(c.title);
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

  return (
    <aside className="w-64 border-r border-gray-800 h-full flex flex-col">
      <div className="p-3 border-b border-gray-800">
        <button
          onClick={handleNewChat}
          disabled={isCreating}
          className="w-full rounded bg-white text-black text-sm font-medium py-2 hover:bg-gray-200 disabled:opacity-50"
        >
          {isCreating ? "Creating..." : "+ New Chat"}
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {isLoading && (
          <p className="text-xs text-gray-500 px-2 py-2">Loading...</p>
        )}
        {!isLoading && conversations.length === 0 && (
          <p className="text-xs text-gray-500 px-2 py-2">
            No chats yet. Start one above.
          </p>
        )}
        {conversations.map((c) => (
          <div
            key={c._id}
            className={`group rounded px-3 py-2 text-sm flex items-center justify-between ${
              activeId === c._id
                ? "bg-gray-800 text-white"
                : "text-gray-300 hover:bg-gray-900"
            }`}
          >
            {editingId === c._id ? (
              <input
                autoFocus
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onBlur={() => saveTitle(c._id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveTitle(c._id);
                  if (e.key === "Escape") setEditingId(null);
                }}
                className="bg-transparent border-b border-gray-500 outline-none w-full text-white"
              />
            ) : (
              <>
                <Link
                  href={`/chat/${c._id}`}
                  className="truncate flex-1"
                >
                  {c.title}
                </Link>
                <button
                  onClick={() => startEditing(c)}
                  className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-white text-xs ml-2"
                  title="Rename"
                >
                  ✎
                </button>
              </>
            )}
          </div>
        ))}
      </div>
    </aside>
  );
}