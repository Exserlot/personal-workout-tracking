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
- npm
- Supabase REST API (browser-safe publishable/anon key only)
- Vite PWA / Workbox application-shell precache
- Vercel deployment workflows
- Privacy-sanitized Sentry error reporting for hosted environments

## Development

```bash
npm install
npm run dev
npm run typecheck
npm run lint
npm test
npm run build
npm run check:bundle
npm run test:pwa
```

For local database setup, see [docs/supabase-local-setup.md](docs/supabase-local-setup.md).

For current milestone status, completed work, next tasks, and release gates, see [docs/project-roadmap.md](docs/project-roadmap.md).

Hosted environment and release preparation:

- [Deployment environments](docs/deployment-environments.md)
- [Monitoring and privacy](docs/monitoring-privacy.md)
- [Release checklist](docs/release-checklist.md)

## Local Supabase Initial Setup

The application connects to a local Supabase stack through its browser-safe publishable key. Docker Desktop (Linux containers), Node.js, and npm are required.

### First run

Run these commands from the repository root:

```powershell
npm install
npx supabase start
npx supabase status
npx supabase db reset
```

`supabase db reset` recreates the local database, applies every migration, and runs `supabase/seed.sql`. It is destructive to local data, so use it only when resetting the disposable local environment is intentional.

The important local endpoints are:

- API: `http://127.0.0.1:54321`
- Studio: `http://127.0.0.1:54323`
- Email preview: `http://127.0.0.1:54324`

Copy the publishable key shown by `npx supabase status` into a new `.env.local` file:

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
4. Start the app with `npm run dev` and open `http://localhost:5173`.
5. Sign in with that owner account.

The owner can now verify the seeded Exercise Library, create a Custom Exercise, edit it, archive it, and create a Workout Template/Routine. Starter Exercises are read-only.

### Daily local workflow

```powershell
npx supabase start       # start Docker services
npx supabase status      # inspect URLs and keys
npm run dev              # start Vite
```

Stop the stack when finished:

```powershell
npx supabase stop
```

Apply pending migrations without clearing data with `npx supabase db push --local`. Use `npx supabase db reset` when you intentionally want a clean database and fresh seed data.

### Validation and database tests

With Docker and the local stack running, use:

```powershell
npm run typecheck
npm run lint
npm test
npm run build
npm run check:bundle
npx supabase db lint --local
npx supabase test db
npm run test:e2e
npm run test:pwa
```

The Playwright suite expects the Vite app and local Supabase services to be available.

### Troubleshooting

- `docker: command not found` or `dockerDesktopLinuxEngine` errors: start Docker Desktop and switch to the Linux container engine before running `supabase start`.
- `401 Unauthorized` or `permission denied for table`: confirm the URL and **Publishable** key from `supabase status`, then rerun migrations with `npx supabase db push --local` or reset the local database.
- `email_provider_disabled`: confirm `[auth.email] enable_signup = true` in `supabase/config.toml`, then run `npx supabase stop` and `npx supabase start`. Global public signup remains disabled intentionally.
- PowerShell blocks `npm` or `npx`: use `npm.cmd` or `npx.cmd` in the same commands, for example `npx.cmd supabase status`.
