const loading = new Map<string, Promise<void>>();

/** Loads a third-party SDK once per page and reuses the same promise after. */
export function loadScript(src: string): Promise<void> {
  const existing = loading.get(src);
  if (existing !== undefined) {
    return existing;
  }
  const pending = new Promise<void>((resolve, reject) => {
    if (typeof document === "undefined") {
      reject(new Error("Scripts can only load in the browser"));
      return;
    }
    const element = document.createElement("script");
    element.src = src;
    element.async = true;
    element.defer = true;
    element.onload = () => resolve();
    element.onerror = () => {
      loading.delete(src);
      reject(new Error(`Failed to load ${src}`));
    };
    document.head.append(element);
  });
  loading.set(src, pending);
  return pending;
}
