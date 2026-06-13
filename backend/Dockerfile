FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install --include=dev
COPY . .
RUN npx prisma generate
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev \
  && npm cache clean --force
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/base ./base
ENV PORT=8372
EXPOSE 8372
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/scripts/import-base-catalog.js --if-empty && node dist/src/main.js"]
