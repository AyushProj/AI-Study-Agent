import { ObjectId } from "mongodb";

export type DocumentStatus = "uploading" | "processing" | "ready" | "failed";

// Widened from a strict "pdf" | "docx" | "txt" union to support arbitrary
// file types (per the drag-and-drop "any file type" request). Text
// extraction still only runs for pdf/docx/txt — see lib/textExtraction.ts —
// anything else is stored and downloadable but not chat-searchable.
export type DocumentFileType = string;

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