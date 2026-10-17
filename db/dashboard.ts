import { and, asc, gte, lt, lte } from "drizzle-orm";
import type { StoreDb } from "./customers";
import { listOrders, type OrderSummary } from "./orders";
import { products, orders, type Product } from "./schema";

export const LOW_STOCK_THRESHOLD = 5;
export const RECENT_ORDERS_LIMIT = 10;

export interface DashboardSummary {
  revenueTodayMinor: number;
  lowStock: Product[];
  recentOrders: OrderSummary[];
}

function startOfDay(now: Date): Date {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function endOfDay(now: Date): Date {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
}

export function revenueToday(db: StoreDb, now: Date = new Date()): number {
  const rows = db
    .select({ totalMinor: orders.totalMinor })
    .from(orders)
    .where(
      and(gte(orders.placedAt, startOfDay(now)), lt(orders.placedAt, endOfDay(now))),
    )
    .all();
  return rows.reduce((sum, row) => sum + row.totalMinor, 0);
}

export function lowStock(
  db: StoreDb,
  threshold: number = LOW_STOCK_THRESHOLD,
): Product[] {
  return db
    .select()
    .from(products)
    .where(lte(products.stock, threshold))
    .orderBy(asc(products.stock), asc(products.sku))
    .all();
}

export function getDashboard(
  db: StoreDb,
  opts?: { now?: Date; threshold?: number; limit?: number },
): DashboardSummary {
  return {
    revenueTodayMinor: revenueToday(db, opts?.now),
    lowStock: lowStock(db, opts?.threshold),
    recentOrders: listOrders(db, { limit: opts?.limit ?? RECENT_ORDERS_LIMIT }),
  };
}
