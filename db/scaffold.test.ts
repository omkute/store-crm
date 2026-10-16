import { describe, expect, it } from "vitest";
import { db, sqlite } from "./index";

describe("scaffold", () => {
  it("connects to sqlite", () => {
    const row = sqlite.prepare("SELECT 1 + 1 AS two").get() as { two: number };
    expect(row.two).toBe(2);
  });

  it("exposes a drizzle db instance", () => {
    expect(db).toBeDefined();
  });
});
