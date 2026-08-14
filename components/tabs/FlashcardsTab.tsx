"use client";

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import DocumentPicker from "../DocumentPicker";
import ChatSourcePicker from "../ChatSourcePicker";
import SourceToggle, { GenerationSourceValue } from "../SourceToggle";

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
  const [source, setSource] = useState<GenerationSourceValue>("documents");
  const [selectedDocs, setSelectedDocs] = useState<string[]>([]);
  const [selectedMessages, setSelectedMessages] = useState<string[]>([]);
  const [count, setCount] = useState(10);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState("");

  const [activeSetId, setActiveSetId] = useState<string | null>(null);
  const [cards, setCards] = useState<CardData[]>([]);
  const [cardIndex, setCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);

  const prefersReducedMotion = useReducedMotion();

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
    const selection = source === "documents" ? selectedDocs : selectedMessages;
    if (selection.length === 0) {
      setError(source === "documents" ? "Select at least one document" : "Select at least one chat topic");
      return;
    }
    setIsGenerating(true);
    const res = await fetch(`/api/conversations/${conversationId}/flashcards`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        source === "documents"
          ? { source, documentIds: selectedDocs, count }
          : { source, messageIds: selectedMessages, count }
      ),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Generation failed");
    } else {
      setShowGenerate(false);
      setSelectedDocs([]);
      setSelectedMessages([]);
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
            <div className="[perspective:1200px]">
              <motion.div
                onClick={() => setIsFlipped((f) => !f)}
                animate={{ rotateY: isFlipped ? 180 : 0 }}
                transition={{ duration: prefersReducedMotion ? 0 : 0.45, ease: "easeInOut" }}
                className="relative min-h-[220px] cursor-pointer [transform-style:preserve-3d]"
              >
                <div className="absolute inset-0 flex items-center justify-center rounded-xl border border-gray-700 bg-gray-900/50 p-8 text-center [backface-visibility:hidden]">
                  <p className="text-lg">{card.question}</p>
                </div>
                <div
                  className="absolute inset-0 flex items-center justify-center rounded-xl border border-accent/40 bg-gray-900/70 p-8 text-center [backface-visibility:hidden]"
                  style={{ transform: "rotateY(180deg)" }}
                >
                  <p className="text-lg">{card.answer}</p>
                </div>
              </motion.div>
            </div>

            <p className="text-xs text-gray-500 text-center mt-3">Click card to flip</p>
            <div className="flex justify-center gap-1.5 mt-2">
              {cards.map((_, i) => (
                <span
                  key={i}
                  className={`h-1.5 w-1.5 rounded-full transition-colors ${
                    i === cardIndex ? "bg-accent" : "bg-gray-700"
                  }`}
                />
              ))}
            </div>

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

      <AnimatePresence initial={false}>
        {showGenerate && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.25, ease: "easeOut" }}
            className="overflow-hidden"
          >
            <div className="rounded-xl border border-gray-800 p-4 mb-6 space-y-4">
              <div>
                <p className="text-sm text-gray-300 mb-2">Generate from</p>
                <SourceToggle value={source} onChange={setSource} />
              </div>
              <div>
                <p className="text-sm text-gray-300 mb-2">
                  {source === "documents" ? "Documents to use" : "Chat topics to use"}
                </p>
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
                className="rounded bg-accent text-accent-foreground text-sm font-medium px-4 py-2 hover:brightness-95 disabled:opacity-50"
              >
                {isGenerating ? "Generating..." : "Generate"}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {isLoading && <p className="text-gray-500 text-sm">Loading...</p>}
      {!isLoading && sets.length === 0 && !showGenerate && (
        <p className="text-gray-500 text-sm">No flashcard sets yet.</p>
      )}

      <ul className="space-y-2">
        <AnimatePresence>
          {sets.map((set, i) => (
            <motion.li
              key={set._id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: prefersReducedMotion ? 0 : 0.2, delay: i * 0.03 }}
            >
              <button
                onClick={() => openSet(set._id)}
                className="w-full text-left rounded-lg border border-gray-800 px-4 py-3 transition-colors hover:border-accent/50 hover:bg-gray-900"
              >
                <p className="text-sm">{set.title}</p>
                <p className="text-xs text-gray-500">{set.cardCount} cards</p>
              </button>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
    </div>
  );
}