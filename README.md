# ForgeERP

A production-structured manufacturing ERP inspired by Katana MRP, built with:

- **Backend:** Express.js + Prisma 5 + PostgreSQL + TypeScript
- **Frontend:** Next.js 14 + Tailwind CSS + TanStack Query
- **Monorepo:** Turborepo + pnpm workspaces
- **Auth:** JWT (access + refresh tokens)

## 🚀 Easy Run with Docker (Windows & Mac)

If you have Docker installed, you can spin up the entire application (Frontend, Backend API, Postgres, MinIO) with a single command:

1. Copy the environment variables file:
   ```bash
   # Windows (PowerShell/CMD): copy .env.example .env
   # Mac/Linux: cp .env.example .env
   ```
2. Start the Docker containers:
   ```bash
   docker compose -f docker-compose.local.yml up --build
   ```
3. Visit the applications:
   - **Frontend:** http://localhost:3000
   - **API Docs:** http://localhost:8000/docs

*(Note: If you are accessing the frontend from a different machine on your local Wi-Fi, update `NEXT_PUBLIC_API_URL` and `ALLOWED_ORIGINS` in your `.env` to use your computer's local IP address instead of `localhost`).*

## 🛠 Local Development without Docker (Mac & Windows)

**Prerequisites:** Node 20, pnpm 9, PostgreSQL 15

1. Copy and configure the environment variables:
   - **Mac/Linux:** `cp .env.example .env`
   - **Windows:** `copy .env.example .env`
   *Open `.env` and configure your `DATABASE_URL` to point to a running local PostgreSQL instance.* 

2. Install dependencies:
   ```bash
   pnpm install
   ```
3. Set up the Database (Schema, Client, and seed data):
   ```bash
   pnpm db:generate    # Generates the Prisma Client
   pnpm db:push        # Pushes schema to your local Postgres database
   pnpm db:seed        # Seeds the database with demo data
   ```
4. Start the Development Servers (Frontend + API):
   ```bash
   pnpm run dev
   ```
*(Note for cross-device testing: If you run this server on one computer and want to view it on another, you must change `NEXT_PUBLIC_API_URL` to the host computer's Local IP Address, and add the remote URL to `ALLOWED_ORIGINS` in your `.env` file).*

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

## 🐳 Docker Production Setup

Run all services (API, Web, Postgres, MinIO, Nginx) via Docker Compose:

```bash
docker compose up -d --build
```

Then visit:
- **Frontend:** http://localhost (port 80 via Nginx)
- **API Docs:** http://localhost/api/docs

### Architecture

```
nginx (port 80/443)
├── → web  (Next.js, port 3000)
└── → api  (Express, port 4000)
    ├── postgres (port 5432, internal)
    └── minio  (port 9000, internal)
```

### Environment Variables

Copy `.env.example` to `.env` and configure before building:

```bash
cp .env.example .env
```

| Variable | Default | Description |
|---|---|---|
| `DB_USER` | `forge` | PostgreSQL user |
| `DB_PASSWORD` | `forge_secret` | PostgreSQL password |
| `DB_NAME` | `forgeerp` | PostgreSQL database name |
| `JWT_SECRET` | — | Secret key for JWT signing |
| `MINIO_ROOT_USER` | `minioadmin` | MinIO admin username |
| `MINIO_ROOT_PASSWORD` | `minioadmin123` | MinIO admin password |
| `PUBLIC_API_URL` | `http://localhost` | Public-facing API base URL |

## 🔧 Resolved Docker Issues

### Web — `Cannot find module '/app/server.js'`

Next.js standalone mode in a monorepo preserves the internal directory structure inside the container. The server entry point lives at `apps/web/server.js`, not at the container root. Fixed in `apps/web/Dockerfile`:

```dockerfile
# Before
CMD ["node", "server.js"]

# After (correct path in monorepo standalone output)
CMD ["node", "apps/web/server.js"]
```

### API — Prisma OpenSSL / JSON parse error

Prisma's Rust Query Engine on `node:20-alpine` (musl libc) requires `openssl` to be explicitly installed. Without it the engine fails silently and Prisma surfaces a cryptic `SyntaxError: Unexpected token 'E'` JSON parse error. Fixed in `apps/api/Dockerfile`:

```dockerfile
# Before
RUN apk add --no-cache curl

# After (openssl required by Prisma Query Engine on Alpine)
RUN apk add --no-cache curl openssl
```
