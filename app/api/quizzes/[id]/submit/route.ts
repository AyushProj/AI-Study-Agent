import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import clientPromise from "@/lib/db";
import { auth } from "@/auth";
import type { QuizQuestion, QuizAttempt, QuizAttemptAnswer } from "@/types/quiz";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  if (!ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const submitted: { questionId: string; selectedIndex: number }[] = Array.isArray(body.answers)
    ? body.answers
    : [];

  const userId = new ObjectId(session.user.id);
  const client = await clientPromise;
  const db = client.db();

  const quiz = await db.collection("quizzes").findOne({ _id: new ObjectId(id), userId });
  if (!quiz) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const questions = await db
    .collection<QuizQuestion>("quizQuestions")
    .find({ quizId: quiz._id })
    .sort({ index: 1 })
    .toArray();

  const answerMap = new Map(submitted.map((a) => [a.questionId, a.selectedIndex]));

  const gradedAnswers: QuizAttemptAnswer[] = questions.map((q) => {
    const selectedIndex = answerMap.get(q._id!.toString()) ?? -1;
    return {
      questionId: q._id!,
      selectedIndex,
      isCorrect: selectedIndex === q.correctIndex,
    };
  });

  const score = gradedAnswers.filter((a) => a.isCorrect).length;
  const total = questions.length;
  const now = new Date();

  await db.collection<QuizAttempt>("quizAttempts").insertOne({
    quizId: quiz._id!,
    userId,
    answers: gradedAnswers,
    score,
    total,
    submittedAt: now,
  } as QuizAttempt);

  // Return full results, including correct answers/explanations now that
  // the attempt is submitted and graded.
  const results = questions.map((q) => {
    const graded = gradedAnswers.find((a) => a.questionId.toString() === q._id!.toString())!;
    return {
      questionId: q._id,
      question: q.question,
      options: q.options,
      correctIndex: q.correctIndex,
      selectedIndex: graded.selectedIndex,
      isCorrect: graded.isCorrect,
    };
  });

  return NextResponse.json({ score, total, results });
}
