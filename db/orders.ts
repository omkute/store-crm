import { desc, eq } from "drizzle-orm";
import type { StoreDb } from "./customers";
import {
  customers,
  orderItems,
  orders,
  products,
  type Order,
  type OrderItem,
} from "./schema";

export interface OrderLineInput {
  productId: number;
  quantity: number;
}

export interface RecordOrderInput {
  customerId: number;
  items: OrderLineInput[];
}

export interface OrderSummary {
  id: number;
  customerName: string;
  totalMinor: number;
  status: string;
  placedAt: Date;
  items: { productName: string; quantity: number; unitPriceMinor: number }[];
}

function mergedLines(items: OrderLineInput[]): OrderLineInput[] {
  const byProduct = new Map<number, number>();
  for (const line of items) {
    if (!Number.isInteger(line.quantity) || line.quantity < 1)
      throw new Error("Quantity must be a positive integer");
    if (!Number.isInteger(line.productId))
      throw new Error("Product not found");
    byProduct.set(line.productId, (byProduct.get(line.productId) ?? 0) + line.quantity);
  }
  return [...byProduct].map(([productId, quantity]) => ({ productId, quantity }));
}

export function recordOrder(db: StoreDb, input: RecordOrderInput): Order {
  if (input.items.length === 0)
    throw new Error("Order must have at least one line item");
  if (!Number.isInteger(input.customerId)) throw new Error("Customer not found");
  const lines = mergedLines(input.items);

  return db.transaction((tx) => {
    const customer = tx
      .select({ id: customers.id })
      .from(customers)
      .where(eq(customers.id, input.customerId))
      .get();
    if (!customer) throw new Error("Customer not found");

    let totalMinor = 0;
    const rows = lines.map((line) => {
      const product = tx.select().from(products).where(eq(products.id, line.productId)).get();
      if (!product) throw new Error("Product not found");
      if (product.stock < line.quantity)
        throw new Error(`Insufficient stock for ${product.name}`);
      totalMinor += product.priceMinor * line.quantity;
      return {
        productId: product.id,
        quantity: line.quantity,
        unitPriceMinor: product.priceMinor,
        stockAfter: product.stock - line.quantity,
      };
    });

    const order = tx
      .insert(orders)
      .values({ customerId: input.customerId, totalMinor })
      .returning()
      .get();
    for (const row of rows) {
      tx.insert(orderItems)
        .values({
          orderId: order.id,
          productId: row.productId,
          quantity: row.quantity,
          unitPriceMinor: row.unitPriceMinor,
        })
        .run();
      tx.update(products)
        .set({ stock: row.stockAfter })
        .where(eq(products.id, row.productId))
        .run();
    }
    return order;
  });
}

export function listOrderItems(db: StoreDb, orderId: number): OrderItem[] {
  return db
    .select()
    .from(orderItems)
    .where(eq(orderItems.orderId, orderId))
    .all();
}

export function listOrders(db: StoreDb): OrderSummary[] {
  const rows = db
    .select({
      id: orders.id,
      customerName: customers.name,
      totalMinor: orders.totalMinor,
      status: orders.status,
      placedAt: orders.placedAt,
    })
    .from(orders)
    .innerJoin(customers, eq(orders.customerId, customers.id))
    .orderBy(desc(orders.placedAt), desc(orders.id))
    .all();
  return rows.map((row) => ({
    ...row,
    items: db
      .select({
        productName: products.name,
        quantity: orderItems.quantity,
        unitPriceMinor: orderItems.unitPriceMinor,
      })
      .from(orderItems)
      .innerJoin(products, eq(orderItems.productId, products.id))
      .where(eq(orderItems.orderId, row.id))
      .all(),
  }));
}
