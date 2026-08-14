import Groq from "groq-sdk";

const apiKey = process.env.GROQ_API_KEY;

if (!apiKey) {
  throw new Error("Missing GROQ_API_KEY in .env.local");
}

export const groq = new Groq({ apiKey });

// Fast + capable general-purpose model on Groq. Swap freely for another
// hosted model (see https://console.groq.com/docs/models) if you prefer.
export const CHAT_MODEL = "llama-3.3-70b-versatile";