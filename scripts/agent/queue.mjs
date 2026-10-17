#!/usr/bin/env node
// Queue: run every open issue labeled agent:implement through run.mjs,
// sequentially. Each run either opens a draft PR (agent:review) or moves the
// issue to a refusal/blocked state, so the list shrinks as work completes.
//
// Usage: pnpm agent:queue

import { execFileSync, spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const RUN = path.join(ROOT, "scripts", "agent", "run.mjs");

const list = JSON.parse(
  execFileSync(
    "gh",
    ["issue", "list", "--label", "agent:implement", "--state", "open", "--limit", "100", "--json", "number,title"],
    { cwd: ROOT, encoding: "utf8" },
  ),
);

if (list.length === 0) {
  console.log("agent:queue: no open issues labeled agent:implement.");
  process.exit(0);
}

console.log(`agent:queue: ${list.length} issue(s) labeled agent:implement.`);

const results = [];
for (const issue of list) {
  console.log(`\n=== agent:run #${issue.number} — ${issue.title} ===`);
  const res = spawnSync(process.execPath, [RUN, String(issue.number)], {
    cwd: ROOT,
    stdio: "inherit",
  });
  results.push({ ...issue, status: res.status ?? 1 });
}

console.log("\n=== agent:queue summary ===");
for (const r of results) {
  const outcome = r.status === 0 ? "draft PR opened" : r.status === 3 ? "refused" : `failed (exit ${r.status})`;
  console.log(`#${r.number} ${r.title} → ${outcome}`);
}
process.exit(results.every((r) => r.status === 0) ? 0 : 1);
