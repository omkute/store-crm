import { asc, eq } from "drizzle-orm";
import type { StoreDb } from "./customers";
import { products, type Product } from "./schema";

export interface ProductInput {
  name: string;
  sku: string;
  priceMinor: number;
  stock?: number;
}

function validated(input: ProductInput): {
  name: string;
  sku: string;
  priceMinor: number;
  stock: number;
} {
  const name = input.name.trim();
  if (name === "") throw new Error("Product name is required");
  const sku = input.sku.trim();
  if (sku === "") throw new Error("SKU is required");
  const priceMinor = input.priceMinor;
  if (!Number.isInteger(priceMinor) || priceMinor < 0)
    throw new Error("Price must be non-negative");
  const stock = input.stock ?? 0;
  if (!Number.isInteger(stock) || stock < 0)
    throw new Error("Stock must be non-negative");
  return { name, sku, priceMinor, stock };
}

export function createProduct(db: StoreDb, input: ProductInput): Product {
  const v = validated(input);
  const existing = db
    .select({ id: products.id })
    .from(products)
    .where(eq(products.sku, v.sku))
    .get();
  if (existing) throw new Error("SKU already exists");
  return db.insert(products).values(v).returning().get();
}

export function listProducts(db: StoreDb): Product[] {
  return db.select().from(products).orderBy(asc(products.sku)).all();
}

export function updateProduct(
  db: StoreDb,
  id: number,
  patch: Partial<ProductInput>,
): Product {
  const current = db.select().from(products).where(eq(products.id, id)).get();
  if (!current) throw new Error("Product not found");
  const merged = validated({
    name: patch.name ?? current.name,
    sku: patch.sku ?? current.sku,
    priceMinor: patch.priceMinor ?? current.priceMinor,
    stock: patch.stock ?? current.stock,
  });
  if (merged.sku !== current.sku) {
    const clash = db
      .select({ id: products.id })
      .from(products)
      .where(eq(products.sku, merged.sku))
      .get();
    if (clash) throw new Error("SKU already exists");
  }
  return db
    .update(products)
    .set(merged)
    .where(eq(products.id, id))
    .returning()
    .get();
}
