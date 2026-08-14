import pdfParse from "pdf-parse";
import mammoth from "mammoth";
import type { DocumentFileType } from "@/types/document";

/**
 * Extracts plain text from an uploaded file buffer based on its detected type.
 * Throws if the file type is unsupported or the buffer can't be parsed.
 */
export async function extractText(
  buffer: Buffer,
  fileType: DocumentFileType
): Promise<string> {
  switch (fileType) {
    case "pdf": {
      const result = await pdfParse(buffer);
      return result.text;
    }
    case "docx": {
      const result = await mammoth.extractRawText({ buffer });
      return result.value;
    }
    case "txt": {
      return buffer.toString("utf-8");
    }
    default: {
      const _exhaustive: never = fileType;
      throw new Error(`Unsupported file type: ${_exhaustive}`);
    }
  }
}