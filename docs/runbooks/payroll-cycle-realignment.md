# Runbook: realign Weekly and Bi-Weekly payroll runs

Audience: an agent or person running this on the machine that hosts the live
SimpleBookkeeping database.

## Background

Weekly and Bi-Weekly payroll runs used to be counted from the first of the month
the schedule was generated. Regenerating in a different month created another
cycle, so some clients ended up with duplicate runs on overlapping cycles.

The firm-wide rule now (see `src/lib/compliance-rules.ts`):
- **Weekly** runs end on a **Friday** (the 7 days Saturday to Friday).
- **Bi-Weekly** runs end on a Friday, every 14 days from **Friday 13 Nov 2026**.

Semi-Monthly and Monthly runs are unchanged.

`scripts/realign-payroll-cycles.ts` (`npm run realign-payroll-cycles`) brings an
existing database onto this rule. Apply it only after the code change is deployed:
the script checks against the same rule the generator uses.

## Rules for the agent

- Do not run `--apply` unless the user has approved it in this session. A dry run
  is always safe.
- The script never touches a run with recorded work (a workflow record, a client
  interaction, a status other than Pending, a filed date, an amount, a
  confirmation number, notes, or a manual row). It never touches past-due runs.
  It never touches Monthly, Semi-Monthly, or other filing types.
- Stop the app before any `--apply`. Use `stop.cmd`.
- Never commit `data/`, `backups/`, or `.env`.
- Do not run a restore unless the user asks. Restores overwrite the live database.

## Steps

### 1. Get the code

```powershell
cd <path-to-simpleBookkeeping>
git fetch origin
git checkout feat/table-sorting-and-fye-month-end
git pull
git log --oneline -3
```

Confirm the commit that adds `scripts/realign-payroll-cycles.ts` is in the log.
If it isn't, stop and tell the user.

### 2. Install dependencies

```powershell
npm install
```

### 3. Stop the app

```powershell
cmd /c stop.cmd
```

Confirm nothing is listening on port 3100. `curl` should fail to connect.

### 4. Dry run (safe, writes nothing)

```powershell
npm run realign-payroll-cycles
```

The output lists each affected client, with the runs to remove, the runs to add,
and any runs kept because they have work recorded. The summary gives totals.
Report these to the user and wait for approval before going on.

If the summary says `Nothing to change.`, the database is already aligned. Skip to step 7.

### 5. Apply (only after the user approves)

```powershell
npm run realign-payroll-cycles -- --apply
```

The script first writes a snapshot to `backups\pre-migration`, and prints a line
like:

```
Backup saved as: simplebookkeeping-YYYYMMDD-HHMMSS.db
```

Copy that file name into your report. If the snapshot fails, nothing is changed.

### 6. Verify

```powershell
npm run realign-payroll-cycles
```

Expected output: `Nothing to change.`

### 7. Start the app

```powershell
cmd /c start.cmd
```

Confirm `http://localhost:3100/login` responds with HTTP 200.

## If something goes wrong

Stop the app and restore the snapshot from step 5. Only do this on the user's
instruction:

```powershell
npm run restore-payroll-remittance -- --file=<snapshot-file-name>
```

## Report back

- Runs removed and runs added.
- Runs kept because they have work recorded (list them).
- Snapshot file name.
- Whether the app started and responded.

## Open item for the user

The firm-wide anchor (Friday 13 Nov 2026) is a convention, not a confirmed pay
calendar. Each client's real pay dates should be checked with the accountant. If
a client pays on a different cycle, the code would need a per-client anchor.
