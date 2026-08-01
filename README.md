# ROT Workshop Resource Utilization Dashboard

A resource utilization and productivity tracking platform for the ROT
Workshop, replacing manual spreadsheet-based daily reporting. Resources log
task work against assigned projects; managers get a live utilization
dashboard, historical reports, attendance tracking, and configuration tools.

See [`docs/SRS.md`](docs/SRS.md) for the full requirements spec this was
built against, and [`CLAUDE.md`](CLAUDE.md) for implementation notes and
decisions.

## Stack

Next.js 16 (App Router, TypeScript) · React 19 · Supabase (Postgres + Auth) ·
TanStack React Query · Tailwind CSS · Zod · Vitest

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). You'll be redirected to
`/login`.

Environment variables (`.env.local`):

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` / `npm start` | Production build / start |
| `npm run lint` | ESLint |
| `npm test` | Run the Vitest suite once |
| `npm run test:watch` | Vitest in watch mode |
| `npm run seed:auth-users` | Create Supabase Auth users + profiles for any resource missing one |
| `npm run import:master-data -- <file.xlsx> --dry-run` | Import Excel master data (resources + tasks) — see [`docs/EXCEL_IMPORT.md`](docs/EXCEL_IMPORT.md) |

## Docs

- [`docs/SRS.md`](docs/SRS.md) — the requirements spec (source of truth)
- [`docs/DATABASE.md`](docs/DATABASE.md) — schema reference + RLS notes
- [`docs/API.md`](docs/API.md) — API route reference
- [`docs/EXCEL_IMPORT.md`](docs/EXCEL_IMPORT.md) — master-data import details
- [`CLAUDE.md`](CLAUDE.md) — session/implementation notes, decisions and their reasoning

## Roles

- **Manager** (`/manager/*`) — dashboard, projects, resources, tasks,
  attendance, reports, audit log, settings.
- **Resource** (`/resource/*`) — dashboard, submit work.

Login uses an Employee ID + password (mapped internally to a
`{employeeId}@rot-internal.local` Supabase Auth account). First-time users
go through `/set-password` before their first real login.
