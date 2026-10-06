import { cn } from "./lib/utils";

const RING = {
  idle: "border-primary",
  available: "border-success",
  live: "border-destructive",
} as const;

export function Avatar({
  photoUrl,
  initials,
  size = 40,
  ring = "idle",
  label,
}: {
  photoUrl: string | null;
  initials: string;
  size?: number;
  ring?: keyof typeof RING;
  label?: string;
}) {
  return (
    <span
      aria-label={label ?? initials}
      className={cn(
        "grid shrink-0 place-items-center overflow-hidden rounded-full border-[3px] bg-card font-bold text-foreground",
        RING[ring],
      )}
      style={{ width: size, height: size, fontSize: Math.max(10, Math.round(size * 0.32)) }}
    >
      {photoUrl ? (
        <img src={photoUrl} alt="" width={size} height={size} className="size-full object-cover" />
      ) : (
        initials
      )}
    </span>
  );
}
