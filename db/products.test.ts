import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { describe, expect, it } from "vitest";
import { createProduct, listProducts, updateProduct } from "./products";
import * as schema from "./schema";

function testDb() {
  const sqlite = new Database(":memory:");
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: "./drizzle" });
  return db;
}

describe("products", () => {
  it("creates a product with name, SKU, price, and stock", () => {
    const db = testDb();
    const product = createProduct(db, {
      name: "Widget",
      sku: "WID-001",
      priceMinor: 1999,
      stock: 10,
    });
    expect(product.id).toBeGreaterThan(0);
    expect(product.name).toBe("Widget");
    expect(product.sku).toBe("WID-001");
    expect(product.priceMinor).toBe(1999);
    expect(product.stock).toBe(10);
  });

  it("rejects a duplicate SKU", () => {
    const db = testDb();
    createProduct(db, { name: "Widget", sku: "WID-001", priceMinor: 1999 });
    expect(() =>
      createProduct(db, { name: "Gadget", sku: "WID-001", priceMinor: 999 }),
    ).toThrow("SKU already exists");
  });

  it("rejects a negative price", () => {
    const db = testDb();
    expect(() =>
      createProduct(db, {
        name: "Widget",
        sku: "WID-001",
        priceMinor: -1,
      }),
    ).toThrow("Price must be non-negative");
  });

  it("rejects negative stock", () => {
    const db = testDb();
    expect(() =>
      createProduct(db, {
        name: "Widget",
        sku: "WID-001",
        priceMinor: 1999,
        stock: -1,
      }),
    ).toThrow("Stock must be non-negative");
  });

  it("rejects a blank name and blank SKU", () => {
    const db = testDb();
    expect(() =>
      createProduct(db, { name: "  ", sku: "WID-001", priceMinor: 0 }),
    ).toThrow("Product name is required");
    expect(() =>
      createProduct(db, { name: "Widget", sku: "  ", priceMinor: 0 }),
    ).toThrow("SKU is required");
  });

  it("defaults stock to zero", () => {
    const db = testDb();
    const product = createProduct(db, {
      name: "Widget",
      sku: "WID-001",
      priceMinor: 1999,
    });
    expect(product.stock).toBe(0);
  });

  it("lists products ordered by SKU", () => {
    const db = testDb();
    createProduct(db, { name: "Beta", sku: "BBB", priceMinor: 100 });
    createProduct(db, { name: "Alpha", sku: "AAA", priceMinor: 200 });
    const products = listProducts(db);
    expect(products.map((p) => p.sku)).toEqual(["AAA", "BBB"]);
  });

  it("updates price and stock and validates the patch", () => {
    const db = testDb();
    const created = createProduct(db, {
      name: "Widget",
      sku: "WID-001",
      priceMinor: 1999,
      stock: 10,
    });
    const updated = updateProduct(db, created.id, {
      priceMinor: 2499,
      stock: 25,
    });
    expect(updated.priceMinor).toBe(2499);
    expect(updated.stock).toBe(25);
    expect(updated.name).toBe("Widget");
    expect(() => updateProduct(db, created.id, { stock: -5 })).toThrow(
      "Stock must be non-negative",
    );
  });

  it("refuses to update a product that does not exist", () => {
    const db = testDb();
    expect(() => updateProduct(db, 999, { stock: 0 })).toThrow(
      "Product not found",
    );
  });
});
