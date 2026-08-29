import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";

function run(command, args) {
  console.log(`> ${command} ${args.join(" ")}`);
  execFileSync(command, args, { stdio: "inherit" });
}

run(process.execPath, ["scripts/check-toolchain.mjs"]);

if (!existsSync("pnpm-lock.yaml")) {
  console.warn(
    "pnpm-lock.yaml is not present yet. The first successful install must generate it and commit it in the same PR before NEX-18 is closed.",
  );
}

run("pnpm", ["install"]);
run("pnpm", ["lint"]);
run("pnpm", ["typecheck"]);
run("pnpm", ["format:check"]);

console.log("Nexora TMS bootstrap validation completed.");
