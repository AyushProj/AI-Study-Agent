import type { ReactNode } from "react";

export default function EmptyState({
  icon,
  title,
  description,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-14 text-center">
      {icon && <div className="mb-1 text-[var(--foreground-muted)]">{icon}</div>}
      <p className="text-sm font-medium text-[var(--foreground)]">{title}</p>
      {description && (
        <p className="max-w-xs text-xs leading-relaxed text-[var(--foreground-muted)]">
          {description}
        </p>
      )}
    </div>
  );
}