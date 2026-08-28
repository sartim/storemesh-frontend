"use client";

import { FormEvent, useEffect, useState } from "react";

type Product = { id: string; sku?: string; name: string; priceMinor?: number; currency?: string };
type AuthResponse = { accessToken?: string; access_token?: string };
type Session = { token: string; userId: string; email: string; roles: string[] };
type Order = { orderId?: string; order_id?: string; totalMinor?: number; total_minor?: number; currency?: string; status?: string; createdAt?: string; created_at?: string };
type OrdersResponse = { orders?: Order[]; nextPageToken?: string; next_page_token?: string };
type User = { id?: string; email?: string; status?: string; roles?: string[] };
type UsersResponse = { users?: User[] };
type RolesResponse = { roles?: Array<{ name?: string }> };

const API = process.env.NEXT_PUBLIC_BFF_URL ?? "/api/v1";
const TOKEN_KEY = "storemesh.access_token";

async function request<T>(path: string, options: RequestInit = {}, token = ""): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(`${API}${path}`, { ...options, headers });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.message || body.error?.message || body.error || `Request failed (${response.status})`);
  return body as T;
}

function readSession(token: string): Session {
  try {
    const encoded = token.split(".")[1];
    const payload = JSON.parse(atob(encoded.replace(/-/g, "+").replace(/_/g, "/"))) as { sub?: string; email?: string; roles?: string[] };
    return { token, userId: payload.sub ?? "", email: payload.email ?? "", roles: payload.roles ?? [] };
  } catch {
    return { token, userId: "", email: "", roles: [] };
  }
}

function isAdmin(session: Session | null) {
  return session?.roles.some((role) => ["admin", "administrator"].includes(role.toLowerCase())) ?? false;
}
function orderID(order: Order) { return order.orderId ?? order.order_id ?? ""; }
function orderStatus(order: Order) { return (order.status ?? "ORDER_STATUS_UNSPECIFIED").replace("ORDER_STATUS_", "").toLowerCase(); }
function money(minor: number | undefined, currency: string | undefined) { return `${((minor ?? 0) / 100).toFixed(2)} ${currency ?? ""}`; }

export default function Home() {
  const [session, setSession] = useState<Session | null>(null);
  const [email, setEmail] = useState(""); const [password, setPassword] = useState("");
  const [products, setProducts] = useState<Product[]>([]); const [orders, setOrders] = useState<Order[]>([]); const [users, setUsers] = useState<User[]>([]); const [availableRoles, setAvailableRoles] = useState<string[]>([]);
  const [selectedProduct, setSelectedProduct] = useState(""); const [quantity, setQuantity] = useState(1); const [activeView, setActiveView] = useState<"shop" | "orders" | "admin">("shop"); const [nextOrdersToken, setNextOrdersToken] = useState("");
  const [loginError, setLoginError] = useState(""); const [status, setStatus] = useState(""); const [orderResult, setOrderResult] = useState(""); const [ordersError, setOrdersError] = useState(""); const [adminError, setAdminError] = useState("");

  useEffect(() => { const saved = window.sessionStorage.getItem(TOKEN_KEY); if (saved) setSession(readSession(saved)); }, []);
  useEffect(() => { if (!session) return; void loadProducts(session.token); void loadOrders(session, ""); }, [session]);

  async function loadProducts(token: string) {
    setStatus("Loading catalog…");
    try { const result = await request<{ products?: Product[] }>("/products?page_size=100", {}, token); const next = result.products ?? []; setProducts(next); setSelectedProduct((current) => current || next[0]?.id || ""); setStatus(`${next.length} product${next.length === 1 ? "" : "s"} available`); }
    catch (error) { setStatus(error instanceof Error ? error.message : "Unable to load catalog"); }
  }
  async function loadOrders(currentSession: Session, pageToken: string) {
    if (!currentSession.userId) { setOrdersError("Your access token does not contain a user ID, so order history cannot be scoped safely."); return; }
    setOrdersError("");
    try { const query = new URLSearchParams({ customer_id: currentSession.userId, page_size: "10" }); if (pageToken) query.set("page_token", pageToken); const result = await request<OrdersResponse>(`/orders?${query.toString()}`, {}, currentSession.token); setOrders(pageToken ? (current) => [...current, ...(result.orders ?? [])] : result.orders ?? []); setNextOrdersToken(result.nextPageToken ?? result.next_page_token ?? ""); }
    catch (error) { setOrdersError(error instanceof Error ? error.message : "Unable to load orders"); }
  }
  async function loadAdmin(currentSession: Session) {
    setAdminError("");
    try { const [userResult, roleResult] = await Promise.all([request<UsersResponse>("/admin/users?per_page=100", {}, currentSession.token), request<RolesResponse>("/admin/roles", {}, currentSession.token)]); setUsers(userResult.users ?? []); setAvailableRoles((roleResult.roles ?? []).map((role) => role.name ?? "").filter(Boolean)); }
    catch (error) { setAdminError(error instanceof Error ? error.message : "Unable to load administration data"); }
  }
  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setLoginError("");
    try { const result = await request<AuthResponse>("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }); const token = result.accessToken ?? result.access_token ?? ""; if (!token) throw new Error("Login response did not include an access token"); window.sessionStorage.setItem(TOKEN_KEY, token); setSession(readSession(token)); }
    catch (error) { setLoginError(error instanceof Error ? error.message : "Unable to sign in"); }
  }
  async function createOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setOrderResult("Placing order…"); if (!session?.userId) { setOrderResult("Unable to place an order without a user ID in the access token."); return; }
    try { const result = await request<{ order?: Order }>("/orders", { method: "POST", headers: { "Idempotency-Key": crypto.randomUUID() }, body: JSON.stringify({ customerId: session.userId, lines: [{ productId: selectedProduct, quantity }] }) }, session.token); setOrderResult(`Order ${orderID(result.order ?? {}) || "created"} placed.`); await loadOrders(session, ""); }
    catch (error) { setOrderResult(error instanceof Error ? error.message : "Unable to place order"); }
  }
  async function cancelOrder(id: string) { if (!session || !window.confirm("Cancel this order?")) return; try { await request(`/orders/${id}:cancel`, { method: "POST" }, session.token); await loadOrders(session, ""); } catch (error) { setOrdersError(error instanceof Error ? error.message : "Unable to cancel order"); } }
  async function changeRole(userID: string, role: string, method: "PUT" | "DELETE") { if (!session) return; try { await request(`/admin/users/${userID}/roles/${encodeURIComponent(role)}`, { method }, session.token); await loadAdmin(session); } catch (error) { setAdminError(error instanceof Error ? error.message : "Unable to update role"); } }
  async function deleteUser(userID: string) { if (!session || !window.confirm("Delete this user?")) return; try { await request(`/admin/users/${userID}`, { method: "DELETE" }, session.token); await loadAdmin(session); } catch (error) { setAdminError(error instanceof Error ? error.message : "Unable to delete user"); } }
  function logout() { window.sessionStorage.removeItem(TOKEN_KEY); setSession(null); setProducts([]); setOrders([]); setUsers([]); }

  if (!session) return <main className="shell"><header className="topbar"><div><span className="eyebrow">STOREMESH</span><h1>Commerce workspace</h1></div></header><section className="card auth-card"><span className="eyebrow">WELCOME BACK</span><h2>Sign in to your store</h2><form onSubmit={login}><label>Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" /></label><label>Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required autoComplete="current-password" /></label><button type="submit">Continue</button></form><p className="error">{loginError}</p></section></main>;

  return <main className="shell"><header className="topbar"><div><span className="eyebrow">STOREMESH</span><h1>Commerce workspace</h1><p className="muted">{session.email || session.userId}</p></div><button className="ghost" onClick={logout}>Sign out</button></header>
    <nav className="tabs" aria-label="Workspace sections"><button className={activeView === "shop" ? "active" : "ghost"} onClick={() => setActiveView("shop")}>Shop</button><button className={activeView === "orders" ? "active" : "ghost"} onClick={() => setActiveView("orders")}>My orders</button>{isAdmin(session) && <button className={activeView === "admin" ? "active" : "ghost"} onClick={() => { setActiveView("admin"); void loadAdmin(session); }}>Admin</button>}</nav>
    {activeView === "shop" && <section><div className="welcome"><div><span className="eyebrow">CATALOG</span><h2>Available products</h2></div><button className="ghost" onClick={() => void loadProducts(session.token)}>Refresh</button></div><p className="muted">{status}</p><div className="product-grid">{products.map((product) => <article className="product" key={product.id}><span className="eyebrow">{product.sku || "PRODUCT"}</span><strong>{product.name}</strong><span className="price">{money(product.priceMinor, product.currency)}</span></article>)}</div><section className="card order-card"><span className="eyebrow">CHECKOUT</span><h2>Create an order</h2><form onSubmit={createOrder}><label>Product<select value={selectedProduct} onChange={(event) => setSelectedProduct(event.target.value)} required>{products.map((product) => <option value={product.id} key={product.id}>{product.name}</option>)}</select></label><label>Quantity<input type="number" min="1" value={quantity} onChange={(event) => setQuantity(Number(event.target.value))} required /></label><button type="submit" disabled={!selectedProduct}>Place order</button></form><p className="muted">{orderResult}</p></section></section>}
    {activeView === "orders" && <section><div className="welcome"><div><span className="eyebrow">ACCOUNT</span><h2>My orders</h2></div><button className="ghost" onClick={() => void loadOrders(session, "")}>Refresh</button></div>{ordersError && <p className="error">{ordersError}</p>}{orders.length === 0 && !ordersError && <p className="muted">No orders yet. Your completed checkouts will appear here.</p>}<div className="order-list">{orders.map((order) => <article className="card order-row" key={orderID(order)}><div><span className="eyebrow">{orderStatus(order)}</span><strong>{orderID(order)}</strong><span className="muted">{order.createdAt ?? order.created_at ?? ""}</span></div><div className="order-actions"><strong>{money(order.totalMinor ?? order.total_minor, order.currency)}</strong>{orderStatus(order) !== "cancelled" && <button className="ghost" onClick={() => void cancelOrder(orderID(order))}>Cancel</button>}</div></article>)}</div>{nextOrdersToken && <button className="ghost" onClick={() => void loadOrders(session, nextOrdersToken)}>Load more</button>}</section>}
    {activeView === "admin" && isAdmin(session) && <section><div className="welcome"><div><span className="eyebrow">CONTROL PLANE</span><h2>User administration</h2></div><button className="ghost" onClick={() => void loadAdmin(session)}>Refresh</button></div>{adminError && <p className="error">{adminError}</p>}<div className="admin-list">{users.map((user) => { const userID = user.id ?? ""; return <article className="card admin-row" key={userID}><div><strong>{user.email || userID}</strong><span className="muted">{user.status || "active"} · {userID}</span><div className="role-list">{(user.roles ?? []).map((role) => <button className="role" key={role} onClick={() => void changeRole(userID, role, "DELETE")}>{role} ×</button>)}</div></div><div className="admin-actions"><select aria-label={`Assign role to ${user.email || userID}`} defaultValue="" onChange={(event) => { if (event.target.value) void changeRole(userID, event.target.value, "PUT"); }}><option value="">Assign role…</option>{availableRoles.filter((role) => !(user.roles ?? []).includes(role)).map((role) => <option value={role} key={role}>{role}</option>)}</select><button className="ghost danger" onClick={() => void deleteUser(userID)}>Delete</button></div></article>; })}</div></section>}
  </main>;
}
