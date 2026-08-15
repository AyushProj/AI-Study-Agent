import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import clientPromise from "@/lib/db";
import { auth } from "@/auth";

/**
 * Called after the browser has already uploaded a file directly to
 * Cloudinary (using the signature from /api/documents/sign). This just
 * persists the resulting metadata — no file bytes pass through here, so
 * Vercel's request body limit is a non-issue.
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

  // "All file types" per your last request — store whatever extension the
  // file has (lowercased), rather than restricting to a fixed set. If
  // types/document.ts declares DocumentFileType as a strict union
  // ("pdf" | "docx" | "txt"), widen it to `string` or it won't compile.
  const extension = originalFileName.includes(".")
    ? originalFileName.split(".").pop()!.toLowerCase()
    : "file";

  const client = await clientPromise;
  const db = client.db();
  const userId = new ObjectId(session.user.id);
  const now = new Date();

  const result = await db.collection("documents").insertOne({
    userId,
    conversationId: conversationId ? new ObjectId(conversationId) : undefined,
    fileName: storageKey,
    originalFileName,
    fileType: extension,
    fileSizeBytes,
    storageKey,
    storageUrl,
    status: "uploading", // becomes "processing" -> "ready" once your extraction pipeline picks it up
    createdAt: now,
    updatedAt: now,
  });

  if (conversationId) {
    await db.collection("conversations").updateOne(
      { _id: new ObjectId(conversationId), userId },
      { $addToSet: { documentIds: result.insertedId }, $set: { updatedAt: now } }
    );
  }

  return NextResponse.json(
    {
      _id: result.insertedId,
      originalFileName,
      fileType: extension,
      fileSizeBytes,
      status: "uploading",
      storageUrl,
    },
    { status: 201 }
  );
}