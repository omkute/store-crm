---
name: to-issues
description: Break a PRD issue into ordered tracer-bullet sub-issues (schema to UI to tests) attached as native GitHub sub-issues.
metadata:
  opencode/slash: "true"
---

# To Issues (store-crm)

Break a parent PRD into a flat list of native GitHub sub-issues, in execution order. Each sub-issue is a tracer-bullet vertical slice the implement workflow picks up one at a time. Argument is the parent PRD issue number.

## Process

### 1. Fetch the PRD

```bash
gh issue view <PRD_NUMBER> --comments
```

The PRD is the spec. Don't add scope; don't redesign. If ambiguous, ask the user to clarify before drafting slices.

### 2. Confirm no existing sub-issues

```bash
gh api repos/omkute/store-crm/issues/<PRD_NUMBER>/sub_issues --jq 'length'
```

If non-zero, stop and ask whether to (a) abort, (b) add on top, or (c) close/delete existing first. Never silently double up.

### 3. Explore the codebase (optional)

Read `GLOSSARY.md`, respect `docs/adr/`. Use ubiquitous language (Customer, Product, Order, Dashboard) in titles and bodies. Look for prefactors: "make the change easy, then make the easy change."

### 4. Draft vertical slices

Each slice is a thin cut through every layer (schema → service → UI → tests), NOT one horizontal layer:

- A completed slice is demoable alone
- Slices are **flat** — never nest; split oversized slices into peers
- Prefactoring goes first, in its own slice(s)
- Order satisfies dependencies; slices run in list order
- Each slice fits one agent session (a couple of files + tests + `pnpm check`)

### 5. Quiz the user

Present a numbered list. Per slice show Title, What it builds (1–2 sentences), Depends on (earlier slice position or "none"). Ask: granularity right? order right? merge/split/drop anything? Iterate until approved.

### 6. Publish in order

Per slice:

```bash
gh issue create --title "<title>" --body "$(cat <<'EOF'
<body — see template>
EOF
)"
# capture the number, then get its REST id:
gh api repos/omkute/store-crm/issues/<SUB_NUMBER> --jq '.id'
# attach as native sub-issue of the PRD:
gh api -X POST "repos/omkute/store-crm/issues/<PRD_NUMBER>/sub_issues" -f sub_issue_id=<SUB_ID>
```

Do NOT apply `agent:implement` to sub-issues — they are never labeled directly. The user labels the **PRD** when ready.

### Sub-issue body template

```markdown
## Parent PRD

#<PRD_NUMBER>

## What to build

End-to-end behavior this slice delivers, 1–3 short paragraphs. Frame around what it delivers, not which files change. No file paths or snippets (exception: prototype-derived decision encodings, trimmed).

## Acceptance criteria

- [ ] Concrete, checkable outcome 1
- [ ] Concrete, checkable outcome 2
- [ ] Tests cover the new behavior

## Depends on

Name earlier sub-issues this builds on (e.g. "Sub-issue #N — <title>"). Omit if none.
```

No `Closes` directive — the implement workflow closes sub-issues; the bundled PR closes the PRD via `Closes #<PRD>`.

## After publishing

Output the PRD URL and sub-issue count. Tell the user: "Add `agent:implement` to PRD #<N> when ready." Order in the PRD determines execution order; reorder in the GitHub UI before labeling if needed.
