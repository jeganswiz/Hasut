import { cssVar } from "./tokens";

export function Rating({ value }: { value: number | null }) {
  if (value === null) {
    return <span style={{ color: cssVar("mutedText") }}>New</span>;
  }
  return <span style={{ color: cssVar("accent"), fontWeight: 700 }}>★ {value.toFixed(1)}</span>;
}
