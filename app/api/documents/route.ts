import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import clientPromise from "@/lib/db";
import { auth } from "@/auth";

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