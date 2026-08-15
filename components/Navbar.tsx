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
    <nav className="flex items-center justify-between border-b border-[var(--border)] bg-[var(--navbar-bg)] px-6 py-3">
      <div className="text-sm text-[var(--foreground-muted)]">
        Welcome, <span className="font-semibold text-[var(--foreground)]">{displayName}</span>
      </div>

      <div className="flex items-center gap-4">
        <Link
          href={settingsUrl}
          className="text-sm text-[var(--foreground-muted)] transition hover:text-[var(--foreground)]"
        >
          Settings
        </Link>

        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="text-sm text-[var(--foreground-muted)] transition hover:text-[var(--foreground)]"
        >
          Log out
        </button>
      </div>
    </nav>
  );
}