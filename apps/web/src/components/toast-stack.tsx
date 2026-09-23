"use client";

export interface ToastNoteView {
  id: number;
  text: string;
}

export function ToastStack({ toasts }: { toasts: ToastNoteView[] }) {
  if (toasts.length === 0) {
    return null;
  }
  return (
    <div className="toast-viewport" aria-live="polite">
      {toasts.map((toast) => (
        <p key={toast.id} className="toast" role="status">
          {toast.text}
        </p>
      ))}
    </div>
  );
}
