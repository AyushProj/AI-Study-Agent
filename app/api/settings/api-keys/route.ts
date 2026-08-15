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

  const results = await db
    .collection("apiKeys")
    .find({ userId: new ObjectId(session.user.id) })
    .sort({ createdAt: -1 })
    .toArray();

  return NextResponse.json(
    results.map((item) => ({
      id: item._id.toString(),
      name: item.name,
      key: item.key,
    }))
  );
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const { name, key } = body;

  if (!name || !key) {
    return NextResponse.json({ error: "Name and key are required." }, { status: 400 });
  }

  const client = await clientPromise;
  const db = client.db();

  const inserted = await db.collection("apiKeys").insertOne({
    userId: new ObjectId(session.user.id),
    name: String(name).trim(),
    key: String(key).trim(),
    createdAt: new Date(),
  });

  return NextResponse.json({
    id: inserted.insertedId.toString(),
    name: String(name).trim(),
    key: String(key).trim(),
  });
}