-- Add FK for fulfillment ship-from location (column existed; relation was missing in schema)
ALTER TABLE "sales_order_fulfillments" ADD CONSTRAINT "sales_order_fulfillments_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
