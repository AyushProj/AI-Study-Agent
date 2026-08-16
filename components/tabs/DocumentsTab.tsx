"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import Spinner from "../Spinner";
import EmptyState from "../EmptyState";
import ErrorBanner from "../ErrorBanner";

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
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);
  // Counts nested dragenter/dragleave events so the dropzone doesn't flicker
  // as the pointer passes over child elements (the icon, the text, etc).
  const dragCounter = useRef(0);

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

  // Uploads one file directly to Cloudinary (bypassing our own API for the
  // actual bytes), then tells our backend the upload is done so it can save
  // the DB record. This is what keeps large files off Vercel's 4.5MB
  // serverless function payload limit — only small JSON ever hits our API.
  const uploadOne = useCallback(
    async (file: File) => {
      const signRes = await fetch("/api/documents/sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName: file.name }),
      });
      if (!signRes.ok) {
        throw new Error(`Could not authorize upload for ${file.name}`);
      }
      const { signature, timestamp, folder, publicId, apiKey, cloudName } =
        await signRes.json();

      const cloudinaryForm = new FormData();
      cloudinaryForm.append("file", file);
      cloudinaryForm.append("api_key", apiKey);
      cloudinaryForm.append("timestamp", String(timestamp));
      cloudinaryForm.append("signature", signature);
      cloudinaryForm.append("folder", folder);
      cloudinaryForm.append("public_id", publicId);

      const uploadRes = await fetch(
        `https://api.cloudinary.com/v1_1/${cloudName}/raw/upload`,
        { method: "POST", body: cloudinaryForm }
      );
      if (!uploadRes.ok) {
        const data = await uploadRes.json().catch(() => null);
        throw new Error(data?.error?.message || `Upload to storage failed for ${file.name}`);
      }
      const uploadData = await uploadRes.json();

      const confirmRes = await fetch("/api/documents/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          originalFileName: file.name,
          fileSizeBytes: file.size,
          storageKey: uploadData.public_id,
          storageUrl: uploadData.secure_url,
          conversationId,
        }),
      });
      if (!confirmRes.ok) {
        const data = await confirmRes.json().catch(() => null);
        throw new Error(data?.error || `Could not save ${file.name}`);
      }
    },
    [conversationId]
  );

  const uploadFiles = useCallback(
    async (fileList: FileList | File[]) => {
      const files = Array.from(fileList);
      if (files.length === 0) return;

      setError("");
      setIsUploading(true);

      const failures: string[] = [];
      for (const file of files) {
        try {
          await uploadOne(file);
        } catch (err) {
          failures.push(err instanceof Error ? err.message : `Failed to upload ${file.name}`);
        }
      }

      if (failures.length > 0) {
        setError(failures.join(" — "));
      }

      await loadDocuments();
      setIsUploading(false);
    },
    [loadDocuments, uploadOne]
  );

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (files && files.length > 0) {
      await uploadFiles(files);
    }
    e.target.value = "";
  }

  function handleDragEnter(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    // Only react to actual file drags, not text/link drags.
    if (!e.dataTransfer.types.includes("Files")) return;
    dragCounter.current += 1;
    setIsDragging(true);
  }

  function handleDragOver(e: React.DragEvent) {
    // Required — without preventDefault() here, onDrop never fires.
    e.preventDefault();
    e.stopPropagation();
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current -= 1;
    if (dragCounter.current <= 0) {
      dragCounter.current = 0;
      setIsDragging(false);
    }
  }

  async function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current = 0;
    setIsDragging(false);

    if (isUploading) return;

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      await uploadFiles(files);
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

          <div
            onClick={() => !isUploading && fileInputRef.current?.click()}
            onDragEnter={handleDragEnter}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") fileInputRef.current?.click();
            }}
            className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 text-center transition-colors ${
              isDragging
                ? "border-accent bg-accent/10"
                : "border-[var(--border)] hover:border-[var(--foreground-muted)]"
            } ${isUploading ? "pointer-events-none opacity-60" : ""}`}
          >
            <svg
              className={`h-8 w-8 ${isDragging ? "text-accent" : "text-[var(--foreground-muted)]"}`}
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
              {isDragging ? "Drop to upload" : "Click to upload, or drag and drop files here"}
            </span>

            <span className="text-xs text-[var(--foreground-muted)]">
              Any file type — multiple files supported
            </span>

            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={handleFileSelect}
              disabled={isUploading}
              className="hidden"
            />
          </div>

          {error && (
            <div className="mt-3">
              <ErrorBanner message={error} />
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
            <Spinner label="Loading documents..." />
          ) : documents.length === 0 ? (
            <EmptyState
              icon={
                <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
              }
              title="No documents yet"
              description="Upload a document above to start building your study material."
            />
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