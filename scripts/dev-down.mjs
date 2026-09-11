import { parseDevDownArgs, stopApps, stopDataStores } from "./dev-stack.mjs";

function main() {
  const args = parseDevDownArgs(process.argv.slice(2));
  stopApps();
  if (args.infra) {
    stopDataStores();
  } else {
    console.log("Left Docker Redis/Postgres/MinIO running. Add --infra to stop them.");
  }
}

main();
