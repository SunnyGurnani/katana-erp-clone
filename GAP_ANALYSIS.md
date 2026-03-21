# Katana MRP Clone — Full Gap Analysis

## BACKEND STATUS (Mostly Complete)

### What EXISTS in backend:
- Auth (login/register/JWT/API keys)
- Products with variants, BOMs, operations
- Materials with reorder points, lead times
- Services
- Customers & Suppliers (with addresses)
- Sales Orders (create, fulfill, returnable items)
- Purchase Orders (create, receive)
- Manufacturing Orders (create, produce, recipe rows, operation rows, productions)
- Outsourced PO recipe rows
- Inventory levels, movements, reorder points, safety stock, negative stock
- Stock adjustments, transfers, stocktakes
- Batches & batch stock
- Serial numbers
- Locations & storage bins/bin locations
- Price lists (with rows & customer assignments)
- Sales returns
- Shipping fees
- Tax rates
- Currencies & exchange rates
- Custom fields
- Barcodes (generation & scanning)
- Demand forecast
- Factory settings
- Accounting integrations (QB/Xero stubs)
- E-commerce integrations (Shopify/WooCommerce stubs)
- Webhooks & webhook logs
- Audit logs
- Dashboard stats
- Users & roles

### What's MISSING in backend:
1. **Quotes model** — Katana has Quotes as a sub-tab under Sell (create quotes, convert to SO)
2. **Insights/Reporting endpoints** — aggregated sales, manufacturing, purchasing analytics
3. **Planning endpoints** — inventory forecast visualization, replenishment suggestions
4. **MO task assignment** — assigning tasks to operators (Shop Floor App concept)
5. **SO pipeline status columns** — Sales items/Ingredients/Production/Delivery status per SO

## FRONTEND STATUS (Major Gaps)

### Current UI Architecture: LEFT SIDEBAR navigation (wrong)
### Katana UI Architecture: TOP HORIZONTAL NAV BAR (correct)

### What EXISTS in frontend:
- Left sidebar with sections (Catalog, Orders, People, Warehouse)
- Basic list pages: Products, Materials, Locations, Purchase Orders, Sales Orders, Manufacturing, Suppliers, Customers, Inventory, Stock Adjustments, Stock Transfers, Stocktakes
- Detail pages: SO detail, PO detail, MO detail
- Settings: API Keys & Webhooks only
- Dashboard with stat cards
- Simple modals for create/edit
- Basic table styling

### What's COMPLETELY MISSING in frontend:
1. **Katana-style top nav bar** (Sell/Make/Buy/Stock/Items/Plan/Insights icons+labels)
2. **Sub-tab navigation** within each section
3. **Quotes page** (Sell > Quotes)
4. **Sales Returns page** (Sell > Returns) — API exists, no UI
5. **Price Lists page** (Sell > Price Lists) — API exists, no UI
6. **Services page** (Items > Services) — API exists, no UI
7. **Batches page** (Stock > Batches) — API exists, no UI
8. **Outsourced PO page** (Buy > Outsourcing) — API exists, no UI
9. **Plan section** (Planning + Replenishment tabs)
10. **Insights section** (Sales/Manufacturing/Purchasing dashboards with charts)
11. **Proper Settings** (General/Locations/Tax Rates/Currencies/Units/Categories)
12. **Pipeline status columns** on Sales Orders (Ingredients/Production/Delivery status)
13. **Drag-and-drop priority ranking** on Manufacturing Schedule
14. **Column filters** on all tables
15. **Open/Done status filter pills** on list views
16. **Location picker** on order list views
17. **"+ Create" button** in top nav
18. **Search across entities**
19. **Product detail page with BOM/recipe editor**
20. **Proper SO detail** with fulfillment workflow, shipping addresses
21. **Proper PO detail** with receiving workflow
22. **Proper MO detail** with production runs, ingredient consumption
23. **Color-coded status badges** matching Katana's system
24. **Dark navy top nav** with Katana-style design
