"use client";

import { cssVar } from "@hasut/ui";
import type { AuthFeedback } from "../../lib/auth-flow";

/** Single live region so loading, error, and success never stack up. */
export function AuthFeedbackNote({ feedback, id }: { feedback: AuthFeedback; id?: string }) {
  if (feedback.status === "idle" || feedback.message.length === 0) {
    return <div id={id} role="status" aria-live="polite" style={{ minHeight: 20 }} />;
  }

  const tone =
    feedback.status === "error"
      ? cssVar("danger")
      : feedback.status === "success"
        ? cssVar("success")
        : cssVar("mutedText");

  return (
    <div
      id={id}
      role={feedback.status === "error" ? "alert" : "status"}
      aria-live="polite"
      style={{
        minHeight: 20,
        display: "flex",
        alignItems: "center",
        gap: 8,
        fontSize: 14,
        color: tone,
      }}
    >
      {feedback.status === "loading" ? <Spinner /> : null}
      <span>{feedback.message}</span>
    </div>
  );
}

function Spinner() {
  return (
    <span
      aria-hidden
      style={{
        width: 14,
        height: 14,
        borderRadius: "50%",
        border: `2px solid ${cssVar("border")}`,
        borderTopColor: cssVar("primary"),
        animation: "hasut-spin 700ms linear infinite",
        display: "inline-block",
      }}
    />
  );
}
