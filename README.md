# Personal Workout Tracking Web App

A private, strength-first workout tracking web app for planning routines, logging workouts, and reviewing training progress across desktop, tablet, and mobile.

## Purpose

This app is designed for a single owner user in the MVP phase. Desktop and laptop views focus on planning, reviewing history, and analyzing progress. Mobile views focus on fast workout logging during training.

## MVP Scope

- Exercise Library
- Workout Plans
- Today's Workout
- Active Workout
- Workout History
- Basic Progress
- Responsive application shell
- Dark Swiss International Style design system

## Design Direction

The interface follows a restrained dark-mode Swiss International Style:

- structured grid layouts
- clear typography
- border-based separation
- minimal shadows
- red accent used sparingly
- responsive layouts that change structure by device

## Current Status

The complete owner flow is implemented through Exercise Library, Planning, Today, online/offline Workout execution, History, Sync recovery and live Progress/PR calculations. Release hardening is in progress: the repository now includes an installable PWA foundation, typed environments, privacy-safe monitoring, bundle budgets and staging/production workflows. Production launch and backup/restore rehearsal are not complete.

## Tech Stack

- React
- TypeScript
- Vite
- Tailwind CSS
- pnpm
- Supabase REST API (browser-safe publishable/anon key only)
- Vite PWA / Workbox application-shell precache
- Vercel deployment workflows
- Privacy-sanitized Sentry error reporting for hosted environments

## Development

```bash
pnpm install
pnpm dev
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm check:bundle
pnpm test:pwa
```

For local database setup, see [docs/supabase-local-setup.md](docs/supabase-local-setup.md).

For current milestone status, completed work, next tasks, and release gates, see [docs/project-roadmap.md](docs/project-roadmap.md).

Hosted environment and release preparation:

- [Deployment environments](docs/deployment-environments.md)
- [Monitoring and privacy](docs/monitoring-privacy.md)
- [Release checklist](docs/release-checklist.md)

## Local Supabase Initial Setup

The application connects to a local Supabase stack through its browser-safe publishable key. Docker Desktop (Linux containers) and Node.js with pnpm are required.

### First run

Run these commands from the repository root:

```powershell
pnpm install
pnpm exec supabase start
pnpm exec supabase status
pnpm exec supabase db reset
```

`supabase db reset` recreates the local database, applies every migration, and runs `supabase/seed.sql`. It is destructive to local data, so use it only when resetting the disposable local environment is intentional.

The important local endpoints are:

- API: `http://127.0.0.1:54321`
- Studio: `http://127.0.0.1:54323`
- Email preview: `http://127.0.0.1:54324`

Copy the publishable key shown by `pnpm exec supabase status` into a new `.env.local` file:

```dotenv
VITE_APP_ENV=local
VITE_APP_VERSION=dev
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_PUBLISHABLE_KEY=<Publishable key from supabase status>
VITE_SENTRY_DSN=
```

Never put the `Secret` or `service_role` key in a `VITE_*` variable, source code, or Git. `.env.local` is ignored by Git.

### Create the local owner account

Because public registration is disabled, create the single development owner in Studio:

1. Open `http://127.0.0.1:54323`.
2. Go to **Authentication > Users > Add user**.
3. Enter an email and password, then enable **Auto Confirm User**.
4. Start the app with `pnpm dev` and open `http://localhost:5173`.
5. Sign in with that owner account.

The owner can now verify the seeded Exercise Library, create a Custom Exercise, edit it, archive it, and create a Workout Template/Routine. Starter Exercises are read-only.

### Daily local workflow

```powershell
pnpm exec supabase start       # start Docker services
pnpm exec supabase status      # inspect URLs and keys
pnpm dev                       # start Vite
```

Stop the stack when finished:

```powershell
pnpm exec supabase stop
```

Apply pending migrations without clearing data with `pnpm exec supabase db push --local`. Use `pnpm exec supabase db reset` when you intentionally want a clean database and fresh seed data.

### Validation and database tests

With Docker and the local stack running, use:

```powershell
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm check:bundle
pnpm exec supabase db lint --local
pnpm exec supabase test db
pnpm test:e2e
pnpm test:pwa
```

The Playwright suite expects the Vite app and local Supabase services to be available.

### Troubleshooting

- `docker: command not found` or `dockerDesktopLinuxEngine` errors: start Docker Desktop and switch to the Linux container engine before running `supabase start`.
- `401 Unauthorized` or `permission denied for table`: confirm the URL and **Publishable** key from `supabase status`, then rerun migrations with `pnpm exec supabase db push --local` or reset the local database.
- `email_provider_disabled`: confirm `[auth.email] enable_signup = true` in `supabase/config.toml`, then run `pnpm exec supabase stop` and `pnpm exec supabase start`. Global public signup remains disabled intentionally.
- PowerShell blocks `pnpm`: use `pnpm.cmd` in the same commands, for example `pnpm.cmd exec supabase status`.
