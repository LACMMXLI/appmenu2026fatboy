-- Points are now credited to the customer only when an order reaches
-- COMPLETED (delivered), not at creation. pointsCredited guards against
-- crediting the same order twice.
ALTER TABLE "orders" ADD COLUMN "points_credited" BOOLEAN NOT NULL DEFAULT false;

-- Backfill: every existing order already credited its pointsEarned to the
-- customer at creation time under the old (buggy) logic, regardless of its
-- current status. Mark them all as already-credited so the new
-- COMPLETED-only crediting path never double-credits a legacy order when it
-- later transitions (e.g. an order that is currently ACCEPTED or PREPARING
-- and will reach COMPLETED under the new code).
UPDATE "orders" SET "points_credited" = true WHERE "points_earned" > 0;
