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
cp .env.example .env   # set JWT_SECRET (and DATABASE_URL if using Postgres)
npm run db:migrate
npm run db:seed
npm run db:create-user -- you@example.com 'your-password' APPROVER
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

App: http://localhost:5173 (proxies `/graphql` to the backend). Unauthenticated users are redirected to `/login`.

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

## Authentication & roles (Tier 0)

The GraphQL API and PDF download route require a JWT issued by the `login` mutation. Pass it as `Authorization: Bearer <token>` on every request.

| Role | Access |
|------|--------|
| `VIEWER` | Read invoices, vendors, accounts, ledger integrity |
| `APPROVER` | Everything VIEWER can do, plus all mutations (create invoices, send, pay, reverse, mark overdue, create vendors/accounts) |

Create users with:

```bash
cd server
npm run db:create-user -- admin@example.com 'strong-password' APPROVER
npm run db:create-user -- viewer@example.com 'strong-password' VIEWER
```

Passwords are bcrypt-hashed; never stored or logged in plain text. Set `JWT_SECRET` in the server environment (required). Optional: `JWT_EXPIRES_IN` (default `8h`).

**Behavior change:** previously open GraphQL operations now return `UNAUTHENTICATED` without a valid token. Mutation attempts by `VIEWER` return `FORBIDDEN`.

## AI compliance review (Tier 1)

Before applying a payment, the invoice detail page runs a **read-only** AI compliance review (`paymentComplianceReview` query).

- Principle: **AI advises, human decides.** The review never applies a payment, never changes invoice status, and never writes to the ledger.
- The Apply Payment button stays fully enabled even if the review is loading, failed, or unavailable.
- Set `GEMINI_API_KEY` in the server environment (see `.env.example`). Without it, the API returns `available: false` with a clear message fallback instead of blocking the flow.
- All Gemini calls go through a shared `server/src/llm/llmClient.ts` module that tests can mock.

## Ledger assistant (Tier 2)

Authenticated users (VIEWER or APPROVER) can open **Assistant** in the sidebar and ask plain-English questions via `askLedgerAssistant(question)`.

**Safety constraints:**
- The LLM never generates or executes SQL.
- It may only select from a fixed set of parameterized read operations:
  - `getVendorBalance` — how much is owed to a vendor
  - `getOverdueInvoices` — overdue invoices, optional minimum remaining amount
  - `getInvoicesByStatus` — invoices filtered by status
  - `getVendorInvoices` — invoices for a vendor
- Unsupported or adversarial prompts (delete/update/pay) return a clear “I can’t answer that yet” style response and **cannot mutate** ledger or invoice state.

Example questions:
- “How much do we owe Metro Logistics?”
- “Show overdue invoices over $5,000”
- “List all sent invoices”

## Invoice document intelligence (Tier 3 — experimental)

On **Create Invoice**, you can paste invoice text or upload a text, PDF, or image file (PNG/JPEG/WebP). The `extractInvoiceFromDocument` query returns a **draft only** (vendor name, invoice number, due date, currency, line items).

- Best-effort extraction; missing fields are reported explicitly for manual entry.
- Existing vendors are matched by name into `matchedVendorId` when possible.
- **Nothing is written to the database** until a human reviews the form and submits via the existing `createInvoice` mutation (auth/validation unchanged).
- Reuses the shared `llmClient` (supports text, PDF, and image base64 parts).

### Final AI safety confirmation

All LLM-touching resolvers/services (`paymentComplianceReview`, `askLedgerAssistant`, `extractInvoiceFromDocument`, plus `llmClient`) are **read-only advisory paths**. None of them, directly or indirectly:

- execute a payment
- alter invoice status
- write ledger entries
- run arbitrary / non-parameterized SQL

Financial mutations remain human-triggered through existing permission-checked mutations only.

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `8266` | Backend server port |
| `JWT_SECRET` | — | **Required.** Secret used to sign/verify JWTs |
| `JWT_EXPIRES_IN` | `8h` | JWT lifetime (e.g. `1h`, `12h`, `7d`) |
| `GEMINI_API_KEY` | — | Optional. Enables AI compliance, assistant, and invoice extraction |
| `GEMINI_MODEL` | `gemini-2.5-flash` | Optional Gemini model override |
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

- Multi-tenancy (single shared ledger/tenant)
- Partial refunds (reversals reverse the full remaining net amount of a payment)

## Invoice email (Send Invoice)

`sendInvoice` emails the vendor a PDF attachment, then posts the draft invoice to the ledger.

1. Add SMTP settings to `server/.env` (see `.env.example`):
   ```
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=you@gmail.com
   SMTP_PASS=your-app-password
   SMTP_FROM="TMS Payables <you@gmail.com>"
   ```
2. Restart the server.
3. Open an invoice → **Send Invoice** → enter the vendor email.

Without SMTP configured, the server logs the outbound message to the console and still completes the send (handy for local demos). If SMTP is configured and delivery fails, the invoice stays `draft` and is not posted.
## Testing

```bash
cd server
npm test
```

The backend test suite covers ledger integrity, invoice lifecycle, payments, refunds, concurrency, idempotency, currency conversion, authentication/authorization, AI compliance review, the natural-language ledger assistant, and invoice document extraction (mocked LLM — no live Gemini calls).

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