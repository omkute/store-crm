---
name: to-prd
description: Synthesize conversation into a PRD GitHub issue (Problem, Solution, User Stories, Implementation and Testing Decisions) ready for /to-issues.
metadata:
  opencode/slash: "true"
---

# To PRD (store-crm)

Turn the current conversation into a PRD and publish it as a GitHub issue in `omkute/store-crm`. Do **not** apply `agent:implement` — labeling happens after sub-issues exist (Phase 3).

Do NOT interview the user — synthesize what you already know. If context is thin, ask the user to talk through the problem first; don't run on an empty plate.

## Process

1. **Explore the repo** if you haven't. Read `GLOSSARY.md` and respect `docs/adr/` for areas you touch. Use the ubiquitous language exactly: Customer, Product, Order, Dashboard.
2. **Sketch the major modules** you'd build or modify (e.g. Drizzle schema, services, App Router pages). Look for deep modules testable in isolation. Confirm with the user that the modules match expectations.
3. **Write the PRD** with the template below and publish via `gh issue create`. Use a heredoc for the body. Add no labels unless asked.
4. **Output the issue URL** so the user can run `/to-issues <number>` next.

## PRD template

The PRD is read by humans, by `/to-issues` when slicing, and by the implement workflow as spec context. It must be concrete enough to implement against without re-deriving decisions.

```markdown
## Problem Statement

The problem, from the user's perspective.

## Solution

The solution, from the user's perspective.

## User Stories

A LONG numbered list, one per line:

1. As a <actor>, I want <feature>, so that <benefit>

Cover every aspect of the feature.

## Implementation Decisions

- Modules to build/modify and their interfaces
- Schema changes, API contracts, key interactions
- Architectural decisions and technical clarifications

Do NOT include file paths or code snippets (they go stale).
Exception: a prototype-derived snippet (state machine, schema, type shape) may be inlined when prose cannot encode the decision precisely; note its prototype origin and trim to the decision-rich parts.

## Testing Decisions

- What makes a good test here (external behavior only, colocated `*.test.ts`, `:memory:` SQLite)
- Which modules get tests; prior art in the repo

## Out of Scope

Explicitly excluded work — "we are not building X", not "X is out of scope".

## Further Notes

Open questions, risks, deferred decisions.
```

## After publishing

Tell the user: "PRD published at <URL>. Run `/to-issues <number>` to break it into sub-issues." Never add `agent:implement` yourself — the PRD has no sub-issues yet.
