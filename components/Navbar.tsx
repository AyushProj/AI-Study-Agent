"use client";

import Link from "next/link";
import { signOut, useSession } from "next-auth/react";

export default function Navbar() {
  const { data: session } = useSession();

  if (!session) return null;

  const links = [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/documents", label: "Documents" },
    { href: "/flashcards", label: "Flashcards" },
    { href: "/quizzes", label: "Quizzes" },
    { href: "/chat", label: "Chat" },
    { href: "/progress", label: "Progress" },
  ];

  return (
    <nav className="border-b border-gray-800 px-6 py-3 flex items-center justify-between">
      <div className="flex gap-5">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="text-sm text-gray-300 hover:text-white"
          >
            {link.label}
          </Link>
        ))}
      </div>
      <div className="flex items-center gap-4">
        <span className="text-sm text-gray-500">{session.user?.email}</span>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="text-sm text-gray-300 hover:text-white"
        >
          Log out
        </button>
      </div>
    </nav>
  );
}