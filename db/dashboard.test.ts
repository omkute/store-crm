import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { describe, expect, it } from "vitest";
import type { StoreDb } from "./customers";
import { createCustomer } from "./customers";
import { getDashboard, lowStock, revenueToday } from "./dashboard";
import { createProduct } from "./products";
import { orders } from "./schema";
import * as schema from "./schema";

function testDb() {
  const sqlite = new Database(":memory:");
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: "./drizzle" });
  return db;
}

function noonOf(dayOffset: number, now: Date): Date {
  return new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + dayOffset,
    12,
    0,
    0,
  );
}

function seed(db: StoreDb) {
  const customer = createCustomer(db, {
    name: "Ada Lovelace",
    email: "ada@example.com",
  });
  const low = createProduct(db, {
    name: "Widget",
    sku: "WID-001",
    priceMinor: 1999,
    stock: 2,
  });
  const edge = createProduct(db, {
    name: "Gadget",
    sku: "GAD-001",
    priceMinor: 500,
    stock: 5,
  });
  const plenty = createProduct(db, {
    name: "Doohickey",
    sku: "DOO-001",
    priceMinor: 100,
    stock: 20,
  });
  return { customer, low, edge, plenty };
}

function insertOrder(
  db: StoreDb,
  row: { customerId: number; totalMinor: number; placedAt: Date },
) {
  return db
    .insert(orders)
    .values({ customerId: row.customerId, totalMinor: row.totalMinor, placedAt: row.placedAt })
    .returning()
    .get();
}

describe("dashboard", () => {
  it("sums only today's orders into revenue", () => {
    const db = testDb();
    const { customer } = seed(db);
    const now = new Date();
    insertOrder(db, { customerId: customer.id, totalMinor: 1999, placedAt: now });
    insertOrder(db, { customerId: customer.id, totalMinor: 500, placedAt: now });
    insertOrder(db, {
      customerId: customer.id,
      totalMinor: 99999,
      placedAt: noonOf(-1, now),
    });
    expect(revenueToday(db, now)).toBe(2499);
  });

  it("reports zero revenue when nothing was sold today", () => {
    const db = testDb();
    const { customer } = seed(db);
    const now = new Date();
    insertOrder(db, {
      customerId: customer.id,
      totalMinor: 99999,
      placedAt: noonOf(-1, now),
    });
    expect(revenueToday(db, now)).toBe(0);
    expect(revenueToday(testDb(), now)).toBe(0);
  });

  it("lists products at or below the low-stock threshold", () => {
    const db = testDb();
    seed(db);
    expect(lowStock(db).map((p) => p.sku)).toEqual(["WID-001", "GAD-001"]);
    expect(lowStock(db, 20).map((p) => p.sku)).toEqual([
      "WID-001",
      "GAD-001",
      "DOO-001",
    ]);
    expect(lowStock(db, 1)).toEqual([]);
  });

  it("lists the latest N orders newest first with customer info", () => {
    const db = testDb();
    const { customer } = seed(db);
    const now = new Date();
    for (let i = 1; i <= 12; i++) {
      insertOrder(db, {
        customerId: customer.id,
        totalMinor: i * 100,
        placedAt: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 8, 0, i),
      });
    }
    const recent = getDashboard(db, { now }).recentOrders;
    expect(recent).toHaveLength(10);
    expect(recent[0].totalMinor).toBe(1200);
    expect(recent[0].customerName).toBe("Ada Lovelace");
    expect(recent[0].status).toBe("recorded");
    expect(recent[0].placedAt).toBeInstanceOf(Date);
    expect(recent[9].totalMinor).toBe(300);
  });

  it("combines revenue, low stock, and recent orders in one call", () => {
    const db = testDb();
    const { customer, low, plenty } = seed(db);
    const now = new Date();
    insertOrder(db, { customerId: customer.id, totalMinor: 1999, placedAt: now });
    insertOrder(db, {
      customerId: customer.id,
      totalMinor: 100,
      placedAt: noonOf(-1, now),
    });
    const summary = getDashboard(db, { now });
    expect(summary.revenueTodayMinor).toBe(1999);
    expect(summary.lowStock.map((p) => p.sku)).toEqual(["WID-001", "GAD-001"]);
    expect(summary.lowStock.find((p) => p.sku === "DOO-001")).toBeUndefined();
    expect(summary.recentOrders).toHaveLength(2);
    expect(summary.recentOrders[0].totalMinor).toBe(1999);
    expect(plenty.stock).toBe(20);
    expect(low.stock).toBe(2);
  });
});
