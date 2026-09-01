# StoreMesh Frontend

Next.js App Router frontend using React and TypeScript. It provides login,
catalog browsing, order creation, customer order history with pagination and
cancellation, and an admin workspace for user and role management through the
BFF.

```sh
npm install
NEXT_PUBLIC_BFF_URL=http://localhost:8080/api/v1 npm run dev
```

In Kubernetes, browser requests use the same-origin `/api/v1` path and
Next.js rewrites them to the internal BFF using `BFF_INTERNAL_URL`.

## Persistent cart

The storefront loads, updates, and clears the authenticated customer's cart
through the BFF GraphQL `cart`, `updateCart`, and `clearCart` operations. Cart
state is owned by Order Service persistence behind the BFF, so the same
customer can resume the cart from another signed-in client. Checkout uses the
GraphQL `createOrder` mutation with an idempotency key and clears the server
cart only after the order succeeds. Order cancellation and admin actions still
use REST until equivalent GraphQL mutations are defined.

The access token is used to establish the current user context for navigation
and to scope customer order-history requests. Backend authorization remains the
source of truth; decoded roles must not be treated as a security boundary.

The frontend Helm chart includes an optional Ingress, disabled by default.
Enable it and set `ingress.host` after an ingress controller is installed.

## GraphQL composition

The storefront catalog, cart, order history, and checkout use the authenticated Go BFF GraphQL endpoint at
`POST /api/v1/graphql` through `lib/graphql.ts`. The `products` query is used
for catalog reads, with `cart`, `orders`, `updateCart`, `clearCart`, and
`createOrder` covering customer commerce flows. REST remains in use for order
cancellation and admin operations.

The web client is migrating to Keycloak OIDC with Authorization Code + PKCE.
Configure `NEXT_PUBLIC_KEYCLOAK_ISSUER`, `NEXT_PUBLIC_KEYCLOAK_REALM`, and
`NEXT_PUBLIC_KEYCLOAK_CLIENT_ID` for the local `storemesh-web` client before
enabling the OIDC bootstrap. The BFF remains the only API endpoint used by the
browser.

When `NEXT_PUBLIC_KEYCLOAK_ISSUER` is set, the app uses Keycloak
`login-required` with Authorization Code + PKCE (`S256`) and no longer renders
the password-login flow. The current compatibility form is used only when the
issuer variable is absent. Local development uses the `storemesh-web` client
with a `http://localhost:3000/*` redirect URI.
