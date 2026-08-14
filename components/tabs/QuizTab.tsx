"use client";

import { useCallback, useEffect, useState } from "react";
import DocumentPicker from "../DocumentPicker";

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
  const [selectedDocs, setSelectedDocs] = useState<string[]>([]);
  const [count, setCount] = useState<5 | 10 | 20>(10);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState("");

  const [activeQuizId, setActiveQuizId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<QuestionData[]>([]);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [results, setResults] = useState<{ score: number; total: number; results: ResultData[] } | null>(null);

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
    if (selectedDocs.length === 0) {
      setError("Select at least one document");
      return;
    }
    setIsGenerating(true);
    const res = await fetch(`/api/conversations/${conversationId}/quizzes`, {
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
            <p className="text-lg mb-4">
              Score: {results.score} / {results.total}
            </p>
            <div className="space-y-4">
              {results.results.map((r) => (
                <div
                  key={r.questionId}
                  className={`rounded border px-4 py-3 ${
                    r.isCorrect ? "border-green-800" : "border-red-800"
                  }`}
                >
                  <p className="text-sm mb-2">{r.question}</p>
                  <ul className="space-y-1">
                    {r.options.map((opt, i) => (
                      <li
                        key={i}
                        className={`text-xs px-2 py-1 rounded ${
                          i === r.correctIndex
                            ? "bg-green-900 text-green-200"
                            : i === r.selectedIndex
                            ? "bg-red-900 text-red-200"
                            : "text-gray-400"
                        }`}
                      >
                        {opt}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            {questions.map((q) => (
              <div key={q._id}>
                <p className="text-sm mb-2">
                  {q.index + 1}. {q.question}
                </p>
                <div className="space-y-1">
                  {q.options.map((opt, i) => (
                    <label
                      key={i}
                      className="flex items-center gap-2 text-sm text-gray-200 cursor-pointer"
                    >
                      <input
                        type="radio"
                        name={q._id}
                        checked={answers[q._id] === i}
                        onChange={() => setAnswers((prev) => ({ ...prev, [q._id]: i }))}
                        className="accent-white"
                      />
                      {opt}
                    </label>
                  ))}
                </div>
              </div>
            ))}
            <button
              onClick={handleSubmit}
              disabled={isSubmitting || Object.keys(answers).length !== questions.length}
              className="rounded bg-white text-black text-sm font-medium px-4 py-2 hover:bg-gray-200 disabled:opacity-50"
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
            <p className="text-sm text-gray-300 mb-2">Number of questions</p>
            <div className="flex gap-2">
              {[5, 10, 20].map((n) => (
                <button
                  key={n}
                  onClick={() => setCount(n as 5 | 10 | 20)}
                  className={`rounded px-3 py-1.5 text-sm border ${
                    count === n
                      ? "bg-white text-black border-white"
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
            className="rounded bg-white text-black text-sm font-medium px-4 py-2 hover:bg-gray-200 disabled:opacity-50"
          >
            {isGenerating ? "Generating..." : "Generate"}
          </button>
        </div>
      )}

      {isLoading && <p className="text-gray-500 text-sm">Loading...</p>}
      {!isLoading && quizzes.length === 0 && !showGenerate && (
        <p className="text-gray-500 text-sm">No quizzes yet.</p>
      )}

      <ul className="space-y-2">
        {quizzes.map((quiz) => (
          <li key={quiz._id}>
            <button
              onClick={() => openQuiz(quiz._id)}
              className="w-full text-left rounded border border-gray-800 px-4 py-3 hover:bg-gray-900"
            >
              <p className="text-sm">{quiz.title}</p>
              <p className="text-xs text-gray-500">
                {quiz.questionCount} questions
                {quiz.lastScore && ` · Last score: ${quiz.lastScore.correct}/${quiz.lastScore.total}`}
              </p>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
