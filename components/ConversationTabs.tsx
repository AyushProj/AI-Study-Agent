"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

const TABS = [
  { key: "chat", label: "Chat" },
  { key: "documents", label: "Documents" },
  { key: "flashcards", label: "Flashcards" },
  { key: "quiz", label: "Quiz" },
];

export default function ConversationTabs() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeTab = searchParams.get("tab") || "chat";

  return (
    <div className="border-b border-gray-800 px-6 flex gap-6">
      {TABS.map((tab) => {
        const isActive = activeTab === tab.key;
        return (
          <Link
            key={tab.key}
            href={`${pathname}?tab=${tab.key}`}
            className={`py-3 text-sm border-b-2 -mb-px ${
              isActive
                ? "border-white text-white"
                : "border-transparent text-gray-400 hover:text-gray-200"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}