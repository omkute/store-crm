# ADR 0001 — SQLite via Drizzle ORM

- Status: accepted
- Date: 2026-10-16
- Context: Store CRM is a learning vehicle. We want zero infrastructure — no Docker, no hosted database — so `pnpm check` passes on a fresh clone and in CI with no services.
- Decision: persist with a SQLite file (`better-sqlite3`) accessed through Drizzle ORM. Schema lives in `db/schema.ts`; migrations generated with `pnpm db:generate` into `drizzle/`.
- Consequences:
  - Good: zero infra, single-file DB, fast Vitest runs, Drizzle gives us typed queries and a migration path to Postgres later.
  - Bad: `better-sqlite3` is a native module (needs `pnpm.onlyBuiltDependencies`); SQLite has single-writer semantics — fine for this app, not for high concurrency.
  - Rule: never commit `*.db` files; tests use `:memory:` or temp files.
