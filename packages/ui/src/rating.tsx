export function Rating({ value }: { value: number | null }) {
  if (value === null) {
    return <span className="text-muted-foreground">New</span>;
  }
  return <span className="font-bold text-accent">★ {value.toFixed(1)}</span>;
}
