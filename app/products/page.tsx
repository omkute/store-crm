import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { createProduct, listProducts, updateProduct } from "@/db/products";

export const instant = false;

async function create(formData: FormData) {
  "use server";
  createProduct(db, {
    name: String(formData.get("name") ?? ""),
    sku: String(formData.get("sku") ?? ""),
    priceMinor: Math.round(Number(formData.get("priceMinor") ?? 0) * 100),
    stock: Math.round(Number(formData.get("stock") ?? 0)),
  });
  revalidatePath("/products");
}

async function update(id: number, formData: FormData) {
  "use server";
  updateProduct(db, id, {
    priceMinor: Math.round(Number(formData.get("priceMinor") ?? 0) * 100),
    stock: Math.round(Number(formData.get("stock") ?? 0)),
  });
  revalidatePath("/products");
}

function formatPrice(minor: number): string {
  return `$${(minor / 100).toFixed(2)}`;
}

export default async function ProductsPage() {
  const products = listProducts(db);

  return (
    <main style={{ padding: 32, fontFamily: "system-ui, sans-serif" }}>
      <h1>Products</h1>

      <h2>Add a product</h2>
      <form action={create}>
        <input type="text" name="name" placeholder="Name" required />
        <input type="text" name="sku" placeholder="SKU" required />
        <input
          type="number"
          name="priceMinor"
          placeholder="Price (e.g. 19.99)"
          step="0.01"
          min="0"
          required
        />
        <input
          type="number"
          name="stock"
          placeholder="Stock"
          min="0"
          defaultValue={0}
        />
        <button type="submit">Add</button>
      </form>

      <h2>Inventory ({products.length})</h2>
      <ul>
        {products.map((product) => (
          <li key={product.id}>
            <form action={update.bind(null, product.id)}>
              <strong>{product.name}</strong>
              <input
                type="number"
                name="priceMinor"
                step="0.01"
                min="0"
                defaultValue={(product.priceMinor / 100).toFixed(2)}
              />
              <input
                type="number"
                name="stock"
                min="0"
                defaultValue={product.stock}
              />
              <span>{formatPrice(product.priceMinor)}</span>
              <button type="submit">Save</button>
            </form>
          </li>
        ))}
      </ul>
    </main>
  );
}
