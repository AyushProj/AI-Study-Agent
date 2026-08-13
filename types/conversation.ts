import { ObjectId } from "mongodb";

export interface Conversation {
  _id?: ObjectId;
  userId: ObjectId;
  documentIds: ObjectId[];
  title: string;
  createdAt: Date;
  updatedAt: Date;
}