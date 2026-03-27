# ForgeERP QuickBooks Integration Technical Specification

## 1) Monorepo Architecture Map

## Repository Topology

- `apps/api`: Express + Prisma + PostgreSQL backend (`@forge-erp/api`)
- `apps/web`: Next.js 14 frontend (`@forge-erp/web`)
- `packages/types`: shared TypeScript interfaces (`@forge-erp/types`)
- Workspace/build orchestration: pnpm workspaces + Turborepo (`turbo.json`)

## Backend (`apps/api`) Architecture

- **Entry/runtime**
  - `src/index.ts`: server bootstrap, storage init, listen
  - `src/app.ts`: middleware stack, OpenAPI docs, route mounting
- **Data layer**
  - `prisma/schema.prisma`: canonical data model
  - `src/lib/prisma.ts`: Prisma client singleton
- **Domain/API layer**
  - `src/routes/*.ts`: modular REST resources (inventory, orders, manufacturing, integrations, etc.)
- **Middleware**
  - Auth (`src/middleware/auth.ts`)
  - RBAC (`src/middleware/roles.ts`)
  - Audit logging (`src/middleware/audit.ts`)
  - Error handling (`src/middleware/error.ts`)
  - Webhook signature verification (`src/middleware/verifyWebhook.ts`)
  - Pagination/metrics/request ID helpers
- **Utilities**
  - `src/lib/jwt.ts`, `src/lib/password.ts`, `src/lib/inventory.ts`, `src/lib/storage.ts`

## Frontend (`apps/web`) Architecture

- Next.js App Router pages under `src/app`
- Core business sections under `/dashboard/*`: buy, sell, make, stock, plan, insights, settings
- API client wrapper in `src/lib/api.ts`:
  - Bearer token injection
  - automatic refresh via `/api/v1/auth/refresh`
- Auth helpers in `src/lib/auth.ts`
- React Query-driven UI state/data fetching

## Shared Types (`packages/types`)

- `packages/types/src/index.ts` contains shared DTO-like interfaces for:
  - users
  - products/variants/materials
  - inventory levels
  - suppliers/customers
  - purchase/sales/manufacturing order structures

---

## 2) Core Business Domains Identified

- **Inventory**
  - inventory levels, inventory movements, stock adjustments/transfers/stocktakes
  - serial/batch tracking, bin locations, variant-bin mapping
- **Purchase Orders**
  - PO headers, PO rows, PO additional costs, receiving flow
- **Sales Orders**
  - SO headers, SO rows, fulfillment, shipping fees, SO addresses, returns
- **Manufacturing**
  - BOMs, BOM rows, product operations, manufacturing orders, production runs, ingredient consumption
- **Materials**
  - materials catalog and purchasing metadata
- **Products**
  - products and variants, BOM/operation recipes
- **Suppliers**
  - supplier records and addresses
- **Customers**
  - customer records and addresses
- **Cross-cutting**
  - currencies/exchange rates, tax rates, pricing lists, custom fields, attachments, analytics/planning
- **Integrations**
  - accounting integrations (includes QuickBooks provider placeholder)
  - ecommerce integrations (Shopify/WooCommerce)
  - outbound webhooks and API keys

---

## 3) Existing API Endpoints (Methods, Paths, Purpose)

All resource endpoints are under `/api/v1` unless noted.

## System/Auth

- `GET /health` - service health probe
- `GET /api/v1/status/metrics` - Prometheus metrics
- `POST /api/v1/webhooks/inbound` - generic inbound webhook receiver with HMAC verification
- `POST /api/v1/auth/login` - login, returns access/refresh JWT pair
- `POST /api/v1/auth/refresh` - refresh token rotation
- `GET /api/v1/auth/me` - current user profile
- `POST /api/v1/auth/register` - create user account

## Master Data

- Products (`/products`)
  - `GET /` list products
  - `POST /` create product
  - `GET /:id` get product
  - `PUT /:id`, `PATCH /:id` update product
  - `DELETE /:id` delete product
  - BOM row ops in same router:
    - `GET /bom-rows`, `POST /bom-rows`, `POST /bom-rows/batch`
    - `GET /bom-rows/:id`, `PATCH /bom-rows/:id`, `DELETE /bom-rows/:id`
  - Operation helpers:
    - `POST /operation-rerank`
    - `GET /operation-rows`
- Variants (`/variants`)
  - `GET /`, `POST /`, `GET /:id`, `PATCH /:id`, `DELETE /:id`
  - Bin links: `GET /:id/storage-bins`, `POST /:id/storage-bins`, `DELETE /:id/storage-bins/:binLinkId`
- Materials (`/materials`)
  - `GET /`, `POST /`, `GET /:id`, `PATCH /:id`, `DELETE /:id`
- Services (`/services`)
  - `GET /`, `POST /`, `GET /:id`, `PATCH /:id`, `DELETE /:id`
- Suppliers (`/suppliers`)
  - `GET /`, `POST /`, `GET /:id`, `PATCH /:id`, `DELETE /:id`
- Customers (`/customers`)
  - `GET /`, `POST /`, `GET /:id`, `PATCH /:id`, `DELETE /:id`
- Locations (`/locations`)
  - `GET /`, `POST /`, `GET /:id`, `PATCH /:id`
- Tax rates (`/tax-rates`)
  - `GET /`, `POST /`, `PATCH /:id`, `DELETE /:id`
- Currencies (`/currencies`)
  - `GET /`, `POST /`, `GET /:id`, `PATCH /:id`, `DELETE /:id`
  - `GET /convert`
  - exchange rates: `GET /exchange-rates/list`, `POST /exchange-rates`, `POST /exchange-rates/fetch`
- Factory settings (`/factory`)
  - `GET /`, `PATCH /`
- Additional costs (`/additional-costs`)
  - `GET /`, `POST /`, `PATCH /:id`, `DELETE /:id`
- Custom fields (`/custom-fields`)
  - definitions: `GET /`, `POST /`, `PATCH /:id`, `DELETE /:id`
  - values: `GET /values`, `POST /values`, `DELETE /values/:id`
  - entity-level: `GET /entity/:entityType/:entityId`, `POST /entity/:entityType/:entityId`

## Procurement / Sales / Manufacturing

- Purchase Orders (`/purchase-orders`)
  - `GET /`, `POST /`, `GET /:id`, `PUT /:id`, `PATCH /:id`
  - `POST /:id/rows` add row
  - `POST /:id/receive` receive inventory
- Purchase Order Rows (`/purchase-order-rows`)
  - `GET /`, `GET /:id`, `PATCH /:id`, `DELETE /:id`
- Outsourced PO Recipe Rows (`/outsourced-po-recipe-rows`)
  - `GET /`, `POST /`, `GET /:id`, `PATCH /:id`, `DELETE /:id`
- Sales Orders (`/sales-orders`)
  - `GET /`, `POST /`, `GET /:id`, `PUT /:id`, `PATCH /:id`
  - `POST /:id/rows` add row
  - `POST /:id/fulfill` fulfill lines
  - `GET /:id/returnable-items`
- Sales Order Rows (`/sales-order-rows`)
  - `GET /`, `GET /:id`, `PATCH /:id`, `DELETE /:id`
- Sales Order Fulfillments (`/sales-order-fulfillments`)
  - `GET /`, `GET /:id`, `POST /`, `DELETE /:id`
- Sales Returns (`/sales-returns`)
  - `GET /`, `POST /`, `GET /:id`, `PATCH /:id`, `DELETE /:id`
  - `POST /:id/rows`, `GET /:id/rows`
  - `PATCH /rows/:id`, `DELETE /rows/:id`
  - `POST /:id/complete`
  - `GET /return-reasons`
  - `GET /:id/unassigned-batch-transactions`
- Sales Return Rows (`/sales-return-rows`)
  - `POST /`, `GET /`, `GET /:id`, `PATCH /:id`, `DELETE /:id`
- Shipping Fees (mounted on root `/api/v1`)
  - `POST /sales-orders/:orderId/shipping-fees`
  - `GET /shipping-fees`, `GET /shipping-fees/:id`, `PATCH /shipping-fees/:id`, `DELETE /shipping-fees/:id`
- Quotes (`/quotes`)
  - `GET /`, `POST /`, `GET /:id`, `PUT /:id`, `DELETE /:id`
  - `POST /:id/rows`, `PATCH /rows/:id`, `DELETE /rows/:id`
  - `POST /:id/convert-to-so`
- Manufacturing (`/manufacturing`)
  - BOMs: `GET /boms`, `POST /boms`, `GET /boms/:id`, `PATCH /boms/:id`
  - MOs: `GET /orders`, `POST /orders`, `GET /orders/:id`, `PATCH /orders/:id`
  - production flows: `POST /orders/:id/produce`, `POST /orders/:id/make-to-order`, `POST /orders/:id/unlink`
  - recipe rows: `GET /recipe-rows`, `POST /recipe-rows`, `GET /recipe-rows/:id`, `PATCH /recipe-rows/:id`, `DELETE /recipe-rows/:id`
  - operation rows: `GET /operation-rows`, `POST /operation-rows`, `GET /operation-rows/:id`, `PATCH /operation-rows/:id`, `DELETE /operation-rows/:id`
- MO Productions (`/mo-productions`)
  - `POST /orders/:id/productions`, `GET /orders/:id/productions`
  - `GET /productions/:id`, `PATCH /productions/:id`, `DELETE /productions/:id`
  - `PATCH /productions/:id/ingredients/:ingredientId`
- MO Recipe Rows (`/mo-recipe-rows`)
  - `POST /`, `GET /`, `GET /:id`, `PATCH /:id`, `DELETE /:id`
- MO Operation Rows (`/mo-operation-rows`)
  - `POST /`, `GET /`, `GET /:id`, `PATCH /:id`, `DELETE /:id`
- MO Production Ingredients (`/mo-production-ingredients`)
  - `GET /`, `PATCH /:id`
- Recipes (`/recipes`)
  - `POST /`, `GET /`, `GET /:id`, `PATCH /:id`, `DELETE /:id`
- BOM Rows (`/bom-rows`)
  - `POST /`, `GET /`, `POST /bulk`, `PATCH /:id`, `DELETE /:id`
- Product Operations (`/product-operations`)
  - `POST /`, `GET /`, `PATCH /:id`, `DELETE /:id`, `POST /:id/rank`

## Inventory / Warehouse

- Inventory (`/inventory`)
  - `GET /levels`, `GET /movements`
  - `POST /reorder-points`, `POST /safety-stock`
  - `GET /negative-stock`
- Inventory movements (`/inventory-movements`)
  - `GET /`
- Stock operations (`/stock`)
  - adjustments:
    - `GET /adjustments`, `GET /adjustments/:id`, `POST /adjustments`, `PATCH /adjustments/:id`, `DELETE /adjustments/:id`
  - transfers:
    - `GET /transfers`, `GET /transfers/:id`, `POST /transfers`
    - `PATCH /transfers/bulk-status`, `PATCH /transfers/:id`, `PATCH /transfers/:id/status`, `DELETE /transfers/:id`
  - stocktakes:
    - `GET /stocktakes`, `POST /stocktakes`, `GET /stocktakes/:id`, `PATCH /stocktakes/:id`, `DELETE /stocktakes/:id`
    - `POST /stocktakes/:id/rows`, `GET /stocktakes/:id/rows`
    - `POST /stocktakes/:id/commit`, `POST /stocktakes/:id/complete`
    - `PATCH /stocktake-rows/:id`, `DELETE /stocktake-rows/:id`
- Stocktake rows (`/stocktake-rows`)
  - `POST /`, `GET /`, `PATCH /:id`, `DELETE /:id`
- Batches (`/batches`)
  - batches: `GET /`, `POST /`, `GET /:id`, `PATCH /:id`, `DELETE /:id`
  - stock slices: `GET /stocks/list`, `POST /stocks`, `PATCH /stocks/:id`
- Serial numbers (`/serial-numbers`)
  - `GET /`, `POST /`, `GET /:id`, `PATCH /:id`, `DELETE /`, `DELETE /:id`, `GET /stock/summary`
- Serial number stock (`/serial-number-stock`)
  - `GET /`
- Bin locations (`/bin-locations`)
  - bins: `GET /`, `POST /`, `GET /:id`, `PATCH /:id`, `DELETE /:id`
  - assignments: `GET /variant-assignments/list`, `POST /variant-assignments`, `DELETE /variant-assignments/:id`
  - `POST /unlink`
- Variant bins (`/variant-bins`)
  - `POST /link`, `POST /unlink`
- Barcodes (`/barcodes`)
  - `GET /variants/:id/barcode`, `GET /variants/:id/barcode/svg`, `GET /variants/:id/label`
  - `GET /materials/:id/barcode`, `GET /materials/:id/label`
  - `POST /scan`

## Pricing / Addresses / Attachments / Import-Export

- Price lists (`/price-lists`)
  - `GET /`, `POST /`, `GET /:id`, `PATCH /:id`, `DELETE /:id`
  - nested rows: `GET /:id/rows`, `POST /:id/rows`, `PATCH /rows/:id`, `DELETE /rows/:id`
  - customer assignment: `GET /:id/customers`, `POST /:id/customers`, `DELETE /customers/:id`
- Price list rows (`/price-list-rows`)
  - `POST /`, `GET /`, `GET /:id`, `PATCH /:id`, `DELETE /:id`
- Price list customers (`/price-list-customers`)
  - `POST /`, `GET /`, `GET /:id`, `DELETE /:id`
- Supplier addresses (mounted on root `/api/v1`)
  - `GET /suppliers/:supplierId/addresses`
  - `POST /suppliers/:supplierId/addresses`
  - `PATCH /addresses/:id`
  - `DELETE /addresses/:id`
- Customer addresses (mounted on root `/api/v1`)
  - `GET /customers/:customerId/addresses`
  - `POST /customers/:customerId/addresses`
  - `PATCH /addresses/:id`
  - `DELETE /addresses/:id`
- Sales order addresses (`/so-addresses`)
  - `GET /:orderId/addresses`, `POST /:orderId/addresses`
  - `PATCH /addresses/:id`, `DELETE /addresses/:id`
- Attachments (`/attachments`)
  - `GET /`, `POST /`, `GET /:id`, `PATCH /:id`, `DELETE /:id`
- Upload (`/upload`)
  - `POST /` generic upload
  - `POST /product-image`
  - `GET /:entityType/:entityId`
  - `DELETE /`
- Data import/export (`/data`)
  - `POST /export`, `POST /import`, `GET /entities`
- PDF (`/pdf`)
  - `GET /sales-orders/:id`
  - `GET /purchase-orders/:id`
  - `GET /manufacturing-orders/:id`

## Analytics / Planning / Misc

- Dashboard (`/dashboard`)
  - `GET /stats`
- Insights (`/insights`)
  - `GET /sales/summary`, `GET /sales/by-product`
  - `GET /manufacturing/summary`, `GET /manufacturing/by-product`
  - `GET /purchasing/summary`, `GET /inventory/valuation`
- Planning (`/planning`)
  - `GET /forecast`, `GET /replenishment`
- Demand forecast (`/demand-forecast`)
  - `GET /`, `POST /`, `DELETE /`
- Users (`/users`)
  - `GET /`, `GET /me`, `GET /:id`, `GET /operators/list`
- Operators (`/operators`)
  - `GET /`

## Integrations / Security Admin

- API keys (`/api-keys`)
  - `GET /`, `POST /`, `DELETE /:id`
- Webhooks (`/webhooks`)
  - `GET /`, `POST /`, `PATCH /:id`, `DELETE /:id`
  - `GET /logs`, `POST /logs/export`
- Accounting (`/accounting`)
  - `GET /integrations`
  - `POST /:provider/connect`
  - `POST /:provider/disconnect`
  - `POST /:provider/sync/invoices`
  - `POST /:provider/sync/bills`
  - `POST /:provider/sync/contacts`
  - `GET /:provider/sync-logs`
  - `GET /:provider/oauth/callback`
- Accounting metadata (`/accounting-metadata`)
  - `GET /sales-orders`, `GET /purchase-orders`
- Ecommerce (`/ecommerce`)
  - unauthenticated inbound:
    - `POST /webhooks/:provider`
  - authenticated:
    - `GET /integrations`
    - `POST /:provider/connect`, `POST /:provider/disconnect`
    - `POST /:provider/sync/products`, `POST /:provider/sync/orders`, `POST /:provider/sync/inventory`
    - `GET /mappings`, `POST /mappings`, `DELETE /mappings/:id`
    - `GET /:provider/sync-logs`

---

## 4) Prisma Data Models and Relationships

Source of truth: `apps/api/prisma/schema.prisma`.

## Identity & Access

- `Role` 1-N `User`
- `User` 1-N `ApiKey`
- `User` 1-N `AuditLog`

## Integrations

- `Webhook` 1-N `WebhookLog`
- `AccountingIntegration` 1-N `AccountingSyncLog`
- `EcommerceIntegration` 1-N `EcommerceSyncLog`
- `EcommerceIntegration` 1-N `EcommerceProductMapping`

## Catalog & Inventory

- `Product` 1-N `Variant`
- `Product` 1-N `BOM`
- `Variant` 1-N `InventoryLevel`
- `Variant` 1-N `InventoryMovement`
- `Location` 1-N `InventoryLevel`
- `Location` 1-N `InventoryMovement`
- `Location` 1-N `StorageBin`
- `StorageBin` 1-N `VariantBinLocation`
- `Batch` 1-N `BatchStock`
- `Location` 1-N `BatchStock`
- `Variant` + `Batch` + serial entities support traceability

## Procurement / Sales / Manufacturing

- `Supplier` 1-N `PurchaseOrder`
- `Supplier` 1-N `SupplierAddress`
- `Customer` 1-N `SalesOrder`
- `Customer` 1-N `CustomerAddress`
- `PurchaseOrder` 1-N `PurchaseOrderRow`
- `PurchaseOrder` 1-N `PurchaseOrderCostRow`
- `PurchaseOrder` 1-N `OutsourcedPORecipeRow`
- `SalesOrder` 1-N `SalesOrderRow`
- `SalesOrder` 1-N `SalesOrderFulfillment`
- `SalesOrderRow` 1-N `SalesOrderFulfillment`
- `SalesOrder` 1-N `SalesOrderShippingFee`
- `SalesOrder` 1-N `SalesOrderAddress`
- `SalesReturn` 1-N `SalesReturnRow`
- `BOM` 1-N `BOMRow`
- `BOM` 1-N `ProductOperation`
- `BOM` 1-N `ManufacturingOrder`
- `ManufacturingOrder` 1-N `MORecipeRow`
- `ManufacturingOrder` 1-N `MOOperationRow`
- `ManufacturingOrder` 1-N `MOProduction`
- `MOProduction` 1-N `MOProductionIngredient`

## Other supporting models

- pricing: `PriceList`, `PriceListRow`, `PriceListCustomer`
- forecasting/planning: `DemandForecast`
- accounting config: `Currency`, `ExchangeRate`, `TaxRate`, `Factory`
- extension: `CustomFieldDefinition`, `CustomFieldValue`, `Attachment`

---

## 5) Authentication and Authorization

## Authentication mechanisms

- **JWT Bearer tokens**
  - Access + refresh tokens, signed with `SECRET_KEY`
  - Access TTL from `ACCESS_TOKEN_EXPIRE_MINUTES`
  - Refresh TTL from `REFRESH_TOKEN_EXPIRE_DAYS`
- **API key auth**
  - `X-API-Key` supported in auth middleware
  - Keys are SHA-256 hashed at rest (`api_keys.key_hash`)
  - Last-used timestamp tracked

## Authorization model (RBAC)

- Role names in DB: `viewer`, `operator`, `admin` (+ superuser override)
- `requireOperatorForMutations`
  - non-mutating methods allowed for authenticated users
  - `POST/PUT/PATCH/DELETE` require operator/admin/superuser
- `requireAdminForMutations`
  - mutating requests require admin/superuser
  - used for sensitive resources (API keys, webhooks admin, factory settings)

## Security notes

- API-level rate limiter configured (`100 req/min` window)
- CORS allowlist from `ALLOWED_ORIGINS`
- HMAC verification for generic inbound webhook endpoint

---

## 6) Existing Integration Hook Points

- **Accounting integration framework already exists**
  - `AccountingIntegration` table stores provider tokens/config (`quickbooks` included)
  - `AccountingSyncLog` tracks per-entity push/pull execution
  - `/api/v1/accounting/*` routes define connect/disconnect/sync/callback flow
- **Ecommerce integration framework**
  - provider-specific sync patterns and sync logs
  - demonstrates current integration style in this codebase
- **API Keys**
  - first-class machine integration authentication path
- **Webhooks**
  - outbound webhook registry + delivery logs
  - inbound webhook endpoint with HMAC support
- **Audit logs**
  - mutation audit trail useful for sync trigger/event provenance
- **Data import/export + attachments**
  - bulk ingestion/export touch points for reconciliation tooling

---

## 7) Where QuickBooks Integration Should Live

## Best location in current codebase

- Keep QuickBooks integration in `apps/api` as an **integration module** under existing accounting domain.
- Recommended foldering:
  - `apps/api/src/integrations/quickbooks/`
    - `client.ts` (OAuth/token handling + Intuit API client)
    - `mappers/*.ts` (ForgeERP -> QBO payload mapping)
    - `sync/*.ts` (entity sync orchestrators)
    - `errors.ts` (error normalization/classification)
  - Route handlers remain in `apps/api/src/routes/accounting.ts` (or split to `routes/accountingQuickbooks.ts` and mount under `/accounting/quickbooks`)

Why: schema/routes already include accounting integration primitives and quickbooks provider constant.

---

## 8) Integration Pattern Decision

## Recommendation

- **Primary pattern**: Extend existing API with dedicated QuickBooks routes + add background sync worker process.
- **Do not start with separate microservice** unless scale/tenant isolation/compliance requires it later.

## Pattern comparison

- **New microservice now**: over-architected for current codebase, duplicates auth/config/logging concerns.
- **API-only synchronous routes**: easiest but fragile for long-running sync and retries.
- **API + background worker (recommended)**:
  - API handles auth/config/manual trigger/status
  - worker executes queued sync jobs, retries/backoff, dead-letter handling
  - aligns with existing sync-log entities

## Proposed runtime topology

- `apps/api` process:
  - OAuth connect/callback endpoints
  - enqueue sync jobs
  - expose sync status/log endpoints
- background worker (same repo/package; separate start command):
  - pulls jobs from queue table or Redis-backed queue
  - calls QBO API
  - writes `AccountingSyncLog`
  - updates mapping and integration state

---

## 9) QuickBooks Entities to Sync

Prioritized by business value and current ForgeERP model coverage:

1. **Customers** (`Customer` -> QBO `Customer`)
2. **Suppliers** (`Supplier` -> QBO `Vendor`)
3. **Products/Items**
   - `Variant` / `Product` / optionally `Material` / `Service` -> QBO `Item`
4. **Sales**
   - `SalesOrder` (as pre-invoice order metadata/internal)
   - `SalesOrder` fulfilled -> QBO `Invoice`
5. **Purchasing**
   - `PurchaseOrder` -> QBO `PurchaseOrder` or `Bill` (depending accounting policy)
   - received/vendor-bill stage -> QBO `Bill`
6. **Payments**
   - customer receipts -> QBO `Payment` (when ForgeERP captures payment events; currently limited in schema)
7. **Credit/returns (phase 2)**
   - `SalesReturn` -> QBO `CreditMemo` where applicable
8. **Reference data**
   - tax code mapping (`TaxRate` <-> QBO TaxCode)
   - currency alignment

---

## 10) QuickBooks Online API vs Desktop SDK

## Recommendation: **QuickBooks Online API v3**

- Current backend is cloud-native HTTP REST architecture
- Existing accounting route already references QBO OAuth token endpoint
- OAuth2 + realm/company model fits current schema (`realmId`, token fields)
- Desktop SDK requires on-prem connectors/Windows middleware and is not aligned with this deployment model

Use Desktop SDK only if there is a hard customer requirement to integrate specifically with QuickBooks Desktop installations.

---

## 11) ForgeERP -> QuickBooks Entity Field Mapping

## Customer

- ForgeERP `Customer.id` -> internal external-id mapping table key (not sent as QBO ID)
- `name` -> `DisplayName`
- `email` -> `PrimaryEmailAddr.Address`
- `phone` -> `PrimaryPhone.FreeFormNumber`
- `currency` -> `CurrencyRef` (if multicurrency enabled)
- addresses from `CustomerAddress` (billing/shipping) -> QBO `BillAddr` / `ShipAddr`

## Supplier/Vendor

- `Supplier.name` -> `DisplayName`
- `email` -> `PrimaryEmailAddr.Address`
- `phone` -> `PrimaryPhone.FreeFormNumber`
- `address`/`SupplierAddress` -> `BillAddr`

## Item (Products/Variants/Materials/Services)

- `Variant.sku` (fallback `Product.sku`) -> `Sku`
- `Variant.name` + `Product.name` -> `Name`/`Description`
- `salesPrice` -> `UnitPrice` (sales items)
- `purchasePrice` -> `PurchaseCost` (inventory/non-inventory items)
- type mapping:
  - manufactured/sellable -> `Inventory` or `NonInventory`
  - service -> `Service`
  - material-only -> `NonInventory`

## Sales Order / Invoice

- `SalesOrder.number` -> `DocNumber`
- `orderDate` -> `TxnDate`
- `requiredDate` -> `DueDate`
- `customer` -> `CustomerRef`
- rows:
  - `variantId` mapped to QBO ItemRef
  - `qtyOrdered`/`qtyFulfilled` -> `Qty`
  - `unitPrice` -> `UnitPrice`
  - computed amount -> `Line.Amount`
- shipping fees -> separate line item
- tax rate -> mapped tax code on line or txn

## Purchase Order / Bill

- `PurchaseOrder.number` -> `DocNumber`
- `orderDate` -> `TxnDate`
- `expectedDate` -> `DueDate` / memo metadata
- `supplier` -> `VendorRef`
- rows:
  - material/variant mapping -> `ItemBasedExpenseLineDetail.ItemRef`
  - `qtyOrdered` -> `Qty`
  - `unitPrice` -> `UnitPrice`

## Payments (future/phase 2)

- ForgeERP payment event record -> QBO `Payment`
- links to `Invoice.Id` in QBO

## Required addition: mapping persistence

Add table(s), e.g. `AccountingEntityMapping`:

- `integrationId`
- `entityType` (`customer`, `vendor`, `item`, `invoice`, `bill`, ...)
- `localEntityId`
- `externalEntityId`
- `syncToken` (for QBO optimistic concurrency updates)
- `lastSyncedAt`

Without this, robust update/upsert behavior is not possible.

---

## 12) Sync Direction Design

## Recommended default: **Uni-directional ForgeERP -> QuickBooks** (phase 1)

- ForgeERP remains operational source of truth for ops data
- push contacts/items/invoices/bills to QBO
- optionally pull limited reference updates (connectivity checks, metadata)

## Phase 2 optional: selective bi-directional

- Pull payment status from QBO into ForgeERP
- Pull invoice settlement state
- Keep strict conflict strategy:
  - ForgeERP-owned fields overwrite downstream
  - QBO-owned accounting status fields can flow upstream

---

## 13) Configuration Requirements

## Integration secrets/config

- `QUICKBOOKS_CLIENT_ID`
- `QUICKBOOKS_CLIENT_SECRET`
- `QUICKBOOKS_REDIRECT_URI`
- `QUICKBOOKS_ENV` (`sandbox` | `production`)
- `QUICKBOOKS_SCOPES` (defaults include accounting scope)
- encryption key for token-at-rest encryption (recommended)

## Tenant-specific persisted settings (already partially supported)

In `AccountingIntegration` row (`provider = quickbooks`):

- `realmId` (QBO company ID)
- `accessToken`
- `refreshToken`
- `tokenExpiry`
- `settings` JSON:
  - account mappings (income/expense/asset accounts)
  - tax code mappings
  - sync toggles by entity
  - default customer/vendor/item behavior

---

## 14) Error Handling, Retries, Triggers, and Webhooks

## Error handling strategy

- Normalize external errors into categories:
  - auth/token errors (401/403)
  - rate limit (429)
  - validation/business rule (400)
  - transient transport (5xx/network timeout)
- Store normalized details in `AccountingSyncLog.error` and optional structured payload in `payload`
- Mark integration status:
  - `connected` / `error` / `disconnected`

## Retry strategy

- For transient failures only (`429`, `5xx`, timeouts):
  - exponential backoff with jitter (e.g., 30s, 2m, 10m, 30m, max attempts 5)
- Non-retryable failures:
  - validation errors, missing mappings, bad payload semantics
- Dead-letter queue/table for exhausted jobs
- Idempotency keys per sync job (`integrationId + entityType + entityId + operation`)

## Triggering model

- **Event-driven triggers**
  - on SO fulfillment completion -> enqueue invoice push
  - on PO receipt or approval -> enqueue bill/PO push
  - on customer/supplier/product create/update -> enqueue upsert
- **Manual triggers**
  - keep explicit sync endpoints for backfill and admin reruns
- **Scheduled reconciliation**
  - nightly compare/report for mismatches

## Webhooks

- Current system has webhook framework; add outbound events:
  - `accounting.sync.success`
  - `accounting.sync.failed`
  - `accounting.token.expiring`
- For QBO inbound webhooks (future):
  - add `/api/v1/accounting/quickbooks/webhook`
  - validate Intuit signature
  - only process whitelisted event types

---

## 15) Implementation Blueprint for QuickBooks in ForgeERP

## Phase 0 - Data/Foundation

- Add DB migration:
  - `AccountingEntityMapping` table
  - optional `SyncJob` queue table (if DB-backed queue)
- Encrypt token fields before persistence (application-level encryption)

## Phase 1 - Connectivity & Configuration

- Implement OAuth connect/callback/token refresh for QBO
- Extend `/accounting/quickbooks/*` endpoints:
  - connect URL generation
  - callback handler exchanging code for tokens
  - connection status test
  - settings save/read

## Phase 2 - Outbound Sync Core

- Implement mappers/services for:
  - customers, vendors, items, invoices, bills
- Worker-based execution with retry/backoff
- Persist mapping and sync tokens for update semantics

## Phase 3 - Operational Hardening

- Observability:
  - metrics: success rate, latency, retry count, backlog
  - dashboards/alerts
- Reconciliation reports + admin retry UX
- Webhook/event notifications

## Phase 4 - Optional Bi-directional Extensions

- Pull payment states and selective accounting statuses
- Add conflict resolution and field ownership policy

---

## Recommended Final Architecture Decision

- Keep integration in `apps/api`, not a new microservice initially.
- Add a dedicated background sync worker process in the same package/repo.
- Use QuickBooks Online API v3 with OAuth2.
- Start with uni-directional ForgeERP -> QuickBooks for core entities.
- Add mapping persistence + resilient retry/idempotency before production rollout.

This approach fits the current ForgeERP codebase, minimizes platform complexity, and creates a clear path to scale into richer two-way accounting sync later.
