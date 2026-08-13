"use client";

import { useEffect, useState, useCallback } from "react";

interface DocumentSummary {
  _id: string;
  originalFileName: string;
  fileType: string;
  fileSizeBytes: number;
  status: string;
}

export default function DocumentsTab({ conversationId }: { conversationId: string }) {
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState("");

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
    const file = e.target.files?.[0];
    if (!file) return;

    setError("");
    setIsUploading(true);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("conversationId", conversationId);

    const res = await fetch("/api/documents", {
      method: "POST",
      body: formData,
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Upload failed");
    } else {
      await loadDocuments();
    }

    setIsUploading(false);
    e.target.value = "";
  }

  async function handleDelete(id: string) {
    const res = await fetch(`/api/documents/${id}`, { method: "DELETE" });
    if (res.ok) {
      setDocuments((prev) => prev.filter((d) => d._id !== id));
    }
  }

  return (
    <div className="p-6 text-white max-w-2xl">
      <div className="mb-6">
        <label className="inline-block cursor-pointer rounded bg-white text-black text-sm font-medium px-4 py-2 hover:bg-gray-200">
          {isUploading ? "Uploading..." : "Upload Document"}
          <input
            type="file"
            accept=".pdf,.docx,.txt"
            onChange={handleFileSelect}
            disabled={isUploading}
            className="hidden"
          />
        </label>
        <p className="text-xs text-gray-500 mt-2">PDF, DOCX, or TXT — up to 20MB</p>
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
            className="flex items-center justify-between rounded border border-gray-800 px-4 py-3"
          >
            <div>
              <p className="text-sm">{doc.originalFileName}</p>
              <p className="text-xs text-gray-500">
                {doc.fileType.toUpperCase()} · {(doc.fileSizeBytes / 1024).toFixed(0)} KB ·{" "}
                <span className="capitalize">{doc.status}</span>
              </p>
            </div>
            <button
              onClick={() => handleDelete(doc._id)}
              className="text-xs text-gray-500 hover:text-red-400"
            >
              Delete
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}