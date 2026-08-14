"use client";

import { useEffect, useRef, useState } from "react";

export interface OverflowMenuItem {
  label: string;
  onClick: () => void;
  danger?: boolean;
}

export default function OverflowMenu({ items }: { items: OverflowMenuItem[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((prev) => !prev);
        }}
        className="text-gray-500 hover:text-white px-1.5 py-0.5 rounded"
        title="More options"
      >
        ⋮
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-20 w-36 rounded border border-gray-700 bg-gray-900 shadow-lg py-1">
          {items.map((item) => (
            <button
              key={item.label}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setOpen(false);
                item.onClick();
              }}
              className={`w-full text-left px-3 py-1.5 text-sm hover:bg-gray-800 ${
                item.danger ? "text-red-400 hover:text-red-300" : "text-gray-200"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}