ALTER TABLE "products" ADD COLUMN "track_lots_and_expiry" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "sales_order_fulfillments" ADD COLUMN "batch_id" TEXT;
ALTER TABLE "sales_order_fulfillments" ADD CONSTRAINT "sales_order_fulfillments_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
