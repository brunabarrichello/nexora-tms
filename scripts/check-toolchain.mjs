import { execFileSync } from "node:child_process";

const expectedNode = "v24.20.0";
const expectedPnpm = "11.23.0";

const failures = [];

if (process.version !== expectedNode) {
  failures.push(`Node.js ${expectedNode.slice(1)} is required; found ${process.version.slice(1)}.`);
}

try {
  const pnpmVersion = execFileSync("pnpm", ["--version"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();

  if (pnpmVersion !== expectedPnpm) {
    failures.push(`pnpm ${expectedPnpm} is required; found ${pnpmVersion}.`);
  }
} catch {
  failures.push(
    `pnpm ${expectedPnpm} is required but was not found. Enable Corepack and activate the pinned package manager.`,
  );
}

if (failures.length > 0) {
  console.error("Nexora TMS toolchain check failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log(`Toolchain OK: Node.js ${expectedNode.slice(1)} / pnpm ${expectedPnpm}`);
