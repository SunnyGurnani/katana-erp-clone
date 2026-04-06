-- AlterTable
ALTER TABLE "sales_order_rows" ADD COLUMN "qty_picked" DECIMAL(18,4) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "sales_order_fulfillments" ADD COLUMN "from_pick" BOOLEAN NOT NULL DEFAULT false;
