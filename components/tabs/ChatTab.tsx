"use client";

import { useEffect, useRef, useState } from "react";
import Spinner from "../Spinner";
import EmptyState from "../EmptyState";

interface Message {
  _id: string;
  role: "user" | "assistant";
  content: string;
}

// Maps a fenced code block's language tag to a sensible file extension.
// Falls back to .txt for anything unrecognized so downloads always work.
const EXTENSION_BY_LANGUAGE: Record<string, string> = {
  javascript: "js",
  js: "js",
  jsx: "jsx",
  typescript: "ts",
  ts: "ts",
  tsx: "tsx",
  python: "py",
  py: "py",
  java: "java",
  c: "c",
  cpp: "cpp",
  "c++": "cpp",
  csharp: "cs",
  cs: "cs",
  go: "go",
  golang: "go",
  rust: "rs",
  rs: "rs",
  ruby: "rb",
  rb: "rb",
  php: "php",
  swift: "swift",
  kotlin: "kt",
  html: "html",
  css: "css",
  scss: "scss",
  json: "json",
  sql: "sql",
  bash: "sh",
  sh: "sh",
  shell: "sh",
  zsh: "sh",
  yaml: "yaml",
  yml: "yaml",
  markdown: "md",
  md: "md",
  txt: "txt",
  text: "txt",
};

function extensionFor(language: string): string {
  const key = language.trim().toLowerCase();
  return EXTENSION_BY_LANGUAGE[key] || "txt";
}

type ContentSegment =
  | { type: "text"; content: string }
  | { type: "code"; language: string; code: string };

/** Splits message content into plain-text and fenced-code-block segments. */
function parseMessageContent(content: string): ContentSegment[] {
  const segments: ContentSegment[] = [];
  const fenceRegex = /```(\w+)?\n([\s\S]*?)```/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = fenceRegex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: "text", content: content.slice(lastIndex, match.index) });
    }
    segments.push({
      type: "code",
      language: match[1] || "text",
      code: match[2].replace(/\n$/, ""),
    });
    lastIndex = fenceRegex.lastIndex;
  }

  if (lastIndex < content.length) {
    segments.push({ type: "text", content: content.slice(lastIndex) });
  }

  return segments;
}

function downloadAsFile(code: string, language: string, index: number) {
  const extension = extensionFor(language);
  const blob = new Blob([code], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `snippet-${index}.${extension}`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function CodeBlock({
  language,
  code,
  index,
}: {
  language: string;
  code: string;
  index: number;
}) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard API can fail (permissions, non-secure context); no need to
      // block the user over it — the download button still works either way.
    }
  }

  return (
    <div className="my-2 overflow-hidden rounded-lg border border-[var(--border)] bg-black/40">
      <div className="flex items-center justify-between border-b border-[var(--border)] px-3 py-1.5">
        <span className="text-xs text-[var(--foreground-muted)]">{language || "text"}</span>
        <div className="flex gap-1">
          <button
            onClick={handleCopy}
            className="rounded px-2 py-1 text-xs text-[var(--foreground-muted)] hover:bg-white/5 hover:text-[var(--foreground)]"
          >
            {copied ? "Copied" : "Copy"}
          </button>
          <button
            onClick={() => downloadAsFile(code, language, index)}
            className="rounded px-2 py-1 text-xs text-[var(--foreground-muted)] hover:bg-white/5 hover:text-[var(--foreground)]"
          >
            Download
          </button>
        </div>
      </div>
      <pre className="overflow-x-auto p-3 text-xs leading-relaxed">
        <code>{code}</code>
      </pre>
    </div>
  );
}

function MessageContent({ content }: { content: string }) {
  const segments = parseMessageContent(content);

  return (
    <>
      {segments.map((segment, i) =>
        segment.type === "code" ? (
          <CodeBlock key={i} language={segment.language} code={segment.code} index={i} />
        ) : (
          segment.content && (
            <span key={i} className="whitespace-pre-wrap">
              {segment.content}
            </span>
          )
        )
      )}
    </>
  );
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
    <div className="h-full flex flex-col bg-[var(--background)]">
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {isLoading && <Spinner label="Loading chat..." />}
        {!isLoading && messages.length === 0 && (
          <EmptyState
            icon={
              <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.86 9.86 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                />
              </svg>
            }
            title="Start the conversation"
            description="Ask a question about your uploaded documents, or anything else."
          />
        )}
        {messages.map((m) => (
          <div
            key={m._id}
            className={`max-w-xl rounded-lg px-4 py-2 text-sm ${
              m.role === "user"
                ? "bg-[var(--accent)] text-[var(--accent-foreground)] ml-auto whitespace-pre-wrap"
                : "bg-[var(--card-bg)] text-[var(--foreground)] border border-[var(--border)]"
            }`}
          >
            {m.role === "assistant" ? (
              m.content ? <MessageContent content={m.content} /> : "…"
            ) : (
              m.content
            )}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <form onSubmit={handleSend} className="border-t border-[var(--border)] p-4 flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask a question..."
          disabled={isSending}
          className="flex-1 rounded-md border border-[var(--border)] bg-[var(--input-bg)] px-3 py-2 text-[var(--foreground)] placeholder:text-[var(--foreground-muted)] outline-none focus:border-[var(--accent)]"
        />
        <button
          type="submit"
          disabled={isSending || !input.trim()}
          className="rounded-md bg-[var(--accent)] text-[var(--accent-foreground)] text-sm font-medium px-4 py-2 hover:brightness-95 disabled:opacity-50"
        >
          {isSending ? "Sending..." : "Send"}
        </button>
      </form>
    </div>
  );
}