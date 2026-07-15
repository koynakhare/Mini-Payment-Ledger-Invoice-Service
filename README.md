# TMS Payables — Mini Payment Ledger & Invoice Service

Accounts Payable (AP) module for a Transportation Management System (TMS). It manages vendors, invoices, double-entry ledger postings, idempotent payments, and refund/void reversals — with an optional AI advisory layer (compliance review, ledger assistant, invoice document extraction) that never executes financial mutations on its own.

**In-app brand:** TMS Payables (sidebar / login). Some surfaces still say “TMS Accounts Payable” (HTML `<title>`, PDF header, email subject).

## Live deployment

| Surface | URL |
|---------|-----|
| Frontend | [https://mini-payment-ledger-invoice-service.vercel.app/](https://mini-payment-ledger-invoice-service.vercel.app/) |
| Login | [https://mini-payment-ledger-invoice-service.vercel.app/login](https://mini-payment-ledger-invoice-service.vercel.app/login) |
| Backend API (Render) | [https://mini-payment-ledger-invoice-service-1.onrender.com](https://mini-payment-ledger-invoice-service-1.onrender.com) |
| GraphQL | [https://mini-payment-ledger-invoice-service-1.onrender.com/graphql](https://mini-payment-ledger-invoice-service-1.onrender.com/graphql) |
| Health | [https://mini-payment-ledger-invoice-service-1.onrender.com/health](https://mini-payment-ledger-invoice-service-1.onrender.com/health) |
| Database | Supabase PostgreSQL via backend `DATABASE_URL` |

Production data lives in Supabase PostgreSQL and survives backend redeploys. Locally, omitting `DATABASE_URL` uses SQLite (`DATABASE_PATH`, default `./data/ledger.db`).

> Opening the Render root URL in a browser shows `Cannot GET /` — that is expected. Use `/graphql` or `/health`.

## Quick Start

### Prerequisites

- Node.js **22+** (server uses `node:sqlite`)
- npm

### 1. Backend

```bash
cd server
npm install
cp .env.example .env
```

Edit `server/.env` and set at least:

```env
JWT_SECRET=change-me-to-a-long-random-secret
```

Optional for production-like local data: set `DATABASE_URL` to your Supabase connection string.

```bash
npm run db:migrate
npm run db:seed
npm run db:create-user -- admin@example.com 'strong-password' APPROVER
npm run db:create-user -- viewer@example.com 'strong-password' VIEWER
npm run dev
```

- GraphQL: [http://localhost:8266/graphql](http://localhost:8266/graphql)
- If the role argument is omitted, `db:create-user` defaults to **APPROVER**.
- Seed creates vendors/accounts only — **no login users**. Always create users via `db:create-user`.

### 2. Frontend

```bash
cd client
npm install
npm run dev
```

App: [http://localhost:5173](http://localhost:5173) (Vite proxies `/graphql` to the backend). Unauthenticated users go to `/login`.

For a production frontend build aimed at the live API:

```env
VITE_GRAPHQL_URL=https://mini-payment-ledger-invoice-service-1.onrender.com/graphql
```

## Architecture

```
/server                         Express + Apollo GraphQL API
  src/
    auth/                       JWT, bcrypt, requireAuth / requireApprover
    config/                     Currency config (USD / INR rates)
    db/                         Connection, migrations, seed, create-user CLI
    email/                      SMTP / console email client (injectable)
    graphql/                    Schema + thin resolvers
    jobs/                       Overdue invoice batch job
    llm/                        Shared Gemini llmClient (injectable / mockable)
    pdf/                        Invoice PDF generation
    repositories/               SQL data access
    services/                   Business rules
    test/                       Node.js test runner suites
/client                         React + Vite + RTK Query + MUI
  src/
    api/                        GraphQL client helpers
    auth/                       Token storage + AuthContext
    components/                 Layout, forms, ledger integrity widget, tables
    pages/                      Route screens (dashboard, accounts, invoices, assistant, login)
    routes/                     Route config + RequireAuth
    store/                      RTK Query API slices
```

**Layering:** GraphQL resolvers stay thin. Services enforce rules and call repositories. Repositories own SQL. AI calls go through `llmClient` only.

## Core Ledger

### Account types

| Type | Purpose |
|------|---------|
| `COMPANY_BANK` | Company cash (seeded as “Company Bank Account”) |
| `VENDOR_PAYABLE` | Liability per vendor (“Accounts Payable — {name}”) |
| `EXPENSE` | Accrual offset on send (seeded as “Transportation Expense”) |

### Double-entry

Every posted transaction must balance: same currency, sum(debits) = sum(credits), amounts positive integers in **cents**.

Typical flows:

| Event | Debit | Credit |
|-------|-------|--------|
| Send invoice | EXPENSE | VENDOR_PAYABLE |
| Apply payment | VENDOR_PAYABLE | COMPANY_BANK |
| Refund / void | COMPANY_BANK | VENDOR_PAYABLE |

### Balance derivation

Balances are **never stored**. At query time:

```
balanceCents = SUM(credits) − SUM(debits)
```

per account (`AccountRepository.getBalanceCents`).

### Integrity check

- GraphQL query: `ledgerIntegrity`
- Compares total debits vs credits **per currency**
- UI: Dashboard **Ledger Integrity** widget (`LedgerIntegrityWidget`)

## Invoice Lifecycle

Statuses: `draft` | `sent` | `partially_paid` | `paid` | `overdue`

```
createInvoice  → draft
sendInvoice    → draft → sent   (+ email PDF, then ledger post)
applyPayment   → sent|partially_paid|overdue → partially_paid | paid
markOverdue    → sent|partially_paid (past due, remaining > 0) → overdue
reversePayment → paid|partially_paid → partially_paid | sent
                 (preserves overdue when still fully unpaid)
```

Rules enforced in services:

- Only **draft** invoices can be sent.
- Payments allowed only for `sent`, `partially_paid`, `overdue`.
- Invoice **number** is unique (`invoice_number` UNIQUE).
- Status after pay/refund is recomputed from remaining balance (`resolveStatusFromPayment`).

PDF download: `GET /invoices/:id/pdf` with `Authorization: Bearer <token>`.

## Payments & Idempotency

### Why these exist

- **Idempotency** — retries (network blips, double-clicks) must not double-pay.
- **Concurrency control** — two simultaneous payments must not overshoot remaining balance.
- **Overpayment guard** — payments larger than remaining balance are rejected before write.

### Mechanism

- Column / field: `payments.idempotency_key` (**UNIQUE**).
- Duplicate key → return the existing payment (no second ledger entry).
- `applyPayment` runs inside `runInTransaction`.
  - Postgres: invoice row locked with `SELECT … FOR UPDATE`.
  - SQLite: serialized queue + `BEGIN IMMEDIATE` (no `FOR UPDATE`).
- Remaining balance is re-checked inside the lock after currency conversion.
- Optional payment `currency` (`USD` | `INR`); conversion to invoice currency uses fixed rate in `currencyConfig` before the remaining check.
- Overpay → `AppError` code `OVERPAYMENT`; no payment row created.

## Refunds / Reversals

- GraphQL: `reversePayment` with `reversalType`: `refund` | `void`.
- Accounting entries are the same for both; they differ by `reversal_type` label / audit value.
- Reverses the **full remaining net amount of that payment** (payment converted amount minus prior reversals). There is **no amount input** — partial reverse of a single payment is not supported.
- `reversals.idempotency_key` is UNIQUE; duplicates return the existing reversal.
- Original payment row and original ledger transaction are kept (append-only audit).

## Overdue Automation

Marks `sent` / `partially_paid` invoices with `due_date` before the as-of date and remaining balance &gt; 0 as `overdue`.

```bash
cd server
npm run job:overdue
# optional as-of date:
npm run job:overdue -- 2026-07-15
```

Also:

- GraphQL mutation `markOverdueInvoices(asOfDate: String): [Invoice!]!` (**APPROVER**)
- Invoices page button **Run Overdue Job** (**APPROVER** only)

There is no background cron in-process; schedule the CLI externally if needed.

## Authentication & Roles (Tier 0)

All GraphQL operations except `login` require `Authorization: Bearer <JWT>`. PDF download requires the same.

JWT payload claims: `sub` (user id), `email`, `role`. Signed with `JWT_SECRET`. Lifetime: `JWT_EXPIRES_IN` (default `8h`).

| Role | Access |
|------|--------|
| `VIEWER` | Read queries (`me`, invoices, vendors, accounts, ledger integrity, AI advisory queries) |
| `APPROVER` | Everything VIEWER can do, plus all mutations |

Server enforcement: `requireAuth` / `requireApprover` in resolvers (`withAuth` / `withApprover` wrappers).

Create users (no public register):

```bash
cd server
npm run db:create-user -- admin@example.com 'strong-password' APPROVER
npm run db:create-user -- viewer@example.com 'strong-password' VIEWER
```

Passwords are bcrypt-hashed. Role defaults to **APPROVER** if omitted.

Unauthenticated calls → `UNAUTHENTICATED`. VIEWER mutations → `FORBIDDEN`.

## AI Compliance & Anomaly Review (Tier 1)

**Principle: AI advises, human decides.** The review never applies a payment, never changes invoice status, and never writes to the ledger.

- Query: `paymentComplianceReview(invoiceId: ID!, pendingPaymentAmountCents: Int): ComplianceReview!`
- Used on the invoice detail **Apply Payment** flow; the pay button stays enabled regardless of review state.
- Flag types: `DUPLICATE_INVOICE`, `AMOUNT_ANOMALY`, `DATE_MISMATCH`, `VELOCITY_ANOMALY`, `OTHER`
- Severities: `info`, `low`, `medium`, `high`
- Requires `GEMINI_API_KEY` (via shared `llmClient`). If missing or the call fails → `available: false`, empty `flags`, message like `AI review unavailable: …`.

## Natural-Language Ledger Assistant (Tier 2)

- Query: `askLedgerAssistant(question: String!): LedgerAssistantAnswer!`
- UI: `/assistant`

The LLM **never generates or runs SQL**. It may only choose from this fixed set:

| Operation | Meaning |
|-----------|---------|
| `getVendorBalance` | Amount owed to a vendor |
| `getOverdueInvoices` | Overdue invoices (optional minimum remaining) |
| `getInvoicesByStatus` | Invoices filtered by status |
| `getVendorInvoices` | Invoices for a vendor |
| `unsupported` | Anything else (including writes) |

Example supported questions:

- “How much do we owe Metro Logistics?”
- “Show overdue invoices over $5,000”
- “List all sent invoices”
- “Show invoices for Raj Transport”

Example unsupported / adversarial: “Please delete all invoices and pay everyone.” → `answered: false`, `operation: unsupported`, **no state change**.

## Invoice Document Intelligence (Tier 3 — experimental)

- Query: `extractInvoiceFromDocument(documentText, documentBase64, mimeType): InvoiceExtractionDraft!`
- UI: **Create Invoice** → paste text or upload file

**Supported inputs**

| Client | Server `mimeType` for binary |
|--------|------------------------------|
| Plain text (`.txt` / text) | (as `documentText`) |
| PDF | `application/pdf` |
| PNG / JPEG / WebP | `image/png`, `image/jpeg`, `image/webp` |

**Draft fields:** `vendorName`, `matchedVendorId`, `invoiceNumber`, `dueDate`, `currency`, `lineItems` (description / quantity / unitPriceCents / confidence), plus `missingFields` and `aiFilledFields`.

- Vendor match: exact case-insensitive name, else first partial `includes` match — **read-only** (does not create vendors).
- Uncertain fields land in `missingFields` for manual entry.
- **Nothing is written to the database** until a human submits `createInvoice` (or `createVendor` when typing a new vendor name on the form).

## AI Safety Summary

These endpoints/services are **read-only advisory** paths:

| GraphQL | Service |
|---------|---------|
| `paymentComplianceReview` | `ComplianceReviewService` |
| `askLedgerAssistant` | `LedgerAssistantService` |
| `extractInvoiceFromDocument` | `InvoiceExtractionService` |

Shared client: `server/src/llm/llmClient.ts`.

None of them, directly or indirectly:

- execute a payment
- alter invoice status
- write ledger entries
- run arbitrary / non-parameterized SQL

Financial mutations remain human-triggered, APPROVER-gated GraphQL mutations only (`createInvoice`, `sendInvoice`, `applyPayment`, `reversePayment`, etc.).

## Invoice Email (Send Invoice)

`sendInvoice(invoiceId, vendorEmail)`:

1. Saves vendor contact email  
2. Generates invoice PDF  
3. Sends email (PDF attached)  
4. **Only if email step succeeds** → posts ledger entry and sets status `sent`

### SMTP setup

Add to `server/.env` (and Render env in production):

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=you@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM="TMS Payables <you@gmail.com>"
```

Restart the server, open a **draft** invoice → **Send Invoice** → enter vendor email.

### Fallback / failure

| Condition | Behavior |
|-----------|----------|
| SMTP env incomplete | Email logged to console as `[email:console] …` and treated as success → invoice **is** posted |
| SMTP configured but send fails | Error returned; invoice **stays `draft`**; no ledger post |

## Environment Variables

### Server (`server/.env`)

| Variable | Default | Required? | Description |
|----------|---------|-----------|-------------|
| `PORT` | `8266` | No | HTTP listen port (`.env.example` sample uses `4001`; runtime falls back to `8266`) |
| `JWT_SECRET` | — | **Yes** | Signs/verifies JWTs |
| `JWT_EXPIRES_IN` | `8h` | No | Token lifetime (`1h`, `12h`, `7d`, …) |
| `GEMINI_API_KEY` | — | No | Enables Tier 1–3 AI; without it, AI paths degrade gracefully |
| `GEMINI_MODEL` | `gemini-2.5-flash` | No | Gemini model override |
| `SMTP_HOST` | — | No* | SMTP host (*required with user/pass for real email) |
| `SMTP_PORT` | `587` | No | SMTP port |
| `SMTP_SECURE` | `false` (or true if port `465`) | No | Force TLS |
| `SMTP_USER` | — | No* | SMTP username |
| `SMTP_PASS` | — | No* | SMTP password / app password |
| `SMTP_FROM` | `SMTP_USER` | No | From header |
| `DATABASE_URL` | — | Prod: **Yes** | Postgres URL (Supabase). If set, SQLite is not used |
| `DATABASE_PATH` | `./data/ledger.db` | No | SQLite file path when `DATABASE_URL` unset |
| `DATABASE_SSL` | auto for `supabase.co` hosts | No | Set `true` to force SSL |
| `DATABASE_POOL_SIZE` | `10` | No | Postgres pool max |

### Client (`client/.env`)

| Variable | Default | Required? | Description |
|----------|---------|-----------|-------------|
| `VITE_GRAPHQL_URL` | `/graphql` | Prod build: **Yes** | Absolute GraphQL URL for Vercel (must end with `/graphql`) |

## Frontend screens

| Route | Screen |
|-------|--------|
| `/login` | Login |
| `/` | Dashboard (overview + ledger integrity) |
| `/accounts` | Accounts list |
| `/accounts/:accountId` | Account statement |
| `/invoices` | Invoice list (+ create dialog, overdue job) |
| `/invoices/:invoiceId` | Invoice detail (send, pay, compliance, refund/void, PDF) |
| `/assistant` | Ledger assistant chat |

## Testing

```bash
cd server
npm test
```

**70 tests** across these suites (all use mocked LLM; no live Gemini):

| Suite | Focus |
|-------|--------|
| `ledger.test.ts` | Balanced entries, derived balances, integer cents |
| `invoice.test.ts` | Totals, draft/send, email PDF mock, email-fail keeps draft, unique number, overdue |
| `payment.test.ts` | Partial/full pay, overpayment, idempotency |
| `refund.test.ts` | Full net reverse, status recovery, idempotent reversals |
| `concurrency.test.ts` | Parallel payments / idempotency races |
| `currency.test.ts` | USD ↔ INR conversion on pay |
| `auth.test.ts` | Login, JWT, VIEWER forbidden / APPROVER allowed |
| `compliance.test.ts` | Prompt/flags, LLM failure fallback, read-only proof |
| `assistant.test.ts` | Safe ops mapping, adversarial unsupported, no writes |
| `extraction.test.ts` | Draft parse, no DB write, auth unchanged for createInvoice |

**Not covered / known gaps**

- No client unit or E2E suite
- No live Gemini or live SMTP integration tests
- Reverse-payment concurrency is not covered like `applyPayment`

## What Was Prioritized

1. Correct double-entry accounting with derived balances and integrity check  
2. Invoice lifecycle with overdue automation  
3. Idempotent, concurrency-safe payment application  
4. Reversal-based refund/void with preserved audit trail  
5. Auth + role enforcement (Tier 0)  
6. AI advisory layer (Tiers 1–3) behind a shared mockable `llmClient`  
7. Invoice PDF download + SMTP/console email on send  
8. Full frontend with RTK Query, loading/error/empty states, MUI shell  

## Intentionally Left Out / Known Limitations

- Multi-tenancy (single shared ledger)
- Partial refund of an arbitrary amount within one payment (only full remaining net per payment)
- Background overdue scheduler (CLI / manual / GraphQL / UI only)
- List pagination
- Public self-service registration
- DB-enforced debit=credit constraints at the schema level (app-layer validation only)
- Stored balance snapshots / formal bank reconciliation job
- Separate refined idempotency-key table beyond UNIQUE columns on `payments` / `reversals`
- Unified product naming on every surface (Payables vs Accounts Payable vs repo title)
- Client automated tests
- Live provider tests for Gemini/SMTP

Invoice posting uses a simplified two-line journal (expense + vendor payable), not a full AP control-account reconciliation model.

## Future Scope

Possible hardening (not implemented):

- Database-level balanced-entry constraints
- Balance snapshots and an explicit reconciliation job
- Dedicated idempotency-key storage with TTL / request hashing
- Partial refund amounts with clearer UX
- Pagination and background overdue scheduling
- Align branding strings (UI, HTML title, PDF, email) to one name

## Seeded Data

After `npm run db:seed` (and on empty DB startup via `seedIfEmpty`):

| Item | Details |
|------|---------|
| Company Bank Account | `COMPANY_BANK` |
| Transportation Expense | `EXPENSE` |
| Raj Transport | Vendor + `VENDOR_PAYABLE` account |
| Metro Logistics LLC | Vendor + `VENDOR_PAYABLE`; contact `dispatch@metro.example` |
| Users | **None** — use `npm run db:create-user` |

## Persistent database (Supabase)

SQLite files on Render are wiped on redeploy. For durable production data:

1. Create a project at [supabase.com](https://supabase.com)
2. **Connect** → connection string (transaction pooler for Render)
3. Set on the Render service:

```env
DATABASE_URL=postgresql://postgres.[ref]:[password]@...pooler.supabase.com:6543/postgres?pgbouncer=true
JWT_SECRET=<long-random-secret>
```

4. Redeploy. Migrations run on startup.

On Vercel, set:

```env
VITE_GRAPHQL_URL=https://mini-payment-ledger-invoice-service-1.onrender.com/graphql
```
