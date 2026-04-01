-- CreateTable
CREATE TABLE "accounting_entity_mappings" (
    "id" TEXT NOT NULL,
    "integration_id" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "local_entity_id" TEXT NOT NULL,
    "external_entity_id" TEXT NOT NULL,
    "sync_token" TEXT,
    "last_synced_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accounting_entity_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "accounting_entity_mappings_integration_id_entity_type_local_entity_id_key"
ON "accounting_entity_mappings"("integration_id", "entity_type", "local_entity_id");

-- AddForeignKey
ALTER TABLE "accounting_entity_mappings"
ADD CONSTRAINT "accounting_entity_mappings_integration_id_fkey"
FOREIGN KEY ("integration_id") REFERENCES "accounting_integrations"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
