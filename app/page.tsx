"use client";

import { FormEvent, useEffect, useState } from "react";

type Product = { id: string; sku?: string; name: string; priceMinor?: number; currency?: string };
type AuthResponse = { accessToken?: string; access_token?: string };
type ProductsResponse = { products?: Product[] };
type OrderResponse = { order?: { orderId?: string; order_id?: string } };

const API = process.env.NEXT_PUBLIC_BFF_URL ?? "http://localhost:8080/api/v1";

async function request<T>(path: string, options: RequestInit = {}, token = ""): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(`${API}${path}`, { ...options, headers });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.message || body.error || `Request failed (${response.status})`);
  return body as T;
}

export default function Home() {
  const [token, setToken] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [loginError, setLoginError] = useState("");
  const [status, setStatus] = useState("");
  const [orderResult, setOrderResult] = useState("");

  useEffect(() => {
    const saved = window.sessionStorage.getItem("storemesh.access_token");
    if (saved) setToken(saved);
  }, []);

  useEffect(() => {
    if (!token) return;
    void loadProducts();
  }, [token]);

  async function loadProducts() {
    setStatus("Loading catalog…");
    try {
      const result = await request<ProductsResponse>("/products?page_size=100", {}, token);
      const nextProducts = result.products ?? [];
      setProducts(nextProducts);
      setSelectedProduct((current) => current || nextProducts[0]?.id || "");
      setStatus(`${nextProducts.length} product${nextProducts.length === 1 ? "" : "s"} available`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to load catalog");
    }
  }

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoginError("");
    try {
      const result = await request<AuthResponse>("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
      const nextToken = result.accessToken ?? result.access_token ?? "";
      if (!nextToken) throw new Error("Login response did not include an access token");
      window.sessionStorage.setItem("storemesh.access_token", nextToken);
      setToken(nextToken);
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : "Unable to sign in");
    }
  }

  async function createOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setOrderResult("Placing order…");
    try {
      const result = await request<OrderResponse>("/orders", { method: "POST", headers: { "Idempotency-Key": crypto.randomUUID() }, body: JSON.stringify({ lines: [{ productId: selectedProduct, quantity }] }) }, token);
      setOrderResult(`Order ${result.order?.orderId ?? result.order?.order_id ?? "created"} placed.`);
    } catch (error) {
      setOrderResult(error instanceof Error ? error.message : "Unable to place order");
    }
  }

  function logout() { window.sessionStorage.removeItem("storemesh.access_token"); setToken(""); setProducts([]); }

  return <main className="shell">
    <header className="topbar"><div><span className="eyebrow">STOREMESH</span><h1>Commerce workspace</h1></div>{token && <button className="ghost" onClick={logout}>Sign out</button>}</header>
    {!token ? <section className="card auth-card"><span className="eyebrow">WELCOME BACK</span><h2>Sign in to your store</h2><form onSubmit={login}><label>Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" /></label><label>Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required autoComplete="current-password" /></label><button type="submit">Continue</button></form><p className="error">{loginError}</p></section> : <section><div className="welcome"><div><span className="eyebrow">CATALOG</span><h2>Available products</h2></div><button className="ghost" onClick={() => void loadProducts()}>Refresh</button></div><p className="muted">{status}</p><div className="product-grid">{products.map((product) => <article className="product" key={product.id}><span className="eyebrow">{product.sku || "PRODUCT"}</span><strong>{product.name}</strong><span className="price">{((product.priceMinor ?? 0) / 100).toFixed(2)} {product.currency ?? ""}</span></article>)}</div><section className="card order-card"><span className="eyebrow">CHECKOUT</span><h2>Create an order</h2><form onSubmit={createOrder}><label>Product<select value={selectedProduct} onChange={(event) => setSelectedProduct(event.target.value)} required>{products.map((product) => <option value={product.id} key={product.id}>{product.name}</option>)}</select></label><label>Quantity<input type="number" min="1" value={quantity} onChange={(event) => setQuantity(Number(event.target.value))} required /></label><button type="submit" disabled={!selectedProduct}>Place order</button></form><p className="muted">{orderResult}</p></section></section>}
  </main>;
}
