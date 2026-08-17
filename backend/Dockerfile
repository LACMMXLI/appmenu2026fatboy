FROM node:20-alpine AS builder
WORKDIR /app
# argon2 ships prebuilt binaries for glibc/linux, but not always for Alpine's
# musl libc — when no matching prebuild exists, npm falls back to compiling
# the native addon with node-gyp, which needs python3/make/g++.
RUN apk add --no-cache python3 make g++
COPY package*.json ./
RUN npm install --include=dev
COPY . .
RUN npx prisma generate
RUN npm run build

FROM node:20-alpine
WORKDIR /app
RUN apk add --no-cache python3 make g++
COPY package*.json ./
RUN npm install --omit=dev \
  && npm cache clean --force \
  && apk del python3 make g++
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/base ./base
RUN npx prisma generate
COPY docker-entrypoint.sh ./docker-entrypoint.sh
RUN sed -i 's/\r$//' docker-entrypoint.sh \
  && chmod +x docker-entrypoint.sh
ENV PORT=8372
EXPOSE 8372
CMD ["sh", "docker-entrypoint.sh"]
