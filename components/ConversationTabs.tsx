"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

const TABS = [
  { key: "chat", label: "Chat" },
  { key: "documents", label: "Documents" },
  { key: "flashcards", label: "Flashcards" },
  { key: "quiz", label: "Quiz" },
  { key: "settings", label: "Settings" },
];

export default function ConversationTabs() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeTab = searchParams.get("tab") || "chat";

  return (
    <div className="flex gap-6 overflow-x-auto border-b border-[var(--border)] px-6 bg-[var(--navbar-bg)]">
      {TABS.map((tab) => {
        const isActive = activeTab === tab.key;

        return (
          <Link
            key={tab.key}
            href={`${pathname}?tab=${tab.key}`}
            className={`whitespace-nowrap border-b-2 py-3 text-sm ${
              isActive
                ? "border-[var(--foreground)] font-medium text-[var(--foreground)]"
                : "border-transparent text-[var(--foreground-muted)] hover:text-[var(--foreground)]"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}