INSERT INTO "categories" ("id", "name", "order", "status", "image_url")
VALUES (
  '7b5d7621-9c2e-4e40-9821-12fb3d2e4100',
  'Promociones',
  5,
  'active',
  '/images/promo_charola_futbolera.png'
)
ON CONFLICT ("id") DO UPDATE SET
  "name" = EXCLUDED."name",
  "order" = EXCLUDED."order",
  "status" = EXCLUDED."status",
  "image_url" = EXCLUDED."image_url";

INSERT INTO "products" (
  "id",
  "name",
  "price",
  "category_id",
  "status",
  "description",
  "short_description",
  "image_url",
  "order",
  "is_promotion",
  "promotion_tag",
  "promotion_tag_color"
)
VALUES
(
  '7b5d7621-9c2e-4e40-9821-12fb3d2e4101',
  'Charola La Futbolera',
  380.00,
  '7b5d7621-9c2e-4e40-9821-12fb3d2e4100',
  'active',
  'Boneless, alitas, papas sazonadas, aros de cebolla, palitos de queso, apio, zanahoria y aderezo ranch.',
  'La mejor botana para ver los partidos.',
  '/images/promo_charola_futbolera.png',
  10,
  true,
  'FUTBOLERA',
  'yellow'
),
(
  '7b5d7621-9c2e-4e40-9821-12fb3d2e4102',
  'Charola Fatgool',
  499.00,
  '7b5d7621-9c2e-4e40-9821-12fb3d2e4100',
  'active',
  'Hamburguesa guacamole, hamburguesa bacon, burrito de asada, burrito de pastor, boneless, papas, apio, zanahoria, aderezo ranch y bebida.',
  'La que sí llena a toda la raza.',
  '/images/promo_charola_fatgool.png',
  20,
  true,
  'FATGOOL',
  'yellow'
)
ON CONFLICT ("id") DO UPDATE SET
  "name" = EXCLUDED."name",
  "price" = EXCLUDED."price",
  "category_id" = EXCLUDED."category_id",
  "status" = EXCLUDED."status",
  "description" = EXCLUDED."description",
  "short_description" = EXCLUDED."short_description",
  "image_url" = EXCLUDED."image_url",
  "order" = EXCLUDED."order",
  "is_promotion" = EXCLUDED."is_promotion",
  "promotion_tag" = EXCLUDED."promotion_tag",
  "promotion_tag_color" = EXCLUDED."promotion_tag_color";
