import { main } from "./media-audit/audit.mjs";

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
