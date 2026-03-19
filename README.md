# ForgeERP

A production-structured manufacturing ERP inspired by Katana MRP, built with:

- **Backend:** Express.js + Prisma 5 + PostgreSQL + TypeScript
- **Frontend:** Next.js 14 + Tailwind CSS + TanStack Query
- **Monorepo:** Turborepo + pnpm workspaces
- **Auth:** JWT (access + refresh tokens)

## Quick Start

### With Docker

```bash
cp .env.example .env
docker compose up -d --build
```

Then visit:
- Frontend: http://localhost:3000
- API Docs: http://localhost:8000/docs
- Health: http://localhost:8000/health

### Local Development

**Prerequisites:** Node 20, pnpm 9, PostgreSQL 16

```bash
cp .env.example .env
# Edit .env with your DATABASE_URL

pnpm install
pnpm db:generate
pnpm db:migrate     # or: pnpm --filter @forge-erp/api db:push
pnpm db:seed
pnpm run dev
```

## Demo Credentials

| Role     | Email                    | Password       |
|----------|--------------------------|----------------|
| Admin    | admin@forgeerp.com       | Admin1234!     |
| Operator | operator@forgeerp.com    | Operator1234!  |

## Project Structure

```
forge-erp/
├── apps/
│   ├── api/          # Express.js REST API (port 8000)
│   │   ├── prisma/   # Schema + migrations
│   │   └── src/
│   │       ├── routes/       # 14 route files
│   │       ├── lib/          # prisma, jwt, inventory engine
│   │       └── middleware/   # auth, audit, error, paginate
│   └── web/          # Next.js 14 frontend (port 3000)
│       └── src/
│           ├── app/          # App Router pages
│           ├── components/   # UI components
│           └── lib/          # api client, auth helpers
└── packages/
    └── types/        # Shared TypeScript interfaces
```

## Key Features

- **Inventory Engine:** Every stock mutation runs in a DB transaction + creates an immutable `inventory_movements` record
- **Purchase Orders:** Create POs, add line items, receive stock into any location
- **Sales Orders:** Create SOs, add line items, fulfill from any location
- **Manufacturing:** Define BOMs, create manufacturing orders, produce to consume materials and output finished goods
- **Stock Ops:** Adjustments (corrections/write-offs), transfers between locations, stocktakes
- **API Keys:** Generate machine-readable API keys for integrations
- **Webhooks:** Register endpoint URLs and subscribe to events
- **Audit Log:** All POST/PUT/PATCH/DELETE requests logged automatically

## API Endpoints

| Resource | Base Path |
|---|---|
| Auth | `/api/v1/auth` |
| Products | `/api/v1/products` |
| Materials | `/api/v1/materials` |
| Suppliers | `/api/v1/suppliers` |
| Customers | `/api/v1/customers` |
| Locations | `/api/v1/locations` |
| Inventory | `/api/v1/inventory` |
| Purchase Orders | `/api/v1/purchase-orders` |
| Sales Orders | `/api/v1/sales-orders` |
| Manufacturing | `/api/v1/manufacturing` |
| Stock Ops | `/api/v1/stock` |
| API Keys | `/api/v1/api-keys` |
| Webhooks | `/api/v1/webhooks` |
| Dashboard | `/api/v1/dashboard/stats` |

Full interactive docs at http://localhost:8000/docs

## pnpm Scripts

```bash
pnpm run dev          # Start both API + web in dev mode
pnpm db:generate      # Regenerate Prisma client
pnpm db:migrate       # Run migrations (production)
pnpm db:seed          # Seed demo data (30+ records)
pnpm build            # Build all packages
```
