import pdfParse from "pdf-parse";
import mammoth from "mammoth";

const EXTRACTABLE_TYPES = new Set(["pdf", "docx", "txt"]);

export function isExtractable(fileType: string): boolean {
  return EXTRACTABLE_TYPES.has(fileType.toLowerCase());
}

/**
 * Extracts plain text from an uploaded file buffer based on its detected type.
 * Returns null (rather than throwing) for file types we don't know how to
 * parse, so an unsupported type just skips chat-grounding instead of
 * failing the whole upload — the file is still stored and downloadable.
 */
export async function extractText(
  buffer: Buffer,
  fileType: string
): Promise<string | null> {
  switch (fileType.toLowerCase()) {
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
    default:
      return null;
  }
}