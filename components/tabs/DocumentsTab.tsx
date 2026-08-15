"use client";

import { useState, useCallback, useEffect } from "react";

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

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setError("");
    setIsUploading(true);

    try {
      const formData = new FormData();

      Array.from(files).forEach((file) => {
        formData.append("files", file);
      });

      formData.append("conversationId", conversationId);

      const res = await fetch("/api/documents", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Upload failed");
      }

      await loadDocuments();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setIsUploading(false);
      e.target.value = "";
    }
  }

  async function handleDelete(id: string) {
    const confirmDelete = window.confirm("Delete this document?");
    if (!confirmDelete) return;

    const previous = documents;
    setDocuments((prev) => prev.filter((d) => d._id !== id));

    const res = await fetch(`/api/documents/${id}`, { method: "DELETE" });
    if (!res.ok) {
      setDocuments(previous);
      setError("Failed to delete document");
    }
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
      setError("Failed to rename document");
    }
  }

  function handlePreview(doc: DocumentSummary) {
    if (doc.storageUrl) {
      window.open(doc.storageUrl, "_blank", "noopener,noreferrer");
    }
  }

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[var(--background)] text-[var(--foreground)]">
      <div className="border-b border-[var(--border)] bg-[var(--card-bg)] p-6">
        <div className="mx-auto max-w-2xl">
          <h2 className="mb-4 text-lg font-semibold text-[var(--foreground)]">Upload Documents</h2>

          <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-[var(--border)] p-6 text-center">
            <svg
              className="h-8 w-8 text-[var(--foreground-muted)]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10"
              />
            </svg>

            <span className="text-sm font-medium text-[var(--foreground)]">
              Click to upload documents
            </span>

            <span className="text-xs text-[var(--foreground-muted)]">
              PDF, DOCX, TXT — multiple files supported
            </span>

            <input
              type="file"
              accept=".pdf,.docx,.txt"
              multiple
              onChange={handleFileSelect}
              disabled={isUploading}
              className="hidden"
            />
          </label>

          {error && (
            <div className="mt-3 rounded border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
              {error}
            </div>
          )}

          {isUploading && (
            <p className="mt-3 text-sm text-[var(--foreground-muted)]">Uploading files...</p>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-2xl">
          <h3 className="mb-4 text-lg font-semibold text-[var(--foreground)]">
            Your Uploaded Documents
          </h3>

          {isLoading ? (
            <p className="text-[var(--foreground-muted)]">Loading documents...</p>
          ) : documents.length === 0 ? (
            <p className="text-[var(--foreground-muted)]">
              No documents uploaded yet. Upload one above to get started.
            </p>
          ) : (
            <div className="space-y-2">
              {documents.map((doc) => (
                <div
                  key={doc._id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-[var(--border)] bg-[var(--card-bg)] p-3"
                >
                  <div className="min-w-0 flex-1">
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
                        className="w-full rounded border border-[var(--border)] bg-[var(--input-bg)] px-2 py-1 text-[var(--foreground)] outline-none"
                      />
                    ) : (
                      <>
                        <p className="truncate font-medium text-[var(--foreground)]">
                          {doc.originalFileName}
                        </p>
                        <p className="text-xs text-[var(--foreground-muted)]">
                          {doc.status} • {(doc.fileSizeBytes / 1024).toFixed(1)} KB
                        </p>
                      </>
                    )}
                  </div>

                  <div className="flex gap-2">
                    {doc.status === "ready" && (
                      <>
                        <button
                          onClick={() => handlePreview(doc)}
                          className="rounded px-2 py-1 text-xs text-blue-400 hover:bg-blue-500/10"
                        >
                          Preview
                        </button>

                        <button
                          onClick={() => {
                            setEditingId(doc._id);
                            setEditValue(doc.originalFileName);
                          }}
                          className="rounded px-2 py-1 text-xs text-[var(--foreground-muted)] hover:bg-white/5"
                        >
                          Rename
                        </button>
                      </>
                    )}

                    <button
                      onClick={() => handleDelete(doc._id)}
                      className="rounded px-2 py-1 text-xs text-red-400 hover:bg-red-500/10"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}