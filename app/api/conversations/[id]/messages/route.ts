import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import clientPromise from "@/lib/db";
import { auth } from "@/auth";
import { embedText, cosineSimilarity } from "@/lib/embeddings";
import { groq, CHAT_MODEL } from "@/lib/groq";
import type { DocumentChunk } from "@/types/chunk";
import type { ChatMessage } from "@/types/message";

const TOP_K = 5; // how many chunks to retrieve per question
const HISTORY_LIMIT = 10; // how many recent messages to include for continuity

export async function GET(
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

  const messages = await db
    .collection("messages")
    .find({ conversationId })
    .sort({ createdAt: 1 })
    .toArray();

  return NextResponse.json(messages);
}

export async function POST(
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
  const content = typeof body.content === "string" ? body.content.trim() : "";
  if (!content) {
    return NextResponse.json({ error: "Message cannot be empty" }, { status: 400 });
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

  const now = new Date();

  // Save the user's message first so it's persisted even if generation fails
  await db.collection<ChatMessage>("messages").insertOne({
    conversationId,
    userId,
    role: "user",
    content,
    createdAt: now,
  });

  // Retrieve relevant chunks from documents attached to this conversation
  let contextBlock = "";
  try {
    const chunks = await db
      .collection<DocumentChunk>("documentChunks")
      .find({ conversationId })
      .toArray();

    if (chunks.length > 0) {
      const queryEmbedding = await embedText(content);
      const scored = chunks
        .map((chunk) => ({
          chunk,
          score: cosineSimilarity(queryEmbedding, chunk.embedding),
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, TOP_K);

      contextBlock = scored
        .map(({ chunk }, i) => `[Excerpt ${i + 1}]\n${chunk.text}`)
        .join("\n\n");
    }
  } catch (retrievalError) {
    console.error("Retrieval error:", retrievalError);
    // Fall through with no context rather than failing the whole request
  }

  // Recent history for conversational continuity
  const recentHistory = await db
    .collection<ChatMessage>("messages")
    .find({ conversationId })
    .sort({ createdAt: -1 })
    .limit(HISTORY_LIMIT)
    .toArray();
  recentHistory.reverse();

  const systemPrompt = contextBlock
    ? `You are a helpful study assistant. Use the document excerpts below to answer the user's question when they're relevant. If the excerpts don't contain the answer, say so explicitly and then answer from general knowledge instead.\n\nDocument excerpts:\n${contextBlock}`
    : `You are a helpful study assistant. No relevant document excerpts were found, so answer from general knowledge.`;

  const groqMessages = [
    { role: "system" as const, content: systemPrompt },
    ...recentHistory.map((m) => ({
      role: m.role,
      content: m.content,
    })),
  ];

  let stream;
  try {
    stream = await groq.chat.completions.create({
      model: CHAT_MODEL,
      messages: groqMessages,
      stream: true,
      temperature: 0.3,
    });
  } catch (groqError) {
    console.error("Groq request error:", groqError);
    return NextResponse.json({ error: "Failed to reach the AI model" }, { status: 502 });
  }

  const encoder = new TextEncoder();
  let fullResponse = "";

  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const part of stream) {
          const token = part.choices[0]?.delta?.content || "";
          if (token) {
            fullResponse += token;
            controller.enqueue(encoder.encode(token));
          }
        }
      } catch (streamError) {
        console.error("Groq stream error:", streamError);
      } finally {
        controller.close();
        await db.collection<ChatMessage>("messages").insertOne({
          conversationId,
          userId,
          role: "assistant",
          content: fullResponse || "Sorry, I couldn't generate a response.",
          createdAt: new Date(),
        });
        await db
          .collection("conversations")
          .updateOne({ _id: conversationId }, { $set: { updatedAt: new Date() } });
      }
    },
  });

  return new Response(readable, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}