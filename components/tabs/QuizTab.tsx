"use client";

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import DocumentPicker from "../DocumentPicker";
import ChatSourcePicker from "../ChatSourcePicker";
import SourceToggle, { GenerationSourceValue } from "../SourceToggle";
import OverflowMenu from "../OverflowMenu";

interface QuizSummary {
  _id: string;
  title: string;
  questionCount: number;
  lastScore: { correct: number; total: number } | null;
}

interface QuestionData {
  _id: string;
  index: number;
  question: string;
  options: string[];
}

interface ResultData {
  questionId: string;
  question: string;
  options: string[];
  correctIndex: number;
  selectedIndex: number;
  isCorrect: boolean;
}

export default function QuizTab({ conversationId }: { conversationId: string }) {
  const [quizzes, setQuizzes] = useState<QuizSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showGenerate, setShowGenerate] = useState(false);
  const [source, setSource] = useState<GenerationSourceValue>("documents");
  const [selectedDocs, setSelectedDocs] = useState<string[]>([]);
  const [selectedMessages, setSelectedMessages] = useState<string[]>([]);
  const [count, setCount] = useState<5 | 10 | 20>(10);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState("");

  const [activeQuizId, setActiveQuizId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<QuestionData[]>([]);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [results, setResults] = useState<{ score: number; total: number; results: ResultData[] } | null>(null);

  // Rename state for the quizzes list.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  const prefersReducedMotion = useReducedMotion();

  const loadQuizzes = useCallback(async () => {
    setIsLoading(true);
    const res = await fetch(`/api/conversations/${conversationId}/quizzes`);
    if (res.ok) setQuizzes(await res.json());
    setIsLoading(false);
  }, [conversationId]);

  useEffect(() => {
    loadQuizzes();
  }, [loadQuizzes]);

  async function handleGenerate() {
    setError("");
    const selection = source === "documents" ? selectedDocs : selectedMessages;
    if (selection.length === 0) {
      setError(source === "documents" ? "Select at least one document" : "Select at least one chat topic");
      return;
    }
    setIsGenerating(true);
    const res = await fetch(`/api/conversations/${conversationId}/quizzes`, {
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
      await loadQuizzes();
    }
    setIsGenerating(false);
  }

  async function openQuiz(quizId: string) {
    setActiveQuizId(quizId);
    setAnswers({});
    setResults(null);
    const res = await fetch(`/api/quizzes/${quizId}`);
    if (res.ok) {
      const data = await res.json();
      setQuestions(data.questions);
    }
  }

  async function handleSubmit() {
    if (!activeQuizId) return;
    setIsSubmitting(true);
    const payload = {
      answers: Object.entries(answers).map(([questionId, selectedIndex]) => ({
        questionId,
        selectedIndex,
      })),
    };
    const res = await fetch(`/api/quizzes/${activeQuizId}/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      setResults(await res.json());
      await loadQuizzes();
    }
    setIsSubmitting(false);
  }

  function startEditing(quiz: QuizSummary) {
    setEditingId(quiz._id);
    setEditValue(quiz.title);
  }

  async function saveTitle(quizId: string) {
    const trimmed = editValue.trim();
    setEditingId(null);
    if (!trimmed) return;

    const previous = quizzes;
    setQuizzes((prev) => prev.map((q) => (q._id === quizId ? { ...q, title: trimmed } : q)));

    const res = await fetch(`/api/quizzes/${quizId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: trimmed }),
    });

    if (!res.ok) {
      setQuizzes(previous);
    }
  }

  async function handleDelete(quizId: string) {
    const confirmed = window.confirm("Delete this quiz? This can't be undone.");
    if (!confirmed) return;

    const previous = quizzes;
    setQuizzes((prev) => prev.filter((q) => q._id !== quizId));

    const res = await fetch(`/api/quizzes/${quizId}`, { method: "DELETE" });

    if (!res.ok) {
      setQuizzes(previous);
      return;
    }

    if (activeQuizId === quizId) {
      setActiveQuizId(null);
    }
  }

  if (activeQuizId) {
    return (
      <div className="p-6 text-white max-w-2xl">
        <button
          onClick={() => setActiveQuizId(null)}
          className="text-sm text-gray-400 hover:text-white mb-4"
        >
          ← Back to quizzes
        </button>

        {results ? (
          <div>
            <div className="rounded-xl border border-gray-800 p-5">
              <ScoreReveal score={results.score} total={results.total} reduceMotion={!!prefersReducedMotion} />
            </div>
            <div className="space-y-4 mt-6">
              {results.results.map((r, i) => (
                <motion.div
                  key={r.questionId}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: prefersReducedMotion ? 0 : 0.25, delay: i * 0.04 }}
                  className={`rounded-xl border p-4 ${
                    r.isCorrect ? "border-green-800/60" : "border-red-800/60"
                  }`}
                >
                  <p className="text-sm font-medium mb-3">{r.question}</p>
                  <div className="space-y-2">
                    {r.options.map((opt, oi) => {
                      const isCorrectAnswer = oi === r.correctIndex;
                      const isUserWrongPick = oi === r.selectedIndex && !r.isCorrect;
                      return (
                        <div
                          key={oi}
                          className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 text-sm ${
                            isCorrectAnswer
                              ? "border-green-700 bg-green-900/30 text-green-200"
                              : isUserWrongPick
                              ? "border-red-700 bg-red-900/30 text-red-200"
                              : "border-gray-800 text-gray-400"
                          }`}
                        >
                          <span
                            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-medium ${
                              isCorrectAnswer
                                ? "border-green-600 bg-green-700 text-white"
                                : isUserWrongPick
                                ? "border-red-600 bg-red-700 text-white"
                                : "border-gray-700 text-gray-500"
                            }`}
                          >
                            {isCorrectAnswer ? "✓" : isUserWrongPick ? "✗" : String.fromCharCode(65 + oi)}
                          </span>
                          <span>{opt}</span>
                        </div>
                      );
                    })}
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        ) : (
          <div>
            <div className="mb-5">
              <div className="flex items-center justify-between text-xs text-gray-500 mb-1.5">
                <span>
                  {Object.keys(answers).length} of {questions.length} answered
                </span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-gray-800 overflow-hidden">
                <motion.div
                  className="h-full rounded-full bg-accent"
                  animate={{
                    width: `${questions.length ? (Object.keys(answers).length / questions.length) * 100 : 0}%`,
                  }}
                  transition={{ duration: prefersReducedMotion ? 0 : 0.25 }}
                />
              </div>
            </div>

            <div className="space-y-4">
              {questions.map((q, qi) => (
                <motion.div
                  key={q._id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: prefersReducedMotion ? 0 : 0.2, delay: qi * 0.03 }}
                  className="rounded-xl border border-gray-800 p-4"
                >
                  <p className="text-sm font-medium mb-3">
                    {q.index + 1}. {q.question}
                  </p>
                  <div className="space-y-2">
                    {q.options.map((opt, i) => {
                      const isSelected = answers[q._id] === i;
                      return (
                        <label
                          key={i}
                          className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 text-sm transition-colors ${
                            isSelected
                              ? "border-accent bg-accent/10 text-white"
                              : "border-gray-700 text-gray-300 hover:border-gray-500 hover:bg-gray-900"
                          }`}
                        >
                          <input
                            type="radio"
                            name={q._id}
                            checked={isSelected}
                            onChange={() => setAnswers((prev) => ({ ...prev, [q._id]: i }))}
                            className="sr-only"
                          />
                          <span
                            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-medium ${
                              isSelected
                                ? "border-accent bg-accent text-accent-foreground"
                                : "border-gray-600 text-gray-400"
                            }`}
                          >
                            {String.fromCharCode(65 + i)}
                          </span>
                          <span>{opt}</span>
                        </label>
                      );
                    })}
                  </div>
                </motion.div>
              ))}
            </div>

            <button
              onClick={handleSubmit}
              disabled={isSubmitting || Object.keys(answers).length !== questions.length}
              className="w-full mt-5 rounded-lg bg-accent text-accent-foreground text-sm font-medium px-4 py-2.5 hover:brightness-95 disabled:opacity-50 disabled:hover:brightness-100"
            >
              {isSubmitting ? "Submitting..." : "Submit Quiz"}
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="p-6 text-white max-w-2xl">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-medium">Quizzes</h2>
        <button
          onClick={() => setShowGenerate((s) => !s)}
          className="rounded bg-white text-black text-sm font-medium px-4 py-2 hover:bg-gray-200"
        >
          {showGenerate ? "Cancel" : "+ Generate Quiz"}
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
                <p className="text-sm text-gray-300 mb-2">Number of questions</p>
                <div className="flex gap-2">
                  {[5, 10, 20].map((n) => (
                    <button
                      key={n}
                      onClick={() => setCount(n as 5 | 10 | 20)}
                      className={`rounded px-3 py-1.5 text-sm border transition-colors ${
                        count === n
                          ? "bg-accent text-accent-foreground border-accent"
                          : "border-gray-600 text-gray-300 hover:border-gray-400"
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
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
      {!isLoading && quizzes.length === 0 && !showGenerate && (
        <p className="text-gray-500 text-sm">No quizzes yet.</p>
      )}

      <ul className="space-y-2">
        <AnimatePresence>
          {quizzes.map((quiz, i) => (
            <motion.li
              key={quiz._id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: prefersReducedMotion ? 0 : 0.2, delay: i * 0.03 }}
              className="group flex items-center gap-2 rounded-lg border border-gray-800 px-4 py-3 transition-colors hover:border-accent/50 hover:bg-gray-900"
            >
              {editingId === quiz._id ? (
                <input
                  autoFocus
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onBlur={() => saveTitle(quiz._id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveTitle(quiz._id);
                    if (e.key === "Escape") setEditingId(null);
                  }}
                  className="flex-1 bg-transparent border-b border-gray-500 outline-none text-sm text-white"
                />
              ) : (
                <>
                  <button onClick={() => openQuiz(quiz._id)} className="flex-1 text-left">
                    <p className="text-sm">{quiz.title}</p>
                    <p className="text-xs text-gray-500">
                      {quiz.questionCount} questions
                      {quiz.lastScore && ` · Last score: ${quiz.lastScore.correct}/${quiz.lastScore.total}`}
                    </p>
                  </button>
                  <div className="opacity-0 group-hover:opacity-100">
                    <OverflowMenu
                      items={[
                        { label: "Rename", onClick: () => startEditing(quiz) },
                        { label: "Delete", onClick: () => handleDelete(quiz._id), danger: true },
                      ]}
                    />
                  </div>
                </>
              )}
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
    </div>
  );
}

function ScoreReveal({
  score,
  total,
  reduceMotion,
}: {
  score: number;
  total: number;
  reduceMotion: boolean;
}) {
  const pct = total > 0 ? Math.round((score / total) * 100) : 0;
  const circumference = 2 * Math.PI * 42;

  return (
    <div className="flex items-center gap-5">
      <svg width="96" height="96" viewBox="0 0 96 96" className="-rotate-90">
        <circle cx="48" cy="48" r="42" fill="none" stroke="var(--color-background)" strokeWidth="8" />
        <circle
          cx="48"
          cy="48"
          r="42"
          fill="none"
          stroke="#374151"
          strokeWidth="8"
        />
        <motion.circle
          cx="48"
          cy="48"
          r="42"
          fill="none"
          stroke="var(--color-accent)"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: circumference * (1 - pct / 100) }}
          transition={{ duration: reduceMotion ? 0 : 0.8, ease: "easeOut" }}
        />
      </svg>
      <div>
        <p className="text-2xl font-semibold">
          {score} / {total}
        </p>
        <p className="text-sm text-gray-400">{pct}% correct</p>
      </div>
    </div>
  );
}