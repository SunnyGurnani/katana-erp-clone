# Katana MRP API Gap Fill

## New Endpoints Added

### Tax Rates (`/api/v1/tax-rates`)
- `GET /tax-rates` — list all tax rates (paginated)
- `POST /tax-rates` — create a tax rate
- `PATCH /tax-rates/:id` — update a tax rate
- `DELETE /tax-rates/:id` — delete a tax rate

### Supplier Addresses (`/api/v1`)
- `GET /suppliers/:supplierId/addresses` — list addresses for a supplier
- `POST /suppliers/:supplierId/addresses` — create an address
- `PATCH /supplier-addresses/addresses/:id` — update an address
- `DELETE /supplier-addresses/addresses/:id` — delete an address

### Customer Addresses (`/api/v1`)
- `GET /customers/:customerId/addresses` — list addresses for a customer
- `POST /customers/:customerId/addresses` — create an address
- `PATCH /customer-addresses/addresses/:id` — update an address
- `DELETE /customer-addresses/addresses/:id` — delete an address

### Price Lists (`/api/v1/price-lists`)
- `GET /price-lists` — list all price lists (paginated, includes rows + customers)
- `POST /price-lists` — create a price list
- `GET /price-lists/:id` — get single price list
- `PATCH /price-lists/:id` — update a price list
- `DELETE /price-lists/:id` — delete a price list
- `GET /price-lists/:id/rows` — list rows
- `POST /price-lists/:id/rows` — add a row
- `PATCH /price-lists/rows/:id` — update a row
- `DELETE /price-lists/rows/:id` — delete a row
- `GET /price-lists/:id/customers` — list customers assigned to price list
- `POST /price-lists/:id/customers` — assign a customer
- `DELETE /price-lists/customers/:id` — unassign a customer

### Services (`/api/v1/services`)
- `GET /services` — list all services (paginated, filterable by `isActive`)
- `POST /services` — create a service
- `GET /services/:id` — get single service
- `PATCH /services/:id` — update a service
- `DELETE /services/:id` — delete a service

### Sales Returns (`/api/v1/sales-returns`)
- `GET /sales-returns` — list all returns (paginated, filterable by `status`)
- `POST /sales-returns` — create a return
- `GET /sales-returns/:id` — get single return
- `PATCH /sales-returns/:id` — update a return
- `DELETE /sales-returns/:id` — delete a return
- `POST /sales-returns/:id/rows` — add a return row
- `GET /sales-returns/:id/rows` — list return rows
- `PATCH /sales-returns/rows/:id` — update a return row
- `DELETE /sales-returns/rows/:id` — delete a return row
- `POST /sales-returns/:id/complete` — complete return (adds stock back via adjustStock())
- `GET /sales-returns/return-reasons` — returns static list of return reasons

### Shipping Fees (`/api/v1`)
- `POST /sales-orders/:orderId/shipping-fees` — add a shipping fee to a sales order
- `GET /shipping-fees` — list all shipping fees (filterable by `orderId`)
- `GET /shipping-fees/:id` — get single shipping fee
- `PATCH /shipping-fees/:id` — update a shipping fee
- `DELETE /shipping-fees/:id` — delete a shipping fee

### Demand Forecast (`/api/v1/demand-forecast`)
- `GET /demand-forecast` — list forecasts (filterable by `variantId`, `locationId`)
- `POST /demand-forecast` — create a forecast entry
- `DELETE /demand-forecast` — delete forecasts by `variantId` + optional `locationId` (query params)

### Factory (`/api/v1/factory`)
- `GET /factory` — get factory settings (auto-creates default if none exists)
- `PATCH /factory` — update factory settings

### MO Productions (`/api/v1/manufacturing`)
- `POST /manufacturing/orders/:id/productions` — create a production run (auto-creates ingredients from recipe rows)
- `GET /manufacturing/orders/:id/productions` — list productions for an MO
- `GET /manufacturing/productions/:id` — get single production
- `PATCH /manufacturing/productions/:id` — update status/qty/notes
- `DELETE /manufacturing/productions/:id` — delete a production
- `PATCH /manufacturing/productions/:id/ingredients/:ingredientId` — update qtyConsumed on an ingredient

### Sales Order Addresses (`/api/v1/sales-orders`)
- `GET /sales-orders/:orderId/addresses` — list addresses for a sales order
- `POST /sales-orders/:orderId/addresses` — add an address to a sales order
- `PATCH /sales-orders/addresses/:id` — update an address
- `DELETE /sales-orders/addresses/:id` — delete an address

## New Prisma Models Added
- `TaxRate`
- `SupplierAddress`
- `CustomerAddress`
- `PriceList`
- `PriceListRow`
- `PriceListCustomer`
- `Service`
- `SalesReturn`
- `SalesReturnRow`
- `SalesOrderShippingFee`
- `DemandForecast`
- `Factory`
- `MOProduction`
- `MOProductionIngredient`
- `SalesOrderAddress`

## Relations Added to Existing Models
- `Supplier` → `addresses SupplierAddress[]`
- `Customer` → `addresses CustomerAddress[]`
- `SalesOrder` → `shippingFees SalesOrderShippingFee[]`, `addresses SalesOrderAddress[]`
- `ManufacturingOrder` → `productions MOProduction[]`

## Known Limitations / TODOs
- `DELETE /demand-forecast` bulk-deletes by variantId/locationId rather than individual ID (matches Katana-style batch forecasting)
- `SupplierAddress` and `CustomerAddress` routes are mounted at `/api/v1` (not at nested paths) to support flat routing; paths like `GET /suppliers/:supplierId/addresses` still work correctly
- `SalesReturn.complete` only restocks inventory for rows that have both `variantId` and `locationId` set
- Tax rates on `Service`, `PriceListRow`, and `SalesOrderShippingFee` store only the `taxRateId` FK — no automatic rate lookup/calculation
- `Factory` model supports a single factory record (first-or-create pattern)
