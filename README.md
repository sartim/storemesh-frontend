# StoreMesh Frontend

Next.js App Router frontend using React and TypeScript. It provides login,
catalog browsing, and a basic order flow through the BFF.

```sh
npm install
NEXT_PUBLIC_BFF_URL=http://localhost:8080/api/v1 npm run dev
```

In Kubernetes, browser requests use the same-origin `/api/v1` path and
Next.js rewrites them to the internal BFF using `BFF_INTERNAL_URL`.
