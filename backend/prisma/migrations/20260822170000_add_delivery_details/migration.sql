-- Add delivery details for home delivery orders
ALTER TABLE "orders" ADD COLUMN "delivery_address" TEXT;
ALTER TABLE "orders" ADD COLUMN "delivery_reference" TEXT;
ALTER TABLE "orders" ADD COLUMN "delivery_fee" DECIMAL(10, 2) NOT NULL DEFAULT 0;
