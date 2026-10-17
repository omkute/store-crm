# Triage labels

Labels **are** the state machine — there is no external DB (see AGENTS.md, "The one architectural law"). The orchestrator (`scripts/agent/run.mjs`, via `pnpm agent:run` / `pnpm agent:queue`) is the only thing that moves issues between these states; the agent never edits labels.

## Agent state labels

| Label | Meaning |
| --- | --- |
| `agent:implement` | Ready for the implement workflow to run. |
| `agent:queued` | Ready for agent work, but waiting on declared blockers. Auto-promotes when blockers clear (Phase 4). |
| `agent:in-progress` | An implement run is currently active. Doubles as the lock — one run per issue. |
| `agent:review` | Draft PR is open and awaiting review (on the PR). |
| `agent:blocked` | A run failed or was refused; needs human attention before retry. Re-add `agent:implement` to retry. |

## Transitions

```
agent:implement ──run starts──▶ agent:in-progress ──draft PR opened──▶ agent:review (on PR)
       ▲                              │
       │                              └──run failed──▶ agent:blocked ──re-add──▶ agent:implement
       └──human retry─────────────────────────────────────────────┘

Refusals (no run): sub-issue of another issue → agent:blocked + comment.
                   an open PR already references the issue → clear agent:implement + comment.
```
