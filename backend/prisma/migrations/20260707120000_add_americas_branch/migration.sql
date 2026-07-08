UPDATE "branches"
SET
  "name" = 'Américas',
  "phone" = '+526861105191',
  "address" = 'Calzada de las Américas 837, Colonia Compuertas, Mexicali, B.C.',
  "hours" = COALESCE("hours", 'Horario pendiente de configurar'),
  "maps_url" = 'https://www.google.com/maps/search/?api=1&query=Calzada%20de%20las%20Am%C3%A9ricas%20837%2C%20Colonia%20Compuertas%2C%20Mexicali%2C%20B.C.'
WHERE lower("name") LIKE '%amer%';

INSERT INTO "branches" ("id", "name", "phone", "address", "hours", "maps_url", "created_at")
SELECT
  '6d038f0e-0f15-4bd7-951f-2b1f0a70a9e8',
  'Américas',
  '+526861105191',
  'Calzada de las Américas 837, Colonia Compuertas, Mexicali, B.C.',
  'Horario pendiente de configurar',
  'https://www.google.com/maps/search/?api=1&query=Calzada%20de%20las%20Am%C3%A9ricas%20837%2C%20Colonia%20Compuertas%2C%20Mexicali%2C%20B.C.',
  NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM "branches" WHERE lower("name") LIKE '%amer%'
);
