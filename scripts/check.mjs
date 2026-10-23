import { readdir, readFile, access } from "node:fs/promises";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import assert from "node:assert/strict";

const manifest = JSON.parse(await readFile("extension/manifest.json", "utf8"));
assert.equal(manifest.manifest_version, 3);
assert.deepEqual(manifest.permissions, ["storage", "downloads"]);
assert.deepEqual(manifest.host_permissions, ["https://pbs.twimg.com/*"]);
for (const file of [
  manifest.background.service_worker,
  manifest.options_page,
  ...manifest.content_scripts.flatMap((s) => s.js),
  ...manifest.web_accessible_resources.flatMap((r) => r.resources),
])
  await access(join("extension", file));
let count = 0;
async function check(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) await check(path);
    else if (/\.(js|mjs)$/.test(entry.name)) {
      const result = spawnSync(process.execPath, ["--check", path], {
        encoding: "utf8",
      });
      assert.equal(result.status, 0, `${path}: ${result.stderr}`);
      count++;
    }
  }
}
await check("extension");
await check("scripts");
await check("bin");
await check("tests");
const html = await readFile("extension/library.html", "utf8");
assert(!/\bon\w+=/i.test(html), "No inline handlers allowed by extension CSP");
assert(
  !/https?:\/\//.test(html.match(/<head>[\s\S]*?<\/head>/)?.[0] || ""),
  "No remote executable resources",
);
console.log(
  `Manifest valid; ${count} JavaScript files parsed; local resources and CSP-compatible HTML checked.`,
);
