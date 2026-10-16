<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Store CRM — agent entry point

Learning vehicle for a PRD-driven agent workflow (Next.js + Drizzle + SQLite + Vitest).

## Repo layout

- `app/` — Next.js App Router pages.
- `db/` — Drizzle schema (`schema.ts`), connection (`index.ts`), `*.test.ts` colocated tests.
- `drizzle/` — generated migrations (`pnpm db:generate`).
- `docs/adr/` — architecture decisions. Read before contradicting a decision.
- `docs/agents/merging.md` — the PR ritual. Every change lands this way.
- `GLOSSARY.md` — domain terms. Use exactly these words.
- `.opencode/agent/` — `implementer` (does work), `reviewer` (read-only review).
- `.opencode/prompts/` — prompts for headless runs (Phase 3+).
- `scripts/` — `check.sh` (single gate), `agent/` (label state machine, Phase 3+).

## Commands

- `pnpm check` — THE gate. Runs `pnpm typecheck && pnpm lint && pnpm test`. Green before you push, green before you open a PR.
- `pnpm typecheck` — `tsc --noEmit`.
- `pnpm lint` — `eslint`.
- `pnpm test` — `vitest run`. Run only the test file(s) covering your change while iterating; full suite runs in CI.
- `pnpm dev` / `pnpm build` — run / build the app.
- `pnpm db:generate` / `pnpm db:migrate` — Drizzle Kit.

## Testing rules

- TDD: write the failing test first, then the smallest implementation.
- Colocate tests with the code they cover (`db/*.test.ts`).
- Mock at system boundaries only, never an internal collaborator.
- SQLite file DB (`better-sqlite3`, `./store-crm.db`). Never commit `*.db`. Tests use `:memory:` or a temp file — never production data (there is none yet, keep it that way).

## Landing a change

Read `docs/agents/merging.md` before you start a change, and again before you merge. Worktree → implement → `pnpm check` → PR → wait → merge. No direct pushes to `main`.

## The one architectural law

The orchestrator owns every mutation (labels, comments, PRs, pushes to GitHub state). The agent only does work in a git checkout and writes files (diffs, local commits, JSON outputs). Labels ARE the state machine — no external DB.
