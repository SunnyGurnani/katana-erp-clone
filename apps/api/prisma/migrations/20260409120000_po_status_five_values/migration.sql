-- Canonical PO statuses: draft, confirmed, vendor_confirmed, vendor_rejected, done
UPDATE "purchase_orders" SET "status" = 'done' WHERE LOWER("status") IN ('cancelled', 'received');
UPDATE "purchase_orders" SET "status" = 'confirmed' WHERE LOWER("status") = 'open';
UPDATE "purchase_orders" SET "status" = 'vendor_confirmed' WHERE LOWER("status") IN ('partial');
