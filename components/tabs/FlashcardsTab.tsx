"use client";

import { useCallback, useEffect, useState } from "react";
import DocumentPicker from "../DocumentPicker";

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
  const [selectedDocs, setSelectedDocs] = useState<string[]>([]);
  const [count, setCount] = useState(10);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState("");

  const [activeSetId, setActiveSetId] = useState<string | null>(null);
  const [cards, setCards] = useState<CardData[]>([]);
  const [cardIndex, setCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);

  const loadSets = useCallback(async () => {
    setIsLoading(true);
    const res = await fetch(`/api/conversations/${conversationId}/flashcards`);
    if (res.ok) setSets(await res.json());
    setIsLoading(false);
  }, [conversationId]);

  useEffect(() => {
    loadSets();
  }, [loadSets]);

  async function handleGenerate() {
    setError("");
    if (selectedDocs.length === 0) {
      setError("Select at least one document");
      return;
    }
    setIsGenerating(true);
    const res = await fetch(`/api/conversations/${conversationId}/flashcards`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ documentIds: selectedDocs, count }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Generation failed");
    } else {
      setShowGenerate(false);
      setSelectedDocs([]);
      await loadSets();
    }
    setIsGenerating(false);
  }

  async function openSet(setId: string) {
    setActiveSetId(setId);
    setCardIndex(0);
    setIsFlipped(false);
    const res = await fetch(`/api/conversations/${conversationId}/flashcards/${setId}`);
    if (res.ok) {
      const data = await res.json();
      setCards(data.cards);
    }
  }

  if (activeSetId) {
    const card = cards[cardIndex];
    return (
      <div className="p-6 text-white max-w-2xl">
        <button
          onClick={() => setActiveSetId(null)}
          className="text-sm text-gray-400 hover:text-white mb-4"
        >
          ← Back to sets
        </button>

        {card ? (
          <>
            <div
              onClick={() => setIsFlipped((f) => !f)}
              className="cursor-pointer rounded border border-gray-700 min-h-[220px] flex items-center justify-center p-8 text-center"
            >
              <p className="text-lg">{isFlipped ? card.answer : card.question}</p>
            </div>
            <p className="text-xs text-gray-500 text-center mt-2">
              Click card to flip · {cardIndex + 1} / {cards.length}
            </p>
            <div className="flex justify-between mt-4">
              <button
                disabled={cardIndex === 0}
                onClick={() => {
                  setCardIndex((i) => i - 1);
                  setIsFlipped(false);
                }}
                className="text-sm text-gray-300 hover:text-white disabled:opacity-30"
              >
                ← Previous
              </button>
              <button
                disabled={cardIndex === cards.length - 1}
                onClick={() => {
                  setCardIndex((i) => i + 1);
                  setIsFlipped(false);
                }}
                className="text-sm text-gray-300 hover:text-white disabled:opacity-30"
              >
                Next →
              </button>
            </div>
          </>
        ) : (
          <p className="text-gray-500 text-sm">Loading cards...</p>
        )}
      </div>
    );
  }

  return (
    <div className="p-6 text-white max-w-2xl">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-medium">Flashcard Sets</h2>
        <button
          onClick={() => setShowGenerate((s) => !s)}
          className="rounded bg-white text-black text-sm font-medium px-4 py-2 hover:bg-gray-200"
        >
          {showGenerate ? "Cancel" : "+ Generate Flashcards"}
        </button>
      </div>

      {showGenerate && (
        <div className="rounded border border-gray-800 p-4 mb-6 space-y-4">
          <div>
            <p className="text-sm text-gray-300 mb-2">Documents to use</p>
            <DocumentPicker
              conversationId={conversationId}
              selected={selectedDocs}
              onChange={setSelectedDocs}
            />
          </div>
          <div>
            <label className="text-sm text-gray-300 block mb-1">Number of cards</label>
            <input
              type="number"
              min={1}
              max={30}
              value={count}
              onChange={(e) => setCount(Number(e.target.value))}
              className="w-24 rounded border border-gray-600 bg-gray-900 px-2 py-1 text-sm text-white"
            />
          </div>
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <button
            onClick={handleGenerate}
            disabled={isGenerating}
            className="rounded bg-white text-black text-sm font-medium px-4 py-2 hover:bg-gray-200 disabled:opacity-50"
          >
            {isGenerating ? "Generating..." : "Generate"}
          </button>
        </div>
      )}

      {isLoading && <p className="text-gray-500 text-sm">Loading...</p>}
      {!isLoading && sets.length === 0 && !showGenerate && (
        <p className="text-gray-500 text-sm">No flashcard sets yet.</p>
      )}

      <ul className="space-y-2">
        {sets.map((set) => (
          <li key={set._id}>
            <button
              onClick={() => openSet(set._id)}
              className="w-full text-left rounded border border-gray-800 px-4 py-3 hover:bg-gray-900"
            >
              <p className="text-sm">{set.title}</p>
              <p className="text-xs text-gray-500">{set.cardCount} cards</p>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
