FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ARG NEXT_PUBLIC_BFF_URL=/api/v1
ARG BFF_INTERNAL_URL=http://storemesh-bff.storemesh-bff.svc.cluster.local:8080
ENV NEXT_PUBLIC_BFF_URL=$NEXT_PUBLIC_BFF_URL
ENV BFF_INTERNAL_URL=$BFF_INTERNAL_URL
RUN npm run build

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ARG BFF_INTERNAL_URL=http://storemesh-bff.storemesh-bff.svc.cluster.local:8080
ENV BFF_INTERNAL_URL=$BFF_INTERNAL_URL
COPY --from=build /app/public ./public
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
USER node
EXPOSE 3000
CMD ["node", "server.js"]
