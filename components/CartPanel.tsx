"use client";

type Product = { id: string; name: string; priceMinor?: number; currency?: string };
type CartLine = { productId?: string; product_id?: string; quantity?: number };
type CartPanelProps = { products: Product[]; lines: CartLine[]; error?: string; onChangeQuantity: (productId: string, delta: number) => void; onClear: () => void };

export function CartPanel({ products, lines, error, onChangeQuantity, onClear }: CartPanelProps) {
  const productByID = new Map(products.map((product) => [product.id, product]));
  const count = lines.reduce((sum, line) => sum + (line.quantity ?? 0), 0);
  return <section className="card cart-summary"><div className="panel-title"><div><span className="eyebrow">SAVED CART</span><h3>{count} item{count === 1 ? "" : "s"}</h3></div>{lines.length > 0 && <button type="button" className="ghost" onClick={onClear}>Clear</button>}</div>{error && <p className="error">{error}</p>}{lines.length === 0 ? <p className="muted">Your cart is empty. Add a product to begin.</p> : <><p className="muted">Your cart is saved to your account and follows you across devices.</p><div className="cart-lines">{lines.map((line) => { const id = line.productId ?? line.product_id ?? ""; const product = productByID.get(id); return <div className="cart-line" key={id}><div><strong>{product?.name ?? "Product"}</strong><span className="muted">{line.quantity ?? 0} × {product?.currency ?? ""} {((product?.priceMinor ?? 0) / 100).toFixed(2)}</span></div><div className="cart-quantity"><button type="button" className="ghost" aria-label={`Decrease ${product?.name ?? "product"}`} onClick={() => onChangeQuantity(id, -1)}>−</button><strong>{line.quantity ?? 0}</strong><button type="button" className="ghost" aria-label={`Increase ${product?.name ?? "product"}`} onClick={() => onChangeQuantity(id, 1)}>+</button></div></div>; })}</div></>}</section>;
}
