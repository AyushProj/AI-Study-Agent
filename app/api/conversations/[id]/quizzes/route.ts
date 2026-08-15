import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import clientPromise from "@/lib/db";
import { auth } from "@/auth";
import {
  getCombinedTextForDocuments,
  getCombinedTextForMessages,
  generateQuizQuestions,
} from "@/lib/generation";
import type { Quiz, QuizQuestion, QuizAttempt, GenerationSource } from "@/types/quiz";

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
  const source: GenerationSource = body.source === "chat" ? "chat" : "documents";
  const count = [5, 10, 20].includes(body.count) ? body.count : 10;

  const userId = new ObjectId(session.user.id);
  const conversationId = new ObjectId(id);

  const client = await clientPromise;
  const db = client.db();

  let contextText = "";
  let documentObjectIds: ObjectId[] = [];
  let messageObjectIds: ObjectId[] = [];

  if (source === "chat") {
    const messageIds: string[] = Array.isArray(body.messageIds) ? body.messageIds : [];
    if (messageIds.length === 0 || !messageIds.every((m) => ObjectId.isValid(m))) {
      return NextResponse.json(
        { error: "Select at least one part of the conversation" },
        { status: 400 }
      );
    }
    messageObjectIds = messageIds.map((m) => new ObjectId(m));

    const ownedCount = await db.collection("messages").countDocuments({
      _id: { $in: messageObjectIds },
      conversationId,
      userId,
    });
    if (ownedCount !== messageObjectIds.length) {
      return NextResponse.json({ error: "One or more messages are invalid" }, { status: 400 });
    }

    contextText = await getCombinedTextForMessages(messageObjectIds, conversationId, userId);
  } else {
    const documentIds: string[] = Array.isArray(body.documentIds) ? body.documentIds : [];
    if (documentIds.length === 0 || !documentIds.every((d) => ObjectId.isValid(d))) {
      return NextResponse.json({ error: "Select at least one valid document" }, { status: 400 });
    }
    documentObjectIds = documentIds.map((d) => new ObjectId(d));

    const ownedCount = await db.collection("documents").countDocuments({
      _id: { $in: documentObjectIds },
      userId,
      status: "ready",
    });
    if (ownedCount !== documentObjectIds.length) {
      return NextResponse.json({ error: "One or more documents are invalid" }, { status: 400 });
    }

    contextText = await getCombinedTextForDocuments(documentObjectIds, userId);
  }

  if (!contextText.trim()) {
    return NextResponse.json({ error: "No text available to generate from" }, { status: 400 });
  }

  // Pull question text from every prior quiz in this conversation, so
  // regenerating doesn't just hand back a set the model already produced.
  const priorQuizIds = (
    await db.collection<Quiz>("quizzes").find({ conversationId, userId }).project({ _id: 1 }).toArray()
  ).map((q) => q._id);

  const priorQuestions = await db
    .collection<QuizQuestion>("quizQuestions")
    .find({ quizId: { $in: priorQuizIds } })
    .project<{ question: string }>({ question: 1, _id: 0 })
    .toArray();

  const excludeQuestions = priorQuestions.map((q) => q.question);

  let generated;
  try {
    generated = await generateQuizQuestions(contextText, count, excludeQuestions);
  } catch (error) {
    console.error("Quiz generation error:", error);
    return NextResponse.json({ error: "Generation failed, please try again" }, { status: 502 });
  }

  const now = new Date();
  const quizResult = await db.collection<Quiz>("quizzes").insertOne({
    userId,
    conversationId,
    source,
    documentIds: documentObjectIds,
    messageIds: messageObjectIds,
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