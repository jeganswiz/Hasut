export function bucketDistanceMeters(meters: number, stepsMeters: number[]): string {
  const steps = stepsMeters
    .filter((step) => Number.isFinite(step) && step > 0)
    .sort((a, b) => a - b);
  if (steps.length === 0) {
    return formatDistanceLabel(meters);
  }
  for (const step of steps) {
    if (meters <= step) {
      return formatDistanceLabel(step);
    }
  }
  return formatDistanceLabel(steps[steps.length - 1] ?? meters);
}

export function formatDistanceLabel(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters)}m`;
  }
  const km = meters / 1000;
  const rounded = km >= 10 ? Math.round(km) : Math.round(km * 10) / 10;
  return `${rounded}km`;
}
