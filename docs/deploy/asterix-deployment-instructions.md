# Instructions for Asterix: deploy the latest SimpleBookkeeping to the accountant's laptop

Audience: the Hermes agent (Asterix) on the laptop that hosts the accountant's live
database. Follow these in order. Stop and report to the user if any step fails.

## Rules

- Stop the app (`stop.cmd`) before any database command that writes.
- Every data script below is **dry run by default**. Run the dry run, report the
  numbers, and wait for the user's approval before adding `--apply`.
- Each `--apply` takes a backup first and prints a line `Backup saved as: <file>`.
  Include that file name in your report.
- Never commit `data/`, `backups/` or `.env`. Do not restore a backup unless the
  user asks.
- Do not delete anything by hand. Every data change goes through the scripts.

## 1. Get the code

```powershell
cd <path-to-simpleBookkeeping>
git fetch origin
git checkout feat/table-sorting-and-fye-month-end
git pull
git log --oneline -3
```

Confirm the log contains `71743d9` (the latest commit on this branch).

## 2. Build

```powershell
npm install
npm run typecheck
npm run lint
npm run build
```

All four must succeed. `npm run build` writes `.next`, so the app must be stopped.

## 3. Stop the app

```powershell
cmd /c stop.cmd
```

Confirm nothing is listening on port 3100.

## 4. Apply database migrations

This branch adds one column, `FilingObligation.reviewYear` (migration
`20261122120000_add_review_year`). It is additive; no data is rewritten.

```powershell
npx prisma migrate deploy
npx prisma generate
```

Expected: "All migrations have been successfully applied."

## 5. Data updates (in this order)

Take a manual backup first. The scripts also back up, but this one is free:

```powershell
npm run backup
```

### 5a. Remove Payroll Remittance rows

Payroll remittances are no longer generated.

```powershell
npm run remove-payroll-remittance -- --include-worked   # dry run, lists every row
```

Report the counts. The accountant has approved deleting the rows with recorded
work, so apply with the same flag:

```powershell
npm run remove-payroll-remittance -- --apply --include-worked
```

### 5b. Realign Weekly and Bi-Weekly payroll runs

```powershell
npm run realign-payroll-cycles      # dry run
```

Report how many runs will be removed and added, and any runs kept because they
have recorded work. Apply after approval:

```powershell
npm run realign-payroll-cycles -- --apply
```

Verify with `npm run realign-payroll-cycles` again; it should say
`Nothing to change.`

### 5c. Historical review

No script. The group columns are new. The user will have the accountant set the
cells in the app (see the accountant instructions): set a cell to N/A and back to
Overdue or Outstanding Balance to create the missing obligations for that year.
Both of the scripts above only touch payroll runs; nothing else needs a data pass.

## 6. Start the app

```powershell
cmd /c start.cmd
```

Check `http://localhost:3100/login` returns HTTP 200. Open the Historical review
page for one corporation client and confirm there are six group columns
(Income Taxes, Sales Tax, Payroll, Federal AR, Provincial AR, Information
Returns), with groups the client doesn't have greyed out.

## 7. Report back

- Commits deployed (the `git log` lines).
- Typecheck, lint and build results.
- Migration result.
- For each script: the dry-run counts, the applied counts, and the backup file name.
- Whether the app started and the review page shows six groups.
- Anything that needed a decision.

## If something goes wrong

Stop the app and restore the backup printed by the failing step:

```powershell
npm run restore-payroll-remittance -- --list
npm run restore-payroll-remittance -- --file=<backup-file-name>
```

Only on the user's instruction. The restore saves the current database first, so
it can itself be undone.
