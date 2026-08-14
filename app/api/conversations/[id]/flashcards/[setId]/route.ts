import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import clientPromise from "@/lib/db";
import { auth } from "@/auth";
import type { Flashcard } from "@/types/flashcard";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; setId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { setId } = await params;
  if (!ObjectId.isValid(setId)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const userId = new ObjectId(session.user.id);
  const client = await clientPromise;
  const db = client.db();

  const set = await db.collection("flashcardSets").findOne({
    _id: new ObjectId(setId),
    userId,
  });
  if (!set) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const cards = await db
    .collection<Flashcard>("flashcards")
    .find({ setId: set._id, userId })
    .sort({ _id: 1 })
    .toArray();

  return NextResponse.json({ set, cards });
}
