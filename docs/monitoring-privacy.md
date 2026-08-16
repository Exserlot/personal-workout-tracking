# Monitoring and Privacy

## Purpose

Sentry is used to detect application crashes, authentication failure categories, Supabase request failures and Workout sync health. It is not an analytics or workout-data store.

## Allowed Data

- application environment and release version
- operation category such as Auth, REST or Sync
- HTTP status code
- sync status and aggregate pending/conflict/recovery counts
- sanitized exception type and stack trace

## Prohibited Data

Never send email, user ID, Session/Exercise/Set IDs, Exercise names, weight, reps, RPE/RIR, notes, command payloads, URLs with IDs/query strings, access tokens, refresh tokens, database passwords or Supabase secret keys.

The client disables default PII, tracing and Session Replay. Event and breadcrumb hooks remove user data, request bodies, arbitrary extras, input/console breadcrumbs, query strings, identifiers, tokens, email addresses and numeric workout values.

## Verification

Before enabling Production:

1. Trigger a controlled error in Staging.
2. Confirm environment and release tags are present.
3. Inspect the complete event, breadcrumbs and request context.
4. Confirm no prohibited value is present.
5. Delete the test event if it contains unexpected data and block Production until the sanitizer is corrected.

`VITE_SENTRY_DSN` is a browser value. `SENTRY_AUTH_TOKEN`, organization and project build settings belong only in CI/Vercel. Source maps are uploaded during an authorized build and removed from deployment output.
