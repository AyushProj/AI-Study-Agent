import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import clientPromise from "@/lib/db";
import { auth } from "@/auth";
import type { QuizQuestion } from "@/types/quiz";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  if (!ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Invalid quiz id" }, { status: 400 });
  }

  const userId = new ObjectId(session.user.id);
  const client = await clientPromise;
  const db = client.db();

  // Ownership check lives on the quiz itself — quizQuestions has no userId
  // field (see types/quiz.ts), so filtering questions by userId directly
  // can never match anything, which is why this route was returning [].
  const quiz = await db.collection("quizzes").findOne({
    _id: new ObjectId(id),
    userId,
  });

  if (!quiz) {
    return NextResponse.json({ error: "Quiz not found" }, { status: 404 });
  }

  const questions = await db
    .collection<QuizQuestion>("quizQuestions")
    .find({ quizId: quiz._id })
    .sort({ index: 1 })
    .toArray();

  return NextResponse.json(
    questions.map((q) => ({
      _id: q._id!.toString(),
      index: q.index,
      question: q.question,
      options: q.options,
    }))
  );
}