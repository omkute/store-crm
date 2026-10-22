import { describe, expect, it, vi } from "vitest";
import { createProduct } from "@/db/products";
import ProductsPage from "./page";

const { connectionMock } = vi.hoisted(() => ({
  connectionMock: vi.fn(() => Promise.resolve()),
}));

// System boundaries: the framework APIs the page uses and the file DB it opens
// at import time (tests build their own :memory: database — see db/index.ts).
vi.mock("next/server", () => ({ connection: connectionMock }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/db", async () => {
  const Database = (await import("better-sqlite3")).default;
  const { drizzle } = await import("drizzle-orm/better-sqlite3");
  const { migrate } = await import("drizzle-orm/better-sqlite3/migrator");
  const schema = await import("@/db/schema");
  const sqlite = new Database(":memory:");
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: "./drizzle" });
  return { db };
});

function renderedText(node: unknown): string {
  if (node === null || node === undefined || typeof node === "boolean") {
    return "";
  }
  if (typeof node === "string" || typeof node === "number") {
    return String(node);
  }
  if (Array.isArray(node)) return node.map(renderedText).join("");
  const element = node as { props?: { children?: unknown } };
  if (element.props?.children !== undefined) {
    return renderedText(element.props.children);
  }
  return "";
}

describe("Products page", () => {
  it("blocks on connection() before rendering the inventory", async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    connectionMock.mockImplementationOnce(() => gate);

    const rendered = ProductsPage();
    let settled = false;
    rendered.then(
      () => {
        settled = true;
      },
      () => {
        settled = true;
      },
    );

    // Flush every pending microtask. A render that does not wait on
    // connection() has already settled by now; a blocked one has not.
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(settled).toBe(false);

    release();
    await expect(rendered).resolves.toBeDefined();
  });

  it("renders the Products currently in the database", async () => {
    const { db } = await import("@/db");
    createProduct(db, {
      name: "Widget",
      sku: "WID-001",
      priceMinor: 1999,
      stock: 10,
    });

    const first = renderedText(await ProductsPage());
    expect(first).toContain("Inventory (1)");
    expect(first).toContain("Widget");

    createProduct(db, { name: "Gadget", sku: "GAD-001", priceMinor: 500 });

    const second = renderedText(await ProductsPage());
    expect(second).toContain("Inventory (2)");
    expect(second).toContain("Gadget");
  });
});
