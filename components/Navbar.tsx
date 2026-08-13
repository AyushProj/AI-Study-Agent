"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";

const HIDDEN_ON = ["/", "/login", "/register"];

export default function Navbar() {
  const { data: session } = useSession();
  const pathname = usePathname();

  if (!session) return null;
  if (HIDDEN_ON.includes(pathname)) return null;

  const links = [
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