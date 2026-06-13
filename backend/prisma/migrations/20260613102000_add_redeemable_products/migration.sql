CREATE TABLE "redeemable_products" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "points_cost" INTEGER NOT NULL,
    "status" "CatalogStatus" NOT NULL DEFAULT 'active',
    "image_url" TEXT,
    "description" TEXT,
    "order" INTEGER NOT NULL DEFAULT 999,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "redeemable_products_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "reward_redemptions" (
    "id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "redeemable_product_id" UUID NOT NULL,
    "product_name" TEXT NOT NULL,
    "points_cost" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reward_redemptions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "redeemable_products_status_idx" ON "redeemable_products"("status");
CREATE INDEX "reward_redemptions_customer_id_idx" ON "reward_redemptions"("customer_id");
CREATE INDEX "reward_redemptions_redeemable_product_id_idx" ON "reward_redemptions"("redeemable_product_id");

ALTER TABLE "reward_redemptions" ADD CONSTRAINT "reward_redemptions_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "reward_redemptions" ADD CONSTRAINT "reward_redemptions_redeemable_product_id_fkey" FOREIGN KEY ("redeemable_product_id") REFERENCES "redeemable_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "redeemable_products" ("id", "name", "points_cost", "status", "image_url", "description", "order") VALUES
('9f3c27b7-fb3f-4e35-82a6-4a53f5510101', 'Bebida de Refill', 50, 'active', 'https://images.unsplash.com/photo-1556881286-fc6915169721?q=80&w=200&auto=format&fit=crop', 'Canjeable configurado inicialmente desde el menú anterior.', 10),
('9f3c27b7-fb3f-4e35-82a6-4a53f5510102', 'Nachos Clásicos', 100, 'active', 'https://images.unsplash.com/photo-1513456852971-30c0b8199d4d?q=80&w=200&auto=format&fit=crop', 'Canjeable configurado inicialmente desde el menú anterior.', 20),
('9f3c27b7-fb3f-4e35-82a6-4a53f5510103', 'Hamburguesa Sencilla', 250, 'active', 'https://images.unsplash.com/photo-1550547660-d9450f859349?q=80&w=200&auto=format&fit=crop', 'Canjeable configurado inicialmente desde el menú anterior.', 30),
('9f3c27b7-fb3f-4e35-82a6-4a53f5510104', 'Sushi Tradicional', 300, 'active', 'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?q=80&w=200&auto=format&fit=crop', 'Canjeable configurado inicialmente desde el menú anterior.', 40)
ON CONFLICT ("id") DO NOTHING;
