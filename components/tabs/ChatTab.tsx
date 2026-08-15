"use client";

import { useEffect, useRef, useState } from "react";

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
    <div className="my-2 overflow-hidden rounded-lg border border-gray-800 bg-black/40">
      <div className="flex items-center justify-between border-b border-gray-800 px-3 py-1.5">
        <span className="text-xs text-gray-500">{language || "text"}</span>
        <div className="flex gap-1">
          <button
            onClick={handleCopy}
            className="rounded px-2 py-1 text-xs text-gray-400 hover:bg-white/5 hover:text-white"
          >
            {copied ? "Copied" : "Copy"}
          </button>
          <button
            onClick={() => downloadAsFile(code, language, index)}
            className="rounded px-2 py-1 text-xs text-gray-400 hover:bg-white/5 hover:text-white"
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
            className={`max-w-xl rounded px-4 py-2 text-sm ${
              m.role === "user"
                ? "bg-white text-black ml-auto whitespace-pre-wrap"
                : "bg-gray-900 text-gray-100 border border-gray-800"
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