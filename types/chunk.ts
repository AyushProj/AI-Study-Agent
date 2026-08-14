import type { ObjectId } from "mongodb";

export interface DocumentChunk {
  _id?: ObjectId;
  documentId: ObjectId;
  conversationId: ObjectId;
  userId: ObjectId;
  chunkIndex: number;
  text: string;
  embedding: number[];
  createdAt: Date;
}