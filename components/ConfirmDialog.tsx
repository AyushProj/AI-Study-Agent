"use client";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Replaces window.confirm() app-wide. Native confirm() has a real failure
 * mode: browsers let the user check "prevent this page from creating
 * additional dialogs," and once checked, every future confirm() call
 * silently returns false with no dialog and no error — which is exactly
 * what was happening to every delete button in the app. This dialog is
 * just React state, so that's no longer possible.
 */
export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Delete",
  danger = true,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-sm rounded-xl border border-[var(--border)] bg-[var(--card-bg)] p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-base font-semibold text-[var(--foreground)]">{title}</h3>
        <p className="mt-2 text-sm text-[var(--foreground-muted)]">{message}</p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="rounded-md border border-[var(--border)] px-3 py-1.5 text-sm text-[var(--foreground)] hover:bg-[var(--background-soft)]"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${
              danger
                ? "bg-red-600 text-white hover:bg-red-500"
                : "bg-[var(--accent)] text-[var(--accent-foreground)] hover:brightness-95"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}