import { ObjectId } from "mongodb";
import { z } from "zod";
import clientPromise from "@/lib/db";
import { groq, CHAT_MODEL } from "@/lib/groq";
import type { DocumentChunk } from "@/types/chunk";

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
 */
export async function generateFlashcards(
  contextText: string,
  count: number
): Promise<{ question: string; answer: string }[]> {
  const systemPrompt = `You are a study assistant that creates flashcards strictly from the provided text. Base every flashcard only on facts present in the text — never invent information. Return ONLY a JSON array, no other text, no markdown code fences, matching this exact shape:
[{"question": "...", "answer": "..."}]
Generate exactly ${count} flashcards.`;

  for (let attempt = 0; attempt < 2; attempt++) {
    const completion = await groq.chat.completions.create({
      model: CHAT_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: contextText },
      ],
      temperature: 0.4,
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

export async function generateQuizQuestions(
  contextText: string,
  count: number
): Promise<{ question: string; options: string[]; correctIndex: number }[]> {
  const systemPrompt = `You are a study assistant that creates multiple-choice quiz questions strictly from the provided text. Base every question only on facts present in the text — never invent information. Each question must have exactly 4 options with exactly one correct answer. Return ONLY a JSON array, no other text, no markdown code fences, matching this exact shape:
[{"question": "...", "options": ["...", "...", "...", "..."], "correctIndex": 0}]
correctIndex is the 0-based index into options of the correct answer.
Generate exactly ${count} questions.`;

  for (let attempt = 0; attempt < 2; attempt++) {
    const completion = await groq.chat.completions.create({
      model: CHAT_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: contextText },
      ],
      temperature: 0.4,
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
