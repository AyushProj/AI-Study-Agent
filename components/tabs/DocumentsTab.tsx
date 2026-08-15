"use client";

import { useEffect, useState, useCallback } from "react";
import OverflowMenu from "../OverflowMenu";

interface DocumentSummary {
  _id: string;
  originalFileName: string;
  fileType: string;
  fileSizeBytes: number;
  status: string;
  storageUrl: string;
}

export default function DocumentsTab({ conversationId }: { conversationId: string }) {
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  const loadDocuments = useCallback(async () => {
    setIsLoading(true);
    const res = await fetch(`/api/documents?conversationId=${conversationId}`);
    if (res.ok) {
      setDocuments(await res.json());
    }
    setIsLoading(false);
  }, [conversationId]);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  async function uploadOne(file: File): Promise<string | null> {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("conversationId", conversationId);

    const res = await fetch("/api/documents", {
      method: "POST",
      body: formData,
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return data.error || `Failed to upload ${file.name}`;
    }
    return null;
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files ? Array.from(e.target.files) : [];
    if (files.length === 0) return;

    setError("");
    setIsUploading(true);
    setUploadProgress({ done: 0, total: files.length });

    // Upload sequentially so we can report per-file progress and surface
    // exactly which file failed, rather than firing them all in parallel.
    const errors: string[] = [];
    for (let i = 0; i < files.length; i++) {
      const failureMessage = await uploadOne(files[i]);
      if (failureMessage) errors.push(failureMessage);
      setUploadProgress({ done: i + 1, total: files.length });
    }

    if (errors.length > 0) {
      setError(
        errors.length === files.length
          ? "All uploads failed."
          : `${errors.length} of ${files.length} uploads failed.`
      );
    }

    await loadDocuments();
    setIsUploading(false);
    setUploadProgress(null);
    e.target.value = "";
  }

  async function handleDelete(id: string) {
    const confirmed = window.confirm("Delete this document? This can't be undone.");
    if (!confirmed) return;

    const previous = documents;
    setDocuments((prev) => prev.filter((d) => d._id !== id));

    const res = await fetch(`/api/documents/${id}`, { method: "DELETE" });
    if (!res.ok) {
      setDocuments(previous);
    }
  }

  function startEditing(doc: DocumentSummary) {
    setEditingId(doc._id);
    setEditValue(doc.originalFileName);
  }

  async function saveRename(id: string) {
    const trimmed = editValue.trim();
    setEditingId(null);
    if (!trimmed) return;

    const previous = documents;
    setDocuments((prev) =>
      prev.map((d) => (d._id === id ? { ...d, originalFileName: trimmed } : d))
    );

    const res = await fetch(`/api/documents/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ originalFileName: trimmed }),
    });

    if (!res.ok) {
      setDocuments(previous);
    }
  }

  function handlePreview(doc: DocumentSummary) {
    window.open(doc.storageUrl, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="p-6 text-white max-w-2xl">
      <h2 className="text-lg font-medium mb-4">Your Uploaded Documents</h2>

      <div className="mb-6">
        <label className="inline-block cursor-pointer rounded bg-white text-black text-sm font-medium px-4 py-2 hover:bg-gray-200">
          {isUploading
            ? uploadProgress
              ? `Uploading ${uploadProgress.done}/${uploadProgress.total}...`
              : "Uploading..."
            : "Upload Documents"}
          <input
            type="file"
            accept=".pdf,.docx,.txt"
            multiple
            onChange={handleFileSelect}
            disabled={isUploading}
            className="hidden"
          />
        </label>
        <p className="text-xs text-gray-500 mt-2">
          PDF, DOCX, or TXT — up to 20MB each. You can select multiple files at once.
        </p>
        {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
      </div>

      {isLoading && <p className="text-gray-500 text-sm">Loading documents...</p>}

      {!isLoading && documents.length === 0 && (
        <p className="text-gray-500 text-sm">No documents uploaded yet.</p>
      )}

      <ul className="space-y-2">
        {documents.map((doc) => (
          <li
            key={doc._id}
            className="group flex items-center justify-between rounded border border-gray-800 px-4 py-3"
          >
            <div className="flex-1 min-w-0">
              {editingId === doc._id ? (
                <input
                  autoFocus
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onBlur={() => saveRename(doc._id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveRename(doc._id);
                    if (e.key === "Escape") setEditingId(null);
                  }}
                  className="bg-transparent border-b border-gray-500 outline-none w-full text-sm text-white"
                />
              ) : (
                <p className="text-sm truncate">{doc.originalFileName}</p>
              )}
              <p className="text-xs text-gray-500">
                {doc.fileType.toUpperCase()} · {(doc.fileSizeBytes / 1024).toFixed(0)} KB ·{" "}
                <span className="capitalize">{doc.status}</span>
              </p>
            </div>
            <div className="opacity-0 group-hover:opacity-100 ml-2">
              <OverflowMenu
                items={[
                  { label: "Preview", onClick: () => handlePreview(doc) },
                  { label: "Rename", onClick: () => startEditing(doc) },
                  { label: "Delete", onClick: () => handleDelete(doc._id), danger: true },
                ]}
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}