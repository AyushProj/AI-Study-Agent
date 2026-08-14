"use client";

import { useEffect, useState } from "react";

interface DocumentOption {
  _id: string;
  originalFileName: string;
  status: string;
}

export default function DocumentPicker({
  conversationId,
  selected,
  onChange,
}: {
  conversationId: string;
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const [documents, setDocuments] = useState<DocumentOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setIsLoading(true);
      const res = await fetch(`/api/documents?conversationId=${conversationId}`);
      if (res.ok) {
        setDocuments(await res.json());
      }
      setIsLoading(false);
    }
    load();
  }, [conversationId]);

  function toggle(id: string) {
    if (selected.includes(id)) {
      onChange(selected.filter((s) => s !== id));
    } else {
      onChange([...selected, id]);
    }
  }

  if (isLoading) {
    return <p className="text-xs text-gray-500">Loading documents...</p>;
  }

  const readyDocs = documents.filter((d) => d.status === "ready");

  if (readyDocs.length === 0) {
    return (
      <p className="text-xs text-gray-500">
        No processed documents in this chat yet. Upload one in the Documents tab first.
      </p>
    );
  }

  return (
    <div className="space-y-1.5">
      {readyDocs.map((doc) => (
        <label
          key={doc._id}
          className="flex items-center gap-2 text-sm text-gray-200 cursor-pointer"
        >
          <input
            type="checkbox"
            checked={selected.includes(doc._id)}
            onChange={() => toggle(doc._id)}
            className="accent-white"
          />
          <span className="truncate">{doc.originalFileName}</span>
        </label>
      ))}
    </div>
  );
}
