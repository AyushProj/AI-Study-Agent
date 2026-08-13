import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import clientPromise from "@/lib/db";
import { auth } from "@/auth";
import { deleteFile } from "@/lib/storage";

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

  const doc = await db.collection("documents").findOne({
    _id: new ObjectId(id),
    userId: new ObjectId(session.user.id),
  });

  if (!doc) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await deleteFile(doc.storageKey);
  await db.collection("documents").deleteOne({ _id: doc._id });
  await db.collection("documentChunks").deleteMany({ documentId: doc._id });

  return NextResponse.json({ ok: true });
}