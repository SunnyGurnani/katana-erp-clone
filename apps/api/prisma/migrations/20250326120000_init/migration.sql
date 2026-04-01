-- CreateTable
CREATE TABLE "roles" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "hashed_password" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_superuser" BOOLEAN NOT NULL DEFAULT false,
    "role_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_keys" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "key_hash" TEXT NOT NULL,
    "key_prefix" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_used_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "scopes" TEXT,
    "user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhooks" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "secret" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "events" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "webhooks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_logs" (
    "id" TEXT NOT NULL,
    "webhook_id" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "response_status" INTEGER,
    "response_body" TEXT,
    "attempt" INTEGER NOT NULL DEFAULT 1,
    "delivered_at" TIMESTAMP(3),
    "error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webhook_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "locations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "storage_bins" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "location_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "storage_bins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sku" TEXT,
    "description" TEXT,
    "category" TEXT,
    "unit_of_measure" TEXT NOT NULL DEFAULT 'pcs',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_manufactured" BOOLEAN NOT NULL DEFAULT false,
    "sales_price" DECIMAL(18,4),
    "purchase_price" DECIMAL(18,4),
    "image_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "variants" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sku" TEXT,
    "barcode" TEXT,
    "sales_price" DECIMAL(18,4),
    "purchase_price" DECIMAL(18,4),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "variants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "materials" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sku" TEXT,
    "description" TEXT,
    "category" TEXT,
    "unit_of_measure" TEXT NOT NULL DEFAULT 'pcs',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "purchase_price" DECIMAL(18,4),
    "reorder_point" DECIMAL(18,4),
    "lead_time_days" INTEGER,
    "image_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "materials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_levels" (
    "id" TEXT NOT NULL,
    "variant_id" TEXT NOT NULL,
    "location_id" TEXT NOT NULL,
    "on_hand" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "allocated" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "reorder_point" DECIMAL(18,4),
    "reorder_qty" DECIMAL(18,4),
    "safety_stock" DECIMAL(18,4),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_levels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_movements" (
    "id" TEXT NOT NULL,
    "variant_id" TEXT NOT NULL,
    "location_id" TEXT NOT NULL,
    "qty" DECIMAL(18,4) NOT NULL,
    "movement_type" TEXT NOT NULL,
    "reference_type" TEXT,
    "reference_id" TEXT,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "suppliers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "payment_terms" TEXT,
    "notes" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "payment_terms" TEXT,
    "notes" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_orders" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "supplier_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "order_date" DATE,
    "expected_date" DATE,
    "notes" TEXT,
    "location_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "purchase_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_order_rows" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "material_id" TEXT,
    "variant_id" TEXT,
    "description" TEXT,
    "qty_ordered" DECIMAL(18,4) NOT NULL,
    "qty_received" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "unit_price" DECIMAL(18,4),
    "tax_rate" DECIMAL(7,4),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "purchase_order_rows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_order_cost_rows" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DECIMAL(18,4) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "purchase_order_cost_rows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_orders" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "customer_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "order_date" DATE,
    "required_date" DATE,
    "notes" TEXT,
    "location_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sales_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_order_rows" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "variant_id" TEXT,
    "description" TEXT,
    "qty_ordered" DECIMAL(18,4) NOT NULL,
    "qty_fulfilled" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "unit_price" DECIMAL(18,4),
    "tax_rate" DECIMAL(7,4),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sales_order_rows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_order_fulfillments" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "row_id" TEXT NOT NULL,
    "qty" DECIMAL(18,4) NOT NULL,
    "location_id" TEXT,
    "is_return" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sales_order_fulfillments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "boms" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "variant_id" TEXT,
    "name" TEXT NOT NULL,
    "qty" DECIMAL(18,4) NOT NULL DEFAULT 1,
    "notes" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "boms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bom_rows" (
    "id" TEXT NOT NULL,
    "bom_id" TEXT NOT NULL,
    "material_id" TEXT,
    "variant_id" TEXT,
    "qty" DECIMAL(18,4) NOT NULL,
    "unit_cost" DECIMAL(18,4),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bom_rows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_operations" (
    "id" TEXT NOT NULL,
    "bom_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "rank" INTEGER NOT NULL DEFAULT 0,
    "duration_minutes" INTEGER,
    "cost_per_hour" DECIMAL(18,4),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_operations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "manufacturing_orders" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "bom_id" TEXT,
    "product_id" TEXT NOT NULL,
    "variant_id" TEXT,
    "location_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "qty_planned" DECIMAL(18,4) NOT NULL,
    "qty_produced" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "planned_start" DATE,
    "planned_end" DATE,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "manufacturing_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mo_recipe_rows" (
    "id" TEXT NOT NULL,
    "mo_id" TEXT NOT NULL,
    "material_id" TEXT,
    "variant_id" TEXT,
    "qty_planned" DECIMAL(18,4) NOT NULL,
    "qty_consumed" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mo_recipe_rows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mo_operation_rows" (
    "id" TEXT NOT NULL,
    "mo_id" TEXT NOT NULL,
    "operation_id" TEXT,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "actual_minutes" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mo_operation_rows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_adjustments" (
    "id" TEXT NOT NULL,
    "variant_id" TEXT NOT NULL,
    "location_id" TEXT NOT NULL,
    "qty_delta" DECIMAL(18,4) NOT NULL,
    "reason" TEXT NOT NULL,
    "note" TEXT,
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_adjustments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_transfers" (
    "id" TEXT NOT NULL,
    "variant_id" TEXT NOT NULL,
    "from_location_id" TEXT NOT NULL,
    "to_location_id" TEXT NOT NULL,
    "qty" DECIMAL(18,4) NOT NULL,
    "note" TEXT,
    "status" TEXT NOT NULL DEFAULT 'completed',
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_transfers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stocktakes" (
    "id" TEXT NOT NULL,
    "location_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stocktakes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stocktake_rows" (
    "id" TEXT NOT NULL,
    "stocktake_id" TEXT NOT NULL,
    "variant_id" TEXT NOT NULL,
    "counted_qty" DECIMAL(18,4) NOT NULL,
    "system_qty" DECIMAL(18,4) NOT NULL,
    "variance" DECIMAL(18,4) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stocktake_rows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "batches" (
    "id" TEXT NOT NULL,
    "variant_id" TEXT NOT NULL,
    "batch_number" TEXT NOT NULL,
    "expiry_date" DATE,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "serial_numbers" (
    "id" TEXT NOT NULL,
    "variant_id" TEXT NOT NULL,
    "serial_number" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'available',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "serial_numbers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tax_rates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "rate" DECIMAL(7,4) NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tax_rates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_addresses" (
    "id" TEXT NOT NULL,
    "supplier_id" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'billing',
    "line1" TEXT,
    "line2" TEXT,
    "city" TEXT,
    "state" TEXT,
    "zip" TEXT,
    "country" TEXT,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "supplier_addresses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_addresses" (
    "id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'billing',
    "line1" TEXT,
    "line2" TEXT,
    "city" TEXT,
    "state" TEXT,
    "zip" TEXT,
    "country" TEXT,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customer_addresses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "price_lists" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "price_lists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "price_list_rows" (
    "id" TEXT NOT NULL,
    "price_list_id" TEXT NOT NULL,
    "variant_id" TEXT,
    "service_id" TEXT,
    "price" DECIMAL(18,4) NOT NULL,
    "min_qty" DECIMAL(18,4),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "price_list_rows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "price_list_customers" (
    "id" TEXT NOT NULL,
    "price_list_id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "price_list_customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "services" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sku" TEXT,
    "description" TEXT,
    "price" DECIMAL(18,4),
    "tax_rate_id" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_returns" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "order_id" TEXT,
    "customer_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sales_returns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_return_rows" (
    "id" TEXT NOT NULL,
    "return_id" TEXT NOT NULL,
    "variant_id" TEXT,
    "so_row_id" TEXT,
    "description" TEXT,
    "qty" DECIMAL(18,4) NOT NULL,
    "unit_price" DECIMAL(18,4),
    "return_reason" TEXT,
    "location_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sales_return_rows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_order_shipping_fees" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT 'Shipping',
    "amount" DECIMAL(18,4) NOT NULL,
    "tax_rate_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sales_order_shipping_fees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "demand_forecasts" (
    "id" TEXT NOT NULL,
    "variant_id" TEXT NOT NULL,
    "location_id" TEXT,
    "qty" DECIMAL(18,4) NOT NULL,
    "forecast_at" DATE NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "demand_forecasts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "factory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "address" TEXT,
    "logo_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "factory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mo_productions" (
    "id" TEXT NOT NULL,
    "mo_id" TEXT NOT NULL,
    "qty" DECIMAL(18,4) NOT NULL,
    "location_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'planned',
    "produced_at" TIMESTAMP(3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mo_productions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mo_production_ingredients" (
    "id" TEXT NOT NULL,
    "production_id" TEXT NOT NULL,
    "recipe_row_id" TEXT,
    "variant_id" TEXT,
    "material_id" TEXT,
    "qty_required" DECIMAL(18,4) NOT NULL,
    "qty_consumed" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mo_production_ingredients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_order_addresses" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'shipping',
    "line1" TEXT,
    "line2" TEXT,
    "city" TEXT,
    "state" TEXT,
    "zip" TEXT,
    "country" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sales_order_addresses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "method" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "resource_type" TEXT NOT NULL,
    "resource_id" TEXT,
    "action" TEXT NOT NULL,
    "request_body" TEXT,
    "response_status" INTEGER,
    "ip_address" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quotes" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "customer_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "valid_until" DATE,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quotes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quote_rows" (
    "id" TEXT NOT NULL,
    "quote_id" TEXT NOT NULL,
    "variant_id" TEXT,
    "description" TEXT,
    "qty" DECIMAL(18,4) NOT NULL,
    "unit_price" DECIMAL(18,4),
    "tax_rate" DECIMAL(7,4),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quote_rows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "currencies" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "is_base" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "currencies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exchange_rates" (
    "id" TEXT NOT NULL,
    "from_code" TEXT NOT NULL,
    "to_code" TEXT NOT NULL,
    "rate" DECIMAL(18,8) NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "effective_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exchange_rates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounting_integrations" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'disconnected',
    "access_token" TEXT,
    "refresh_token" TEXT,
    "token_expiry" TIMESTAMP(3),
    "realm_id" TEXT,
    "tenant_id" TEXT,
    "last_sync_at" TIMESTAMP(3),
    "settings" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accounting_integrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounting_sync_logs" (
    "id" TEXT NOT NULL,
    "integration_id" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "external_id" TEXT,
    "status" TEXT NOT NULL,
    "error" TEXT,
    "payload" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "accounting_sync_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ecommerce_integrations" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'disconnected',
    "shop_domain" TEXT,
    "access_token" TEXT,
    "api_key" TEXT,
    "api_secret" TEXT,
    "webhook_secret" TEXT,
    "settings" TEXT,
    "last_sync_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ecommerce_integrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ecommerce_sync_logs" (
    "id" TEXT NOT NULL,
    "integration_id" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "external_id" TEXT,
    "status" TEXT NOT NULL,
    "error" TEXT,
    "payload" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ecommerce_sync_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ecommerce_product_mappings" (
    "id" TEXT NOT NULL,
    "integration_id" TEXT NOT NULL,
    "variant_id" TEXT NOT NULL,
    "external_id" TEXT NOT NULL,
    "external_sku" TEXT,
    "sync_inventory" BOOLEAN NOT NULL DEFAULT true,
    "sync_price" BOOLEAN NOT NULL DEFAULT false,
    "last_sync_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ecommerce_product_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "custom_field_definitions" (
    "id" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "field_type" TEXT NOT NULL,
    "options" TEXT,
    "is_required" BOOLEAN NOT NULL DEFAULT false,
    "default_value" TEXT,
    "rank" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "custom_field_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "custom_field_values" (
    "id" TEXT NOT NULL,
    "field_id" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "value" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "custom_field_values_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "batch_stocks" (
    "id" TEXT NOT NULL,
    "batch_id" TEXT NOT NULL,
    "location_id" TEXT NOT NULL,
    "on_hand" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "allocated" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "batch_stocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "variant_bin_locations" (
    "id" TEXT NOT NULL,
    "variant_id" TEXT NOT NULL,
    "storage_bin_id" TEXT NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "variant_bin_locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "additional_costs" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "additional_costs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outsourced_po_recipe_rows" (
    "id" TEXT NOT NULL,
    "po_id" TEXT NOT NULL,
    "material_id" TEXT,
    "variant_id" TEXT,
    "qty_required" DECIMAL(18,4) NOT NULL,
    "qty_consumed" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "outsourced_po_recipe_rows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attachments" (
    "id" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "type" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attachments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "roles_name_key" ON "roles"("name");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "api_keys_key_hash_key" ON "api_keys"("key_hash");

-- CreateIndex
CREATE UNIQUE INDEX "products_sku_key" ON "products"("sku");

-- CreateIndex
CREATE UNIQUE INDEX "variants_sku_key" ON "variants"("sku");

-- CreateIndex
CREATE UNIQUE INDEX "variants_barcode_key" ON "variants"("barcode");

-- CreateIndex
CREATE UNIQUE INDEX "materials_sku_key" ON "materials"("sku");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_levels_variant_id_location_id_key" ON "inventory_levels"("variant_id", "location_id");

-- CreateIndex
CREATE UNIQUE INDEX "suppliers_code_key" ON "suppliers"("code");

-- CreateIndex
CREATE UNIQUE INDEX "customers_code_key" ON "customers"("code");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_orders_number_key" ON "purchase_orders"("number");

-- CreateIndex
CREATE UNIQUE INDEX "sales_orders_number_key" ON "sales_orders"("number");

-- CreateIndex
CREATE UNIQUE INDEX "manufacturing_orders_number_key" ON "manufacturing_orders"("number");

-- CreateIndex
CREATE UNIQUE INDEX "batches_variant_id_batch_number_key" ON "batches"("variant_id", "batch_number");

-- CreateIndex
CREATE UNIQUE INDEX "serial_numbers_serial_number_key" ON "serial_numbers"("serial_number");

-- CreateIndex
CREATE UNIQUE INDEX "services_sku_key" ON "services"("sku");

-- CreateIndex
CREATE UNIQUE INDEX "sales_returns_number_key" ON "sales_returns"("number");

-- CreateIndex
CREATE UNIQUE INDEX "quotes_number_key" ON "quotes"("number");

-- CreateIndex
CREATE UNIQUE INDEX "currencies_code_key" ON "currencies"("code");

-- CreateIndex
CREATE UNIQUE INDEX "exchange_rates_from_code_to_code_effective_at_key" ON "exchange_rates"("from_code", "to_code", "effective_at");

-- CreateIndex
CREATE UNIQUE INDEX "accounting_integrations_provider_key" ON "accounting_integrations"("provider");

-- CreateIndex
CREATE UNIQUE INDEX "ecommerce_integrations_provider_key" ON "ecommerce_integrations"("provider");

-- CreateIndex
CREATE UNIQUE INDEX "ecommerce_product_mappings_integration_id_variant_id_key" ON "ecommerce_product_mappings"("integration_id", "variant_id");

-- CreateIndex
CREATE UNIQUE INDEX "custom_field_definitions_entity_type_name_key" ON "custom_field_definitions"("entity_type", "name");

-- CreateIndex
CREATE UNIQUE INDEX "custom_field_values_field_id_entity_id_key" ON "custom_field_values"("field_id", "entity_id");

-- CreateIndex
CREATE UNIQUE INDEX "batch_stocks_batch_id_location_id_key" ON "batch_stocks"("batch_id", "location_id");

-- CreateIndex
CREATE UNIQUE INDEX "variant_bin_locations_variant_id_storage_bin_id_key" ON "variant_bin_locations"("variant_id", "storage_bin_id");

-- CreateIndex
CREATE UNIQUE INDEX "additional_costs_name_key" ON "additional_costs"("name");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webhook_logs" ADD CONSTRAINT "webhook_logs_webhook_id_fkey" FOREIGN KEY ("webhook_id") REFERENCES "webhooks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "storage_bins" ADD CONSTRAINT "storage_bins_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "variants" ADD CONSTRAINT "variants_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_levels" ADD CONSTRAINT "inventory_levels_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_levels" ADD CONSTRAINT "inventory_levels_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order_rows" ADD CONSTRAINT "purchase_order_rows_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "purchase_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order_cost_rows" ADD CONSTRAINT "purchase_order_cost_rows_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "purchase_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_orders" ADD CONSTRAINT "sales_orders_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_order_rows" ADD CONSTRAINT "sales_order_rows_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "sales_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_order_fulfillments" ADD CONSTRAINT "sales_order_fulfillments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "sales_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_order_fulfillments" ADD CONSTRAINT "sales_order_fulfillments_row_id_fkey" FOREIGN KEY ("row_id") REFERENCES "sales_order_rows"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "boms" ADD CONSTRAINT "boms_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bom_rows" ADD CONSTRAINT "bom_rows_bom_id_fkey" FOREIGN KEY ("bom_id") REFERENCES "boms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_operations" ADD CONSTRAINT "product_operations_bom_id_fkey" FOREIGN KEY ("bom_id") REFERENCES "boms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "manufacturing_orders" ADD CONSTRAINT "manufacturing_orders_bom_id_fkey" FOREIGN KEY ("bom_id") REFERENCES "boms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "manufacturing_orders" ADD CONSTRAINT "manufacturing_orders_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mo_recipe_rows" ADD CONSTRAINT "mo_recipe_rows_mo_id_fkey" FOREIGN KEY ("mo_id") REFERENCES "manufacturing_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mo_operation_rows" ADD CONSTRAINT "mo_operation_rows_mo_id_fkey" FOREIGN KEY ("mo_id") REFERENCES "manufacturing_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mo_operation_rows" ADD CONSTRAINT "mo_operation_rows_operation_id_fkey" FOREIGN KEY ("operation_id") REFERENCES "product_operations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stocktake_rows" ADD CONSTRAINT "stocktake_rows_stocktake_id_fkey" FOREIGN KEY ("stocktake_id") REFERENCES "stocktakes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_addresses" ADD CONSTRAINT "supplier_addresses_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_addresses" ADD CONSTRAINT "customer_addresses_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_list_rows" ADD CONSTRAINT "price_list_rows_price_list_id_fkey" FOREIGN KEY ("price_list_id") REFERENCES "price_lists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_list_customers" ADD CONSTRAINT "price_list_customers_price_list_id_fkey" FOREIGN KEY ("price_list_id") REFERENCES "price_lists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_return_rows" ADD CONSTRAINT "sales_return_rows_return_id_fkey" FOREIGN KEY ("return_id") REFERENCES "sales_returns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_order_shipping_fees" ADD CONSTRAINT "sales_order_shipping_fees_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "sales_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mo_productions" ADD CONSTRAINT "mo_productions_mo_id_fkey" FOREIGN KEY ("mo_id") REFERENCES "manufacturing_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mo_production_ingredients" ADD CONSTRAINT "mo_production_ingredients_production_id_fkey" FOREIGN KEY ("production_id") REFERENCES "mo_productions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_order_addresses" ADD CONSTRAINT "sales_order_addresses_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "sales_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_rows" ADD CONSTRAINT "quote_rows_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "quotes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exchange_rates" ADD CONSTRAINT "exchange_rates_from_code_fkey" FOREIGN KEY ("from_code") REFERENCES "currencies"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounting_sync_logs" ADD CONSTRAINT "accounting_sync_logs_integration_id_fkey" FOREIGN KEY ("integration_id") REFERENCES "accounting_integrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ecommerce_sync_logs" ADD CONSTRAINT "ecommerce_sync_logs_integration_id_fkey" FOREIGN KEY ("integration_id") REFERENCES "ecommerce_integrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "custom_field_values" ADD CONSTRAINT "custom_field_values_field_id_fkey" FOREIGN KEY ("field_id") REFERENCES "custom_field_definitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "batch_stocks" ADD CONSTRAINT "batch_stocks_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "batch_stocks" ADD CONSTRAINT "batch_stocks_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "variant_bin_locations" ADD CONSTRAINT "variant_bin_locations_storage_bin_id_fkey" FOREIGN KEY ("storage_bin_id") REFERENCES "storage_bins"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outsourced_po_recipe_rows" ADD CONSTRAINT "outsourced_po_recipe_rows_po_id_fkey" FOREIGN KEY ("po_id") REFERENCES "purchase_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

