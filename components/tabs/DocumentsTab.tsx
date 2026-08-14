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
  const [uploadProgress, setUploadProgress] = useState<{ [key: string]: number }>({});

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

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const fileKey = `${file.name}-${i}`;
      
      try {
        setUploadProgress((prev) => ({ ...prev, [fileKey]: 0 }));

        const formData = new FormData();
        formData.append("file", file);
        formData.append("conversationId", conversationId);

        const res = await fetch("/api/documents", {
          method: "POST",
          body: formData,
        });

        if (res.ok) {
          const newDoc = await res.json();
          setDocuments((prev) => [newDoc, ...prev]);
          successCount++;
          setUploadProgress((prev) => {
            const updated = { ...prev };
            delete updated[fileKey];
            return updated;
          });
        } else {
          failCount++;
        }
      } catch (err) {
        failCount++;
        console.error(`Failed to upload ${file.name}:`, err);
      }
    }

    setIsUploading(false);
    if (failCount > 0) {
      setError(`Failed to upload ${failCount} file(s)`);
    }
    if (successCount > 0) {
      setTimeout(() => setError(""), 3000);
    }
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
      setError("Failed to delete document");
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
      setError("Failed to rename document");
    }
  }

  function handlePreview(doc: DocumentSummary) {
    window.open(doc.storageUrl, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="h-full flex flex-col overflow-hidden bg-white dark:bg-gray-950">
      {/* Upload Section */}
      <div className="border-b border-gray-200 dark:border-gray-800 p-6 bg-gray-50 dark:bg-gray-900">
        <div className="max-w-2xl">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Upload Documents
          </h2>
          
          <label className="flex flex-col items-center justify-center gap-2 p-6 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition">
            <svg
              className="w-8 h-8 text-gray-400"
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
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Click to upload or drag and drop
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              PDF, DOCX, or TXT (multiple files allowed)
            </span>
            <input
              type="file"
              multiple
              onChange={handleFileSelect}
              disabled={isUploading}
              className="hidden"
              accept=".pdf,.docx,.txt"
            />
          </label>

          {error && (
            <div className="mt-3 p-3 bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 text-sm rounded">
              {error}
            </div>
          )}

          {isUploading && (
            <div className="mt-3 text-sm text-gray-600 dark:text-gray-400">
              Uploading... {Object.keys(uploadProgress).length} file(s)
            </div>
          )}
        </div>
      </div>

      {/* Documents List */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-2xl">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Your Uploaded Documents
          </h3>

          {isLoading ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">Loading documents...</p>
          ) : documents.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              No documents uploaded yet. Upload one above to get started.
            </p>
          ) : (
            <div className="space-y-2">
              {documents.map((doc) => (
                <div
                  key={doc._id}
                  className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg"
                >
                  <div className="flex-1">
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
                        className="w-full px-2 py-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-sm text-gray-900 dark:text-white"
                      />
                    ) : (
                      <>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {doc.originalFileName}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
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
                          className="text-xs px-2 py-1 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded"
                        >
                          Preview
                        </button>
                        <button
                          onClick={() => startEditing(doc)}
                          className="text-xs px-2 py-1 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
                        >
                          Rename
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => handleDelete(doc._id)}
                      className="text-xs px-2 py-1 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded"
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