export interface CaptionStyle {
  fontWeight: number;
  fontStyle: "normal" | "italic";
  fontFamily: string;
}

export const CAPTION_STYLES: readonly CaptionStyle[] = [
  { fontWeight: 800, fontStyle: "normal", fontFamily: "Georgia, 'Times New Roman', serif" },
  { fontWeight: 500, fontStyle: "normal", fontFamily: "sans-serif" },
  { fontWeight: 600, fontStyle: "italic", fontFamily: "Georgia, 'Times New Roman', serif" },
  { fontWeight: 400, fontStyle: "normal", fontFamily: "sans-serif" },
];

export function captionStyleAt(index: number): CaptionStyle {
  return (
    CAPTION_STYLES[index] ??
    CAPTION_STYLES[0] ?? {
      fontWeight: 800,
      fontStyle: "normal",
      fontFamily: "Georgia, serif",
    }
  );
}

export function nextBackdrop(
  current: "none" | "solid" | "gradient",
): "none" | "solid" | "gradient" {
  if (current === "none") {
    return "solid";
  }
  if (current === "solid") {
    return "gradient";
  }
  return "none";
}
