FROM node:20-bookworm-slim AS deps
WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json
RUN npm config set fetch-retries 10 \
  && npm config set fetch-retry-maxtimeout 120000 \
  && npm ci --include=dev

FROM deps AS build
COPY backend backend
RUN npm run prisma:generate --workspace @fatboy-pos/backend
RUN npm run build --workspace @fatboy-pos/backend

FROM build AS production-deps
RUN npm prune --omit=dev \
  && npm cache clean --force

FROM node:20-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8372
ENV BASE_DATA_DIR=backend/base

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json
COPY --from=production-deps /app/node_modules node_modules
COPY --from=build /app/backend/dist backend/dist
COPY --from=build /app/backend/prisma backend/prisma
COPY --from=build /app/backend/base backend/base
COPY backend/docker-entrypoint.sh backend/docker-entrypoint.sh
RUN sed -i 's/\r$//' backend/docker-entrypoint.sh \
  && chmod +x backend/docker-entrypoint.sh

EXPOSE 8372
CMD ["sh", "backend/docker-entrypoint.sh"]
