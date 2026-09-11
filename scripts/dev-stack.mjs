import { spawn, spawnSync } from "node:child_process";
import { copyFileSync, existsSync } from "node:fs";
import { createConnection } from "node:net";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

export const ROOT = resolve(here, "..");
export const COMPOSE_FILE = resolve(ROOT, "infra/compose/docker-compose.yml");
export const APP_PORTS = { web: 3000, api: 3001, admin: 3002 };

export function sleep(ms) {
  return new Promise((resolveSleep) => {
    setTimeout(resolveSleep, ms);
  });
}

function resolvePnpmInvocation() {
  if (process.platform !== "win32") {
    return { command: "pnpm", prefix: [], shell: false };
  }

  const candidates = [
    resolve(dirname(process.execPath), "node_modules/pnpm/bin/pnpm.cjs"),
    resolve(dirname(process.execPath), "../lib/node_modules/pnpm/bin/pnpm.cjs"),
  ];
  for (const file of candidates) {
    if (existsSync(file)) {
      return { command: process.execPath, prefix: [file], shell: false };
    }
  }

  return { command: "pnpm.cmd", prefix: [], shell: true };
}

function spawnOptions(extra = {}) {
  return {
    cwd: ROOT,
    env: process.env,
    ...extra,
  };
}

function spawnPnpmSync(args, extra = {}) {
  const invocation = resolvePnpmInvocation();
  return spawnSync(
    invocation.command,
    [...invocation.prefix, ...args],
    spawnOptions({
      shell: invocation.shell,
      ...extra,
    }),
  );
}

export function run(command, args, options = {}) {
  const result =
    command === "pnpm"
      ? spawnPnpmSync(args, { stdio: "inherit", ...options })
      : spawnSync(command, args, spawnOptions({ stdio: "inherit", ...options }));
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed with exit ${String(result.status)}`);
  }
}

export function runCapture(command, args) {
  const result =
    command === "pnpm"
      ? spawnPnpmSync(args, { encoding: "utf8" })
      : spawnSync(command, args, spawnOptions({ encoding: "utf8" }));
  return {
    status: result.status ?? 1,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

export function composeArgs(args) {
  return ["compose", "-f", COMPOSE_FILE, ...args];
}

export function parseDevUpArgs(argv) {
  return {
    skipSeed: argv.includes("--skip-seed"),
    forceSeed: argv.includes("--seed"),
    infraOnly: argv.includes("--infra-only"),
    skipInstall: argv.includes("--skip-install"),
  };
}

export function parseDevDownArgs(argv) {
  return {
    infra: argv.includes("--infra"),
  };
}

export function ensureEnvFile() {
  const envPath = resolve(ROOT, ".env");
  const examplePath = resolve(ROOT, ".env.example");
  if (!existsSync(envPath)) {
    if (!existsSync(examplePath)) {
      throw new Error("Missing .env.example; cannot create .env");
    }
    copyFileSync(examplePath, envPath);
    console.log("Created .env from .env.example");
  }
  process.loadEnvFile(envPath);
}

export function ensurePnpmInstall(skipInstall) {
  if (skipInstall || existsSync(resolve(ROOT, "node_modules"))) {
    return;
  }
  console.log("Installing workspace dependencies...");
  run("pnpm", ["install"]);
}

export async function ensureDockerDaemon() {
  if (runCapture("docker", ["info"]).status === 0) {
    return;
  }

  console.log("Docker is not running. Starting Docker Desktop...");
  if (process.platform === "win32") {
    const exe = "C:\\Program Files\\Docker\\Docker\\Docker Desktop.exe";
    if (!existsSync(exe)) {
      throw new Error("Docker Desktop was not found. Install Docker Desktop and retry.");
    }
    spawn(exe, [], { detached: true, stdio: "ignore" }).unref();
  } else if (process.platform === "darwin") {
    spawn("open", ["-a", "Docker"], { detached: true, stdio: "ignore" }).unref();
  } else {
    throw new Error("Docker daemon is not running. Start Docker and retry.");
  }

  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    await sleep(2000);
    if (runCapture("docker", ["info"]).status === 0) {
      return;
    }
  }
  throw new Error("Docker daemon did not become ready. Start Docker Desktop and retry.");
}

export function startDataStores() {
  console.log("Starting Docker data stores (Redis, Postgres/PostGIS, MinIO)...");
  run("docker", composeArgs(["up", "-d", "postgres", "redis", "minio", "minio-init"]));
}

export function stopDataStores() {
  console.log("Stopping Docker data stores...");
  run("docker", composeArgs(["stop", "postgres", "redis", "minio", "minio-init"]));
}

export async function waitForDataStores() {
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    const redis = runCapture("docker", composeArgs(["exec", "-T", "redis", "redis-cli", "ping"]));
    const postgres = runCapture(
      "docker",
      composeArgs(["exec", "-T", "postgres", "pg_isready", "-U", "hasut", "-d", "hasut"]),
    );
    if (redis.status === 0 && redis.stdout.trim() === "PONG" && postgres.status === 0) {
      console.log("Redis (Docker) is up. Postgres is ready.");
      return;
    }
    await sleep(2000);
  }
  throw new Error("Timed out waiting for Redis and Postgres containers.");
}

export function migrateDatabase() {
  console.log("Applying database migrations...");
  run("pnpm", ["db:migrate:deploy"]);
}

export function seedDatabase() {
  console.log("Seeding local demo data...");
  run("pnpm", ["db:seed"]);
}

export function shouldSeed(forceSeed, skipSeed) {
  if (skipSeed) {
    return false;
  }
  if (forceSeed) {
    return true;
  }
  const result = runCapture(
    "docker",
    composeArgs([
      "exec",
      "-T",
      "postgres",
      "psql",
      "-U",
      "hasut",
      "-d",
      "hasut",
      "-tAc",
      "select 1 from schema_bootstrap where id = 'hasut' limit 1",
    ]),
  );
  return result.status !== 0 || result.stdout.trim() !== "1";
}

export function isPortOpen(port) {
  return new Promise((resolveOpen) => {
    const socket = createConnection({ host: "127.0.0.1", port });
    socket.setTimeout(500);
    socket.once("connect", () => {
      socket.destroy();
      resolveOpen(true);
    });
    socket.once("timeout", () => {
      socket.destroy();
      resolveOpen(false);
    });
    socket.once("error", () => {
      socket.destroy();
      resolveOpen(false);
    });
  });
}

export async function waitForHttp(url, timeoutMs, label) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
    } catch {
      // Process is still booting.
    }
    await sleep(1000);
  }
  throw new Error(`Timed out waiting for ${label} at ${url}`);
}

export async function waitForApps() {
  await waitForHttp("http://127.0.0.1:3001/health/ready", 180_000, "API");
  await waitForHttp("http://127.0.0.1:3000", 120_000, "web");
  await waitForHttp("http://127.0.0.1:3002", 120_000, "admin");
}

export function printReadyBanner() {
  console.log("");
  console.log("HASUT is running");
  console.log("  Redis (Docker)  localhost:6379");
  console.log("  Postgres        localhost:5432");
  console.log("  MinIO           http://localhost:9001");
  console.log("  API             http://localhost:3001");
  console.log("  Health          http://localhost:3001/health/ready");
  console.log("  OpenAPI         http://localhost:3001/api/docs");
  console.log("  Web             http://localhost:3000");
  console.log("  Admin           http://localhost:3002");
  console.log("");
  console.log("Demo login: 7010358490  OTP: 123456 (after Send code)");
  console.log("Stop apps:  pnpm dev:down");
  console.log("Stop Docker data stores too:  pnpm dev:down --infra");
}

export function pidsListeningOn(port) {
  if (process.platform === "win32") {
    const { stdout } = runCapture("netstat", ["-ano", "-p", "tcp"]);
    const pids = new Set();
    const suffix = `:${String(port)}`;
    for (const line of stdout.split(/\r?\n/)) {
      if (!line.includes("LISTENING")) {
        continue;
      }
      const parts = line.trim().split(/\s+/);
      const local = parts[1] ?? "";
      const pid = Number(parts[4]);
      if (local.endsWith(suffix) && Number.isInteger(pid) && pid > 0) {
        pids.add(pid);
      }
    }
    return [...pids];
  }

  const { stdout, status } = runCapture("lsof", ["-ti", `tcp:${String(port)}`]);
  if (status !== 0) {
    return [];
  }
  return stdout
    .split(/\s+/)
    .map((value) => Number(value))
    .filter((pid) => Number.isInteger(pid) && pid > 0);
}

export function stopApps() {
  const ports = Object.values(APP_PORTS);
  const pids = new Set(ports.flatMap((port) => pidsListeningOn(port)));
  if (pids.size === 0) {
    console.log("No API/web/admin processes were listening.");
    return;
  }

  for (const pid of pids) {
    console.log(`Stopping process ${String(pid)}...`);
    if (process.platform === "win32") {
      spawnSync("taskkill", ["/PID", String(pid), "/T", "/F"], { stdio: "ignore" });
    } else {
      try {
        process.kill(pid, "SIGTERM");
      } catch {
        // Already gone.
      }
    }
  }
}

export function startApps(missingFilters) {
  const args = ["--parallel", ...missingFilters.flatMap((name) => ["--filter", name]), "dev"];
  console.log(`Starting ${missingFilters.join(", ")}...`);
  const invocation = resolvePnpmInvocation();
  const child = spawn(
    invocation.command,
    [...invocation.prefix, ...args],
    spawnOptions({
      stdio: "inherit",
      shell: invocation.shell,
    }),
  );

  const shutdown = () => {
    if (child.pid === undefined) {
      return;
    }
    if (process.platform === "win32") {
      spawnSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], { stdio: "ignore" });
      return;
    }
    child.kill("SIGTERM");
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  return child;
}

export async function missingAppFilters() {
  const missing = [];
  if (!(await isPortOpen(APP_PORTS.api))) {
    missing.push("@hasut/api");
  }
  if (!(await isPortOpen(APP_PORTS.web))) {
    missing.push("@hasut/web");
  }
  if (!(await isPortOpen(APP_PORTS.admin))) {
    missing.push("@hasut/admin");
  }
  return missing;
}
