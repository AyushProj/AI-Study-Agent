"use client";

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import DocumentPicker from "../DocumentPicker";
import ChatSourcePicker from "../ChatSourcePicker";
import SourceToggle, { GenerationSourceValue } from "../SourceToggle";

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
            <ScoreReveal score={results.score} total={results.total} reduceMotion={!!prefersReducedMotion} />
            <div className="space-y-4 mt-6">
              {results.results.map((r, i) => (
                <motion.div
                  key={r.questionId}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: prefersReducedMotion ? 0 : 0.25, delay: i * 0.04 }}
                  className={`rounded-lg border px-4 py-3 ${
                    r.isCorrect ? "border-green-800" : "border-red-800"
                  }`}
                >
                  <p className="text-sm mb-2">{r.question}</p>
                  <ul className="space-y-1">
                    {r.options.map((opt, oi) => (
                      <li
                        key={oi}
                        className={`text-xs px-2 py-1 rounded ${
                          oi === r.correctIndex
                            ? "bg-green-900 text-green-200"
                            : oi === r.selectedIndex
                            ? "bg-red-900 text-red-200"
                            : "text-gray-400"
                        }`}
                      >
                        {opt}
                      </li>
                    ))}
                  </ul>
                </motion.div>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            {questions.map((q, qi) => (
              <motion.div
                key={q._id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: prefersReducedMotion ? 0 : 0.2, delay: qi * 0.03 }}
              >
                <p className="text-sm mb-2">
                  {q.index + 1}. {q.question}
                </p>
                <div className="space-y-1">
                  {q.options.map((opt, i) => (
                    <label
                      key={i}
                      className={`flex items-center gap-2 text-sm text-gray-200 cursor-pointer rounded px-2 py-1 transition-colors ${
                        answers[q._id] === i ? "bg-accent/10" : "hover:bg-gray-900"
                      }`}
                    >
                      <input
                        type="radio"
                        name={q._id}
                        checked={answers[q._id] === i}
                        onChange={() => setAnswers((prev) => ({ ...prev, [q._id]: i }))}
                        className="accent-accent"
                      />
                      {opt}
                    </label>
                  ))}
                </div>
              </motion.div>
            ))}
            <button
              onClick={handleSubmit}
              disabled={isSubmitting || Object.keys(answers).length !== questions.length}
              className="rounded bg-accent text-accent-foreground text-sm font-medium px-4 py-2 hover:brightness-95 disabled:opacity-50"
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
            >
              <button
                onClick={() => openQuiz(quiz._id)}
                className="w-full text-left rounded-lg border border-gray-800 px-4 py-3 transition-colors hover:border-accent/50 hover:bg-gray-900"
              >
                <p className="text-sm">{quiz.title}</p>
                <p className="text-xs text-gray-500">
                  {quiz.questionCount} questions
                  {quiz.lastScore && ` · Last score: ${quiz.lastScore.correct}/${quiz.lastScore.total}`}
                </p>
              </button>
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