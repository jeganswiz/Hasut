export type LivePlayerPhase =
  "loading" | "waiting" | "playing" | "reconnecting" | "poor" | "ended" | "error" | "restricted";

export function nextPlayerPhase(
  current: LivePlayerPhase,
  event: "ready" | "stalled" | "fatal" | "ended" | "forbidden" | "recover",
): LivePlayerPhase {
  if (event === "forbidden") {
    return "restricted";
  }
  if (event === "ended") {
    return "ended";
  }
  if (event === "ready") {
    return "playing";
  }
  if (event === "recover") {
    return current === "ended" || current === "restricted" ? current : "waiting";
  }
  if (event === "stalled") {
    return current === "playing" ? "poor" : current;
  }
  if (event === "fatal") {
    return current === "playing" || current === "poor" ? "reconnecting" : "error";
  }
  return current;
}
