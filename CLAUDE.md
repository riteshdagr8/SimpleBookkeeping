# SimpleBookkeeping — Project Context for Claude Code

Next.js 15 (App Router) + React 19 + TypeScript + Prisma 6 + SQLite + NextAuth 4 (Credentials/JWT). Canadian accounting-firm compliance tracker (T2, GST/HST, payroll, annual returns, T4/T4A/T5).

## Running it
- Dev server: `npm run dev -- -p 3100` (matches NEXTAUTH_URL). Use the system Node: `/c/Program Files/nodejs/npm`.
- DB: SQLite at `data/app.db` (via Prisma). Backups in `backups/`.
- Gates: `npm run typecheck`, `npm run lint`, `npm run build`.

## Architecture
- `src/lib/compliance-rules.ts` — pure Canadian deadline math (T2/T1/T5013/T3 income tax, HST/GST/QST/PST/RST sales tax, payroll, federal + provincial annual returns). `hstPeriods()`/`salesTaxPeriods()` are anchored to `Client.gstYearEnd` month (quarterly = 3-month blocks after year-end; annual = year-end to year-end; monthly = rolling window). Falls back to calendar quarters when gstYearEnd is null.
- `src/lib/obligation-matrix.ts` — the entity- and jurisdiction-aware source of truth: `filingTypesForClient()`, `incomeTaxFilingType()`, `salesTaxFilingTypes()`, `annualReturnFilingTypes()`, `infoReturnFilingTypes()`, `FILING_TYPE_LABELS`. Shared by the generator, the safe-edit confirmation, and `scripts/migrate-multi-entity.ts`.
- `src/lib/jurisdictions.ts` — the 14 jurisdiction codes + labels, sales-tax buckets (harmonized / non-PST / QC / separate-PST), and `normalizeJurisdiction()` for legacy data.
- `src/lib/services/obligations.ts` — `generateObligationsForClient()` builds the rolling 12-month schedule and reconciles stale auto-generated rows (never deletes historical/completed). Emits `T2/T1/T5013/T3` (by entityType), sales-tax types (by jurisdiction), `PayrollRemittance` (remitterType `Monthly`/`Quarterly`), `PayrollProcessing`, `FederalAnnualReturn`/`ProvincialAnnualReturn`, `T4/T4A/T5/T3Slips`. `findInvalidPendingObligations()` drives the safe-edit confirmation.
- `src/lib/services/clients.ts` — Zod validation + persistence. Client has `primaryEmail` (required), `secondaryEmail` (optional), `gstYearEnd` (month name), `entityType` (Corporation/Self-Employed/Trust/Individual/Partnership), `incorporationJurisdiction` (2-letter codes + Federal), `payrollFrequency`, `remitterType` (`Monthly`/`Quarterly`).
- `src/lib/workflows/` — declarative workflow engine (Payroll, Income Taxes, Sales Tax, Federal/Provincial AR, Info Returns). Multi-type configs (IncomeTax, SalesTax, InfoReturn) use a generic checklist with per-filing-type dynamic labels.
- `src/lib/auth.ts` — NextAuth credentials. `requireUser()` / `requireAdmin()`.
- `src/lib/email.ts` — Resend email helper (`sendPasswordResetEmail`). Gracefully skips (logs warning) when `RESEND_API_KEY` is unset.
- Auth pages: `/forgot-password`, `/reset-password?token=...`; APIs: `/api/auth/forgot-password`, `/api/auth/reset-password`. Tokens: SHA-256 hashed in `PasswordResetToken`, 30-min expiry, single-use, active users only. Admin panel (`/admin/users`) has manual reset fallback.

## Conventions
- Audit everything: `writeAudit({ tenantId, actorId, action, entity, entityId, metadata })` from `src/lib/services/audit.ts`.
- Passwords: `bcryptjs` cost 12.
- Dates: UTC everywhere; `utc(y, m, d)` helper; store midnight UTC; raw calendar dates (no weekend/holiday adjustment).
- Tenant-scoped queries everywhere; soft-deactivate rather than delete.
- Zod validation on all API inputs; business logic in `src/lib/services/`, not route handlers.
- UI: Tailwind, `bg-bg-subtle`, `text-fg`, `border-border` theme tokens; shared `ObligationTable` + `MonitoringFilters` components have payroll-type filter toggles (All / Payroll Processing / Payroll Remittances).

## Gotchas
- Prisma stores SQLite DATETIME as integer epoch millis — `strftime` needs `fiscalYearEnd / 1000, 'unixepoch'`.
- `prisma migrate dev` can hang on Windows if the dev server holds the query-engine DLL lock (`database is locked` / EPERM on generate) — stop the dev server, run migrate/generate, restart.
- Prisma does NOT detect SQLite column renames — hand-edit migration SQL to `RENAME COLUMN` (or recreate-table with backfill) to avoid data loss.
- Known gaps: weekend/holiday adjustment deferred; no test suite (typecheck+lint+manual). Anniversary-based provincial ARs require an incorporation date.

## TODO / next steps (as of 2026-08-16)
- [ ] Run `npm run migrate-multi-entity` on any production DB once to backfill jurisdiction codes / remitter renames / ProvincialAnnualReturn and reconcile invalid pending rows (takes a backup first).
- [ ] Consider weekend/holiday adjustment and an automated test suite for `compliance-rules.ts` / `obligation-matrix.ts`.
- [ ] Consider adding a test runner (none exists).
