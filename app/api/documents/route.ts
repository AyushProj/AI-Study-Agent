import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import clientPromise from "@/lib/db";
import { auth } from "@/auth";
import { uploadFile } from "@/lib/storage";
import { extractText } from "@/lib/textExtraction";
import { chunkText } from "@/lib/chunking";
import { embedText } from "@/lib/embeddings";
import type { DocumentFileType } from "@/types/document";
import type { DocumentChunk } from "@/types/chunk";

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
    const userId = new ObjectId(session.user.id);
    const conversationObjectId = conversationId ? new ObjectId(conversationId) : undefined;

    const result = await db.collection("documents").insertOne({
      userId,
      conversationId: conversationObjectId,
      fileName: storageKey,
      originalFileName: file.name,
      fileType,
      fileSizeBytes: file.size,
      storageKey,
      storageUrl,
      status: "processing",
      createdAt: now,
      updatedAt: now,
    });

    // Link this document to the conversation, if one was provided
    if (conversationObjectId) {
      await db.collection("conversations").updateOne(
        { _id: conversationObjectId, userId },
        { $addToSet: { documentIds: result.insertedId }, $set: { updatedAt: now } }
      );
    }

    // Extract -> chunk -> embed -> store. Runs synchronously so the response
    // reflects the final status; simplest option, no background job/queue.
    let finalStatus: "ready" | "failed" = "ready";

    if (!conversationObjectId) {
      // RAG chunks are scoped to a conversation. A document uploaded without
      // one has nothing to attach chunks to, so skip processing for it.
      finalStatus = "ready";
    } else {
      try {
        const text = await extractText(buffer, fileType);
        const rawChunks = chunkText(text);

        if (rawChunks.length === 0) {
          throw new Error("No extractable text found in document");
        }

        const chunkDocs: DocumentChunk[] = [];
        for (const chunk of rawChunks) {
          const embedding = await embedText(chunk.text);
          chunkDocs.push({
            documentId: result.insertedId,
            conversationId: conversationObjectId,
            userId,
            chunkIndex: chunk.index,
            text: chunk.text,
            embedding,
            createdAt: now,
          });
        }

        await db.collection<DocumentChunk>("documentChunks").insertMany(chunkDocs);
      } catch (processingError) {
        console.error("Document processing error:", processingError);
        finalStatus = "failed";
      }
    }

    await db.collection("documents").updateOne(
      { _id: result.insertedId },
      { $set: { status: finalStatus, updatedAt: new Date() } }
    );

    return NextResponse.json(
      {
        _id: result.insertedId,
        originalFileName: file.name,
        fileType,
        fileSizeBytes: file.size,
        status: finalStatus,
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