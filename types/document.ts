import { ObjectId } from "mongodb";

export type DocumentStatus = "uploading" | "processing" | "ready" | "failed";
export type DocumentFileType = "pdf" | "docx" | "txt";

export interface StudyDocument {
  _id?: ObjectId;
  userId: ObjectId;
  conversationId?: ObjectId;
  fileName: string;
  originalFileName: string;
  fileType: DocumentFileType;
  fileSizeBytes: number;
  storageKey: string; // Cloudinary public_id
  storageUrl: string; // Cloudinary secure_url
  status: DocumentStatus;
  processingError?: string;
  createdAt: Date;
  updatedAt: Date;
}