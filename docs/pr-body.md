## Summary

Eight commits on `feat/table-sorting-and-fye-month-end` covering the review-driven changes from this session. `npm run build`, `npm run typecheck` and `npm run lint` pass. The end-to-end checks were run against the local test database.

### Bug fixes from the full code review
- QuickBooks password is no longer fetched and decrypted when a client page loads; it is revealed on demand and auto-hides after 20 seconds.
- Failed client saves no longer purge schedule rows first (review-lock check moved ahead of the purge).
- Reconcile never deletes past-due rows.
- Password reset tokens are claimed atomically; login timing is equalised for unknown or inactive accounts.
- Historical review edits are audited; Staff no longer see inactive clients.
- Workflow date fields compare by time in the no-op guard; cleared interaction notes save; the close route checks the filing type.
- Field values are validated server-side (dates, numbers, whole-number employee count).
- List queries fetch workflow rows in one call instead of one per obligation.
- Leap-year fiscal period start fixed; duplicate file numbers return 409; `requireUser` kept outside `try`.

### Workflow list filters
- Client filter is a free-text name search on all six list pages; the Client column shows the legal name only.
- Income Taxes: fiscal year-end month filter. Sales Tax: frequency filter, and a Period ending column.

### Payroll
- Payroll remittance rows are no longer generated; `scripts/remove-payroll-remittance.ts` clears existing rows (dry run, snapshot, keeps rows with recorded work unless `--include-worked`).
- Weekly and Bi-Weekly runs are Friday-anchored from a fixed reference (13 Nov 2026), so regenerating no longer creates overlapping cycles. `scripts/realign-payroll-cycles.ts` realigns existing data.
- Clients can select several pay frequencies; the schedule gets one set of runs per frequency.
- Number of employees is optional.
- Information returns T4A/T5: amount field, shown in the list.
- Federal and Provincial AR lists show the incorporation month.

### Historical review
- Columns are the six groups (Income Taxes, Sales Tax, Payroll, Federal AR, Provincial AR, Information Returns). Groups that don't apply to a client are disabled.
- A group marked Overdue or Outstanding Balance generates that fiscal year's filings using the client's frequency. Filed or N/A cancels them; nothing is deleted.
- New `FilingObligation.reviewYear` (migration `20261122120000_add_review_year`) marks review-created rows.
- New `Cancelled` obligation status, excluded from overdue counts.
- Completing a workflow now sets the obligation to Filed/Completed.
- Dashboard overdue count fixed.

## Migrations
- `20261122120000_add_review_year` (additive column). `prisma migrate deploy` on the target.

## Runbooks
- `docs/runbooks/payroll-remittance-removal.md`
- `docs/runbooks/payroll-cycle-realignment.md`

🤖 Generated with [Claude Code](https://claude.com/claude-code)
