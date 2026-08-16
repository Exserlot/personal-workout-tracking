# Release Checklist

## M-07A Staging Gate

- [ ] GitHub quality workflow passes on Linux, including Chromium, Firefox and WebKit
- [ ] Secret scan reports no credentials
- [ ] Local Supabase reset, lint and database tests pass
- [ ] Bundle and PWA precache remain within budget
- [ ] Staging migrations apply without seed or production data
- [ ] Vercel deep links return the SPA shell
- [ ] Manifest, icons and service worker are available
- [ ] Offline reload opens the application shell and cached Active Workout
- [ ] Supabase/Auth/Sentry responses are absent from Cache Storage
- [ ] Staging Sentry event contains no prohibited data
- [ ] Public registration is disabled on Staging Supabase

## M-06 User-assisted Sign-off

Record device/browser and result in `m06-qa-report.md`.

- [ ] Physical phone touch targets and bottom navigation
- [ ] Mobile keyboard does not cover the active Set or primary action
- [ ] Desktop 200% zoom
- [ ] Windows High Contrast or equivalent forced-colors mode
- [ ] Keyboard-only Login → Today → Workout → History → Progress
- [ ] NVDA or VoiceOver headings, dialogs, form errors, timer and charts
- [ ] Installed PWA launch and offline Active Workout

## Production Hold

Do not run the Production workflow until M-07B has completed automated backup configuration, restore rehearsal, owner recovery procedure, production smoke plan and rollback rehearsal.
