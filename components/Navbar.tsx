"use client";

import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { motion, useReducedMotion } from "framer-motion";

const HIDDEN_ON = ["/", "/login", "/register"];

export default function Navbar() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const prefersReducedMotion = useReducedMotion();

  if (!session) return null;
  if (HIDDEN_ON.includes(pathname)) return null;

  const displayName =
    session.user?.name || session.user?.email?.split("@")[0] || "there";

  return (
    <nav className="border-b border-gray-800 px-6 py-3 flex items-center justify-between">
      <motion.p
        initial={{ opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: prefersReducedMotion ? 0 : 0.3 }}
        className="text-sm text-gray-200"
      >
        Welcome, <span className="font-medium text-accent">{displayName}</span>
      </motion.p>
      <button
        onClick={() => signOut({ callbackUrl: "/login" })}
        className="text-sm text-gray-300 hover:text-white"
      >
        Log out
      </button>
    </nav>
  );
}