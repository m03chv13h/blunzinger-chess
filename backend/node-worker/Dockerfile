# Stage 1: Build – bundle TypeScript into a single JS file with esbuild
FROM node:22-alpine AS build
WORKDIR /app

# Copy shared frontend core modules (the worker depends on these)
COPY src/package.json src/package.json
COPY src/core/ src/core/
COPY src/bot/ src/bot/

# Copy worker project
COPY backend/node-worker/ backend/node-worker/
COPY backend/proto/ backend/proto/

WORKDIR /app/backend/node-worker
RUN npm ci
RUN npm run build:bundle

# Stage 2: Production runtime – plain Node.js, no tsx/swc overhead
FROM node:22-alpine
WORKDIR /app

COPY --from=build /app/backend/node-worker/dist/ backend/node-worker/dist/
COPY --from=build /app/backend/node-worker/package.json backend/node-worker/package.json
COPY --from=build /app/backend/node-worker/package-lock.json backend/node-worker/package-lock.json
COPY --from=build /app/backend/proto/ backend/proto/

WORKDIR /app/backend/node-worker
RUN npm ci --omit=dev

ENV PORT=50051
EXPOSE 50051

CMD ["node", "dist/server.mjs"]
