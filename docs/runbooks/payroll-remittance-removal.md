# Runbook: remove Payroll Remittance rows from a live database

Audience: an agent or person running this on the machine that hosts the live
SimpleBookkeeping database (the accountant's instance).

## Background

Payroll remittances are no longer generated. Only Payroll Processing stays on the
schedule. Existing `PayrollRemittance` rows must be deleted from each database
that was generated before the change. The script that does this is
`scripts/remove-payroll-remittance.ts`, run with `npm run remove-payroll-remittance`.

The code change is in commit `6a6513e` and the restore script in `1716b9c`. The
branch is `feat/table-sorting-and-fye-month-end`. Do not run this runbook against
a checkout that does not include `1716b9c` or later.

## Rules for the agent

- Do not run any command with `--apply` unless the user has explicitly approved
  it in this session. A dry run is always safe.
- Rows with recorded work (filed, status moved on, checklist ticked, values
  entered, notes, or a client interaction) are kept by default. Deleting them
  requires `--include-worked`. Confirm with the user before using that flag. The
  dry run lists them with their reasons.
- Stop the app before any `--apply`. Use `stop.cmd`, not an ad-hoc process kill.
- Never commit `data/`, `backups/`, or `.env`.
- Do not use `npm run restore` or any other restore command unless the user asks.
  Restores overwrite the live database.

## Steps

### 1. Get the code

```powershell
cd <path-to-simpleBookkeeping>
git fetch origin
git checkout feat/table-sorting-and-fye-month-end
git pull
git log --oneline -3
```

Confirm `1716b9c` (or a later commit) is in the log. If it is not, stop and tell
the user.

### 2. Install dependencies

```powershell
npm install
```

### 3. Stop the app

```powershell
cmd /c stop.cmd
```

Confirm nothing is listening on port 3100 before going on. `curl` should fail to
connect.

### 4. Dry run (safe, writes nothing)

```powershell
npm run remove-payroll-remittance -- --include-worked
```

The output ends with `Found N Payroll Remittance row(s)` and `Rows to delete: N`.
Report these numbers to the user, and list any rows under "Recorded work" with
their reasons. Wait for the user's go-ahead before going on.

If the output says `No Payroll Remittance rows found`, the database is already
clean. Skip to step 7.

### 5. Apply (only after the user approves)

Without `--include-worked`, only rows with no recorded work are deleted:

```powershell
npm run remove-payroll-remittance -- --apply
```

With `--include-worked`, rows with recorded work are deleted too. Use this only
if the user has explicitly approved deleting them:

```powershell
npm run remove-payroll-remittance -- --apply --include-worked
```

The script first writes a snapshot of the database to `backups\pre-migration`.
It prints a line like:

```
Backup saved as: simplebookkeeping-YYYYMMDD-HHMMSS.db
```

Copy that file name into your report to the user. If the snapshot fails, the
script stops and deletes nothing.

### 6. Verify

```powershell
npm run remove-payroll-remittance
```

Expected output: `No Payroll Remittance rows found. Nothing to do.`

### 7. Start the app

```powershell
cmd /c start.cmd
```

Then check the login page responds (HTTP 200 at `http://localhost:3100/login`).
Report the result to the user.

## If something goes wrong

Restore the snapshot named in step 5. This overwrites the live database, so only
do it on the user's instruction. Stop the app first, then:

```powershell
npm run restore-payroll-remittance -- --file=<snapshot-file-name>
```

The restore saves the current database before overwriting it and prints that
file's name, so the restore can itself be undone. Use `--list` to see available
names.

## Report back

Give the user:
- the number of rows found and the number deleted,
- the snapshot file name,
- whether the app started and responded,
- any rows kept because they had recorded work, and why.
