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

The access token is used to establish the current user context for navigation
and to scope customer order-history requests. Backend authorization remains the
source of truth; decoded roles must not be treated as a security boundary.

The frontend Helm chart includes an optional Ingress, disabled by default.
Enable it and set `ingress.host` after an ingress controller is installed.

The web client is migrating to Keycloak OIDC with Authorization Code + PKCE.
Configure `NEXT_PUBLIC_KEYCLOAK_ISSUER`, `NEXT_PUBLIC_KEYCLOAK_REALM`, and
`NEXT_PUBLIC_KEYCLOAK_CLIENT_ID` for the local `storemesh-web` client before
enabling the OIDC bootstrap. The BFF remains the only API endpoint used by the
browser.
