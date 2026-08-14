import { ObjectId } from "mongodb";

export type GenerationSource = "documents" | "chat";

export interface FlashcardSet {
  _id?: ObjectId;
  userId: ObjectId;
  conversationId: ObjectId;
  source: GenerationSource;
  documentIds: ObjectId[]; // populated when source === "documents"
  messageIds: ObjectId[]; // populated when source === "chat"
  title: string;
  cardCount: number;
  createdAt: Date;
}

export interface Flashcard {
  _id?: ObjectId;
  setId: ObjectId;
  userId: ObjectId;
  question: string;
  answer: string;
  createdAt: Date;
}