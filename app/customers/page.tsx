import { revalidatePath } from "next/cache";
import { db } from "@/db";
import {
  createCustomer,
  listCustomers,
  updateCustomer,
} from "@/db/customers";

// Directory reads live SQLite rows per request — allowed to block on the
// server (Cache Components incremental opt-out). Revisit in a later slice.
export const instant = false;

async function create(formData: FormData) {
  "use server";
  createCustomer(db, {
    name: String(formData.get("name") ?? ""),
    email: String(formData.get("email") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    notes: String(formData.get("notes") ?? ""),
  });
  revalidatePath("/customers");
}

async function update(id: number, formData: FormData) {
  "use server";
  updateCustomer(db, id, {
    name: String(formData.get("name") ?? ""),
    email: String(formData.get("email") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    notes: String(formData.get("notes") ?? ""),
  });
  revalidatePath("/customers");
}

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const customers = listCustomers(db, { search: q });

  return (
    <main style={{ padding: 32, fontFamily: "system-ui, sans-serif" }}>
      <h1>Customers</h1>

      <form method="get" action="/customers">
        <input
          type="search"
          name="q"
          placeholder="Search name, email, phone"
          defaultValue={q ?? ""}
        />
        <button type="submit">Search</button>
      </form>

      <h2>Add a customer</h2>
      <form action={create}>
        <input type="text" name="name" placeholder="Name" required />
        <input type="email" name="email" placeholder="Email" required />
        <input type="tel" name="phone" placeholder="Phone" />
        <input type="text" name="notes" placeholder="Notes" />
        <button type="submit">Add</button>
      </form>

      <h2>Directory ({customers.length})</h2>
      <ul>
        {customers.map((customer) => (
          <li key={customer.id}>
            <form action={update.bind(null, customer.id)}>
              <input type="text" name="name" defaultValue={customer.name} required />
              <input
                type="email"
                name="email"
                defaultValue={customer.email}
                required
              />
              <input type="tel" name="phone" defaultValue={customer.phone} />
              <input type="text" name="notes" defaultValue={customer.notes} />
              <button type="submit">Save</button>
            </form>
          </li>
        ))}
      </ul>
    </main>
  );
}
