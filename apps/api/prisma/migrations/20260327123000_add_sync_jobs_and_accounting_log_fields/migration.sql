-- AlterTable
ALTER TABLE "accounting_sync_logs"
ADD COLUMN "operation" TEXT NOT NULL DEFAULT 'create',
ADD COLUMN "started_at" TIMESTAMP(3),
ADD COLUMN "completed_at" TIMESTAMP(3),
ADD COLUMN "error_code" TEXT,
ADD COLUMN "request_payload" TEXT,
ADD COLUMN "response_payload" TEXT;

-- CreateTable
CREATE TABLE "sync_jobs" (
    "id" TEXT NOT NULL,
    "integration_id" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "local_entity_id" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "next_retry_at" TIMESTAMP(3),
    "error" TEXT,
    "payload" TEXT,
    "last_error_at" TIMESTAMP(3),
    "idempotency_key" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "sync_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sync_jobs_status_next_retry_at_idx" ON "sync_jobs"("status", "next_retry_at");

-- CreateIndex
CREATE UNIQUE INDEX "sync_jobs_integration_id_idempotency_key_key"
ON "sync_jobs"("integration_id", "idempotency_key");

-- AddForeignKey
ALTER TABLE "sync_jobs"
ADD CONSTRAINT "sync_jobs_integration_id_fkey"
FOREIGN KEY ("integration_id") REFERENCES "accounting_integrations"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
