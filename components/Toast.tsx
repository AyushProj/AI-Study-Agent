"use client";

import { useEffect, useState } from "react";

interface ToastProps {
  message: string;
  variant?: "success" | "error";
  duration?: number;
  onClose: () => void;
}

export default function Toast({
  message,
  variant = "success",
  duration = 4500,
  onClose,
}: ToastProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const enterFrame = requestAnimationFrame(() => setVisible(true));
    const exitTimer = setTimeout(() => setVisible(false), duration - 300);
    const closeTimer = setTimeout(onClose, duration);
    return () => {
      cancelAnimationFrame(enterFrame);
      clearTimeout(exitTimer);
      clearTimeout(closeTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [duration]);

  const colors =
    variant === "success"
      ? "bg-green-600/95 border-green-400"
      : "bg-red-600/95 border-red-400";

  return (
    <div
      className={`fixed top-6 left-1/2 -translate-x-1/2 z-50 transition-all duration-300 ease-out ${
        visible ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-2"
      }`}
    >
      <div
        className={`flex items-center gap-2 rounded-lg border px-4 py-3 text-white shadow-lg ${colors}`}
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {variant === "success" ? (
            <path d="M20 6 9 17l-5-5" />
          ) : (
            <>
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </>
          )}
        </svg>
        <span className="text-sm font-medium">{message}</span>
      </div>
    </div>
  );
}