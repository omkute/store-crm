---
name: do-work
description: End-to-end implementation workflow for a GitHub issue — explore, implement with TDD, run pnpm check until green, commit locally.
metadata:
  opencode/slash: "true"
---

# Do Work (store-crm)

Complete implementation workflow from exploration to local commit for one GitHub issue. You do work in a git checkout and write files; the orchestrator owns all GitHub mutations (PRs, labels, merges).

## 1. Explore

- Read `AGENTS.md`, `GLOSSARY.md`, and the `docs/adr/` decisions touching your area. Use the ubiquitous language exactly: Customer, Product, Order, Dashboard.
- Read the issue body (`gh issue view <n>`) — it is the spec. Don't expand scope. If ambiguous, ask before building.
- Skim the code you will touch (schema in `db/schema.ts`, services, App Router pages).

## 2. Implement (TDD)

- **One failing test at a time** through the same interface the app uses (service method → real `:memory:` SQLite → assert on results). Never test internal query structure; never test what the type system already proves.
- Simplest implementation that passes, then the next test. Refactor only under green tests.
- Tests colocate with code (`db/*.test.ts`); never touch the dev `./store-crm.db`; never commit `*.db`.

## 3. Feedback loops (sequentially, until green)

1. `pnpm typecheck`
2. `pnpm lint`
3. `pnpm test` (targeted file while iterating; full suite before finishing)

Fix what each reports and re-run before moving on. `pnpm check` is the gate: green before you stop.

## 4. Commit locally

Conventional commits (`feat:`, `fix:`, `chore:`), each ending with the trailer `Co-Authored-By: opencode`. Push the branch; do NOT open or merge the PR yourself — report the branch name and `pnpm check` evidence, and wait for review.
