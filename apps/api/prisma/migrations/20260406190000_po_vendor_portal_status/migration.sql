-- AlterTable
ALTER TABLE "purchase_orders" ADD COLUMN "vendor_portal_token" TEXT,
ADD COLUMN "vendor_invite_sent_at" TIMESTAMP(3),
ADD COLUMN "vendor_responded_at" TIMESTAMP(3),
ADD COLUMN "vendor_response_comment" TEXT;

CREATE UNIQUE INDEX "purchase_orders_vendor_portal_token_key" ON "purchase_orders"("vendor_portal_token");

-- Normalize legacy PO statuses → new workflow
UPDATE "purchase_orders" SET "status" = 'done' WHERE LOWER("status") = 'received';
UPDATE "purchase_orders" SET "status" = 'vendor_confirmed' WHERE LOWER("status") = 'partial';
UPDATE "purchase_orders" SET "status" = 'confirmed' WHERE LOWER("status") IN ('sent', 'confirmed');
