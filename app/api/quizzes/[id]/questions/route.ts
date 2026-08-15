import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import clientPromise from "@/lib/db";
import { auth } from "@/auth";

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

  const quiz = await db.collection("quizzes").findOne({
    _id: new ObjectId(id),
    userId,
  });

  if (!quiz) {
    return NextResponse.json({ error: "Quiz not found" }, { status: 404 });
  }

  const questions = await db
    .collection("quizQuestions")
    .find({
      quizId: new ObjectId(id),
      userId,
    })
    .sort({ index: 1 })
    .toArray();

  return NextResponse.json(
    questions.map((q) => ({
      _id: q._id.toString(),
      index: q.index,
      question: q.question,
      options: q.options,
    }))
  );
}