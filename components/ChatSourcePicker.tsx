"use client";

import { useEffect, useState } from "react";

interface MessageOption {
  _id: string;
  role: "user" | "assistant";
  content: string;
}

interface Exchange {
  id: string; // the user message id, used as the stable key
  question: string;
  messageIds: string[]; // the user message + its paired assistant reply, if any
}

export default function ChatSourcePicker({
  conversationId,
  selected,
  onChange,
}: {
  conversationId: string;
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const [exchanges, setExchanges] = useState<Exchange[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setIsLoading(true);
      const res = await fetch(`/api/conversations/${conversationId}/messages`);
      if (res.ok) {
        const messages: MessageOption[] = await res.json();
        const built: Exchange[] = [];
        for (let i = 0; i < messages.length; i++) {
          const m = messages[i];
          if (m.role !== "user") continue;
          const next = messages[i + 1];
          const messageIds =
            next && next.role === "assistant" ? [m._id, next._id] : [m._id];
          built.push({ id: m._id, question: m.content, messageIds });
        }
        setExchanges(built);
      }
      setIsLoading(false);
    }
    load();
  }, [conversationId]);

  function toggle(exchange: Exchange) {
    const isSelected = exchange.messageIds.every((mid) => selected.includes(mid));
    if (isSelected) {
      onChange(selected.filter((mid) => !exchange.messageIds.includes(mid)));
    } else {
      onChange([...new Set([...selected, ...exchange.messageIds])]);
    }
  }

  if (isLoading) {
    return <p className="text-xs text-gray-500">Loading conversation...</p>;
  }

  if (exchanges.length === 0) {
    return (
      <p className="text-xs text-gray-500">
        No chat topics to build from yet. Ask a question in the Chat tab first.
      </p>
    );
  }

  return (
    <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
      {exchanges.map((exchange) => {
        const isSelected = exchange.messageIds.every((mid) => selected.includes(mid));
        return (
          <label
            key={exchange.id}
            className="flex items-start gap-2 text-sm text-gray-200 cursor-pointer"
          >
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => toggle(exchange)}
              className="accent-accent mt-0.5"
            />
            <span className="line-clamp-2">{exchange.question}</span>
          </label>
        );
      })}
    </div>
  );
}