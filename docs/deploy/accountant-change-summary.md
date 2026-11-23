# SimpleBookkeeping: what changed, and what you need to do

## In short

This release removes payroll remittances from the schedule, regularises weekly
and bi-weekly payroll dates, adds filters and columns to the list pages, and
makes the historical review create obligations for years that are overdue.

**What you need to do:** after the update is installed, re-enter the historical
review for clients whose past years are overdue or have an outstanding balance
(the steps are under "Historical review" below). Nothing else needs data entry.

## Payroll

**Payroll remittances are gone.** The app now schedules only Payroll Processing
runs, based on each client's pay frequency. Any remittance entries already in
the system are removed as part of the update.

**Weekly and bi-weekly dates are now fixed.** Before, those dates shifted every
time the schedule was regenerated, which could leave duplicate runs. Now:

- Weekly runs always end on a **Friday** (Saturday to Friday).
- Bi-weekly runs always end on a **Friday**, every 14 days from a fixed
  reference period ending **13 November 2026**.

Semi-monthly (1st–15th and 16th–month-end) and monthly are unchanged.

**Assumption:** the firm uses one Friday cycle for all weekly and bi-weekly
clients. The anchor date (13 Nov 2026) comes from your existing schedules, not
from each client's written pay calendar. **Please check each client's real pay
dates.** If a client pays on a different cycle, tell us and we can add a
per-client start date.

**Several pay frequencies per client.** A client can now have more than one pay
frequency (for example two groups of staff). The schedule creates a set of runs
for each.

**Number of employees is optional** when completing payroll. Total remittance is
still required.

## Historical review

The review now has six columns per year: **Income Taxes, Sales Tax, Payroll,
Federal AR, Provincial AR, Information Returns**. Columns that don't apply to a
client are greyed out.

- **Overdue** or **Outstanding Balance**: once the review is marked complete,
  the app creates that year's filings for that group, using the client's
  frequency. Quarterly GST for 2024 creates four quarterly entries with their
  real due dates; monthly payroll creates twelve monthly runs.
- **Filed** or **N/A**: the entries the review created are marked **Cancelled**.
  They are not deleted. If you set the cell back to Overdue, they reopen.

**To set up the existing data:** the old columns (T2, GST/HST, Payroll, T4, T4A,
T5) were renamed to the six groups. For each client and year where something is
still owed, set the matching group cell to **N/A**, then back to **Overdue** or
**Outstanding Balance**. That creates the missing entries.

**Assumption:** "2024" means the fiscal year that ends in 2024 (1 May 2024 to
30 April 2025 for an April year-end). Generated entries use the client's
**current** entity type, HST year-end and pay frequency. If a client's setup
changed since that year, the dates will follow today's setup, not the old one.

**Amounts:** entries created from the review have no amount. Enter the balance
in the workflow if you want it recorded.

## Completing work

Completing a workflow (all steps ticked) now marks the obligation itself as
complete, so the Dashboard, Monitoring and the schedule agree. Cancelled entries
stay cancelled unless the review is set back to Overdue.

## List pages

- The **Client** filter is now a text search on the name (any part of the name,
  case does not matter); the Client column shows the name only.
- **Income Taxes**: filter by fiscal year-end month.
- **Sales Tax**: filter by frequency, and the date column now shows **Period
  ending** (the quarter or year end) instead of the filing due date.
- **Payroll**: filter by pay frequency, and a Frequency column.
- **Information Returns**: T4A and T5 have an **Amount** field, shown in the list.
- **Federal and Provincial AR**: an **Incorporation month** column.

## Clients page

- Pay frequency is now a set of checkboxes (several can be selected).
- QuickBooks passwords are revealed only when you click Reveal, and hide again
  after 20 seconds.
- Staff can no longer see inactive clients; Admins still can.

## Questions to raise

- Each client's true weekly / bi-weekly pay day and cycle reference.
- Any past year treated differently from today's entity type or HST year-end.
- Whether amounts should be recorded for review-created entries.
