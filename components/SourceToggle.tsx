"use client";

export type GenerationSourceValue = "documents" | "chat";

export default function SourceToggle({
  value,
  onChange,
}: {
  value: GenerationSourceValue;
  onChange: (value: GenerationSourceValue) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Generate from"
      className="inline-flex rounded-lg border border-gray-700 bg-gray-950/60 p-0.5"
    >
      {(["documents", "chat"] as const).map((option) => (
        <button
          key={option}
          type="button"
          role="radio"
          aria-checked={value === option}
          onClick={() => onChange(option)}
          className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent ${
            value === option
              ? "bg-accent text-accent-foreground"
              : "text-gray-400 hover:text-white"
          }`}
        >
          {option === "documents" ? "Documents" : "Chat"}
        </button>
      ))}
    </div>
  );
}