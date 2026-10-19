export interface MediaDeviceChoice {
  id: string;
  label: string;
  kind: "videoinput" | "audioinput";
}

export function mapMediaDevices(
  devices: readonly { deviceId: string; kind: string; label: string }[],
): {
  cameras: MediaDeviceChoice[];
  mics: MediaDeviceChoice[];
} {
  const cameras: MediaDeviceChoice[] = [];
  const mics: MediaDeviceChoice[] = [];
  for (const device of devices) {
    if (device.deviceId.length === 0) {
      continue;
    }
    if (device.kind === "videoinput") {
      cameras.push({
        id: device.deviceId,
        label: device.label.length > 0 ? device.label : `Camera ${cameras.length + 1}`,
        kind: "videoinput",
      });
    }
    if (device.kind === "audioinput") {
      mics.push({
        id: device.deviceId,
        label: device.label.length > 0 ? device.label : `Microphone ${mics.length + 1}`,
        kind: "audioinput",
      });
    }
  }
  return { cameras, mics };
}

export function healthLabel(state: string): string {
  if (state === "HEALTHY") {
    return "Stream healthy";
  }
  if (state === "WAITING") {
    return "Waiting for media";
  }
  if (state === "DEGRADED") {
    return "Weak connection";
  }
  if (state === "OFFLINE") {
    return "Disconnected";
  }
  return "Checking connection";
}

export function formatLiveClock(startedAt: string, now: number): string {
  const seconds = Math.max(0, Math.floor((now - Date.parse(startedAt)) / 1000));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remain = seconds % 60;
  return [hours, minutes, remain].map((part) => String(part).padStart(2, "0")).join(":");
}

export function canShareScreen(): boolean {
  return (
    typeof navigator !== "undefined" &&
    typeof navigator.mediaDevices?.getDisplayMedia === "function"
  );
}
