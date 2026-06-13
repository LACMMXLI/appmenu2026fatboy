ALTER TABLE "branches" ADD COLUMN "address" TEXT;
ALTER TABLE "branches" ADD COLUMN "hours" TEXT;
ALTER TABLE "branches" ADD COLUMN "maps_url" TEXT;

UPDATE "branches"
SET
  "phone" = COALESCE(NULLIF("phone", ''), '+526861105191'),
  "address" = 'Calz Lombardo Toledano 1200, Hacienda del Bosque, 21355 Mexicali, B.C.',
  "hours" = 'Lunes a domingo 12:00 PM - 3:00 AM',
  "maps_url" = 'https://maps.app.goo.gl/vwVeVoSUrbbD2oMM6'
WHERE lower("name") IN ('venecia', 'venezia')
   OR lower("name") LIKE '%veneci%'
   OR lower("name") LIKE '%venezi%';

UPDATE "branches"
SET
  "phone" = COALESCE(NULLIF("phone", ''), '+526862761824'),
  "address" = 'Uxmal 101, Fracc. San Marcos, 21050 Mexicali, B.C.',
  "hours" = 'Abierto 24 horas',
  "maps_url" = 'https://maps.app.goo.gl/ytg4tsmf3MrMnSm38'
WHERE lower("name") LIKE '%san marcos%';
