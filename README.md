# Mini Payment Ledger & Invoice Service

A production-quality Accounts Payable module for a Transportation Management System (TMS), featuring double-entry ledger accounting, invoice lifecycle management, idempotent payments, and refund/void flows with full audit trails.

## Quick Start

### Prerequisites

- Node.js 22+ (uses built-in `node:sqlite` — no native compilation required)
- npm

### 1. Backend

```bash
cd server
npm install
npm run db:migrate
npm run db:seed
npm run dev
```

GraphQL playground: http://localhost:4001/graphql

### 2. Frontend

```bash
cd client
npm install
npm run dev
```

App: http://localhost:5173 (proxies `/graphql` to the backend)

## Architecture

```
/server                    Backend (Node.js + Apollo GraphQL + SQLite)
  src/
    db/                    Database connection, migrations, seed
    repositories/          Data access layer (SQL queries)
    services/              Business logic (ledger, invoices, payments)
    graphql/               Schema and thin resolvers
    jobs/                  Overdue invoice batch job
/client                    Frontend (React + RTK Query + MUI)
  src/
    api/                   RTK Query endpoints (all GraphQL calls)
    pages/                 Screen components
    components/            Shared UI (layout, integrity widget)
```

### Layered Backend Design

Resolvers delegate to services; services enforce business rules and call repositories. No business logic lives in resolvers.

### Double-Entry Ledger

Every transaction creates balanced debit and credit entries. Account balances are **derived at query time** from the ledger entry log — no mutable balance column.

Balance formula: `credits − debits` per account.

### Invoice Lifecycle

```
draft → sent → partially_paid → paid
              ↘ overdue (when due date passes and unpaid)
```

- **Send invoice**: posts expense (debit) / vendor liability (credit) to the ledger
- **Apply payment**: debit vendor payable, credit company bank — with idempotency key and overpayment guard
- **Download PDF**: `GET /invoices/:id/pdf` — vendor bill with line items and payment summary

### Account Model

- One **Company Bank Account** (`COMPANY_BANK`) — seeded at startup
- One **vendor payable account** per vendor (`VENDOR_PAYABLE`) — auto-created when a vendor is added
- Invoices reference `vendorId`; payments always flow between that vendor's payable account and the company bank

### Concurrency & Idempotency

- Payment `idempotency_key` is unique in the database; duplicate requests return the existing payment (no-op)
- `applyPayment` runs inside `BEGIN IMMEDIATE` transaction with re-check inside the lock
- Reversals also use idempotency keys

### Overdue Job

```bash
cd server
npm run job:overdue
```

Also triggerable via GraphQL mutation `markOverdueInvoices` or the "Run Overdue Job" button in the UI.

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `4001` | GraphQL server port |
| `DATABASE_PATH` | `./data/ledger.db` | SQLite file (local dev only — **data is lost on redeploy**) |
| `DATABASE_URL` | — | **PostgreSQL connection string (Supabase) — use in production for persistent data** |
| `VITE_GRAPHQL_URL` | `/graphql` | Frontend GraphQL endpoint |
| `VITE_SUPABASE_URL` | — | Supabase project URL (optional — enables client login) |
| `VITE_SUPABASE_ANON_KEY` | — | Supabase anon/public key |
| `SUPABASE_URL` | — | Supabase project URL (optional — server JWT validation) |
| `SUPABASE_SERVICE_ROLE_KEY` | — | Supabase service role key (server only) |

### Persistent database with Supabase (recommended for deploy)

SQLite stores data in a local file. On Render, Railway, Vercel, and similar hosts, that file is **wiped on every redeploy**. To keep your invoices, vendors, and payments:

1. Create a project at [supabase.com](https://supabase.com)
2. Go to **Project Settings → Database → Connection string**
3. Copy the **URI** (use **Transaction pooler** on serverless hosts like Render)
4. Add to your deployed backend environment:
   ```
   DATABASE_URL=postgresql://postgres.[ref]:[password]@...pooler.supabase.com:6543/postgres
   ```
5. Redeploy — tables are created automatically on startup, and data persists across deploys

For local dev without Supabase, omit `DATABASE_URL` and the app uses SQLite as before.

### Optional: Supabase Auth

1. Create a project at [supabase.com](https://supabase.com)
2. In **Project Settings → API**, copy:
   - Project URL → `VITE_SUPABASE_URL` and `SUPABASE_URL`
   - `anon` `public` key → `VITE_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (server `.env` only)
3. In **Authentication → Providers**, enable Email
4. Copy `client/.env.example` → `client/.env` and `server/.env.example` → `server/.env`, then fill in the values above
5. Restart both dev servers

When Supabase env vars are set, the app requires sign-in. Without them, the app runs without auth (local demo mode).

## What Was Prioritized

1. Correct double-entry accounting with derived balances and integrity check
2. Invoice status lifecycle with overdue automation
3. Idempotent, concurrency-safe payment application
4. Reversal-based refund/void with audit trail preservation
5. Full frontend with RTK Query, loading/error/empty states, MUI consistency

## Intentionally Left Out

- Multi-tenancy and RBAC
- Backend unit/integration tests (per spec)
- Email delivery of invoices (vendor email is stored on send; no outbound mail yet)
- Multi-currency support
- Partial refunds (reversals reverse the full remaining net amount of a payment)

## Known Limitations

- SQLite is used for local dev when `DATABASE_URL` is unset; production should set `DATABASE_URL` to Supabase Postgres
- Invoice posting uses a simplified 2-entry journal (expense + vendor) rather than a full AP sub-ledger with control account reconciliation
- The overdue job is manual/cron-triggered, not a background scheduler
- No pagination on list queries

## Seeded Data

test
After `npm run db:seed`:

| Item | Details |
|------|---------|
| Company Bank Account | `COMPANY_BANK` — single system cash account |
| Transportation Expense | `EXPENSE` — invoice accrual offset |
| Raj Transport | Vendor with dedicated `VENDOR_PAYABLE` account |
| Metro Logistics LLC | Vendor with dedicated `VENDOR_PAYABLE` account |
