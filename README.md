# Mini Payment Ledger & Invoice Service

A production-quality Accounts Payable module for a Transportation Management System (TMS), featuring double-entry ledger accounting, invoice lifecycle management, idempotent payments, and refund/void flows with full audit trails.

## Production

- **Frontend (Vercel):** https://mini-payment-ledger-invoice-service-six.vercel.app/
- **Backend API (Render):** https://mini-payment-ledger-invoice-service-1.onrender.com
- **GraphQL endpoint:** https://mini-payment-ledger-invoice-service-1.onrender.com/graphql
- **Database:** Supabase PostgreSQL, configured through the backend `DATABASE_URL`

Production data is stored in Supabase PostgreSQL, so vendors, invoices, ledger entries, payments, and reversals persist across backend redeploys. SQLite is only used for local development when `DATABASE_URL` is not set.

## Quick Start

### Prerequisites

- Node.js 22+
- npm

### 1. Backend

```bash
cd server
npm install
npm run db:migrate
npm run db:seed
npm run dev
```

Local GraphQL playground: http://localhost:8266/graphql

For production-like local development, add `DATABASE_URL` to `server/.env` so the backend connects to Supabase PostgreSQL. Without `DATABASE_URL`, it falls back to local SQLite.

### 2. Frontend

```bash
cd client
npm install
npm run dev
```

App: http://localhost:5173 (proxies `/graphql` to the backend)

For deployed frontend builds, set:

```env
VITE_GRAPHQL_URL=https://mini-payment-ledger-invoice-service-1.onrender.com/graphql
```

## Architecture

```
/server                    Backend (Node.js + Express + Apollo GraphQL)
  src/
    db/                    Database connection, migrations, seed (PostgreSQL/SQLite)
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
- `applyPayment` runs inside a database transaction with a re-check inside the lock
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
| `PORT` | `8266` | Backend server port |
| `DATABASE_PATH` | `./data/ledger.db` | SQLite file (local dev only — **data is lost on redeploy**) |
| `DATABASE_URL` | — | **PostgreSQL connection string (Supabase) — use in production for persistent data** |
| `VITE_GRAPHQL_URL` | `/graphql` | Frontend GraphQL endpoint |

### Persistent database with Supabase (recommended for deploy)

SQLite stores data in a local file. On Render, Railway, Vercel, and similar hosts, that file is **wiped on every redeploy**. To keep your invoices, vendors, and payments:

1. Create a project at [supabase.com](https://supabase.com)
2. In Supabase, click **Connect**
3. Choose **ORM** or **Connection string**
4. Copy the `DATABASE_URL` URI (use the transaction pooler on Render)
5. Add to your deployed backend environment:
   ```
   DATABASE_URL=postgresql://postgres.[ref]:[password]@...pooler.supabase.com:6543/postgres?pgbouncer=true
   ```
6. Redeploy the backend. Tables are created automatically on startup, and data persists across deploys.

On Render, set `DATABASE_URL` in the backend service environment variables. On Vercel, set `VITE_GRAPHQL_URL` in the frontend project environment variables.

For local dev without Supabase, omit `DATABASE_URL` and the app uses SQLite as before.

## What Was Prioritized

1. Correct double-entry accounting with derived balances and integrity check
2. Invoice status lifecycle with overdue automation
3. Idempotent, concurrency-safe payment application
4. Reversal-based refund/void with audit trail preservation
5. Full frontend with RTK Query, loading/error/empty states, MUI consistency

## Intentionally Left Out

- Authentication, multi-tenancy, and RBAC
- Email delivery of invoices (vendor email is stored on send; no outbound mail yet)
- Partial refunds (reversals reverse the full remaining net amount of a payment)

## Testing

```bash
cd server
npm test
```

The backend test suite covers ledger integrity, invoice lifecycle, payments, refunds, concurrency, idempotency, and currency conversion.

## Known Limitations

- SQLite is used for local dev when `DATABASE_URL` is unset; production should set `DATABASE_URL` to Supabase Postgres
- Invoice posting uses a simplified 2-entry journal (expense + vendor) rather than a full AP sub-ledger with control account reconciliation
- The overdue job is manual/cron-triggered, not a background scheduler
- No pagination on list queries

## Seeded Data

After `npm run db:seed`:

| Item | Details |
|------|---------|
| Company Bank Account | `COMPANY_BANK` — single system cash account |
| Transportation Expense | `EXPENSE` — invoice accrual offset |
| Raj Transport | Vendor with dedicated `VENDOR_PAYABLE` account |
| Metro Logistics LLC | Vendor with dedicated `VENDOR_PAYABLE` account |