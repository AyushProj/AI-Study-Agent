"use client";

import Link from "next/link";
import { usePathname, useParams } from "next/navigation";
import { signOut, useSession } from "next-auth/react";

const HIDDEN_ON = ["/", "/login", "/register"];

export default function Navbar() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const params = useParams();
  const conversationId = params?.conversationId as string | undefined;

  if (!session) return null;
  if (HIDDEN_ON.includes(pathname)) return null;

  const displayName =
    session.user?.name || session.user?.email?.split("@")[0] || "there";

  const settingsUrl = conversationId
    ? `/chat/${conversationId}?tab=settings`
    : "/chat";

  return (
    <nav className="border-b border-gray-200 dark:border-gray-800 px-6 py-3 flex items-center justify-between bg-white dark:bg-gray-900">
      <p className="text-sm text-gray-700 dark:text-gray-200">
        Welcome, <span className="font-semibold text-gray-900 dark:text-white">{displayName}</span>
      </p>
      <div className="flex items-center gap-4">
        <Link
          href={settingsUrl}
          className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
        >
          ⚙️ Settings
        </Link>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
        >
          Log out
        </button>
      </div>
    </nav>
  );
}