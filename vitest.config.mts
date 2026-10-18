import path from "node:path";
import { fileURLToPath } from "node:url";
import { configDefaults, defineConfig } from "vitest/config";

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    // Mirror tsconfig's "@/*" path alias so tests can import app modules.
    alias: [{ find: /^@\/(.*)$/, replacement: `${root}/$1` }],
  },
  test: {
    include: ["**/*.test.ts"],
    // Worktrees live under .opencode/worktrees/ — never collect their tests.
    exclude: [...configDefaults.exclude, "**/.opencode/**"],
    environment: "node",
  },
});
