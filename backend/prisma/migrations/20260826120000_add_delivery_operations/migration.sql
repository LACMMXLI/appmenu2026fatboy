ALTER TYPE "StaffRole" ADD VALUE 'DRIVER';

CREATE TYPE "DeliveryTaskStatus" AS ENUM ('ASSIGNED', 'EN_ROUTE', 'INCIDENT', 'DELIVERED');

CREATE TABLE "delivery_tasks" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "driver_id" UUID NOT NULL,
    "assigned_by_staff_id" UUID,
    "status" "DeliveryTaskStatus" NOT NULL DEFAULT 'ASSIGNED',
    "incident_reason" TEXT,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "started_at" TIMESTAMP(3),
    "delivered_at" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "delivery_tasks_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "delivery_task_events" (
    "id" UUID NOT NULL,
    "task_id" UUID NOT NULL,
    "from_status" "DeliveryTaskStatus",
    "to_status" "DeliveryTaskStatus" NOT NULL,
    "staff_id" UUID,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "delivery_task_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "delivery_tasks_order_id_key" ON "delivery_tasks"("order_id");
CREATE INDEX "delivery_tasks_branch_id_status_idx" ON "delivery_tasks"("branch_id", "status");
CREATE INDEX "delivery_tasks_driver_id_status_idx" ON "delivery_tasks"("driver_id", "status");
CREATE INDEX "delivery_task_events_task_id_created_at_idx" ON "delivery_task_events"("task_id", "created_at");

ALTER TABLE "delivery_tasks"
  ADD CONSTRAINT "delivery_tasks_order_id_fkey"
  FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "delivery_tasks"
  ADD CONSTRAINT "delivery_tasks_driver_id_fkey"
  FOREIGN KEY ("driver_id") REFERENCES "staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "delivery_tasks"
  ADD CONSTRAINT "delivery_tasks_assigned_by_staff_id_fkey"
  FOREIGN KEY ("assigned_by_staff_id") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "delivery_task_events"
  ADD CONSTRAINT "delivery_task_events_task_id_fkey"
  FOREIGN KEY ("task_id") REFERENCES "delivery_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "delivery_task_events"
  ADD CONSTRAINT "delivery_task_events_staff_id_fkey"
  FOREIGN KEY ("staff_id") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;
