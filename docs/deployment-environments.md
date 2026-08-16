# Deployment Environments

## Topology

FORM uses one Vercel project and two independent Supabase projects. Preview deployments use Staging Supabase; Production deployments use Production Supabase. Production data must never be copied into Staging.

| Environment | Git ref | Frontend | Database |
| --- | --- | --- | --- |
| Local | feature branch | Vite localhost | Supabase Docker stack |
| Staging | `staging` | Vercel Preview | Staging Supabase project |
| Production | `main` + manual approval | Vercel Production | Production Supabase project |

The workflows follow the separate-project migration model in the [Supabase environment guide](https://supabase.com/docs/guides/deployment/managing-environments). Hosted databases receive migrations only; do not use `--include-seed`.

## Hosted Project Setup

Create empty Staging and Production Supabase projects, then configure each project separately:

1. Disable public sign-up and anonymous sign-in.
2. Keep email/password login enabled for the private owner.
3. Add the matching Vercel URL to Auth Site URL and redirect allow-list.
4. Create the owner through the Supabase Dashboard; do not add credentials to migrations or seed data.
5. Store the project URL and browser-safe publishable key in the matching Vercel environment.
6. Run Security Advisor and verify every application table has RLS.

Required browser variables are documented in `.env.example`. `VITE_*` values are embedded in the browser bundle, so they must never contain service-role keys, database passwords, Sentry auth tokens, or access tokens.

## GitHub Environments

Create `staging` and `production` GitHub environments. Production must require manual approval.

Environment secrets:

- `SUPABASE_ACCESS_TOKEN`
- `SUPABASE_DB_PASSWORD`
- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`
- `SENTRY_AUTH_TOKEN`

Environment variables:

- `SUPABASE_PROJECT_ID`
- `SENTRY_ORG`
- `SENTRY_PROJECT`

Configure `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` and `VITE_SENTRY_DSN` in Vercel Preview/Production settings. Environment variable changes require a new deployment.

## Release Flow

1. Develop and verify migrations locally with reset, lint and database tests.
2. Merge to `staging`; the workflow applies migrations before deploying the Preview build.
3. Run the staging owner smoke test and review Sentry privacy output.
4. Merge the verified release to `main`.
5. Run **Deploy Production** manually with the release version and `DEPLOY` confirmation.

The production workflow is prepared in M-07A but must not be run until the M-07B backup/restore rehearsal and release approval are complete.
