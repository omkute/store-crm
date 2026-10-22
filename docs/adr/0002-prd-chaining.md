# ADR 0002 — PRD chaining: a sequential sub-issue walk

- Status: accepted
- Date: 2026-10-18

## Context

Phase 3 shipped the leaf pipeline: `pnpm agent:run <issue>` on a standalone issue moves `agent:implement` → `agent:in-progress` (the lock), branches a worktree off `origin/main`, runs the headless implementer, gates on `pnpm check`, pushes, opens a draft PR whose body ends `Implements #n`, labels the PR `agent:review`, and releases the lock. Every mutation is the orchestrator's; labels ARE the state machine (AGENTS.md, "The one architectural law").

There is still no path from a PRD to work. `run.mjs` refuses an issue with sub-issues (exit 3: "handles leaf issues only — Phase 4 chains PRDs") and refuses a directly labeled sub-issue (clears `agent:implement`, adds `agent:blocked`, tells the human to label the parent instead). Labeling a PRD today is a dead end; Phase 4 closes the loop.

Constraints that shape the design:

- `main` is protected by a strict, up-to-date-required ruleset (`docs/agents/merging.md`). One PR merges at a time; a slice that builds on the previous slice can only branch from a `main` that contains it — i.e. only after the previous slice's PR is merged. Parallel slices would each invalidate the other's branch. Sequence is the natural shape.
- `/to-issues` slices a PRD into a flat, ordered list of native sub-issues, published in execution order, dependencies pointing backwards, never nested; each slice is one agent session (`.opencode/skills/to-issues/SKILL.md`).
- Every leaf run ends in a draft PR; the human is the merge gate. The walk should advance only through that gate.
- "Done" for readiness must be machine-readable from GitHub state alone (no external DB). Today it is not: leaf PRs deliberately say `Implements #n` (no auto-close) and a human closes the issue afterward — fine as a one-off ritual, untenable as a dependency signal.

## Decision

One orchestrator invocation on a labeled PRD performs exactly one **tick**: it runs the next ready sub-issue through the existing leaf pipeline and stops. A later invocation resumes the walk. The human's merge + re-run is the walk's clock.

### Tick semantics

1. `pnpm agent:run <prd>` where `<prd>` has ≥1 native sub-issue performs a tick instead of refusing. The tick resolves the whole walk state with one paginated REST call — `GET /repos/{owner}/{repo}/issues/<prd>/sub_issues` — which returns each sub-issue's number, title, `state`, and `labels` in list order (verified against #3 → #4, #5, #6, #7). No PRD-level lock is taken; the candidate takes the existing `agent:in-progress` lock.
2. **Order** is that list's order — the PRD's sub-issue list, the same sequence a human sees on the PRD page. `to-issues` publishes in execution order, and the order can be changed deliberately before labeling (the API exposes `PATCH .../sub_issues/priority`). The list is the single source of execution order.
3. **Candidate** = the first sub-issue in order whose state is not `closed`. **Done = issue closed.** Because `to-issues` only ever points dependencies backwards and publishes in execution order, "first not closed" is also "the first sub-issue whose declared blockers are done": walk position encodes the dependency graph. The tick parses no `Depends on` prose and keeps no separate dependency state. Out-of-order dependency prose is human error fixed by reprioritizing the list; the list, not the prose, is authoritative.
4. Guards before any mutation of the candidate:
   - candidate already has an open PR referencing it → stop and wait (console message, exit 0; no label changes — the open PR is the visible state);
   - candidate labeled `agent:blocked` without `agent:implement` → stop, comment: fix the cause, re-add `agent:implement` to the sub-issue to authorize one retry, re-run the PRD (exit 3);
   - candidate labeled `agent:in-progress` → stop, comment: stale lock, clear it manually if no run is live (exit 3).
5. Otherwise the existing leaf pipeline runs on the candidate, unchanged: clear `agent:implement`/`agent:blocked`, add `agent:in-progress` (the lock); worktree off `origin/main`; implementer; `pnpm check`; push; draft PR; PR labeled `agent:review`; `agent:in-progress` removed; stop (exit 0). On failure: remove `agent:in-progress`, add `agent:blocked`, comment on the sub-issue, stop (exit 4) — Phase 3's failure behavior, scoped to the candidate. The PRD is untouched by a failed tick.
6. The PRD keeps `agent:implement` between ticks: on a PRD the label means "enrolled in the walk", not "run now". The tick is idempotent — re-invocations while a slice's PR is open are no-ops; the sub-issues' closed states are the cursor. No new label is introduced.
7. Terminal: the tick that opens the **last open sub-issue**'s PR also clears `agent:implement` from the PRD (the walk is exhausted at that point) and adds `Closes #<prd>` to that PR, so the final merge closes the last slice and the PRD together. A tick invoked when all sub-issues are already closed clears `agent:implement` if still present and stops. Confirmed 2026-10-18.

### Done detection: `Closes #n` in every leaf PR

Leaf PR bodies switch from `Implements #n` to `Closes #n`. Merging then auto-closes the issue on `main`, so code landing and the readiness signal are the same atomic event; the next tick reads "done" directly from issue state, and the same sub-issue listing that resolves order also resolves readiness.

This deliberately reverses the Phase 3 "no auto-close" choice. That choice fit a manual leaf workflow, where closing the issue was a review ritual after merge. The walk turns closure into a dependency signal — the next tick must not start until the previous slice is merged — so one merge must do both. GitHub closes on merge only (to the default branch, the only base used), never on PR open, so draft review semantics are unchanged. Confirmed 2026-10-18.

Why not keep `Implements` and detect merged PRs instead: the branch name is deterministic (`agent/issue-<n>-<slug>`) and `gh pr list --state merged --json headRefName` filters it exactly, so it is scriptable — but it makes readiness depend on a naming convention plus a second scan, where `Closes` is one word in a body the orchestrator already generates. Simplicity wins.

### What changes (decisions, not implementation)

- `scripts/agent/run.mjs` — PRD-shaped issues execute one tick (resolve → guards → leaf pipeline on the candidate) instead of exit 3. The direct sub-issue refusal message changes: sub-issues are never run directly; a sub-issue labeled `agent:implement` is a retry authorization consumed by the PRD tick.
- `scripts/agent/run.mjs` — PR body convention: `Closes #<candidate>`, plus `Closes #<prd>` when the candidate is the last open sub-issue. The existing open-PR preflight (body search + close-keyword regex) extends to the candidate and already matches `closes`.
- `scripts/agent/queue.mjs` — skips sub-issues (their `agent:implement` is a retry token, not a direct job); looping over `agent:implement` then naturally means one tick per enrolled PRD per queue run, and the summary reports ticks distinctly (completed / waiting on merge / blocked).
- `docs/agents/triage-labels.md` (a parallel workstream owns the file) — document the PRD-enrollment meaning of `agent:implement`.
- `agent:queued` stays documented-but-unused: a sequential walk never has more than one runnable slice and readiness is computed at tick time rather than stored as label state. Deferred to a future ADR (implement or retire). Confirmed 2026-10-18. The unused `reviewer` agent (`.opencode/agent/reviewer.md`, referenced by nothing) is likewise out of scope here.

## Alternatives considered

- **Label-driven fan-out (`agent:queued`, auto-promote when blockers clear).** The Phase 3 label set sketched this. Rejected for now: it adds per-slice queue/promotion state and races for "several slices became ready at once", while strict protection makes parallel merges impossible — complexity that schedules work a single-writer repo cannot run in parallel anyway. `agent:queued` is deferred with it.
- **Merged-PR detection instead of `Closes`.** Keep `Implements #n`, treat a slice as done when a merged PR whose head branch matches `agent/issue-<n>-` exists. Scriptable, but two moving parts (convention + scan) plus an invisible signal, where `Closes` is one word and shows up in the issue timeline. Rejected.
- **Native GitHub issue dependencies.** Fully available — REST `.../dependencies/blocked_by` GET/POST/DELETE and GraphQL `Issue.blockedBy` / `issueDependenciesSummary` (verified queryable against this repo; currently zero relationships for #3–#7) — but `to-issues` creates none today (the "Depends on" section is prose), so readiness keyed on them would be vacuous until the skill added a dependency per slice. The flat walk already encodes the same graph in list order. Deferred; usable later as a cheap cross-check.
- **CI-hosted orchestrator** (the course's `agent-implement.yml` shape: run the tick in GitHub Actions on a dispatch/label trigger). Deferred, not rejected: it adds runner plumbing, secret management, and push/PR permissions from CI while the local loop is still being exercised. The tick contract decided here is runner-agnostic; the same one-tick interface can be hosted later.
- **Parallel sub-issues.** Rejected by constraint: with strict up-to-date protection, the second slice's branch goes stale before its PR can merge, and every rebase re-runs the agent. Parallelism is what `agent:queued` would be for; future ADR territory.

## Consequences

- Good: Phase 4 closes the loop with one REST call, one keyword, and no new labels or external state. One invocation = one bounded, debuggable slice of progress.
- Good: the human merge gate is preserved and becomes the pacing mechanism; ticks only build on code that actually landed on `main`. Latency between ticks is a feature, not a cost.
- Good: failure stays small — a failed tick blocks the candidate, not the PRD; retry is one label add.
- Bad: strictly sequential — no two slices in flight; throughput is merge-bound. Accepted; it matches branch protection.
- Rule: "done" trusts issue state. Closing a sub-issue by hand without its PR merged would advance the walk past unmerged code — only merging the slice's PR may close a sub-issue.
- Rule: slice the PRD before labeling it; adding a sub-issue after the final slice's PR opens can close the PRD (via its `Closes`) with fresh work still open.
- Risk: label checks are check-then-act, not compare-and-swap; two simultaneous `agent:run` invocations against one PRD could both pass the guards for the same candidate. Same exposure as Phase 3; local, human-invoked runs make it unlikely. Accepted for now.
- Follow-ups this ADR generates:
  1. Implement the tick in `scripts/agent/run.mjs` (candidate resolution, guards, `Closes` body convention, sub-issue refusal message).
  2. Update `scripts/agent/queue.mjs` (skip sub-issues; tick-aware summary).
  3. Tests for tick semantics: order resolution, closed-skipping, guards (open PR / blocked / stale lock), last-slice `Closes #<prd>` (colocated, `:memory:` SQLite where DB code is touched).
  4. Doc updates: `docs/agents/triage-labels.md` (PRD enrollment + `agent:queued` deferred — parallel workstream) and the closing note in `.opencode/skills/to-issues/SKILL.md`, which still describes a bundle PR closing the PRD.
  5. Human approval: granted 2026-10-18; implementation lands separately.
