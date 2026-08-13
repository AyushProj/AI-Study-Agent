import { ObjectId } from "mongodb";

export interface User {
  _id?: ObjectId;
  email: string;
  passwordHash: string;
  name?: string;
  createdAt: Date;
  updatedAt: Date;
}