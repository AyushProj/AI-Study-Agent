import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import clientPromise from "@/lib/db";
import { auth } from "@/auth";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const client = await clientPromise;
  const db = client.db();

  const conversations = await db
    .collection("conversations")
    .find({ userId: new ObjectId(session.user.id) })
    .sort({ updatedAt: -1 })
    .toArray();

  return NextResponse.json(conversations);
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const title = typeof body.title === "string" && body.title.trim() ? body.title.trim() : "New Chat";

  const client = await clientPromise;
  const db = client.db();

  const now = new Date();
  const result = await db.collection("conversations").insertOne({
    userId: new ObjectId(session.user.id),
    documentIds: [],
    title,
    createdAt: now,
    updatedAt: now,
  });

  return NextResponse.json(
    { _id: result.insertedId, title, documentIds: [], createdAt: now, updatedAt: now },
    { status: 201 }
  );
}