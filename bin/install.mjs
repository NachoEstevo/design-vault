#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

// Python owns installation rules; npm/npx is only a transport and thin entry point.
const script = fileURLToPath(new URL("../scripts/install.py", import.meta.url));
const candidates = process.env.DESIGN_VAULT_PYTHON
  ? [[process.env.DESIGN_VAULT_PYTHON, []]]
  : process.platform === "win32"
    ? [["python", []], ["py", ["-3"]], ["python3", []]]
    : [["python3", []], ["python", []]];

for (const [command, prefix] of candidates) {
  const probe = spawnSync(command, [...prefix, "-c", "import sys; sys.exit(sys.version_info < (3, 10))"], {
    stdio: "ignore",
    windowsHide: true,
  });
  if (probe.status !== 0) continue;
  const result = spawnSync(command, [...prefix, script, ...process.argv.slice(2)], {
    stdio: "inherit",
    windowsHide: true,
    shell: false,
  });
  if (result.error) console.error(`Could not run Python: ${result.error.message}`);
  process.exit(result.status ?? 1);
}
console.error("Design Vault requires Python 3.10+. Install it or set DESIGN_VAULT_PYTHON to its executable.");
process.exit(1);
