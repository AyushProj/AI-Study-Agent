import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import clientPromise from "@/lib/db";
import { auth } from "@/auth";
import { uploadFile } from "@/lib/storage";
import type { DocumentFileType } from "@/types/document";

const MAX_SIZE_BYTES = 20 * 1024 * 1024; // 20MB
const ALLOWED_TYPES: Record<string, DocumentFileType> = {
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "text/plain": "txt",
};

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const conversationId = formData.get("conversationId") as string | null;

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  const fileType = ALLOWED_TYPES[file.type];
  if (!fileType) {
    return NextResponse.json(
      { error: "Unsupported file type. Only PDF, DOCX, and TXT are allowed." },
      { status: 400 }
    );
  }

  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json(
      { error: "File too large. Maximum size is 20MB." },
      { status: 400 }
    );
  }

  if (conversationId && !ObjectId.isValid(conversationId)) {
    return NextResponse.json({ error: "Invalid conversationId" }, { status: 400 });
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const { storageKey, storageUrl } = await uploadFile(
      buffer,
      session.user.id,
      file.name
    );

    const client = await clientPromise;
    const db = client.db();
    const now = new Date();

    const result = await db.collection("documents").insertOne({
      userId: new ObjectId(session.user.id),
      conversationId: conversationId ? new ObjectId(conversationId) : undefined,
      fileName: storageKey,
      originalFileName: file.name,
      fileType,
      fileSizeBytes: file.size,
      storageKey,
      storageUrl,
      status: "uploading", // becomes "processing" -> "ready" in Phase 3
      createdAt: now,
      updatedAt: now,
    });

    // Link this document to the conversation, if one was provided
    if (conversationId) {
      await db.collection("conversations").updateOne(
        { _id: new ObjectId(conversationId), userId: new ObjectId(session.user.id) },
        { $addToSet: { documentIds: result.insertedId }, $set: { updatedAt: now } }
      );
    }

    return NextResponse.json(
      {
        _id: result.insertedId,
        originalFileName: file.name,
        fileType,
        fileSizeBytes: file.size,
        status: "uploading",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const conversationId = searchParams.get("conversationId");

  const client = await clientPromise;
  const db = client.db();

  const filter: Record<string, unknown> = { userId: new ObjectId(session.user.id) };
  if (conversationId && ObjectId.isValid(conversationId)) {
    filter.conversationId = new ObjectId(conversationId);
  }

  const documents = await db
    .collection("documents")
    .find(filter)
    .sort({ createdAt: -1 })
    .toArray();

  return NextResponse.json(documents);
}