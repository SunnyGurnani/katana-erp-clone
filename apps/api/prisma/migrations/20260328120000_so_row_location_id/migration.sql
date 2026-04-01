-- AlterTable
ALTER TABLE "sales_order_rows" ADD COLUMN "location_id" TEXT;

-- AddForeignKey
ALTER TABLE "sales_order_rows" ADD CONSTRAINT "sales_order_rows_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
