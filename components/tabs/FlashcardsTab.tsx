"use client";

import { useState, useCallback, useEffect } from "react";
import DocumentPicker from "@/components/DocumentPicker";
import ChatSourcePicker from "@/components/ChatSourcePicker";
import OverflowMenu from "@/components/OverflowMenu";
import Spinner from "@/components/Spinner";
import EmptyState from "@/components/EmptyState";
import ErrorBanner from "@/components/ErrorBanner";

interface FlashcardSetSummary {
  _id: string;
  title: string;
  cardCount: number;
  createdAt: string;
}

interface CardData {
  _id: string;
  question: string;
  answer: string;
}

export default function FlashcardsTab({ conversationId }: { conversationId: string }) {
  const [sets, setSets] = useState<FlashcardSetSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showGenerate, setShowGenerate] = useState(false);
  const [source, setSource] = useState<"documents" | "chat">("documents");
  const [selectedDocs, setSelectedDocs] = useState<string[]>([]);
  const [selectedMessages, setSelectedMessages] = useState<string[]>([]);
  const [count, setCount] = useState<5 | 10 | 20>(10);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState("");

  const [activeSetId, setActiveSetId] = useState<string | null>(null);
  const [cards, setCards] = useState<CardData[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);

  // Rename state for the sets list — same pattern as Documents/Chats.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  const loadSets = useCallback(async () => {
    setIsLoading(true);
    const res = await fetch(`/api/conversations/${conversationId}/flashcards`);
    if (res.ok) {
      setSets(await res.json());
    }
    setIsLoading(false);
  }, [conversationId]);

  useEffect(() => {
    loadSets();
  }, [loadSets]);

  async function handleGenerate() {
    setError("");
    const selection = source === "documents" ? selectedDocs : selectedMessages;

    if (selection.length === 0) {
      setError("Please select at least one source");
      return;
    }

    setIsGenerating(true);

    try {
      const res = await fetch(`/api/conversations/${conversationId}/flashcards`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source,
          documentIds: source === "documents" ? selection : [],
          messageIds: source === "chat" ? selection : [],
          count,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Generation failed");
      }

      await loadSets();
      setShowGenerate(false);
      setSelectedDocs([]);
      setSelectedMessages([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate flashcards");
    } finally {
      setIsGenerating(false);
    }
  }

  async function openSet(setId: string) {
    // Correct route: conversation-scoped, matching the actual backend
    // (GET /api/conversations/[id]/flashcards/[setId] -> { set, cards }).
    // The old /api/flashcards/[setId]/cards URL doesn't exist, which is
    // what caused the 404.
    const res = await fetch(`/api/conversations/${conversationId}/flashcards/${setId}`);
    if (res.ok) {
      const data = await res.json();
      setCards(data.cards);
      setCurrentIndex(0);
      setShowAnswer(false);
      setActiveSetId(setId);
    }
  }

  function startEditing(set: FlashcardSetSummary) {
    setEditingId(set._id);
    setEditValue(set.title);
  }

  async function saveTitle(setId: string) {
    const trimmed = editValue.trim();
    setEditingId(null);
    if (!trimmed) return;

    const previous = sets;
    setSets((prev) => prev.map((s) => (s._id === setId ? { ...s, title: trimmed } : s)));

    const res = await fetch(`/api/conversations/${conversationId}/flashcards/${setId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: trimmed }),
    });

    if (!res.ok) {
      setSets(previous);
    }
  }

  async function handleDelete(setId: string) {
    const confirmed = window.confirm("Delete this flashcard set?");
    if (!confirmed) return;

    const prev = sets;
    setSets((current) => current.filter((s) => s._id !== setId));

    // Same fix as openSet — correct conversation-scoped route.
    const res = await fetch(`/api/conversations/${conversationId}/flashcards/${setId}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      setSets(prev);
    }
  }

  if (activeSetId) {
    const card = cards[currentIndex];

    return (
      <div className="flex h-full flex-col overflow-hidden bg-[var(--background)] text-[var(--foreground)]">
        <div className="flex items-center justify-between border-b border-[var(--border)] bg-[var(--card-bg)] p-6">
          <button
            onClick={() => setActiveSetId(null)}
            className="text-sm text-[var(--foreground)] hover:opacity-80"
          >
            ← Back to Flashcards
          </button>

          <p className="text-sm text-[var(--foreground-muted)]">
            {currentIndex + 1} / {cards.length}
          </p>
        </div>

        <div className="flex flex-1 items-center justify-center p-6">
          {card ? (
            <div className="w-full max-w-2xl rounded-lg border border-[var(--border)] bg-[var(--card-bg)] p-6">
              <p className="mb-4 text-xs uppercase tracking-[0.18em] text-[var(--foreground-muted)]">
                Question
              </p>

              <h3 className="text-xl font-semibold text-[var(--foreground)]">
                {card.question}
              </h3>

              {showAnswer && (
                <div className="mt-8 border-t border-[var(--border)] pt-6">
                  <p className="mb-4 text-xs uppercase tracking-[0.18em] text-[var(--foreground-muted)]">
                    Answer
                  </p>
                  <p className="text-lg text-[var(--foreground)]">{card.answer}</p>
                </div>
              )}

              <div className="mt-8 flex gap-3">
                {!showAnswer && (
                  <button
                    onClick={() => setShowAnswer(true)}
                    className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-[var(--accent-foreground)]"
                  >
                    Show Answer
                  </button>
                )}

                <button
                  onClick={() => {
                    setShowAnswer(false);
                    setCurrentIndex((prev) => (prev + 1) % cards.length);
                  }}
                  className="rounded-md border border-[var(--border)] bg-[var(--background-soft)] px-4 py-2 text-sm text-[var(--foreground)]"
                >
                  Next Card
                </button>
              </div>
            </div>
          ) : (
            <p className="text-[var(--foreground-muted)]">No cards available.</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[var(--background)] text-[var(--foreground)]">
      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-2xl">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-2xl font-bold text-[var(--foreground)]">Flashcards</h2>

            <button
              onClick={() => setShowGenerate(!showGenerate)}
              className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-[var(--accent-foreground)]"
            >
              {showGenerate ? "Cancel" : "+ Generate Cards"}
            </button>
          </div>

          {error && (
            <div className="mb-4">
              <ErrorBanner message={error} />
            </div>
          )}

          {showGenerate && (
            <div className="mb-6 space-y-4 rounded-lg border border-[var(--border)] bg-[var(--card-bg)] p-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-[var(--foreground)]">
                  Source
                </label>

                <div className="flex gap-2">
                  {(["documents", "chat"] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => {
                        setSource(s);
                        setSelectedDocs([]);
                        setSelectedMessages([]);
                      }}
                      className={`rounded px-3 py-2 text-sm ${
                        source === s
                          ? "bg-[var(--accent)] text-[var(--accent-foreground)]"
                          : "bg-[var(--background-soft)] text-[var(--foreground)]"
                      }`}
                    >
                      {s === "documents" ? "Documents" : "Chat"}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-[var(--foreground)]">
                  {source === "documents" ? "Select Documents" : "Select Chat Topics"}
                </label>

                {source === "documents" ? (
                  <DocumentPicker
                    conversationId={conversationId}
                    selected={selectedDocs}
                    onChange={setSelectedDocs}
                  />
                ) : (
                  <ChatSourcePicker
                    conversationId={conversationId}
                    selected={selectedMessages}
                    onChange={setSelectedMessages}
                  />
                )}
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-[var(--foreground)]">
                  Number of Cards
                </label>

                <div className="flex gap-2">
                  {[5, 10, 20].map((n) => (
                    <button
                      key={n}
                      onClick={() => setCount(n as 5 | 10 | 20)}
                      className={`rounded px-3 py-2 text-sm ${
                        count === n
                          ? "bg-[var(--accent)] text-[var(--accent-foreground)]"
                          : "bg-[var(--background-soft)] text-[var(--foreground)]"
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={handleGenerate}
                disabled={isGenerating}
                className="w-full rounded-md bg-[var(--accent)] px-4 py-2 font-medium text-[var(--accent-foreground)] disabled:opacity-60"
              >
                {isGenerating ? "Generating..." : "Generate Flashcards"}
              </button>
            </div>
          )}

          {isLoading ? (
            <Spinner label="Loading flashcards..." />
          ) : sets.length === 0 ? (
            <EmptyState
              icon={
                <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M9 17V7a2 2 0 012-2h2.343M9 17H7a2 2 0 01-2-2V9a2 2 0 012-2h2m0 10h6a2 2 0 002-2V9a2 2 0 00-2-2h-2.343M9 7l6 6m0-6l-6 6"
                  />
                </svg>
              }
              title="No flashcard sets yet"
              description="Generate a set above from your documents or chat history."
            />
          ) : (
            <div className="space-y-2">
              {sets.map((set) => (
                <div
                  key={set._id}
                  className="group flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--card-bg)] p-3"
                >
                  {editingId === set._id ? (
                    <input
                      autoFocus
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onBlur={() => saveTitle(set._id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") saveTitle(set._id);
                        if (e.key === "Escape") setEditingId(null);
                      }}
                      className="flex-1 bg-transparent border-b border-[var(--border)] outline-none py-1 text-sm text-[var(--foreground)]"
                    />
                  ) : (
                    <>
                      <button onClick={() => openSet(set._id)} className="flex-1 text-left">
                        <p className="font-medium text-[var(--foreground)]">{set.title}</p>
                        <p className="text-xs text-[var(--foreground-muted)]">
                          {set.cardCount} cards • {new Date(set.createdAt).toLocaleDateString()}
                        </p>
                      </button>
                      <div className="opacity-0 group-hover:opacity-100">
                        <OverflowMenu
                          items={[
                            { label: "Rename", onClick: () => startEditing(set) },
                            { label: "Delete", onClick: () => handleDelete(set._id), danger: true },
                          ]}
                        />
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}