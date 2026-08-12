# SimpleBookkeeping

Self-hosted corporate client compliance tracker for a small Canadian
accounting firm. Replaces the existing Excel workbooks for managing
client onboarding, historical filings, and the recurring compliance
schedule (T2, GST/HST, payroll, annual returns, T4/T4A/T5).

MVP1 is single-tenant and self-hosted. The data model and access
patterns are already tenant-scoped, so a SaaS version is a matter of
swapping the database driver and a few infrastructure pieces — no
schema redesign required.

## Stack

- **Next.js 15** (App Router) + **React 19** + **TypeScript 5**
- **Prisma 6** + **SQLite** (single-file DB at `data/app.db`)
- **NextAuth 4** (Credentials provider, JWT sessions)
- **Tailwind CSS v3** with six selectable color palettes
- **AES-256-GCM** encryption for the QuickBooks Desktop password field
- **Docker** multi-stage build (Node 20 bookworm slim) for one-command deploy

## Quick start

### 1. Install

```bash
npm install
cp .env.example .env
```

Generate the two required secrets and put them in `.env`:

```bash
# NEXTAUTH_SECRET (NextAuth session signing key)
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# APP_DATA_KEY (AES-256-GCM key for the QuickBooks password field)
npm run crypto-init
```

### 2. Initialise the database

```bash
npx prisma migrate dev     # create the SQLite database and schema
npm run seed               # seeds default tenant + 2 demo users
```

### 3. Run the app

#### Option A — detached dev server (recommended for office use)

| OS             | Start          | Stop          |
| -------------- | -------------- | ------------- |
| Windows        | `start.cmd`    | `stop.cmd`    |
| macOS / Linux  | `./start.sh`   | `./stop.sh`   |

The dev server binds to `0.0.0.0:3100`. Open <http://localhost:3100>.
Logs go to `dev.out.log` and `dev.err.log`; the process keeps running
after you close the terminal.

> **Unix/macOS:** If the scripts were downloaded without executable permissions,
> run `chmod +x start.sh stop.sh` once before using `./start.sh` or `./stop.sh`.

#### Option B — foreground dev server

```bash
npm run dev
```

#### Option C — production build

```bash
npm run build
npm run start               # binds 0.0.0.0:3000
```

#### Option D — Docker

```bash
# Generate real secrets first
node -e "console.log('NEXTAUTH_SECRET=' + require('crypto').randomBytes(32).toString('base64'))"
node -e "console.log('APP_DATA_KEY=' + require('crypto').randomBytes(32).toString('base64'))"

# Put them in a .env file or pass inline:
NEXTAUTH_SECRET=... APP_DATA_KEY=... docker compose up -d --build
# Open http://localhost:3000
```

The Docker image uses Next.js `output: "standalone"` and a multi-stage
build, so the runtime layer is small (under 200 MB). The SQLite DB and
backup directory are exposed as named volumes. On first start the
container automatically runs `prisma migrate deploy` and seeds the
default tenant and demo users.

### Seeded users

- `admin@firm.ca` / `admin123` — Admin (full access, sees all dashboards)
- `staff@firm.ca` / `staff123` — Staff (day-to-day updates)

> **Change these immediately for any non-dev deployment.** Once logged
> in, open `/admin/users` to create a new admin and deactivate the
> demo accounts. Or skip the seed entirely and use the CLI:
>
> ```bash
> npm run create-admin -- --email you@firm.ca --password '<strong>' --name "Your Name"
> ```

## Feature tour

- **Dashboard** (`/dashboard`) — every compliance obligation across the
  tenant, with filters for date range, status, and filing type. Overdue
  rows are highlighted.
- **Monitoring** (`/monitoring`) — overdue items, items due in the next
  7 days, and items waiting on clients.
- **Clients** (`/clients`) — list, create, edit. Each client has:
  - Master data (file #, legal name, BN, FYE, incorporation date, HST
    and payroll applicability, etc.)
  - Folder checklist (CRA, HST, Payroll, …) with persistent state
  - Historical review (3 years × 6 filing types) — must be marked
    complete before the schedule unlocks
  - Encrypted QuickBooks Desktop password with **Reveal**/**Hide**/**Copy**
    buttons. Plaintext is never written to disk; every reveal is audited.
  - Compliance schedule (auto-generated from master data using the
    Canadian compliance rules in `src/lib/compliance-rules.ts`)
- **Users** (`/admin/users`, Admin only) — create, deactivate, reset
  passwords.
- **Theme** (`/settings/theme`) — pick from six palettes
  (Emerald Prestige, Midnight Indigo, Charcoal & Ember, Noir & Gold,
  Cloud White, Ocean Deep). Each user has their own preference.

## Security

- Passwords stored as bcrypt hashes (cost 12).
- QuickBooks Desktop password encrypted with **AES-256-GCM** using a
  per-tenant key in `APP_DATA_KEY` (a base64 32-byte secret). Plaintext
  is never written to disk and only ever held in memory.
- Every "Reveal" of the QB password writes a row to `AuditLog`. The
  reveal UI auto-masks after 20 s.
- Every Prisma query is **tenant-scoped** (the `tenantId` column on
  every table), so the same codebase can later be deployed multi-tenant
  for SaaS without schema changes.
- Sessions are JWT (NextAuth `jwt` strategy), so the server is
  stateless and horizontally scalable.

## Backups

Hourly snapshots are written to `backups/` (or to the path in
`BACKUP_DIR`). Retention:

- every hourly snapshot for the last 7 days
- one snapshot per day for older backups

Schedule the backup to run hourly. On Windows, create a Task Scheduler
entry:

- **Program:** `npx`
- **Arguments:** `tsx "W:\claude\simpleBookkeeping\scripts\backup.ts"`
- **Start in:** `W:\claude\simpleBookkeeping`
- **Trigger:** every 1 hour, indefinitely

On Linux / macOS, a one-line cron entry:

```
0 * * * * cd /path/to/simplebookkeeping && /usr/bin/npx tsx scripts/backup.ts
```

The script tries the `sqlite3` CLI first (preferred — produces a
consistent offline snapshot) and falls back to Prisma's `VACUUM INTO`
if the CLI is not on PATH. To install the CLI on Windows, grab
`sqlite-tools-win-x64` from <https://www.sqlite.org/download.html> and
put the folder on your system PATH.

To restore:

```bash
npm run restore             # interactive picker
npm run restore -- --list   # show available backups
```

Stop the SimpleBookkeeping app before restoring.

## CLI scripts

| command | purpose |
| --- | --- |
| `npm run dev` | start the dev server on 0.0.0.0:3000 |
| `npm run build` | production build (generates `.next/standalone`) |
| `npm run start` | start the production server on 0.0.0.0:3000 |
| `npm run typecheck` | TypeScript type-check |
| `npm run lint` | ESLint |
| `npm run seed` | seed the default tenant + 2 demo users |
| `npm run create-admin -- --email <e> --password <p> --name "<n>"` | create the first admin (or any admin) |
| `npm run crypto-init` | generate `APP_DATA_KEY` and append to `.env` |
| `npm run backup` | run a backup now |
| `npm run restore` | restore a backup (interactive) |
| `start.cmd` / `./start.sh` | detached dev server (background, log files) |
| `stop.cmd` / `./stop.sh` | stop the detached dev server |

## Project structure

```
src/
  app/
    api/                  REST endpoints (NextAuth, clients, obligations, etc.)
    (app)/                Authenticated pages (layout enforces session)
    login/                Login page
    page.tsx              Root redirect → /dashboard or /login
    instrumentation.ts    Production-only path rewriting for standalone builds
  components/             UI components (palette grid, obligation table, …)
  lib/
    auth.ts               NextAuth options + requireUser/requireAdmin
    cn.ts                 clsx + tailwind-merge
    compliance-rules.ts   Pure date math (T2, HST, payroll, annual returns, T4)
    env.ts                zod-validated env
    overdue.ts            Overdue check (extracted to keep JSX parser happy)
    paths.ts              Production-only DATABASE_URL path rewriting
    prisma.ts             Prisma client singleton
    theme.ts              6 theme records
    services/             Tenant-scoped data access (clients, obligations, …)
prisma/
  schema.prisma           SQLite schema (Tenant, User, Client, FolderChecklistItem, HistoricalReview, FilingObligation, AuditLog)
  seed.ts                 Default tenant + 2 demo users
  migrations/             Prisma migration history
scripts/
  create-admin.ts         CLI admin creation
  crypto-init.ts          Generate APP_DATA_KEY
  backup.ts               Hourly backup with 7d hourly / 1d daily retention
  restore.ts              Interactive restore picker
data/
  app.db                  SQLite database (gitignored)
backups/
  simplebookkeeping-*.db  Backup snapshots (gitignored)
Dockerfile                Multi-stage build (Node 20 bookworm-slim)
docker-compose.yml        One-command local container
start.cmd / start.sh      Detached dev launcher (Windows / Unix)
stop.cmd  / stop.sh       Detached dev stopper
```

## Roadmap to SaaS

The MVP1 release is single-tenant on a single office machine. To
evolve to a multi-tenant SaaS:

- **Tenancy** — the `Tenant` model is in the schema and every query is
  already tenant-scoped. Add a `slug` per tenant and resolve it from
  the request domain or a path prefix.
- **Database** — swap the Prisma datasource from `sqlite` to
  `postgresql` and run `prisma migrate dev`. The schema and services
  are portable. Move the SQLite file out of the repo; everything
  reads/writes through Prisma.
- **Per-tenant encryption** — move the `APP_DATA_KEY` to a per-tenant
  KMS-wrapped data key. The single change is inside
  `src/lib/services/crypto.ts`.
- **Auth** — add signup, billing, magic-link or SSO, and a per-tenant
  subdomain. No code outside `src/lib/auth.ts` needs to know the
  difference.
- **Backups** — swap the local `VACUUM INTO` for a per-tenant
  PostgreSQL dump to object storage (S3 + lifecycle policy).
- **Deployment** — push the existing Dockerfile unchanged; deploy the
  same image behind a reverse proxy (Caddy / nginx / Cloudflare) with
  a managed Postgres. The `Tenant` table and the `tenantId` column on
  every row are the only contracts that need to keep working.

Everything else — the UI, the compliance rules, the encryption, the
audit log, the backup retention — is already production-shaped and
ready to scale.
