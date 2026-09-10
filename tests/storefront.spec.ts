import { expect, test } from "@playwright/test";

const token = `eyJhbGciOiJub25lIn0.${Buffer.from(JSON.stringify({ sub: "customer-1", email: "demo@storemesh.local" })).toString("base64url")}.test`;
const products = [
  { id: "product-lamp", sku: "SM-LAMP-001", name: "Halo Desk Lamp", description: "Warm ambient light.", priceMinor: 8900, currency: "USD", status: "ACTIVE" },
  { id: "product-mug", sku: "SM-MUG-002", name: "Cove Ceramic Mug", description: "A quiet morning ritual.", priceMinor: 2400, currency: "USD", status: "ACTIVE" },
];

test("customer can sign in, add to cart, and place an order", async ({ page }) => {
  let cartLines: Array<{ productId: string; quantity: number }> = [];
  let orderCreated = false;

  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname.endsWith("/auth/login")) {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ accessToken: token }) });
      return;
    }
    if (url.pathname.endsWith("/config")) {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ flags: { graphql_checkout: true } }) });
      return;
    }
    if (url.pathname.endsWith("/graphql")) {
      const body = request.postDataJSON() as { query?: string; variables?: { lines?: Array<{ productId: string; quantity: number }> } };
      const query = body.query ?? "";
      if (query.includes("query Products")) {
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { products: { products, nextPageToken: null } } }) });
      } else if (query.includes("query Cart")) {
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { cart: { customerId: "customer-1", lines: cartLines } } }) });
      } else if (query.includes("mutation UpdateCart")) {
        cartLines = body.variables?.lines ?? [];
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { updateCart: { customerId: "customer-1", lines: cartLines } } }) });
      } else if (query.includes("mutation ClearCart")) {
        cartLines = [];
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { clearCart: { customerId: "customer-1", lines: [] } } }) });
      } else if (query.includes("mutation CreateOrder")) {
        orderCreated = true;
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { createOrder: { id: "order-demo-1", customerId: "customer-1", status: "ORDER_STATUS_PENDING", totalMinor: 8900, currency: "USD", createdAt: "2026-09-10T00:00:00Z" } } }) });
      } else if (query.includes("query Orders")) {
        const orders = orderCreated ? [{ id: "order-demo-1", customerId: "customer-1", status: "ORDER_STATUS_PENDING", totalMinor: 8900, currency: "USD", createdAt: "2026-09-10T00:00:00Z" }] : [];
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { orders: { orders, nextPageToken: null } } }) });
      } else {
        await route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ error: "Unhandled GraphQL fixture" }) });
      }
      return;
    }
    await route.fulfill({ status: 404, contentType: "application/json", body: "{}" });
  });

  await page.goto("/");
  await page.getByLabel("Email", { exact: true }).fill("demo@storemesh.local");
  await page.getByLabel("Password", { exact: true }).fill("StoreMesh-demo-2026!");
  await page.getByRole("button", { name: "Continue", exact: true }).click();

  await expect(page.getByRole("heading", { name: "Featured now" })).toBeVisible();
  await expect(page.getByRole("img", { name: "Halo Desk Lamp" })).toBeVisible();
  await page.getByRole("button", { name: "Add to cart", exact: true }).first().click();
  await expect(page.getByRole("button", { name: "Open cart, 1 items" })).toBeVisible();
  await page.getByRole("button", { name: "Open cart, 1 items" }).click();
  await expect(page.getByRole("heading", { name: "Shopping cart" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "1 item" })).toBeVisible();
  await page.getByRole("button", { name: "Place order", exact: true }).click();
  await expect(page.getByText("Order order-demo-1 placed.")).toBeVisible();
});
