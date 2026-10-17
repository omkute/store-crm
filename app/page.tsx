import { connection } from "next/server";
import { db } from "@/db";
import {
  getDashboard,
  LOW_STOCK_THRESHOLD,
} from "@/db/dashboard";

// The dashboard reads live SQLite rows per request — today's revenue must
// never be frozen at build time, so this segment is allowed to block
// (Cache Components opt-out via instant = false + connection()).
export const instant = false;

function formatPrice(minor: number): string {
  return `$${(minor / 100).toFixed(2)}`;
}

export default async function DashboardPage() {
  await connection();
  const { revenueTodayMinor, lowStock, recentOrders } = getDashboard(db);

  return (
    <main style={{ padding: 32, fontFamily: "system-ui, sans-serif" }}>
      <h1>Dashboard</h1>

      <section style={{ marginBottom: 24 }}>
        <h2>Today&rsquo;s revenue</h2>
        <p style={{ fontSize: 32, margin: "8px 0" }}>
          {formatPrice(revenueTodayMinor)}
        </p>
      </section>

      <section style={{ marginBottom: 24 }}>
        <h2>
          <a href="/products">Low stock (&le; {LOW_STOCK_THRESHOLD})</a>
        </h2>
        {lowStock.length === 0 ? (
          <p>Nothing is running low.</p>
        ) : (
          <ul>
            {lowStock.map((product) => (
              <li key={product.id}>
                {product.name} ({product.sku}) — {product.stock} in stock
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2>
          <a href="/orders">Recent orders</a>
        </h2>
        {recentOrders.length === 0 ? (
          <p>No orders yet.</p>
        ) : (
          <ul>
            {recentOrders.map((order) => (
              <li key={order.id}>
                <strong>{order.customerName}</strong> —{" "}
                {formatPrice(order.totalMinor)} — {order.status} —{" "}
                {order.placedAt.toLocaleDateString("en-CA")}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
