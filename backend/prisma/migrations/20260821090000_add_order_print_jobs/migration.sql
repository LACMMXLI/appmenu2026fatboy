CREATE TYPE "PrintJobStatus" AS ENUM ('PENDING', 'CLAIMED', 'PRINTING', 'PRINTED', 'FAILED', 'UNCERTAIN');

CREATE TYPE "PrintDocumentType" AS ENUM ('PRODUCTION');

CREATE TABLE "order_print_jobs" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "document_type" "PrintDocumentType" NOT NULL DEFAULT 'PRODUCTION',
    "status" "PrintJobStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "claimed_by_station_id" UUID,
    "claimed_by_station_name" TEXT,
    "claimed_at" TIMESTAMP(3),
    "lease_expires_at" TIMESTAMP(3),
    "next_attempt_at" TIMESTAMP(3),
    "printing_started_at" TIMESTAMP(3),
    "printed_at" TIMESTAMP(3),
    "uncertain_at" TIMESTAMP(3),
    "last_error" TEXT,
    "last_result" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_print_jobs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "order_print_jobs_order_id_document_type_key"
ON "order_print_jobs"("order_id", "document_type");

CREATE INDEX "order_print_jobs_branch_id_status_created_at_idx"
ON "order_print_jobs"("branch_id", "status", "created_at");

CREATE INDEX "order_print_jobs_claimed_by_station_id_status_idx"
ON "order_print_jobs"("claimed_by_station_id", "status");

ALTER TABLE "order_print_jobs"
ADD CONSTRAINT "order_print_jobs_order_id_fkey"
FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
