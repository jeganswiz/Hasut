import {
  ensureDockerDaemon,
  ensureEnvFile,
  ensurePnpmInstall,
  migrateDatabase,
  missingAppFilters,
  missingAppFiltersWithoutAdmin,
  parseDevUpArgs,
  printReadyBanner,
  printReadyBannerWithoutAdmin,
  seedDatabase,
  shouldSeed,
  startApps,
  startDataStores,
  waitForApps,
  waitForAppsWithoutAdmin,
  waitForDataStores,
} from "./dev-stack.mjs";

async function main() {
  const args = parseDevUpArgs(process.argv.slice(2));

  ensureEnvFile();
  ensurePnpmInstall(args.skipInstall);
  await ensureDockerDaemon();
  startDataStores();
  await waitForDataStores();
  migrateDatabase();
  if (shouldSeed(args.forceSeed, args.skipSeed)) {
    seedDatabase();
  } else {
    console.log("Demo data already present (use --seed to re-run).");
  }

  if (args.infraOnly) {
    console.log("Infra only. Redis is running in Docker.");
    return;
  }

  const missingFilters = args.skipAdmin ? await missingAppFiltersWithoutAdmin() : await missingAppFilters();
  
  if (missingFilters.length === 0) {
    const waitFn = args.skipAdmin ? waitForAppsWithoutAdmin : waitForApps;
    const printFn = args.skipAdmin ? printReadyBannerWithoutAdmin : printReadyBanner;
    await waitFn();
    printFn();
    console.log("Apps were already running. Leave this window or use pnpm dev:down to stop them.");
    return;
  }

  const child = startApps(missingFilters);
  const waitFn = args.skipAdmin ? waitForAppsWithoutAdmin : waitForApps;
  const printFn = args.skipAdmin ? printReadyBannerWithoutAdmin : printReadyBanner;
  
  const ready = waitFn()
    .then(() => {
      printFn();
      console.log("Logs follow. Ctrl+C stops the apps (Docker Redis stays up).");
    })
    .catch((error) => {
      console.error(error instanceof Error ? error.message : error);
      process.exitCode = 1;
    });

  const exitCode = await new Promise((resolveExit) => {
    child.on("exit", (code) => {
      resolveExit(code ?? 0);
    });
  });
  await ready;
  if (exitCode !== 0 && process.exitCode !== 1) {
    process.exitCode = exitCode;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
