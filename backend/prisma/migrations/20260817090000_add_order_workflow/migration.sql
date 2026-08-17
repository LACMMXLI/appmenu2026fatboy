-- Order workflow: folio, status machine, history, staff accounts.
-- No destructive drops of existing order/order_item data.

-- 1. New enums
CREATE TYPE "OrderStatus" AS ENUM ('PENDING_APPROVAL', 'ACCEPTED', 'PREPARING', 'READY', 'COMPLETED', 'REJECTED', 'CANCELLED');
CREATE TYPE "StaffRole" AS ENUM ('STAFF', 'MANAGER', 'ADMIN');

-- 2. Staff accounts (created before order_status_history so the FK below can reference it)
CREATE TABLE "staff" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" "StaffRole" NOT NULL DEFAULT 'STAFF',
    "branch_id" UUID,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "staff_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "staff_username_key" ON "staff"("username");
CREATE INDEX "staff_branch_id_idx" ON "staff"("branch_id");

CREATE TABLE "staff_sessions" (
    "id" UUID NOT NULL,
    "staff_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "staff_sessions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "staff_sessions_staff_id_idx" ON "staff_sessions"("staff_id");

ALTER TABLE "staff_sessions" ADD CONSTRAINT "staff_sessions_staff_id_fkey"
    FOREIGN KEY ("staff_id") REFERENCES "staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 3. Folio: dedicated sequence, never count()+1, safe under concurrent inserts.
CREATE SEQUENCE IF NOT EXISTS "order_folio_seq" START WITH 1 INCREMENT BY 1;

ALTER TABLE "orders" ADD COLUMN "folio" TEXT;
ALTER TABLE "orders" ADD COLUMN "rejection_reason" TEXT;

-- Backfill folios for existing rows deterministically by creation order.
WITH ordered AS (
    SELECT "id", row_number() OVER (ORDER BY "created_at") AS rn FROM "orders"
)
UPDATE "orders" o
SET "folio" = 'FB-' || lpad(ordered.rn::text, 6, '0')
FROM ordered
WHERE o."id" = ordered."id";

-- Advance the sequence past whatever we just backfilled so new orders never collide.
-- Guarded for the empty-table case, where setval(0) would be out of range.
SELECT setval(
    'order_folio_seq',
    GREATEST((SELECT COUNT(*) FROM "orders")::bigint, 1),
    (SELECT COUNT(*) FROM "orders") > 0
);

ALTER TABLE "orders" ALTER COLUMN "folio" SET NOT NULL;
CREATE UNIQUE INDEX "orders_folio_key" ON "orders"("folio");

-- 4. Status: convert free-text column to the new enum, mapping legacy values 1:1.
ALTER TABLE "orders" ADD COLUMN "status_new" "OrderStatus";

UPDATE "orders" SET "status_new" = CASE "status"
    WHEN 'pending' THEN 'PENDING_APPROVAL'::"OrderStatus"
    WHEN 'preparing' THEN 'PREPARING'::"OrderStatus"
    WHEN 'ready' THEN 'READY'::"OrderStatus"
    WHEN 'delivered' THEN 'COMPLETED'::"OrderStatus"
    WHEN 'cancelled' THEN 'CANCELLED'::"OrderStatus"
    ELSE 'PENDING_APPROVAL'::"OrderStatus"
END;

ALTER TABLE "orders" DROP COLUMN "status";
ALTER TABLE "orders" RENAME COLUMN "status_new" TO "status";
ALTER TABLE "orders" ALTER COLUMN "status" SET NOT NULL;
ALTER TABLE "orders" ALTER COLUMN "status" SET DEFAULT 'PENDING_APPROVAL';

CREATE INDEX "orders_status_idx" ON "orders"("status");
CREATE INDEX "orders_branch_id_status_idx" ON "orders"("branch_id", "status");
CREATE INDEX "orders_branch_id_created_at_idx" ON "orders"("branch_id", "created_at");
CREATE INDEX "orders_customer_id_created_at_idx" ON "orders"("customer_id", "created_at");

-- 5. Immutable append-only status history.
CREATE TABLE "order_status_history" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "from_status" "OrderStatus",
    "to_status" "OrderStatus" NOT NULL,
    "staff_id" UUID,
    "reason" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_status_history_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "order_status_history_order_id_created_at_idx" ON "order_status_history"("order_id", "created_at");

ALTER TABLE "order_status_history" ADD CONSTRAINT "order_status_history_order_id_fkey"
    FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "order_status_history" ADD CONSTRAINT "order_status_history_staff_id_fkey"
    FOREIGN KEY ("staff_id") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 6. Seed an initial "Pedido creado" history row for every existing order so
-- old orders are not left without any trace.
-- md5(random) UUID avoids depending on pgcrypto/uuid-ossp being installed.
INSERT INTO "order_status_history" ("id", "order_id", "from_status", "to_status", "staff_id", "reason", "created_at")
SELECT (md5(random()::text || clock_timestamp()::text))::uuid, "id", NULL, "status", NULL, 'Migración: estado inicial reconstruido', "created_at"
FROM "orders";
