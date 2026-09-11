export type ProbeStatus = "up" | "down";

export interface HealthProbes {
  postgres: ProbeStatus;
  postgis: ProbeStatus;
  redis: ProbeStatus;
}

export interface HealthData {
  status: "ok" | "degraded";
  scope: "live" | "ready";
  service: string;
  version: string;
  uptimeSeconds: number;
  checks?: HealthProbes;
  postgisVersion?: string;
}
