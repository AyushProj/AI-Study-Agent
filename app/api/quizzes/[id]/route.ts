import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import clientPromise from "@/lib/db";
import { auth } from "@/auth";
import type { QuizQuestion } from "@/types/quiz";

export async function GET(
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

  // Strip correctIndex before sending to the client — grading only happens
  // server-side, on submit.
  const safeQuestions = questions.map((q) => ({
    _id: q._id,
    index: q.index,
    question: q.question,
    options: q.options,
  }));

  return NextResponse.json({ quiz, questions: safeQuestions });
}

export async function PATCH(
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
  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!title) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }

  const userId = new ObjectId(session.user.id);
  const client = await clientPromise;
  const db = client.db();

  const result = await db.collection("quizzes").findOneAndUpdate(
    { _id: new ObjectId(id), userId },
    { $set: { title } },
    { returnDocument: "after" }
  );

  if (!result) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(result);
}

export async function DELETE(
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

  const userId = new ObjectId(session.user.id);
  const client = await clientPromise;
  const db = client.db();

  const quiz = await db.collection("quizzes").findOne({
    _id: new ObjectId(id),
    userId,
  });
  if (!quiz) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Cascade: remove questions and any attempt history tied to this quiz.
  await db.collection("quizQuestions").deleteMany({ quizId: quiz._id });
  await db.collection("quizAttempts").deleteMany({ quizId: quiz._id });
  await db.collection("quizzes").deleteOne({ _id: quiz._id });

  return NextResponse.json({ success: true });
}