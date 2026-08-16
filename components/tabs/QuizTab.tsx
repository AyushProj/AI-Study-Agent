"use client";

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import DocumentPicker from "../DocumentPicker";
import ChatSourcePicker from "../ChatSourcePicker";
import SourceToggle, { GenerationSourceValue } from "../SourceToggle";
import OverflowMenu from "../OverflowMenu";
import ConfirmDialog from "../ConfirmDialog";

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

  // Pending delete target for the confirm dialog (replaces window.confirm()).
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

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

  // Clicking a selected option again deselects it (per request); clicking a
  // different option switches the selection as before.
  function toggleAnswer(questionId: string, optionIndex: number) {
    setAnswers((prev) => {
      if (prev[questionId] === optionIndex) {
        const next = { ...prev };
        delete next[questionId];
        return next;
      }
      return { ...prev, [questionId]: optionIndex };
    });
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

  function handleDelete(quizId: string) {
    setPendingDeleteId(quizId);
  }

  async function confirmDelete() {
    const quizId = pendingDeleteId;
    setPendingDeleteId(null);
    if (!quizId) return;

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
      <div className="h-full w-full overflow-y-auto bg-[var(--background)] text-[var(--foreground)]">
        <div className="mx-auto max-w-2xl p-6">
        <button
          onClick={() => setActiveQuizId(null)}
          className="text-sm text-[var(--foreground-muted)] hover:text-[var(--foreground)] mb-4"
        >
          ← Back to quizzes
        </button>

        {results ? (
          <div>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--card-bg)] p-5">
              <ScoreReveal score={results.score} total={results.total} reduceMotion={!!prefersReducedMotion} />
            </div>
            <div className="space-y-4 mt-6">
              {results.results.map((r, i) => (
                <motion.div
                  key={r.questionId}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: prefersReducedMotion ? 0 : 0.25, delay: i * 0.04 }}
                  className={`rounded-xl border p-4 bg-[var(--card-bg)] ${
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
                              : "border-[var(--border)] text-[var(--foreground-muted)]"
                          }`}
                        >
                          <span
                            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-medium ${
                              isCorrectAnswer
                                ? "border-green-600 bg-green-700 text-white"
                                : isUserWrongPick
                                ? "border-red-600 bg-red-700 text-white"
                                : "border-[var(--border)] text-[var(--foreground-muted)]"
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
              <div className="flex items-center justify-between text-xs text-[var(--foreground-muted)] mb-1.5">
                <span>
                  {Object.keys(answers).length} of {questions.length} answered
                </span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-[var(--background-soft)] overflow-hidden">
                <motion.div
                  className="h-full rounded-full bg-[var(--accent)]"
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
                  className="rounded-xl border border-[var(--border)] bg-[var(--card-bg)] p-4"
                >
                  <p className="text-sm font-medium mb-3">
                    {q.index + 1}. {q.question}
                  </p>
                  <div className="space-y-2">
                    {q.options.map((opt, i) => {
                      const isSelected = answers[q._id] === i;
                      return (
                        <button
                          key={i}
                          type="button"
                          role="radio"
                          aria-checked={isSelected}
                          onClick={() => toggleAnswer(q._id, i)}
                          className={`flex w-full cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors ${
                            isSelected
                              ? "border-yellow-500 bg-yellow-500/10 text-yellow-50"
                              : "border-[var(--border)] text-[var(--foreground-muted)] hover:border-[var(--foreground-muted)] hover:bg-[var(--background-soft)]"
                          }`}
                        >
                          <span
                            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-medium ${
                              isSelected
                                ? "border-yellow-500 bg-yellow-500 text-black"
                                : "border-[var(--border)] text-[var(--foreground-muted)]"
                            }`}
                          >
                            {String.fromCharCode(65 + i)}
                          </span>
                          <span>{opt}</span>
                        </button>
                      );
                    })}
                  </div>
                </motion.div>
              ))}
            </div>

            <button
              onClick={handleSubmit}
              disabled={isSubmitting || Object.keys(answers).length !== questions.length}
              className="w-full mt-5 rounded-lg bg-[var(--accent)] text-[var(--accent-foreground)] text-sm font-medium px-4 py-2.5 hover:brightness-95 disabled:opacity-50 disabled:hover:brightness-100"
            >
              {isSubmitting ? "Submitting..." : "Submit Quiz"}
            </button>
          </div>
        )}
        </div>
        <ConfirmDialog
          open={pendingDeleteId !== null}
          title="Delete quiz?"
          message="This can't be undone."
          onConfirm={confirmDelete}
          onCancel={() => setPendingDeleteId(null)}
        />
      </div>
    );
  }

  return (
    <div className="h-full w-full overflow-y-auto bg-[var(--background)] text-[var(--foreground)]">
      <div className="mx-auto max-w-2xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-medium">Quizzes</h2>
        <button
          onClick={() => setShowGenerate((s) => !s)}
          className="rounded bg-[var(--accent)] text-[var(--accent-foreground)] text-sm font-medium px-4 py-2 hover:brightness-95"
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
            <div className="rounded-xl border border-[var(--border)] bg-[var(--card-bg)] p-4 mb-6 space-y-4">
              <div>
                <p className="text-sm text-[var(--foreground-muted)] mb-2">Generate from</p>
                <SourceToggle value={source} onChange={setSource} />
              </div>
              <div>
                <p className="text-sm text-[var(--foreground-muted)] mb-2">
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
                <p className="text-sm text-[var(--foreground-muted)] mb-2">Number of questions</p>
                <div className="flex gap-2">
                  {[5, 10, 20].map((n) => (
                    <button
                      key={n}
                      onClick={() => setCount(n as 5 | 10 | 20)}
                      className={`rounded px-3 py-1.5 text-sm border transition-colors ${
                        count === n
                          ? "bg-[var(--accent)] text-[var(--accent-foreground)] border-[var(--accent)]"
                          : "border-[var(--border)] text-[var(--foreground-muted)] hover:border-[var(--foreground-muted)]"
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
                className="rounded bg-[var(--accent)] text-[var(--accent-foreground)] text-sm font-medium px-4 py-2 hover:brightness-95 disabled:opacity-50"
              >
                {isGenerating ? "Generating..." : "Generate"}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {isLoading && <p className="text-[var(--foreground-muted)] text-sm">Loading...</p>}
      {!isLoading && quizzes.length === 0 && !showGenerate && (
        <p className="text-[var(--foreground-muted)] text-sm">No quizzes yet.</p>
      )}

      <ul className="space-y-2">
        <AnimatePresence>
          {quizzes.map((quiz, i) => (
            <motion.li
              key={quiz._id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: prefersReducedMotion ? 0 : 0.2, delay: i * 0.03 }}
              className="group flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--card-bg)] px-4 py-3 transition-colors hover:border-[var(--accent)]/50"
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
                  className="flex-1 bg-transparent border-b border-[var(--border)] outline-none text-sm text-[var(--foreground)]"
                />
              ) : (
                <>
                  <button onClick={() => openQuiz(quiz._id)} className="flex-1 text-left">
                    <p className="text-sm">{quiz.title}</p>
                    <p className="text-xs text-[var(--foreground-muted)]">
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
      <ConfirmDialog
        open={pendingDeleteId !== null}
        title="Delete quiz?"
        message="This can't be undone."
        onConfirm={confirmDelete}
        onCancel={() => setPendingDeleteId(null)}
      />
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
        {/* Track ring — was previously two overlapping circles, one of
            which referenced a CSS var (--color-background) that doesn't
            exist anywhere else in this app's theme. Down to one track
            circle, using the same --border var every other tab uses for
            neutral dividers/tracks. */}
        <circle cx="48" cy="48" r="42" fill="none" stroke="var(--border)" strokeWidth="8" />
        <motion.circle
          cx="48"
          cy="48"
          r="42"
          fill="none"
          stroke="var(--accent)"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: circumference * (1 - pct / 100) }}
          transition={{ duration: reduceMotion ? 0 : 0.8, ease: "easeOut" }}
        />
      </svg>
      <div>
        <p className="text-2xl font-semibold text-[var(--foreground)]">
          {score} / {total}
        </p>
        <p className="text-sm text-[var(--foreground-muted)]">{pct}% correct</p>
      </div>
    </div>
  );
}