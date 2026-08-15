import { ObjectId } from "mongodb";
import { z } from "zod";
import clientPromise from "@/lib/db";
import { groq, CHAT_MODEL } from "@/lib/groq";
import type { DocumentChunk } from "@/types/chunk";
import type { ChatMessage } from "@/types/message";

const MAX_CONTEXT_CHARS = 12000; // keep prompts small/cheap; enough for solid generation

/**
 * Pulls all chunk text for the given documents (owned by the given user),
 * in original order, joined into one string, capped to a max length so a
 * huge document doesn't blow up token usage/cost.
 */
export async function getCombinedTextForDocuments(
  documentIds: ObjectId[],
  userId: ObjectId
): Promise<string> {
  const client = await clientPromise;
  const db = client.db();

  const chunks = await db
    .collection<DocumentChunk>("documentChunks")
    .find({ documentId: { $in: documentIds }, userId })
    .sort({ documentId: 1, chunkIndex: 1 })
    .toArray();

  const combined = chunks.map((c) => c.text).join("\n\n");
  return combined.slice(0, MAX_CONTEXT_CHARS);
}

/**
 * Pulls the text of the given chat messages (owned by the given user, in
 * the given conversation), in chronological order, formatted as Q/A pairs
 * so the model has clear turn structure to generate from. Capped the same
 * way as the document path.
 */
export async function getCombinedTextForMessages(
  messageIds: ObjectId[],
  conversationId: ObjectId,
  userId: ObjectId
): Promise<string> {
  const client = await clientPromise;
  const db = client.db();

  const messages = await db
    .collection<ChatMessage>("messages")
    .find({ _id: { $in: messageIds }, conversationId, userId })
    .sort({ createdAt: 1 })
    .toArray();

  const combined = messages
    .map((m) => `${m.role === "user" ? "Q" : "A"}: ${m.content}`)
    .join("\n\n");
  return combined.slice(0, MAX_CONTEXT_CHARS);
}

/**
 * Builds the "don't repeat yourself" block of the prompt. Kept as a
 * separate helper since both flashcards and quiz generation need it.
 * Truncates to a reasonable number of prior questions so the exclusion
 * list itself doesn't dominate the prompt/context budget.
 */
function buildAvoidRepeatsBlock(excludeQuestions: string[]): string {
  if (excludeQuestions.length === 0) return "";
  const recent = excludeQuestions.slice(-40); // most recent N are most likely to be top-of-mind duplicates
  return `\n\nThe following questions have already been used for this material. Do NOT repeat any of them, and do NOT generate close paraphrases of them — cover different facts, details, or angles from the source text instead:\n${recent
    .map((q) => `- ${q}`)
    .join("\n")}`;
}

const flashcardSchema = z.object({
  question: z.string().min(1),
  answer: z.string().min(1),
});
const flashcardBatchSchema = z.array(flashcardSchema).min(1);

/**
 * Asks the LLM for `count` flashcards grounded in `contextText`. Validates
 * the response against a schema; retries once on invalid output; throws if
 * it still fails, so the caller can surface a clean error instead of saving
 * garbage.
 *
 * `excludeQuestions` should be the question text of any flashcards already
 * generated for this same document/conversation, so regenerating doesn't
 * just hand back the same set again.
 */
export async function generateFlashcards(
  contextText: string,
  count: number,
  excludeQuestions: string[] = []
): Promise<{ question: string; answer: string }[]> {
  // A random per-call nonce nudges the model away from its most likely /
  // "default" completion for the same input, which is the main reason
  // regenerating from the same source text kept producing the same set.
  const sessionNonce = Math.random().toString(36).slice(2, 10);

  const systemPrompt = `You are a study assistant that creates flashcards strictly from the provided text. Base every flashcard only on facts present in the text — never invent information. Vary which facts, sections, and details you draw on each time you're called, rather than always picking the most obvious ones first. Return ONLY a JSON array, no other text, no markdown code fences, matching this exact shape:
[{"question": "...", "answer": "..."}]
Generate exactly ${count} flashcards.${buildAvoidRepeatsBlock(excludeQuestions)}

(session: ${sessionNonce})`;

  for (let attempt = 0; attempt < 2; attempt++) {
    const completion = await groq.chat.completions.create({
      model: CHAT_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: contextText },
      ],
      temperature: 0.9,
      top_p: 0.95,
    });

    const raw = completion.choices[0]?.message?.content ?? "";
    const parsed = tryParseJson(raw);
    const result = flashcardBatchSchema.safeParse(parsed);

    if (result.success) {
      return result.data;
    }
  }

  throw new Error("Failed to generate valid flashcards after retry");
}

const quizQuestionSchema = z.object({
  question: z.string().min(1),
  options: z.array(z.string().min(1)).length(4),
  correctIndex: z.number().int().min(0).max(3),
});
const quizBatchSchema = z.array(quizQuestionSchema).min(1);

/**
 * `excludeQuestions` should be the question text of any quiz questions
 * already generated for this same document/conversation, for the same
 * reason as generateFlashcards above.
 */
export async function generateQuizQuestions(
  contextText: string,
  count: number,
  excludeQuestions: string[] = []
): Promise<{ question: string; options: string[]; correctIndex: number }[]> {
  const sessionNonce = Math.random().toString(36).slice(2, 10);

  const systemPrompt = `You are a study assistant that creates multiple-choice quiz questions strictly from the provided text. Base every question only on facts present in the text — never invent information. Vary which facts, sections, and details you draw on each time you're called, rather than always picking the most obvious ones first. Each question must have exactly 4 options with exactly one correct answer, and the correct answer's position should be varied (don't always put it first). Return ONLY a JSON array, no other text, no markdown code fences, matching this exact shape:
[{"question": "...", "options": ["...", "...", "...", "..."], "correctIndex": 0}]
correctIndex is the 0-based index into options of the correct answer.
Generate exactly ${count} questions.${buildAvoidRepeatsBlock(excludeQuestions)}

(session: ${sessionNonce})`;

  for (let attempt = 0; attempt < 2; attempt++) {
    const completion = await groq.chat.completions.create({
      model: CHAT_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: contextText },
      ],
      temperature: 0.9,
      top_p: 0.95,
    });

    const raw = completion.choices[0]?.message?.content ?? "";
    const parsed = tryParseJson(raw);
    const result = quizBatchSchema.safeParse(parsed);

    if (result.success) {
      return result.data;
    }
  }

  throw new Error("Failed to generate valid quiz questions after retry");
}

function tryParseJson(raw: string): unknown {
  // Models sometimes wrap JSON in ```json fences despite instructions not to.
  const cleaned = raw.replace(/```json|```/g, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}