"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import DocumentPicker from "@/components/DocumentPicker";
import ChatSourcePicker from "@/components/ChatSourcePicker";

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

type GenerationSourceValue = "documents" | "chat";

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

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  const answersContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mediaQuery.matches);
  }, []);

  const loadQuizzes = useCallback(async () => {
    setIsLoading(true);
    const res = await fetch(`/api/conversations/${conversationId}/quizzes`);
    if (res.ok) {
      setQuizzes(await res.json());
    }
    setIsLoading(false);
  }, [conversationId]);

  useEffect(() => {
    loadQuizzes();
  }, [loadQuizzes]);

  async function handleGenerate() {
    setError("");
    const selection = source === "documents" ? selectedDocs : selectedMessages;
    if (selection.length === 0) {
      setError("Please select at least one source");
      return;
    }

    setIsGenerating(true);

    try {
      const res = await fetch(`/api/conversations/${conversationId}/quizzes`, {
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

      await loadQuizzes();
      setShowGenerate(false);
      setSelectedDocs([]);
      setSelectedMessages([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate quiz");
    } finally {
      setIsGenerating(false);
    }
  }

  async function openQuiz(quizId: string) {
    const res = await fetch(`/api/quizzes/${quizId}/questions`);
    if (res.ok) {
      const qs = await res.json();
      setQuestions(qs);
      setAnswers({});
      setResults(null);
      setActiveQuizId(quizId);
    }
  }

  async function handleSubmit() {
    if (!activeQuizId) return;

    setIsSubmitting(true);

    const submittedAnswers = questions.map((q) => ({
      questionId: q._id,
      selectedIndex: answers[q._id] ?? -1,
    }));

    try {
      const res = await fetch(`/api/quizzes/${activeQuizId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: submittedAnswers }),
      });

      if (res.ok) {
        const data = await res.json();
        setResults(data);
        await loadQuizzes();
      }
    } finally {
      setIsSubmitting(false);
    }
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
    setQuizzes((prev) =>
      prev.map((q) => (q._id === quizId ? { ...q, title: trimmed } : q))
    );

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
    const confirmed = window.confirm("Delete this quiz?");
    if (!confirmed) return;

    const previous = quizzes;
    setQuizzes((prev) => prev.filter((q) => q._id !== quizId));

    const res = await fetch(`/api/quizzes/${quizId}`, { method: "DELETE" });
    if (!res.ok) {
      setQuizzes(previous);
    }
  }

  if (activeQuizId) {
    return (
      <div className="flex h-full flex-col overflow-hidden bg-[var(--background)] text-[var(--foreground)]">
        <div className="flex items-center justify-between border-b border-[var(--border)] bg-[var(--card-bg)] p-6">
          <button
            onClick={() => {
              setActiveQuizId(null);
              setResults(null);
            }}
            className="text-sm text-[var(--foreground)] hover:opacity-80"
          >
            ← Back to Quizzes
          </button>

          {results && (
            <p className="text-sm text-[var(--foreground-muted)]">Quiz Complete</p>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="mx-auto max-w-2xl">
            {results ? (
              <>
                <ScoreReveal
                  score={results.score}
                  total={results.total}
                  reduceMotion={prefersReducedMotion}
                />

                <div className="mt-8 space-y-6">
                  {results.results.map((r, idx) => (
                    <div
                      key={idx}
                      className="rounded-lg border border-[var(--border)] bg-[var(--card-bg)] p-4"
                    >
                      <p className="mb-3 font-medium text-[var(--foreground)]">
                        {idx + 1}. {r.question}
                      </p>

                      <div className="space-y-2">
                        {r.options.map((opt, oi) => (
                          <div
                            key={oi}
                            className={`rounded p-2 text-sm ${
                              oi === r.correctIndex
                                ? "border border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
                                : oi === r.selectedIndex && !r.isCorrect
                                ? "border border-red-500/40 bg-red-500/10 text-red-200"
                                : "bg-[var(--background-soft)] text-[var(--foreground)]"
                            }`}
                          >
                            {opt}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <>
                {questions.map((q, idx) => (
                  <div
                    key={q._id}
                    className="mb-8 rounded-lg border border-[var(--border)] bg-[var(--card-bg)] p-4"
                  >
                    <p className="mb-4 font-medium text-[var(--foreground)]">
                      {idx + 1}. {q.question}
                    </p>

                    <div ref={answersContainerRef} className="space-y-2">
                      {q.options.map((opt, oi) => (
                        <label
                          key={oi}
                          className="flex cursor-pointer items-center gap-3 rounded border border-[var(--border)] bg-[var(--background-soft)] p-3 hover:opacity-90"
                        >
                          <input
                            type="radio"
                            name={`q-${q._id}`}
                            checked={answers[q._id] === oi}
                            onChange={() => setAnswers((prev) => ({ ...prev, [q._id]: oi }))}
                            className="accent-[var(--accent)]"
                          />
                          <span className="text-sm text-[var(--foreground)]">{opt}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>

        {!results && (
          <div className="border-t border-[var(--border)] bg-[var(--card-bg)] p-6">
            <div className="mx-auto max-w-2xl">
              <button
                onClick={handleSubmit}
                disabled={isSubmitting || Object.keys(answers).length !== questions.length}
                className="w-full rounded-md bg-[var(--accent)] px-4 py-2 font-medium text-[var(--accent-foreground)] disabled:opacity-60"
              >
                {isSubmitting ? "Submitting..." : "Submit Quiz"}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[var(--background)] text-[var(--foreground)]">
      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-2xl">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-2xl font-bold text-[var(--foreground)]">Quizzes</h2>

            <button
              onClick={() => setShowGenerate(!showGenerate)}
              className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-[var(--accent-foreground)]"
            >
              {showGenerate ? "Cancel" : "+ Generate Quiz"}
            </button>
          </div>

          {error && (
            <div className="mb-4 rounded border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
              {error}
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
                  Number of Questions
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
                {isGenerating ? "Generating..." : "Generate Quiz"}
              </button>
            </div>
          )}

          {isLoading ? (
            <p className="text-[var(--foreground-muted)]">Loading quizzes...</p>
          ) : quizzes.length === 0 ? (
            <p className="text-[var(--foreground-muted)]">No quizzes yet. Create one above!</p>
          ) : (
            <div className="space-y-2">
              {quizzes.map((q) => (
                <div
                  key={q._id}
                  className="flex items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--card-bg)] p-3"
                >
                  <div className="flex-1">
                    {editingId === q._id ? (
                      <input
                        autoFocus
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onBlur={() => saveTitle(q._id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") saveTitle(q._id);
                          if (e.key === "Escape") setEditingId(null);
                        }}
                        className="w-full rounded border border-[var(--border)] bg-[var(--input-bg)] px-2 py-1 text-[var(--foreground)] outline-none"
                      />
                    ) : (
                      <>
                        <p className="font-medium text-[var(--foreground)]">{q.title}</p>
                        <p className="text-xs text-[var(--foreground-muted)]">
                          {q.questionCount} questions
                          {q.lastScore && ` • Last: ${q.lastScore.correct}/${q.lastScore.total}`}
                        </p>
                      </>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => openQuiz(q._id)}
                      className="rounded px-2 py-1 text-xs text-blue-400 hover:bg-blue-500/10"
                    >
                      Start
                    </button>

                    <button
                      onClick={() => startEditing(q)}
                      className="rounded px-2 py-1 text-xs text-[var(--foreground-muted)] hover:bg-white/5"
                    >
                      Rename
                    </button>

                    <button
                      onClick={() => handleDelete(q._id)}
                      className="rounded px-2 py-1 text-xs text-red-400 hover:bg-red-500/10"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
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
    <div className="flex flex-col items-center gap-4">
      <div className="relative h-40 w-40">
        <svg className="h-full w-full -rotate-90" viewBox="0 0 100 100">
          <circle
            cx="50"
            cy="50"
            r="42"
            fill="none"
            stroke="currentColor"
            strokeWidth="4"
            className="text-gray-700"
          />
          <circle
            cx="50"
            cy="50"
            r="42"
            fill="none"
            stroke="currentColor"
            strokeWidth="4"
            strokeDasharray={circumference}
            strokeDashoffset={circumference - (circumference * pct) / 100}
            className="text-[var(--accent)] transition-all duration-500"
            style={{
              transitionDuration: reduceMotion ? "0ms" : "500ms",
            }}
          />
        </svg>

        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <p className="text-3xl font-bold text-[var(--foreground)]">{pct}%</p>
            <p className="text-sm text-[var(--foreground-muted)]">
              {score}/{total}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}