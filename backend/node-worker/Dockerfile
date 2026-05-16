# Stage 1: Install dependencies
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

# Stage 2: Run with tsx (handles TypeScript natively)
FROM node:22-alpine
WORKDIR /app

COPY --from=build /app/src/package.json src/package.json
COPY --from=build /app/src/core/ src/core/
COPY --from=build /app/src/bot/ src/bot/
COPY --from=build /app/backend/node-worker/ backend/node-worker/
COPY --from=build /app/backend/proto/ backend/proto/

# Symlink so that shared source files (src/core/, src/bot/) can resolve
# npm packages installed in the worker's node_modules (e.g. chess.js).
RUN ln -s /app/backend/node-worker/node_modules /app/node_modules

WORKDIR /app/backend/node-worker

ENV PORT=50051
# CONNECTION_STRING: PostgreSQL URI used to restore open simulations on startup
EXPOSE 50051

CMD ["npx", "tsx", "src/server.ts"]
