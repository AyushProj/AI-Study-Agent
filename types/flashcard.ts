import { ObjectId } from "mongodb";

export interface FlashcardSet {
  _id?: ObjectId;
  userId: ObjectId;
  conversationId: ObjectId;
  documentIds: ObjectId[];
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
