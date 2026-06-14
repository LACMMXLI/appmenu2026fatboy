-- Insert the three new promotions into products table
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
  '7b5d7621-9c2e-4e40-9821-12fb3d2e4103',
  '2 Rollos Cielo, Mar y Tierra Empanizados',
  150.00,
  '7b5d7621-9c2e-4e40-9821-12fb3d2e4100',
  'active',
  '2 rollos empanizados de cielo, mar y tierra. Válido hasta las 10:00 PM.',
  'Válido hasta las 10:00 PM',
  '/images/promo_rollos_empanizados.png',
  30,
  true,
  '2 ROLLOS',
  'yellow'
),
(
  '7b5d7621-9c2e-4e40-9821-12fb3d2e4104',
  '2 Rollos Cielo, Mar y Tierra Naturales',
  100.00,
  '7b5d7621-9c2e-4e40-9821-12fb3d2e4100',
  'active',
  '2 rollos naturales de cielo, mar y tierra. Válido hasta las 10:00 PM.',
  'Válido hasta las 10:00 PM',
  '/images/promo_rollos_naturales.png',
  40,
  true,
  '2 ROLLOS',
  'yellow'
),
(
  '7b5d7621-9c2e-4e40-9821-12fb3d2e4105',
  'Charola Urban Fatboy',
  350.00,
  '7b5d7621-9c2e-4e40-9821-12fb3d2e4100',
  'active',
  '4 hamburguesas, boneless, papas, apio y zanahoria, pepsi 1.5 L.',
  'Todo por solo $350',
  '/images/promo_urban_fatboy_charola.png',
  50,
  true,
  'CHAROLA',
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
