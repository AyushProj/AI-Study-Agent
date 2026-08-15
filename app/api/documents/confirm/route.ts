import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import clientPromise from "@/lib/db";
import { auth } from "@/auth";
import { extractText, isExtractable } from "@/lib/textExtraction";
import { chunkText } from "@/lib/chunking";
import { embedText } from "@/lib/embeddings";
import type { DocumentChunk } from "@/types/chunk";

// Processing (fetching the file back, parsing, embedding every chunk) can
// take a while for larger documents — give it more room than the default
// function timeout. On Vercel Hobby this caps around 60s regardless; if
// you're on Pro/Enterprise you can raise it further.
export const maxDuration = 60;

/**
 * Called after the browser has already uploaded a file directly to
 * Cloudinary (using the signature from /api/documents/sign). Saves the
 * document record, then — synchronously, before responding — fetches the
 * file back from Cloudinary, extracts its text, chunks it, and embeds each
 * chunk, moving the document from "processing" to "ready" (or "failed").
 *
 * This route's own request/response is still small JSON either way (no
 * file bytes pass through the browser<->this-route leg), so Vercel's
 * request body limit is a non-issue — only execution *time* is a
 * consideration here, hence maxDuration above.
 */
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const originalFileName = typeof body.originalFileName === "string" ? body.originalFileName : "";
  const fileSizeBytes = typeof body.fileSizeBytes === "number" ? body.fileSizeBytes : 0;
  const storageKey = typeof body.storageKey === "string" ? body.storageKey : "";
  const storageUrl = typeof body.storageUrl === "string" ? body.storageUrl : "";
  const conversationId = typeof body.conversationId === "string" ? body.conversationId : null;

  if (!originalFileName || !storageKey || !storageUrl) {
    return NextResponse.json({ error: "Missing upload metadata" }, { status: 400 });
  }
  if (conversationId && !ObjectId.isValid(conversationId)) {
    return NextResponse.json({ error: "Invalid conversationId" }, { status: 400 });
  }

  const extension = originalFileName.includes(".")
    ? originalFileName.split(".").pop()!.toLowerCase()
    : "file";

  const client = await clientPromise;
  const db = client.db();
  const userId = new ObjectId(session.user.id);
  const now = new Date();
  const conversationObjectId = conversationId ? new ObjectId(conversationId) : undefined;

  const insertResult = await db.collection("documents").insertOne({
    userId,
    conversationId: conversationObjectId,
    fileName: storageKey,
    originalFileName,
    fileType: extension,
    fileSizeBytes,
    storageKey,
    storageUrl,
    status: "processing",
    createdAt: now,
    updatedAt: now,
  });
  const documentId = insertResult.insertedId;

  if (conversationObjectId) {
    await db.collection("conversations").updateOne(
      { _id: conversationObjectId, userId },
      { $addToSet: { documentIds: documentId }, $set: { updatedAt: now } }
    );
  }

  // From here on, failures update the document's status instead of failing
  // the HTTP response — the upload itself already succeeded, so the client
  // should see a "failed" document, not a vanished one.
  try {
    if (!isExtractable(extension)) {
      // Unknown type: keep the file, just skip chat-grounding for it.
      await db.collection("documents").updateOne(
        { _id: documentId },
        {
          $set: {
            status: "ready",
            processingError:
              "Text extraction isn't supported for this file type; file is stored but won't be used as chat context.",
            updatedAt: new Date(),
          },
        }
      );
    } else if (!conversationObjectId) {
      // No conversation to attach chunks to — store the file, skip chunking.
      await db.collection("documents").updateOne(
        { _id: documentId },
        { $set: { status: "ready", updatedAt: new Date() } }
      );
    } else {
      const fileRes = await fetch(storageUrl);
      if (!fileRes.ok) {
        throw new Error(`Could not re-fetch uploaded file (status ${fileRes.status})`);
      }
      const buffer = Buffer.from(await fileRes.arrayBuffer());

      const text = await extractText(buffer, extension);

      if (!text || !text.trim()) {
        await db.collection("documents").updateOne(
          { _id: documentId },
          {
            $set: {
              status: "ready",
              processingError: "No extractable text was found in this file.",
              updatedAt: new Date(),
            },
          }
        );
      } else {
        const chunks = chunkText(text);

        const chunkDocs: DocumentChunk[] = [];
        for (const chunk of chunks) {
          const embedding = await embedText(chunk.text);
          chunkDocs.push({
            documentId,
            conversationId: conversationObjectId,
            userId,
            chunkIndex: chunk.index,
            text: chunk.text,
            embedding,
            createdAt: new Date(),
          });
        }

        if (chunkDocs.length > 0) {
          await db.collection<DocumentChunk>("documentChunks").insertMany(chunkDocs);
        }

        await db.collection("documents").updateOne(
          { _id: documentId },
          { $set: { status: "ready", updatedAt: new Date() } }
        );
      }
    }
  } catch (error) {
    console.error(`Document processing failed for ${documentId}:`, error);
    await db.collection("documents").updateOne(
      { _id: documentId },
      {
        $set: {
          status: "failed",
          processingError: error instanceof Error ? error.message : "Processing failed",
          updatedAt: new Date(),
        },
      }
    );
  }

  const finalDoc = await db.collection("documents").findOne({ _id: documentId });

  return NextResponse.json(
    {
      _id: documentId,
      originalFileName,
      fileType: extension,
      fileSizeBytes,
      status: finalDoc?.status ?? "failed",
      storageUrl,
    },
    { status: 201 }
  );
}