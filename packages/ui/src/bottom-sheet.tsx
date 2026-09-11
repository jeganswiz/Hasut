import type { ReactNode } from "react";
import { cssVar } from "./tokens";

export function BottomSheet({ children }: { children: ReactNode }) {
  return (
    <section
      style={{
        background: cssVar("surface"),
        borderTopLeftRadius: cssVar("cardRadius"),
        borderTopRightRadius: cssVar("cardRadius"),
        boxShadow: "0 -12px 40px rgba(15, 23, 42, 0.12)",
        padding: "8px 16px 20px",
      }}
    >
      <div
        style={{
          width: 48,
          height: 5,
          borderRadius: 999,
          background: cssVar("border"),
          margin: "0 auto 12px",
        }}
      />
      {children}
    </section>
  );
}
