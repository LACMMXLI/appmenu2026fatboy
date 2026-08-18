-- Customer-initiated cancellation requests (post-acceptance) — the branch
-- approves (-> CANCELLED) or rejects (flags cleared, order continues).
ALTER TABLE "orders" ADD COLUMN "cancellation_requested_at" TIMESTAMP(3);
ALTER TABLE "orders" ADD COLUMN "cancellation_request_reason" TEXT;
