import { asc, eq, like, or } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { customers, type Customer } from "./schema";
import * as schema from "./schema";

export type StoreDb = BetterSQLite3Database<typeof schema>;

export interface CustomerInput {
  name: string;
  email: string;
  phone?: string;
  notes?: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validated(input: CustomerInput): {
  name: string;
  email: string;
  phone: string;
  notes: string;
} {
  const name = input.name.trim();
  if (name === "") throw new Error("Customer name is required");
  const email = input.email.trim();
  if (!EMAIL_RE.test(email)) throw new Error("Customer email is invalid");
  return {
    name,
    email,
    phone: input.phone?.trim() ?? "",
    notes: input.notes?.trim() ?? "",
  };
}

export function createCustomer(db: StoreDb, input: CustomerInput): Customer {
  return db.insert(customers).values(validated(input)).returning().get();
}

export function listCustomers(
  db: StoreDb,
  opts?: { search?: string },
): Customer[] {
  const q = opts?.search?.trim() ?? "";
  if (q === "") return db.select().from(customers).orderBy(asc(customers.id)).all();
  const pattern = `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
  return db
    .select()
    .from(customers)
    .where(
      or(
        like(customers.name, pattern),
        like(customers.email, pattern),
        like(customers.phone, pattern),
      ),
    )
    .orderBy(asc(customers.id))
    .all();
}

export function updateCustomer(
  db: StoreDb,
  id: number,
  patch: Partial<CustomerInput>,
): Customer {
  const current = db
    .select()
    .from(customers)
    .where(eq(customers.id, id))
    .get();
  if (!current) throw new Error("Customer not found");
  const merged = validated({
    name: patch.name ?? current.name,
    email: patch.email ?? current.email,
    phone: patch.phone ?? current.phone,
    notes: patch.notes ?? current.notes,
  });
  return db
    .update(customers)
    .set(merged)
    .where(eq(customers.id, id))
    .returning()
    .get();
}
