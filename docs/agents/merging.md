# Landing a change

`main` is protected by a ruleset: a PR merges only once the `check` status is green on a branch that is up to date with `main` (strict). Every change lands through this sequence.

1. **Worktree.** `git fetch origin && git worktree add .opencode/worktrees/<name> -b <branch> origin/main`, then `pnpm install` inside it.
2. **Commit.** `pnpm check` is green before you push. Conventional commits; every agent commit ends with the trailer `Co-Authored-By: opencode`.
3. **PR.** `gh pr create`; the body states what changed and how it was verified (`pnpm check` output, tests added), or says `No UI change` for non-UI work.
4. **Merge.** Done when the PR shows `MERGED` and your worktree is gone:
   1. Wait for `check` to pass (`gh pr checks <pr> --watch`).
   2. If `gh pr view <pr> --json mergeStateStatus` says `BEHIND`, run `gh pr update-branch <pr>` and go back to 4.1.
   3. `gh pr merge <pr> --merge`.
   4. `git push origin --delete <branch>`, then `git worktree remove .opencode/worktrees/<name>`.

**Waiting and polling.** Prefer `gh pr checks <pr> --watch` to a hand-rolled loop. Any wait loop you do write gets a timeout and writes its logs inside your own worktree, never shared `/tmp`.

The ruleset is the only gate, and it holds for agents without exception: merge through the loop above, every time. `--admin`, ruleset bypass and direct pushes to `main` are reserved for the human admin.

Never skip hooks: no `git commit --no-verify`, no workarounds. If a hook fails because of something on `main`, fix forward or wait for the PR that fixes it; never bypass.
