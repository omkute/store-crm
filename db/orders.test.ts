import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { describe, expect, it } from "vitest";
import { createCustomer, type StoreDb } from "./customers";
import { listOrders, recordOrder } from "./orders";
import { createProduct } from "./products";
import * as schema from "./schema";

function testDb() {
  const sqlite = new Database(":memory:");
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: "./drizzle" });
  return db;
}

function seed(db: StoreDb) {
  const customer = createCustomer(db, {
    name: "Ada Lovelace",
    email: "ada@example.com",
  });
  const widget = createProduct(db, {
    name: "Widget",
    sku: "WID-001",
    priceMinor: 1999,
    stock: 10,
  });
  const gadget = createProduct(db, {
    name: "Gadget",
    sku: "GAD-001",
    priceMinor: 500,
    stock: 3,
  });
  return { customer, widget, gadget };
}

describe("orders", () => {
  it("records an order with a total computed from current prices", () => {
    const db = testDb();
    const { customer, widget, gadget } = seed(db);
    const order = recordOrder(db, {
      customerId: customer.id,
      items: [
        { productId: widget.id, quantity: 2 },
        { productId: gadget.id, quantity: 1 },
      ],
    });
    expect(order.id).toBeGreaterThan(0);
    expect(order.customerId).toBe(customer.id);
    expect(order.totalMinor).toBe(1999 * 2 + 500);
    expect(order.status).toBe("recorded");
    expect(order.placedAt).toBeInstanceOf(Date);
  });

  it("decrements stock for every line item", () => {
    const db = testDb();
    const { customer, widget, gadget } = seed(db);
    recordOrder(db, {
      customerId: customer.id,
      items: [
        { productId: widget.id, quantity: 3 },
        { productId: gadget.id, quantity: 1 },
      ],
    });
    const stocks = new Map(
      db
        .select()
        .from(schema.products)
        .all()
        .map((p) => [p.sku, p.stock]),
    );
    expect(stocks.get("WID-001")).toBe(7);
    expect(stocks.get("GAD-001")).toBe(2);
  });

  it("refuses an oversell and leaves stock untouched", () => {
    const db = testDb();
    const { customer, widget } = seed(db);
    expect(() =>
      recordOrder(db, {
        customerId: customer.id,
        items: [{ productId: widget.id, quantity: 11 }],
      }),
    ).toThrow("Insufficient stock for Widget");
    const after = db.select().from(schema.products).all();
    expect(after.find((p) => p.sku === "WID-001")?.stock).toBe(10);
    expect(after.find((p) => p.sku === "GAD-001")?.stock).toBe(3);
    expect(listOrders(db)).toHaveLength(0);
  });

  it("refuses an empty order", () => {
    const db = testDb();
    const { customer } = seed(db);
    expect(() =>
      recordOrder(db, { customerId: customer.id, items: [] }),
    ).toThrow("Order must have at least one line item");
  });

  it("refuses an unknown customer or product", () => {
    const db = testDb();
    const { customer, widget } = seed(db);
    expect(() =>
      recordOrder(db, {
        customerId: 999,
        items: [{ productId: widget.id, quantity: 1 }],
      }),
    ).toThrow("Customer not found");
    expect(() =>
      recordOrder(db, {
        customerId: NaN,
        items: [{ productId: widget.id, quantity: 1 }],
      }),
    ).toThrow("Customer not found");
    expect(() =>
      recordOrder(db, {
        customerId: customer.id,
        items: [{ productId: 999, quantity: 1 }],
      }),
    ).toThrow("Product not found");
  });

  it("refuses a non-positive quantity", () => {
    const db = testDb();
    const { customer, widget } = seed(db);
    expect(() =>
      recordOrder(db, {
        customerId: customer.id,
        items: [{ productId: widget.id, quantity: 0 }],
      }),
    ).toThrow("Quantity must be a positive integer");
    expect(() =>
      recordOrder(db, {
        customerId: customer.id,
        items: [{ productId: widget.id, quantity: -2 }],
      }),
    ).toThrow("Quantity must be a positive integer");
  });

  it("merges duplicate lines for the same product", () => {
    const db = testDb();
    const { customer, widget } = seed(db);
    const order = recordOrder(db, {
      customerId: customer.id,
      items: [
        { productId: widget.id, quantity: 2 },
        { productId: widget.id, quantity: 3 },
      ],
    });
    expect(order.totalMinor).toBe(1999 * 5);
    const after = db.select().from(schema.products).all();
    expect(after.find((p) => p.sku === "WID-001")?.stock).toBe(5);
  });

  it("lists recent orders newest first with customer name and items", () => {
    const db = testDb();
    const { customer, widget, gadget } = seed(db);
    recordOrder(db, {
      customerId: customer.id,
      items: [{ productId: gadget.id, quantity: 1 }],
    });
    recordOrder(db, {
      customerId: customer.id,
      items: [
        { productId: widget.id, quantity: 2 },
        { productId: gadget.id, quantity: 2 },
      ],
    });
    const orders = listOrders(db);
    expect(orders).toHaveLength(2);
    expect(orders[0].totalMinor).toBe(1999 * 2 + 500 * 2);
    expect(orders[0].customerName).toBe("Ada Lovelace");
    expect(orders[0].status).toBe("recorded");
    expect(orders[0].items).toEqual([
      { productName: "Widget", quantity: 2, unitPriceMinor: 1999 },
      { productName: "Gadget", quantity: 2, unitPriceMinor: 500 },
    ]);
    expect(orders[1].totalMinor).toBe(500);
  });
});
