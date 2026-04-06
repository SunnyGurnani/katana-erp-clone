-- AlterTable
ALTER TABLE "inventory_movements" ADD COLUMN "batch_id" TEXT,
ADD COLUMN "purchase_order_row_id" TEXT;

-- AddForeignKey
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_purchase_order_row_id_fkey" FOREIGN KEY ("purchase_order_row_id") REFERENCES "purchase_order_rows"("id") ON DELETE SET NULL ON UPDATE CASCADE;
