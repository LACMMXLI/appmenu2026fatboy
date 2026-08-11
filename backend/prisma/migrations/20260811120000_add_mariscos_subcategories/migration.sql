-- Additive support for optional product subcategories.
ALTER TABLE "products" ADD COLUMN "subcategory" TEXT;

CREATE INDEX "products_category_id_subcategory_order_idx"
ON "products"("category_id", "subcategory", "order");

-- Create Mariscos only when it does not already exist. Existing categories are never updated.
INSERT INTO "categories" ("id", "name", "order", "status", "image_url", "created_at")
SELECT
  gen_random_uuid(),
  'Mariscos',
  COALESCE((SELECT MAX("order") + 1 FROM "categories"), 1),
  'active',
  '/images/promo_mariscos_2.png',
  NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM "categories" WHERE lower("name") = lower('Mariscos')
);

-- Add only missing products inside Mariscos. Existing products are never updated or deleted.
WITH seafood_category AS (
  SELECT "id"
  FROM "categories"
  WHERE lower("name") = lower('Mariscos')
  ORDER BY "created_at" ASC
  LIMIT 1
), seafood_products("subcategory", "name", "price", "sort_order") AS (
  VALUES
    ('Ceviches', 'Pescado', 110.00, 1),
    ('Ceviches', 'Camarón', 130.00, 2),
    ('Ceviches', 'Mixto', 150.00, 3),
    ('Ceviches', 'Pulpo', 190.00, 4),
    ('Ceviches', 'Ceviche Especial Fatboy', 220.00, 5),
    ('Cócteles', 'Cóctel Chico de Camarón', 100.00, 6),
    ('Cócteles', 'Cóctel Chico de Pulpo', 150.00, 7),
    ('Cócteles', 'Cóctel Chico de Callo', 150.00, 8),
    ('Cócteles', 'Cóctel Chico Campechano', 150.00, 9),
    ('Cócteles', 'Cóctel Mediano de Camarón', 150.00, 10),
    ('Cócteles', 'Cóctel Mediano de Pulpo', 190.00, 11),
    ('Cócteles', 'Cóctel Mediano de Callo', 190.00, 12),
    ('Cócteles', 'Cóctel Mediano Campechano', 190.00, 13),
    ('Cócteles', 'Cóctel Grande de Camarón', 200.00, 14),
    ('Cócteles', 'Cóctel Grande de Pulpo', 250.00, 15),
    ('Cócteles', 'Cóctel Grande de Callo', 250.00, 16),
    ('Cócteles', 'Cóctel Grande Campechano', 250.00, 17),
    ('Botanas', 'Media Botana de Camarón', 190.00, 18),
    ('Botanas', 'Media Botana de Aguachiles', 220.00, 19),
    ('Botanas', 'Media Botana de Atún', 220.00, 20),
    ('Botanas', 'Media Botana de Pulpo', 250.00, 21),
    ('Botanas', 'Media Botana de Callo', 290.00, 22),
    ('Botanas', 'Botana a la Fatboy', 300.00, 23),
    ('Molcajetes', 'Molcajete "Algo Don"', 260.00, 24),
    ('Molcajetes', 'Molcajete Especial Fatboy', 290.00, 25),
    ('Conchas', 'Ostión — Media Docena', 100.00, 26),
    ('Conchas', 'Ostión — Docena', 180.00, 27),
    ('Conchas', 'Pata de Mula — Media Docena', 80.00, 28),
    ('Conchas', 'Pata de Mula — Docena', 150.00, 29),
    ('Conchas', 'Shot de Ostión', 45.00, 30),
    ('Clamatos', 'Clamato Especial Preparado', 190.00, 31),
    ('Especiales Fatboy', 'Tosti Aguachile', 250.00, 32),
    ('Especiales Fatboy', 'Botana del Gordo', 290.00, 33)
)
INSERT INTO "products" (
  "id", "name", "price", "category_id", "status", "description",
  "short_description", "subcategory", "image_url", "order", "is_promotion", "created_at"
)
SELECT
  gen_random_uuid(),
  seafood_products."name",
  seafood_products."price",
  seafood_category."id",
  'active',
  NULL,
  NULL,
  seafood_products."subcategory",
  '/images/promo_mariscos_2.png',
  seafood_products."sort_order",
  false,
  NOW()
FROM seafood_products
CROSS JOIN seafood_category
WHERE NOT EXISTS (
  SELECT 1
  FROM "products" existing
  WHERE existing."category_id" = seafood_category."id"
    AND lower(existing."name") = lower(seafood_products."name")
);
