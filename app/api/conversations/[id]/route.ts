import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import clientPromise from "@/lib/db";
import { auth } from "@/auth";
import { deleteFile } from "@/lib/storage";

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
    return NextResponse.json({ error: "Title cannot be empty" }, { status: 400 });
  }

  const client = await clientPromise;
  const db = client.db();

  const result = await db.collection("conversations").findOneAndUpdate(
    { _id: new ObjectId(id), userId: new ObjectId(session.user.id) },
    { $set: { title, updatedAt: new Date() } },
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

  const client = await clientPromise;
  const db = client.db();
  const userId = new ObjectId(session.user.id);
  const conversationId = new ObjectId(id);

  const conversation = await db.collection("conversations").findOne({
    _id: conversationId,
    userId,
  });
  if (!conversation) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Cascade delete: each document's file in Cloudinary, then its DB records,
  // then this conversation's messages and chunks, then the conversation itself.
  const documents = await db
    .collection("documents")
    .find({ conversationId, userId })
    .toArray();

  for (const doc of documents) {
    try {
      await deleteFile(doc.storageKey);
    } catch (err) {
      console.error(`Failed to delete storage file for document ${doc._id}:`, err);
    }
  }

  await db.collection("documentChunks").deleteMany({ conversationId });
  await db.collection("documents").deleteMany({ conversationId, userId });
  await db.collection("messages").deleteMany({ conversationId });
  await db.collection("conversations").deleteOne({ _id: conversationId });

  return NextResponse.json({ ok: true });
}