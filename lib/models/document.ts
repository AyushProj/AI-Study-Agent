// lib/models/document.ts
import { ObjectId } from "mongodb";

export type DocumentStatus = "processing" | "ready" | "failed";
export type FileType = "pdf" | "docx" | "txt";

export interface DocumentModel {
  _id: ObjectId;
  userId: ObjectId;
  conversationId: ObjectId;

  originalFileName: string;
  fileType: FileType;
  fileSizeBytes: number;

  storageKey: string;   // Cloudinary public_id, from UploadResult
  storageUrl: string;   // Cloudinary secure_url, from UploadResult

  extractedText: string | null;   // populated after text extraction, used for chat context
  status: DocumentStatus;         // "processing" while extracting, "ready" once extractedText is set
  errorMessage: string | null;    // populated if status === "failed"

  createdAt: Date;
  updatedAt: Date;
}