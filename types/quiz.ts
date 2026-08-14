import { ObjectId } from "mongodb";

export type QuizQuestionCount = 5 | 10 | 20;

export interface Quiz {
  _id?: ObjectId;
  userId: ObjectId;
  conversationId: ObjectId;
  documentIds: ObjectId[];
  title: string;
  questionCount: number;
  createdAt: Date;
  // Populated client-side after fetching attempts; not stored on the quiz itself.
  lastScore?: { correct: number; total: number } | null;
}

export interface QuizQuestion {
  _id?: ObjectId;
  quizId: ObjectId;
  index: number;
  question: string;
  options: string[]; // always length 4
  correctIndex: number; // 0-3, NEVER sent to the client before submission
  createdAt: Date;
}

export interface QuizAttemptAnswer {
  questionId: ObjectId;
  selectedIndex: number;
  isCorrect: boolean;
}

export interface QuizAttempt {
  _id?: ObjectId;
  quizId: ObjectId;
  userId: ObjectId;
  answers: QuizAttemptAnswer[];
  score: number;
  total: number;
  submittedAt: Date;
}
