export function HasutLogo({ size = 28, src }: { size?: number; src?: string | null }) {
  if (src !== undefined && src !== null && src.length > 0) {
    return (
      <img src={src} width={size} height={size} alt="" className="block shrink-0 rounded-full" />
    );
  }
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      aria-hidden="true"
      className="block shrink-0"
    >
      <circle cx="16" cy="16" r="15" className="fill-primary" />
      <path
        d="M10 22V10h3.2v4.4h5.6V10H22v12h-3.2v-4.8h-5.6V22H10z"
        className="fill-primary-foreground"
      />
    </svg>
  );
}
