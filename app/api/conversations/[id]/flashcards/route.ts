import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import clientPromise from "@/lib/db";
import { auth } from "@/auth";
import {
  getCombinedTextForDocuments,
  getCombinedTextForMessages,
  generateFlashcards,
} from "@/lib/generation";
import type { FlashcardSet, Flashcard, GenerationSource } from "@/types/flashcard";

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

  const client = await clientPromise;
  const db = client.db();

  const sets = await db
    .collection<FlashcardSet>("flashcardSets")
    .find({ conversationId: new ObjectId(id), userId: new ObjectId(session.user.id) })
    .sort({ createdAt: -1 })
    .toArray();

  return NextResponse.json(sets);
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
  const count = typeof body.count === "number" ? body.count : 10;

  if (count < 1 || count > 30) {
    return NextResponse.json({ error: "Card count must be between 1 and 30" }, { status: 400 });
  }

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

    // Ownership check: every requested message must actually belong to this
    // user and conversation — don't trust client-supplied IDs blindly.
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

  let generated;
  try {
    generated = await generateFlashcards(contextText, count);
  } catch (error) {
    console.error("Flashcard generation error:", error);
    return NextResponse.json({ error: "Generation failed, please try again" }, { status: 502 });
  }

  const now = new Date();
  const setResult = await db.collection<FlashcardSet>("flashcardSets").insertOne({
    userId,
    conversationId,
    source,
    documentIds: documentObjectIds,
    messageIds: messageObjectIds,
    title: `Flashcards (${generated.length})`,
    cardCount: generated.length,
    createdAt: now,
  } as FlashcardSet);

  const cards: Flashcard[] = generated.map((c) => ({
    setId: setResult.insertedId,
    userId,
    question: c.question,
    answer: c.answer,
    createdAt: now,
  }));
  await db.collection<Flashcard>("flashcards").insertMany(cards);

  return NextResponse.json(
    {
      _id: setResult.insertedId,
      title: `Flashcards (${generated.length})`,
      cardCount: generated.length,
      createdAt: now,
    },
    { status: 201 }
  );
}