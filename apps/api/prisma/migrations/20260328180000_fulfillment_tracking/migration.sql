-- Optional carrier / tracking per fulfillment line
ALTER TABLE "sales_order_fulfillments" ADD COLUMN "carrier" TEXT;
ALTER TABLE "sales_order_fulfillments" ADD COLUMN "tracking_number" TEXT;
ALTER TABLE "sales_order_fulfillments" ADD COLUMN "ship_method" TEXT;
