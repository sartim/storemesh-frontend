export type CartLine = { productId?: string; product_id?: string; quantity?: number };
export type Cart = { customerId?: string; customer_id?: string; lines?: CartLine[] };

export async function loadCart(api: string, token: string): Promise<Cart> {
  const response = await fetch(`${api}/cart`, { headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok) throw new Error(`Unable to load cart (${response.status})`);
  return response.json() as Promise<Cart>;
}

export async function saveCart(api: string, token: string, cart: Cart): Promise<Cart> {
  const response = await fetch(`${api}/cart`, { method: "PUT", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(cart) });
  if (!response.ok) throw new Error(`Unable to save cart (${response.status})`);
  return response.json() as Promise<Cart>;
}

export async function emptyCart(api: string, token: string): Promise<void> {
  const response = await fetch(`${api}/cart`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok) throw new Error(`Unable to clear cart (${response.status})`);
}
