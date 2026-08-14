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

  // Check for reduced motion preference
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mediaQuery.matches);
  }, []);

  // IMPORTANT: Ref for answer container to prevent scrolling
  const answersContainerRef = useRef<HTMLDivElement>(null);

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

      // Reset form after successful generation
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
      <div className="h-full flex flex-col overflow-hidden bg-white dark:bg-gray-950">
        {/* Header */}
        <div className="border-b border-gray-200 dark:border-gray-800 p-6 flex items-center justify-between bg-gray-50 dark:bg-gray-900">
          <button
            onClick={() => {
              setActiveQuizId(null);
              setResults(null);
            }}
            className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
          >
            ← Back to Quizzes
          </button>
          {results && <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Quiz Complete</p>}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-2xl mx-auto">
            {results ? (
              <>
                <ScoreReveal score={results.score} total={results.total} reduceMotion={prefersReducedMotion} />
                <div className="mt-8 space-y-6">
                  {results.results.map((r, idx) => (
                    <div key={idx} className="p-4 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
                      <p className="font-medium text-gray-900 dark:text-white mb-3">
                        {idx + 1}. {r.question}
                      </p>
                      <div className="space-y-2">
                        {r.options.map((opt, oi) => (
                          <div
                            key={oi}
                            className={`p-2 rounded text-sm ${
                              oi === r.correctIndex
                                ? "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 border border-green-300 dark:border-green-700"
                                : oi === r.selectedIndex && !r.isCorrect
                                ? "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 border border-red-300 dark:border-red-700"
                                : "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
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
                  <div key={q._id} className="mb-8 p-4 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
                    <p className="font-medium text-gray-900 dark:text-white mb-4">
                      {idx + 1}. {q.question}
                    </p>
                    <div ref={answersContainerRef} className="space-y-2">
                      {q.options.map((opt, oi) => (
                        <label
                          key={oi}
                          className="flex items-center gap-3 p-3 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600"
                        >
                          <input
                            type="radio"
                            name={`q-${q._id}`}
                            checked={answers[q._id] === oi}
                            onChange={() => setAnswers((prev) => ({ ...prev, [q._id]: oi }))}
                            className="accent-accent"
                          />
                          <span className="text-sm text-gray-900 dark:text-white">{opt}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>

        {/* Footer */}
        {!results && (
          <div className="border-t border-gray-200 dark:border-gray-800 p-6 bg-gray-50 dark:bg-gray-900 flex justify-center">
            <button
              onClick={handleSubmit}
              disabled={isSubmitting || Object.keys(answers).length !== questions.length}
              className="px-6 py-2 bg-accent text-accent-foreground rounded font-medium hover:bg-yellow-500 disabled:opacity-50"
            >
              {isSubmitting ? "Submitting..." : "Submit Quiz"}
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden bg-white dark:bg-gray-950">
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Quizzes</h2>
            <button
              onClick={() => setShowGenerate(!showGenerate)}
              className="px-4 py-2 bg-accent text-accent-foreground rounded font-medium hover:bg-yellow-500"
            >
              {showGenerate ? "Cancel" : "+ Generate Quiz"}
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 text-sm rounded">
              {error}
            </div>
          )}

          {showGenerate && (
            <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
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
                      className={`px-3 py-2 rounded text-sm ${
                        source === s
                          ? "bg-accent text-accent-foreground font-medium"
                          : "bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-300"
                      }`}
                    >
                      {s === "documents" ? "Documents" : "Chat"}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
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
                <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
                  Number of Questions
                </label>
                <div className="flex gap-2">
                  {[5, 10, 20].map((n) => (
                    <button
                      key={n}
                      onClick={() => setCount(n as 5 | 10 | 20)}
                      className={`px-3 py-2 rounded text-sm ${
                        count === n
                          ? "bg-accent text-accent-foreground font-medium"
                          : "bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-300"
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
                className="w-full py-2 bg-accent text-accent-foreground rounded font-medium hover:bg-yellow-500 disabled:opacity-50"
              >
                {isGenerating ? "Generating..." : "Generate Quiz"}
              </button>
            </div>
          )}

          {isLoading ? (
            <p className="text-gray-600 dark:text-gray-400">Loading quizzes...</p>
          ) : quizzes.length === 0 ? (
            <p className="text-gray-600 dark:text-gray-400">No quizzes yet. Create one above!</p>
          ) : (
            <div className="space-y-2">
              {quizzes.map((q) => (
                <div
                  key={q._id}
                  className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg"
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
                        className="w-full px-2 py-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white"
                      />
                    ) : (
                      <>
                        <p className="font-medium text-gray-900 dark:text-white">{q.title}</p>
                        <p className="text-xs text-gray-600 dark:text-gray-400">
                          {q.questionCount} questions
                          {q.lastScore && ` • Last: ${q.lastScore.correct}/${q.lastScore.total}`}
                        </p>
                      </>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => openQuiz(q._id)}
                      className="text-xs px-2 py-1 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded"
                    >
                      Start
                    </button>
                    <button
                      onClick={() => startEditing(q)}
                      className="text-xs px-2 py-1 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
                    >
                      Rename
                    </button>
                    <button
                      onClick={() => handleDelete(q._id)}
                      className="text-xs px-2 py-1 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded"
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
      <div className="relative w-40 h-40">
        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
          <circle
            cx="50"
            cy="50"
            r="42"
            fill="none"
            stroke="currentColor"
            strokeWidth="4"
            className="text-gray-300 dark:text-gray-700"
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
            className="text-accent transition-all duration-500"
            style={{
              transitionDuration: reduceMotion ? "0ms" : "500ms",
            }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <p className="text-3xl font-bold text-gray-900 dark:text-white">{pct}%</p>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {score}/{total}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}