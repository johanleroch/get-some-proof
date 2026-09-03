import { spawnSync } from "node:child_process";

const commandArguments = process.argv.slice(2);
if (!commandArguments.includes("--confirm-local-demo")) {
  console.error(
    "Refusing to seed. Re-run with --confirm-local-demo after checking the target deployment.",
  );
  process.exit(1);
}

const ownerEmailIndex = commandArguments.indexOf("--owner-email");
const ownerEmail =
  ownerEmailIndex >= 0 ? commandArguments[ownerEmailIndex + 1] : undefined;
if (ownerEmailIndex >= 0 && !ownerEmail) {
  console.error("--owner-email requires an email address.");
  process.exit(1);
}

const args = {
  confirmation: "SEED_LOCAL_DEMO",
  ...(ownerEmail ? { ownerEmail } : {}),
};
const result = spawnSync(
  "pnpm",
  ["exec", "convex", "run", "seed:demo", JSON.stringify(args)],
  { stdio: "inherit" },
);

process.exit(result.status ?? 1);
