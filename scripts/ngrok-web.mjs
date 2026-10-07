import { spawn } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { delimiter, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const WEB_PORT = 3000;

export function ngrokHttpArgs(port = WEB_PORT) {
  return ["http", `127.0.0.1:${port}`];
}

function candidateBins() {
  const bins = [];
  if (process.env.NGROK_BIN !== undefined && process.env.NGROK_BIN.length > 0) {
    bins.push(process.env.NGROK_BIN);
  }
  const localAppData = process.env.LOCALAPPDATA;
  if (localAppData !== undefined && localAppData.length > 0) {
    bins.push(join(localAppData, "Microsoft", "WinGet", "Links", "ngrok.exe"));
    const packages = join(localAppData, "Microsoft", "WinGet", "Packages");
    if (existsSync(packages)) {
      for (const entry of readdirSync(packages, { withFileTypes: true })) {
        if (entry.isDirectory() && entry.name.startsWith("Ngrok.Ngrok_")) {
          bins.push(join(packages, entry.name, "ngrok.exe"));
        }
      }
    }
  }
  return bins;
}

export function resolveNgrokBin() {
  for (const candidate of candidateBins()) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }
  const names = process.platform === "win32" ? ["ngrok.exe", "ngrok.cmd"] : ["ngrok"];
  for (const dir of (process.env.PATH ?? "").split(delimiter)) {
    if (dir.length === 0) {
      continue;
    }
    for (const name of names) {
      const full = join(dir, name);
      if (existsSync(full)) {
        return full;
      }
    }
  }
  return undefined;
}

function isCliEntry() {
  const entry = process.argv[1];
  if (entry === undefined) {
    return false;
  }
  return import.meta.url === pathToFileURL(resolve(entry)).href;
}

function main() {
  const bin = resolveNgrokBin();
  if (bin === undefined) {
    console.error("ngrok is not installed.");
    console.error("Install it, then add your authtoken once:");
    console.error("  winget install --id Ngrok.Ngrok -e");
    console.error("  ngrok config add-authtoken <token>");
    console.error("Token: https://dashboard.ngrok.com/get-started/your-authtoken");
    process.exitCode = 1;
    return;
  }

  console.log(`Tunneling http://127.0.0.1:${WEB_PORT} (member web). Ctrl+C stops ngrok.`);
  console.log("The public URL is printed below. Stop the tunnel when you are done sharing it.");
  const child = spawn(bin, ngrokHttpArgs(), { stdio: "inherit" });
  child.on("exit", (code) => {
    process.exitCode = code ?? 0;
  });
  child.on("error", (error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

if (isCliEntry()) {
  main();
}
