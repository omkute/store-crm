import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { describe, expect, it } from "vitest";
import { createCustomer, listCustomers, updateCustomer } from "./customers";
import * as schema from "./schema";

function testDb() {
  const sqlite = new Database(":memory:");
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: "./drizzle" });
  return db;
}

describe("customers", () => {
  it("creates a customer with name, email, phone, and notes", () => {
    const db = testDb();
    const customer = createCustomer(db, {
      name: "Ada Lovelace",
      email: "ada@example.com",
      phone: "555-0100",
      notes: "Prefers email.",
    });
    expect(customer.id).toBeGreaterThan(0);
    expect(customer.name).toBe("Ada Lovelace");
    expect(customer.email).toBe("ada@example.com");
    expect(customer.phone).toBe("555-0100");
    expect(customer.notes).toBe("Prefers email.");
  });

  it("rejects an invalid email and stores nothing", () => {
    const db = testDb();
    expect(() =>
      createCustomer(db, { name: "Ada Lovelace", email: "not-an-email" }),
    ).toThrow("Customer email is invalid");
  });

  it("rejects a blank name", () => {
    const db = testDb();
    expect(() =>
      createCustomer(db, { name: "   ", email: "ada@example.com" }),
    ).toThrow("Customer name is required");
  });

  it("defaults phone and notes to empty strings", () => {
    const db = testDb();
    const customer = createCustomer(db, {
      name: "Ada Lovelace",
      email: "ada@example.com",
    });
    expect(customer.phone).toBe("");
    expect(customer.notes).toBe("");
  });

  it("lists customers and finds them via search", () => {
    const db = testDb();
    createCustomer(db, {
      name: "Ada Lovelace",
      email: "ada@example.com",
      phone: "555-0100",
    });
    createCustomer(db, {
      name: "Grace Hopper",
      email: "grace@example.com",
      phone: "555-0200",
    });
    expect(listCustomers(db)).toHaveLength(2);
    expect(listCustomers(db, { search: "grace" })).toHaveLength(1);
    expect(listCustomers(db, { search: "555-0100" })).toHaveLength(1);
    expect(listCustomers(db, { search: "nobody" })).toHaveLength(0);
  });

  it("updates a customer's details and validates the patch", () => {
    const db = testDb();
    const created = createCustomer(db, {
      name: "Ada Lovelace",
      email: "ada@example.com",
    });
    const updated = updateCustomer(db, created.id, {
      phone: "555-9999",
      notes: "Call after 5pm.",
    });
    expect(updated.phone).toBe("555-9999");
    expect(updated.notes).toBe("Call after 5pm.");
    expect(updated.name).toBe("Ada Lovelace");
    expect(() =>
      updateCustomer(db, created.id, { email: "bad" }),
    ).toThrow("Customer email is invalid");
  });

  it("refuses to update a customer that does not exist", () => {
    const db = testDb();
    expect(() => updateCustomer(db, 999, { phone: "555-0000" })).toThrow(
      "Customer not found",
    );
  });
});
