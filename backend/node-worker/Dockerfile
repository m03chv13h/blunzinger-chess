# Stage 1: Install dependencies
FROM node:22-alpine AS build
WORKDIR /app

# Copy shared frontend core modules (the worker depends on these)
COPY src/core/ src/core/
COPY src/bot/ src/bot/

# Copy worker project
COPY backend/node-worker/ backend/node-worker/
COPY backend/proto/ backend/proto/

WORKDIR /app/backend/node-worker
RUN npm ci

# Stage 2: Run with tsx (handles TypeScript natively)
FROM node:22-alpine
WORKDIR /app

COPY --from=build /app/src/core/ src/core/
COPY --from=build /app/src/bot/ src/bot/
COPY --from=build /app/backend/node-worker/ backend/node-worker/
COPY --from=build /app/backend/proto/ backend/proto/

WORKDIR /app/backend/node-worker

ENV PORT=50051
EXPOSE 50051

CMD ["npx", "tsx", "src/server.ts"]
