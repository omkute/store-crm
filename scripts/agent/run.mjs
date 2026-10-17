#!/usr/bin/env node
// Local port of course-video-manager/.github/workflows/agent-implement.yml.
// The orchestrator owns every GitHub mutation (labels, comments, PRs, pushes);
// the agent only writes files and commits locally inside a worktree.
//
// Usage: pnpm agent:run <issue-number>
//
// Exit codes: 0 = draft PR opened, 2 = usage error, 3 = refused (sub-issue,
// PRD, or an open PR already references the issue), 4 = run failed (issue
// marked agent:blocked).

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function out(cmd, args, opts = {}) {
  return execFileSync(cmd, args, {
    cwd: opts.cwd ?? ROOT,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
  }).trim();
}

function run(cmd, args, opts = {}) {
  execFileSync(cmd, args, { cwd: opts.cwd ?? ROOT, stdio: "inherit" });
}

function quiet(cmd, args, opts = {}) {
  try {
    execFileSync(cmd, args, { cwd: opts.cwd ?? ROOT, stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function ghOut(args, opts = {}) {
  return out("gh", args, opts);
}

function ghRun(args, opts = {}) {
  return out("gh", args, opts);
}

function setLabel(kind, n, label, add) {
  try {
    ghRun([kind, "edit", String(n), add ? "--add-label" : "--remove-label", label]);
  } catch (err) {
    console.error(`warning: could not ${add ? "add" : "remove"} label ${label}: ${err.message}`);
  }
}

function comment(n, body) {
  try {
    ghRun(["issue", "comment", String(n), "--body", body]);
  } catch (err) {
    console.error(`warning: could not comment on #${n}: ${err.message}`);
  }
}

function slugify(title) {
  return (
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 50)
      .replace(/-+$/, "") || "issue"
  );
}

function main() {
  const n = Number(process.argv[2]);
  if (!Number.isInteger(n) || n < 1) {
    console.error("usage: pnpm agent:run <issue-number>");
    process.exit(2);
  }

  const issue = JSON.parse(
    ghOut(["issue", "view", String(n), "--json", "number,title,body"]),
  );

  // --- Preflight: shape detection (sub-issues / parent) ---------------------
  let subCount = 0;
  try {
    subCount = Number(ghOut(["api", `repos/{owner}/{repo}/issues/${n}/sub_issues`, "--jq", "length"]));
  } catch {
    subCount = 0;
  }
  let parentNumber = "";
  try {
    parentNumber = ghOut([
      "api", "graphql",
      "-f", "query=query($owner: String!, $repo: String!, $num: Int!) { repository(owner: $owner, name: $repo) { issue(number: $num) { parent { number } } } }",
      "-f", "owner=omkute", "-f", "repo=store-crm", "-F", `num=${n}`,
      "--jq", ".data.repository.issue.parent.number // empty",
    ]);
  } catch {
    parentNumber = "";
  }

  if (subCount > 0) {
    // PRD — decomposition workflow is Phase 4; agent:run does not handle it.
    console.error(`#${n} has ${subCount} sub-issues (PRD). agent:run handles leaf issues only — Phase 4 chains PRDs.`);
    process.exit(3);
  }
  if (parentNumber) {
    setLabel("issue", n, "agent:implement", false);
    setLabel("issue", n, "agent:blocked", true);
    comment(
      n,
      `Refused to run: this issue is a sub-issue of #${parentNumber}. Add \`agent:implement\` to the parent PRD instead. Cleared \`agent:implement\` and added \`agent:blocked\`.`,
    );
    process.exit(3);
  }

  // --- Preflight: refuse if an open PR already references this issue --------
  const prs = JSON.parse(
    ghOut(["pr", "list", "--state", "open", "--search", `in:body "#${n}"`, "--json", "url,body"]),
  );
  const ref = new RegExp(`(closes|fixes|resolves)\\s+#${n}\\b`, "i");
  const existing = prs.find((pr) => ref.test(pr.body ?? ""));
  if (existing) {
    setLabel("issue", n, "agent:implement", false);
    comment(
      n,
      `Refused to run: PR ${existing.url} already targets this issue. Close it first, then re-add \`agent:implement\`.`,
    );
    process.exit(3);
  }

  // --- Transition: remove implement/blocked, add in-progress (the lock) -----
  setLabel("issue", n, "agent:implement", false);
  setLabel("issue", n, "agent:blocked", false);
  setLabel("issue", n, "agent:in-progress", true);
  let locked = true;

  try {
    // --- Branch from main, in an isolated worktree -------------------------
    const slug = slugify(issue.title);
    const branch = `agent/issue-${n}-${slug}`;
    const wt = path.join(ROOT, ".opencode", "worktrees", `agent-issue-${n}-${slug}`);

    run("git", ["fetch", "origin", "main"]);
    quiet("git", ["worktree", "remove", "--force", wt]);
    quiet("git", ["branch", "-D", branch]); // orphan by design — see push below
    run("git", ["worktree", "add", wt, "-b", branch, "origin/main"]);
    run("pnpm", ["install", "--frozen-lockfile"], { cwd: wt });

    // --- Agent: headless implementer with the issue as its spec -------------
    const prompt = readFileSync(path.join(ROOT, ".opencode", "prompts", "implement.md"), "utf8")
      .replaceAll("{{ISSUE_NUMBER}}", String(n))
      .replaceAll("{{ISSUE_TITLE}}", issue.title)
      .replaceAll("{{ISSUE_BODY}}", issue.body ?? "(no issue body)");
    try {
      // --dir pins the agent to the worktree. `cwd` alone is NOT enough:
      // opencode run resolves the project through git's common dir, so with
      // cwd=worktree it still lands in the main checkout (observed live —
      // the agent committed on a branch in ~/Desktop/store-crm instead).
      run("opencode", ["run", "--dir", wt, "--agent", "implementer", prompt], { cwd: wt });
    } catch (err) {
      // execFileSync error.message embeds the whole prompt — keep the issue comment short.
      throw new Error(`opencode run exited with status ${err.status ?? "unknown"} (agent output above)`);
    }

    // --- Assert >=1 commit, gate on the check, push, open a draft PR --------
    const commits = Number(out("git", ["rev-list", "--count", "origin/main..HEAD"], { cwd: wt }));
    if (commits < 1) throw new Error("the agent finished without committing anything");
    run("pnpm", ["check"], { cwd: wt }); // local CI equivalent before push
    run("git", ["push", "--force", "origin", branch]); // preflight refused open PRs, so any remote ref is an orphan

    const title = issue.title.slice(0, 256);
    const body = [
      `Draft opened by \`pnpm agent:run ${n}\` (Phase 3 label state machine).`,
      "",
      `- Issue: #${n} — ${issue.title}`,
      `- Branch: \`${branch}\` (${commits} commit${commits === 1 ? "" : "s"})`,
      `- Verified: \`pnpm check\` green in the agent worktree before push`,
      "",
      `Implements #${n}`,
      "",
      "---",
      `Human review required before merge — see \`docs/agents/merging.md\`. The keyword \`Implements\` is used on purpose (no auto-close); close #${n} explicitly when merging.`,
    ].join("\n");
    const url = ghOut(["pr", "create", "--draft", "--base", "main", "--head", branch, "--title", title, "--body", body]);
    const prUrl = url.split("\n").pop();
    const prNumber = prUrl.match(/\/pull\/(\d+)/)?.[1];
    if (!prNumber) throw new Error(`could not parse PR number from: ${url}`);

    ghRun(["pr", "edit", prNumber, "--add-label", "agent:review"]);
    locked = false;
    ghRun(["issue", "edit", String(n), "--remove-label", "agent:in-progress"]);
    console.log(`\nDone: draft PR ${prUrl} — labeled agent:review; #${n} released.`);
  } catch (err) {
    if (locked) {
      setLabel("issue", n, "agent:in-progress", false);
      setLabel("issue", n, "agent:blocked", true);
      comment(
        n,
        `\`agent:implement\` run failed.\n\n**Reason:** ${err.message}\n\nRe-add \`agent:implement\` to retry (\`pnpm agent:run ${n}\`).`,
      );
    }
    console.error(err.message);
    process.exit(4);
  }
}

main();
