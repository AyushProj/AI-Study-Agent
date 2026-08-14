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

  const apiKeys = await db
    .collection("apiKeys")
    .find({ userId: new ObjectId(session.user.id) })
    .project({ key: 0 }) // Don't send full key to frontend
    .toArray();

  return NextResponse.json(apiKeys);
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const { name, key } = body;

  if (!name?.trim() || !key?.trim()) {
    return NextResponse.json({ error: "Name and key required" }, { status: 400 });
  }

  const client = await clientPromise;
  const db = client.db();
  const userId = new ObjectId(session.user.id);

  const result = await db.collection("apiKeys").insertOne({
    userId,
    name: name.trim(),
    key: key.trim(),
    createdAt: new Date(),
  });

  return NextResponse.json({
    id: result.insertedId,
    name: name.trim(),
    key: key.substring(0, 8) + "..." + key.substring(key.length - 4),
  });
}