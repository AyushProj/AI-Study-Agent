"use client";

import { useEffect, useRef, useState } from "react";

interface Message {
  _id: string;
  role: "user" | "assistant";
  content: string;
}

export default function ChatTab({ conversationId }: { conversationId: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function loadMessages() {
      setIsLoading(true);
      const res = await fetch(`/api/conversations/${conversationId}/messages`);
      if (res.ok) {
        setMessages(await res.json());
      }
      setIsLoading(false);
    }
    loadMessages();
  }, [conversationId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const content = input.trim();
    if (!content || isSending) return;

    setInput("");
    setIsSending(true);

    const userMessage: Message = { _id: `temp-user-${Date.now()}`, role: "user", content };
    const assistantId = `temp-assistant-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      userMessage,
      { _id: assistantId, role: "assistant", content: "" },
    ]);

    try {
      const res = await fetch(`/api/conversations/${conversationId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });

      if (!res.ok || !res.body) {
        throw new Error("Request failed");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
        setMessages((prev) =>
          prev.map((m) => (m._id === assistantId ? { ...m, content: accumulated } : m))
        );
      }
    } catch (err) {
      console.error("Chat error:", err);
      setMessages((prev) =>
        prev.map((m) =>
          m._id === assistantId
            ? { ...m, content: "Sorry, something went wrong. Please try again." }
            : m
        )
      );
    } finally {
      setIsSending(false);
    }
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {isLoading && <p className="text-gray-500 text-sm">Loading chat...</p>}
        {!isLoading && messages.length === 0 && (
          <p className="text-gray-500 text-sm">
            Ask a question about your uploaded documents, or anything else.
          </p>
        )}
        {messages.map((m) => (
          <div
            key={m._id}
            className={`max-w-xl rounded px-4 py-2 text-sm whitespace-pre-wrap ${
              m.role === "user"
                ? "bg-white text-black ml-auto"
                : "bg-gray-900 text-gray-100 border border-gray-800"
            }`}
          >
            {m.content || (m.role === "assistant" ? "…" : "")}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <form onSubmit={handleSend} className="border-t border-gray-800 p-4 flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask a question..."
          disabled={isSending}
          className="flex-1 rounded border border-gray-600 bg-gray-900 px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-gray-400"
        />
        <button
          type="submit"
          disabled={isSending || !input.trim()}
          className="rounded bg-white text-black text-sm font-medium px-4 py-2 hover:bg-gray-200 disabled:opacity-50"
        >
          {isSending ? "Sending..." : "Send"}
        </button>
      </form>
    </div>
  );
}