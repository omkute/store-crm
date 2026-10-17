import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { listCustomers } from "@/db/customers";
import { listOrders, recordOrder } from "@/db/orders";
import { listProducts } from "@/db/products";

// Order reads live SQLite rows per request — allowed to block on the
// server (Cache Components incremental opt-out). Revisit in a later slice.
export const instant = false;

async function record(formData: FormData) {
  "use server";
  const items: { productId: number; quantity: number }[] = [];
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("qty-")) continue;
    const raw = String(value);
    if (raw.trim() === "" || Number(raw) === 0) continue;
    items.push({ productId: Number(key.slice(4)), quantity: Number(raw) });
  }
  let failure: string | null = null;
  try {
    recordOrder(db, {
      customerId: Number(formData.get("customerId")),
      items,
    });
  } catch (err) {
    failure = err instanceof Error ? err.message : "Could not record the order";
  }
  if (failure !== null) redirect(`/orders?error=${encodeURIComponent(failure)}`);
  revalidatePath("/orders");
}

function formatPrice(minor: number): string {
  return `$${(minor / 100).toFixed(2)}`;
}

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const customers = listCustomers(db);
  const products = listProducts(db);
  const orders = listOrders(db);

  return (
    <main style={{ padding: 32, fontFamily: "system-ui, sans-serif" }}>
      <h1>Orders</h1>

      {error && (
        <p role="alert" style={{ color: "crimson" }}>
          {error}
        </p>
      )}

      <h2>Record an order</h2>
      {customers.length === 0 || products.length === 0 ? (
        <p>Add at least one customer and one product first.</p>
      ) : (
        <form action={record}>
          <select name="customerId" required defaultValue="">
            <option value="" disabled>
              Choose a customer
            </option>
            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.name}
              </option>
            ))}
          </select>{" "}
          <button type="submit">Record order</button>
          <table style={{ marginTop: 12, borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left" }}>Product</th>
                <th style={{ textAlign: "left" }}>Price</th>
                <th style={{ textAlign: "left" }}>In stock</th>
                <th style={{ textAlign: "left" }}>Qty</th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => (
                <tr key={product.id}>
                  <td style={{ padding: "4px 12px 4px 0" }}>
                    {product.name} <small>({product.sku})</small>
                  </td>
                  <td style={{ padding: "4px 12px 4px 0" }}>
                    {formatPrice(product.priceMinor)}
                  </td>
                  <td style={{ padding: "4px 12px 4px 0" }}>{product.stock}</td>
                  <td style={{ padding: "4px 12px 4px 0" }}>
                    <input
                      type="number"
                      name={`qty-${product.id}`}
                      min="0"
                      step="1"
                      defaultValue={0}
                      style={{ width: 64 }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </form>
      )}

      <h2>Recent orders ({orders.length})</h2>
      {orders.length === 0 ? (
        <p>No orders yet.</p>
      ) : (
        <ul>
          {orders.map((order) => (
            <li key={order.id} style={{ marginBottom: 8 }}>
              <strong>{order.customerName}</strong> — {formatPrice(order.totalMinor)}{" "}
              — {order.status} — {order.placedAt.toLocaleDateString("en-CA")}
              <ul>
                {order.items.map((item) => (
                  <li key={item.productName}>
                    {item.quantity} × {item.productName} @{" "}
                    {formatPrice(item.unitPriceMinor)}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
