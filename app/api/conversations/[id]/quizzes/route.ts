import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import clientPromise from "@/lib/db";
import { auth } from "@/auth";
import { getCombinedTextForDocuments, generateQuizQuestions } from "@/lib/generation";
import type { Quiz, QuizQuestion, QuizAttempt } from "@/types/quiz";

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

  const quizzes = await db
    .collection<Quiz>("quizzes")
    .find({ conversationId: new ObjectId(id), userId })
    .sort({ createdAt: -1 })
    .toArray();

  // Attach each quiz's most recent attempt score, if any, so the list can
  // show "last score: 7/10" without a separate round trip per quiz.
  const quizIds = quizzes.map((q) => q._id!);
  const attempts = await db
    .collection<QuizAttempt>("quizAttempts")
    .find({ quizId: { $in: quizIds }, userId })
    .sort({ submittedAt: -1 })
    .toArray();

  const lastAttemptByQuiz = new Map<string, QuizAttempt>();
  for (const attempt of attempts) {
    const key = attempt.quizId.toString();
    if (!lastAttemptByQuiz.has(key)) {
      lastAttemptByQuiz.set(key, attempt);
    }
  }

  const enriched = quizzes.map((q) => {
    const last = lastAttemptByQuiz.get(q._id!.toString());
    return {
      ...q,
      lastScore: last ? { correct: last.score, total: last.total } : null,
    };
  });

  return NextResponse.json(enriched);
}

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
  const documentIds: string[] = Array.isArray(body.documentIds) ? body.documentIds : [];
  const count = [5, 10, 20].includes(body.count) ? body.count : 10;

  if (documentIds.length === 0 || !documentIds.every((d) => ObjectId.isValid(d))) {
    return NextResponse.json({ error: "Select at least one valid document" }, { status: 400 });
  }

  const userId = new ObjectId(session.user.id);
  const conversationId = new ObjectId(id);
  const documentObjectIds = documentIds.map((d) => new ObjectId(d));

  const client = await clientPromise;
  const db = client.db();

  const ownedCount = await db.collection("documents").countDocuments({
    _id: { $in: documentObjectIds },
    userId,
    status: "ready",
  });
  if (ownedCount !== documentObjectIds.length) {
    return NextResponse.json({ error: "One or more documents are invalid" }, { status: 400 });
  }

  const contextText = await getCombinedTextForDocuments(documentObjectIds, userId);
  if (!contextText.trim()) {
    return NextResponse.json({ error: "No text available for selected documents" }, { status: 400 });
  }

  let generated;
  try {
    generated = await generateQuizQuestions(contextText, count);
  } catch (error) {
    console.error("Quiz generation error:", error);
    return NextResponse.json({ error: "Generation failed, please try again" }, { status: 502 });
  }

  const now = new Date();
  const quizResult = await db.collection<Quiz>("quizzes").insertOne({
    userId,
    conversationId,
    documentIds: documentObjectIds,
    title: `Quiz (${generated.length} questions)`,
    questionCount: generated.length,
    createdAt: now,
  } as Quiz);

  const questions: QuizQuestion[] = generated.map((q, index) => ({
    quizId: quizResult.insertedId,
    index,
    question: q.question,
    options: q.options,
    correctIndex: q.correctIndex,
    createdAt: now,
  }));
  await db.collection<QuizQuestion>("quizQuestions").insertMany(questions);

  return NextResponse.json(
    {
      _id: quizResult.insertedId,
      title: `Quiz (${generated.length} questions)`,
      questionCount: generated.length,
      createdAt: now,
      lastScore: null,
    },
    { status: 201 }
  );
}
