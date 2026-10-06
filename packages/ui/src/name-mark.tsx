/** A stand-in picture from a name, using the theme colours at an angle unique to that name. */
export function nameMarkHue(name: string): number {
  let hash = 0;
  for (let index = 0; index < name.length; index += 1) {
    hash = (hash + name.charCodeAt(index) * (index + 3)) % 360;
  }
  return hash;
}

export function nameInitials(name: string): string {
  const letters = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.slice(0, 1).toUpperCase())
    .join("");
  return letters.length > 0 ? letters : "?";
}

export function NameMark({ name, height = 72 }: { name: string; height?: number }) {
  return (
    <div
      aria-hidden="true"
      className="grid place-items-center font-bold tracking-wide text-primary-foreground"
      style={{
        height,
        backgroundImage: `linear-gradient(${nameMarkHue(name)}deg, var(--hasut-color-primary), var(--hasut-color-secondary))`,
      }}
    >
      {nameInitials(name)}
    </div>
  );
}
