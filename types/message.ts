import type { ObjectId } from "mongodb";

export type MessageRole = "user" | "assistant";

export interface ChatMessage {
  _id?: ObjectId;
  conversationId: ObjectId;
  userId: ObjectId;
  role: MessageRole;
  content: string;
  createdAt: Date;
}