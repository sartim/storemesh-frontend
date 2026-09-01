"use client";

import { FormEvent, useEffect, useState } from "react";
import { keycloak, logoutOIDC, refreshOIDCToken, startOIDCLogin } from "../lib/oidc";
import { Cart, emptyCart, loadCart, saveCart } from "../lib/cart";
import { CartPanel } from "../components/CartPanel";

type Product = { id: string; sku?: string; name: string; description?: string; priceMinor?: number; currency?: string };
type AuthResponse = { accessToken?: string; access_token?: string };
type Session = { token: string; userId: string; email: string; roles: string[] };
type Order = { orderId?: string; order_id?: string; customerId?: string; customer_id?: string; totalMinor?: number; total_minor?: number; currency?: string; status?: string; createdAt?: string; created_at?: string };
type OrdersResponse = { orders?: Order[]; nextPageToken?: string; next_page_token?: string };
type User = { id?: string; email?: string; status?: string; roles?: string[] };
type UsersResponse = { users?: User[] };
type RolesResponse = { roles?: Array<{ name?: string }> };

const API = process.env.NEXT_PUBLIC_BFF_URL ?? "/api/v1";
const TOKEN_KEY = "storemesh.access_token";
const OIDC_ENABLED = Boolean(process.env.NEXT_PUBLIC_KEYCLOAK_ISSUER);

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
  const [products, setProducts] = useState<Product[]>([]); const [orders, setOrders] = useState<Order[]>([]); const [adminOrders, setAdminOrders] = useState<Order[]>([]); const [users, setUsers] = useState<User[]>([]); const [availableRoles, setAvailableRoles] = useState<string[]>([]);
  const [selectedProduct, setSelectedProduct] = useState(""); const [quantity, setQuantity] = useState(1); const [activeView, setActiveView] = useState<"shop" | "orders" | "admin">("shop"); const [nextOrdersToken, setNextOrdersToken] = useState(""); const [sidebarOpen, setSidebarOpen] = useState(false); const [searchTerm, setSearchTerm] = useState("");
  const [loginError, setLoginError] = useState(""); const [status, setStatus] = useState(""); const [orderResult, setOrderResult] = useState(""); const [ordersError, setOrdersError] = useState(""); const [adminError, setAdminError] = useState("");
  const [cart, setCart] = useState<Cart>({ lines: [] }); const [cartError, setCartError] = useState("");

  useEffect(() => { const saved = window.sessionStorage.getItem(TOKEN_KEY); if (saved) setSession(readSession(saved)); }, []);
  useEffect(() => {
    if (!OIDC_ENABLED) return;
    void startOIDCLogin().then(async () => { await refreshOIDCToken(); if (keycloak.token) { window.sessionStorage.setItem(TOKEN_KEY, keycloak.token); setSession(readSession(keycloak.token)); } });
  }, []);
  useEffect(() => { if (!session) return; void loadProducts(session.token); void loadOrders(session, ""); void loadCart(API, session.token).then(setCart).catch((error: unknown) => setCartError(error instanceof Error ? error.message : "Unable to load cart")); }, [session]);

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
    try { const [userResult, roleResult, orderResult] = await Promise.all([request<UsersResponse>("/admin/users?per_page=100", {}, currentSession.token), request<RolesResponse>("/admin/roles", {}, currentSession.token), request<OrdersResponse>("/orders?page_size=100", {}, currentSession.token)]); setUsers(userResult.users ?? []); setAvailableRoles((roleResult.roles ?? []).map((role) => role.name ?? "").filter(Boolean)); setAdminOrders(orderResult.orders ?? []); }
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
  async function addToCart(productId: string) { if (!session) return; setCartError(""); const lines = [...(cart.lines ?? [])]; const existing = lines.find((line) => (line.productId ?? line.product_id) === productId); if (existing) existing.quantity = (existing.quantity ?? 0) + 1; else lines.push({ productId, quantity: 1 }); try { setCart(await saveCart(API, session.token, { ...cart, lines })); } catch (error) { setCartError(error instanceof Error ? error.message : "Unable to save cart"); } }
  async function changeCartQuantity(productId: string, delta: number) { if (!session) return; const lines = (cart.lines ?? []).map((line) => (line.productId ?? line.product_id) === productId ? { ...line, quantity: (line.quantity ?? 0) + delta } : line).filter((line) => (line.quantity ?? 0) > 0); try { setCart(await saveCart(API, session.token, { ...cart, lines })); } catch (error) { setCartError(error instanceof Error ? error.message : "Unable to save cart"); } }
  async function clearCart() { if (!session) return; try { await emptyCart(API, session.token); setCart({ lines: [] }); } catch (error) { setCartError(error instanceof Error ? error.message : "Unable to clear cart"); } }
  function logout() { window.sessionStorage.removeItem(TOKEN_KEY); setSession(null); setProducts([]); setOrders([]); setUsers([]); setCart({ lines: [] }); if (OIDC_ENABLED) void logoutOIDC(); }

  if (!session) return <main className="auth-shell"><div className="auth-art"><span className="eyebrow">STOREMESH / EVERYDAY GOODS</span><h1>Good things,<br />thoughtfully chosen.</h1><p>Useful objects for calmer desks, slower mornings, and better days.</p></div><section className="card auth-card"><span className="eyebrow">WELCOME BACK</span><h2>Sign in to your store</h2><form onSubmit={login}><label>Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" /></label><label>Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required autoComplete="current-password" /></label><button type="submit">Continue</button></form><p className="error">{loginError}</p></section></main>;

  const visibleProducts = products.filter((product) => `${product.name} ${product.description ?? ""}`.toLowerCase().includes(searchTerm.toLowerCase()));
  const featured = visibleProducts.slice(0, 4); const deals = visibleProducts.slice(4, 8);
  const setView = (view: "shop" | "orders" | "admin") => { setActiveView(view); setSidebarOpen(false); if (view === "admin") void loadAdmin(session); };
  return <main className={isAdmin(session) && activeView === "admin" ? "admin-shell" : "shell"}>
    {activeView === "shop" && <><CartPanel products={products} lines={cart.lines ?? []} error={cartError} onChangeQuantity={(productId, delta) => void changeCartQuantity(productId, delta)} onClear={() => void clearCart()} /><button type="button" onClick={() => selectedProduct && void addToCart(selectedProduct)} disabled={!selectedProduct}>Add selected product</button></>}
    {isAdmin(session) && activeView === "admin" ? <><button className="mobile-menu" onClick={() => setSidebarOpen(true)} aria-label="Open admin menu">☰</button><aside className={`admin-sidebar ${sidebarOpen ? "open" : ""}`}><div className="sidebar-brand"><span className="eyebrow">STOREMESH</span><strong>Operations</strong><button className="close-menu" onClick={() => setSidebarOpen(false)}>×</button></div><div className="admin-profile"><span className="avatar">{session.email.slice(0, 1).toUpperCase()}</span><div><strong>Administrator</strong><span>{session.email}</span></div></div><nav className="side-nav"><button className="side-active">▦ <span>Overview</span></button><button onClick={() => setView("shop")}>◈ <span>Storefront</span></button><button onClick={() => setView("orders")}>↗ <span>Orders</span></button></nav><button className="signout" onClick={logout}>↪ <span>Sign out</span></button></aside><div className="admin-content"><header className="admin-topbar"><div><span className="eyebrow">CONTROL PLANE / OVERVIEW</span><h1>Good morning, operator.</h1></div><button className="ghost" onClick={() => void loadAdmin(session)}>Refresh data</button></header><div className="metrics"><article className="metric card"><span className="eyebrow">ORDERS</span><strong>{adminOrders.length}</strong><span className="muted">All-time tracked</span></article><article className="metric card"><span className="eyebrow">OPEN</span><strong>{adminOrders.filter((order) => !["cancelled", "ORDER_STATUS_CANCELLED"].includes(order.status ?? "")).length}</strong><span className="muted">Awaiting completion</span></article><article className="metric card"><span className="eyebrow">REVENUE</span><strong>{money(adminOrders.reduce((sum, order) => sum + (order.totalMinor ?? order.total_minor ?? 0), 0), adminOrders[0]?.currency)}</strong><span className="muted">Gross order value</span></article><article className="metric card"><span className="eyebrow">CUSTOMERS</span><strong>{users.length}</strong><span className="muted">Registered accounts</span></article></div>{adminError && <p className="error">{adminError}</p>}<div className="admin-grid"><div className="card"><div className="panel-title"><h3>Recent orders</h3><span className="muted">{adminOrders.length} total</span></div>{adminOrders.slice(0, 8).map((order) => <div className="admin-order" key={orderID(order)}><span className="status-pill">{orderStatus(order)}</span><strong>{orderID(order).slice(0, 12)}…</strong><span className="muted">{order.customerId ?? order.customer_id ?? "Customer"}</span><strong>{money(order.totalMinor ?? order.total_minor, order.currency)}</strong></div>)}{adminOrders.length === 0 && <p className="muted">No orders yet. Seed demo orders to populate this view.</p>}</div><div className="card admin-users"><div className="panel-title"><h3>Customer access</h3><span className="muted">{users.length} users</span></div>{users.map((user) => { const userID = user.id ?? ""; return <article className="admin-row" key={userID}><div><strong>{user.email || userID}</strong><span className="muted">{user.status || "active"} · {userID}</span><div className="role-list">{(user.roles ?? []).map((role) => <button className="role" key={role} onClick={() => void changeRole(userID, role, "DELETE")}>{role} ×</button>)}</div></div><div className="admin-actions"><select aria-label={`Assign role to ${user.email || userID}`} defaultValue="" onChange={(event) => { if (event.target.value) void changeRole(userID, event.target.value, "PUT"); }}><option value="">Assign role…</option>{availableRoles.filter((role) => !(user.roles ?? []).includes(role)).map((role) => <option value={role} key={role}>{role}</option>)}</select><button className="ghost danger" onClick={() => void deleteUser(userID)}>Delete</button></div></article>; })}</div></div></div></> : <><header className="store-header"><div className="brand-mark"><span className="eyebrow">STOREMESH</span><strong>objects for living well</strong></div><div className="store-actions"><button className={activeView === "orders" ? "active" : "ghost"} onClick={() => setView("orders")}>My orders</button>{isAdmin(session) && <button className="ghost" onClick={() => setView("admin")}>Admin</button>}<button className="avatar" onClick={logout}>{session.email.slice(0, 1).toUpperCase()}</button></div></header>{activeView === "shop" ? <section className="storefront"><div className="hero"><div className="hero-copy"><span className="eyebrow">THE NEW EVERYDAY</span><h1>Small upgrades.<br /><em>Big difference.</em></h1><p>Considered essentials for your desk, home, and daily rituals.</p><button onClick={() => document.getElementById("catalog")?.scrollIntoView({ behavior: "smooth" })}>Shop the collection ↓</button></div></div><div className="store-intro"><div><span className="eyebrow">CURATED FOR YOU</span><h2>Find your next favourite.</h2></div><input className="search" placeholder="Search the collection" value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} /></div><section className="collection-section"><div className="section-heading"><h3>Featured now</h3><span>{featured.length} pieces</span></div><div className="product-grid feature-grid">{featured.map((product, index) => <article className={`product product-${index % 4}`} key={product.id}><div className="product-image"><img src="/storemesh-hero.png" alt="Curated StoreMesh product collection" /></div><div className="product-info"><span className="eyebrow">{product.sku || "STOREMESH"}</span><strong>{product.name}</strong><p>{product.description || "A considered essential for your everyday."}</p><span className="price">{money(product.priceMinor, product.currency)}</span></div></article>)}</div></section><section className="deal-strip"><div><span className="eyebrow">WEEKEND EDIT</span><h2>Good design,<br />better prices.</h2><p>Save on a handful of everyday favourites.</p></div><div className="deal-products">{deals.map((product) => <article className="deal-card" key={product.id}><div className="mini-image"><img src="/storemesh-hero.png" alt="" /></div><strong>{product.name}</strong><span>{money(product.priceMinor, product.currency)}</span></article>)}</div></section><section id="catalog" className="collection-section"><div className="section-heading"><h3>All products</h3><span>{status}</span></div><div className="product-grid">{visibleProducts.map((product) => <article className="product compact-product" key={product.id}><div className="product-image"><img src="/storemesh-hero.png" alt="" /></div><div className="product-info"><strong>{product.name}</strong><span className="price">{money(product.priceMinor, product.currency)}</span></div></article>)}</div></section><section className="card order-card"><span className="eyebrow">CHECKOUT</span><h2>Create an order</h2><form onSubmit={createOrder}><label>Product<select value={selectedProduct} onChange={(event) => setSelectedProduct(event.target.value)} required>{products.map((product) => <option value={product.id} key={product.id}>{product.name}</option>)}</select></label><label>Quantity<input type="number" min="1" value={quantity} onChange={(event) => setQuantity(Number(event.target.value))} required /></label><button type="submit" disabled={!selectedProduct}>Place order</button></form><p className="muted">{orderResult}</p></section></section> : <section><div className="welcome"><div><span className="eyebrow">ACCOUNT</span><h2>My orders</h2></div><button className="ghost" onClick={() => void loadOrders(session, "")}>Refresh</button></div>{ordersError && <p className="error">{ordersError}</p>}{orders.length === 0 && !ordersError && <p className="muted">No orders yet. Your completed checkouts will appear here.</p>}<div className="order-list">{orders.map((order) => <article className="card order-row" key={orderID(order)}><div><span className="eyebrow">{orderStatus(order)}</span><strong>{orderID(order)}</strong><span className="muted">{order.createdAt ?? order.created_at ?? ""}</span></div><div className="order-actions"><strong>{money(order.totalMinor ?? order.total_minor, order.currency)}</strong>{orderStatus(order) !== "cancelled" && <button className="ghost" onClick={() => void cancelOrder(orderID(order))}>Cancel</button>}</div></article>)}</div>{nextOrdersToken && <button className="ghost" onClick={() => void loadOrders(session, nextOrdersToken)}>Load more</button>}</section>}</>}
  </main>;
}
