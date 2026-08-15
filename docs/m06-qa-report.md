# M-06 QA Report

วันที่ตรวจ: 15 สิงหาคม 2026

## Scope

ตรวจ shared shell, route focus, dialogs, popovers, timer feedback และ route states ของ P-01–P-13 โดยไม่เปลี่ยน repository contract, business rule หรือ Supabase schema

## Automated checks

| Check | Result | Evidence |
| --- | --- | --- |
| TypeScript typecheck | PASS | `tsc -b` |
| ESLint | PASS | `eslint src tests/e2e playwright.config.ts --max-warnings=0` |
| Unit tests | PASS | 17 files, 94 tests |
| Production build | PASS | Vite production build |
| Supabase schema lint | PASS | No schema errors found |
| Supabase database regression | PASS | 7 files, 149 assertions |
| Existing mobile Chromium suite | PASS | 34 tests |
| M-06 Chromium responsive suite | PASS | P-01–P-13, Skip Link, async route focus, modal focus/restore และ 320–1600px overflow |
| Axe WCAG A/AA baseline | PASS | P-01–P-13 route states |
| WebKit smoke | PASS | Mobile/desktop core routes และ keyboard navigation |
| Firefox smoke | BLOCKED | Core-flow assertions complete แต่ Playwright Firefox ล้มเหลวระหว่าง `browserContext.close` ด้วย protocol error ของ local Windows runner |

The Axe run uses `@axe-core/playwright` with WCAG 2A/2AA, 2.1 AA and 2.2 AA tags. No rules are disabled globally and no element-specific exclusions are currently used.

## Implemented checks

- Skip Link targets `#main-content`; the main region is programmatically focusable.
- Route pages set document titles and move focus to the page heading without adding a permanent tab stop; async title updatesไม่ดึง focus จาก control ที่กำลังใช้งาน.
- Desktop rail labels remain available when the label text is visually compacted; current navigation uses `aria-current` from `NavLink`.
- Shared `ModalDialog` handles Escape, focus trapping, body scroll lock, opaque surfaces and focus restoration. It is used by navigation, ad-hoc workout, exercise picker, archive, History confirmation and Settings recovery dialogs.
- Mobile Exercise filters use a modal bottom sheet with focus trap/body-scroll lock; anchored tablet filters expose `aria-expanded` และ `aria-controls`, dismiss on Escape/outside click and restore trigger focus.
- Rest Timer exposes a `role="timer"` value and announces start, pause, resume, reset, skip and finish without announcing every second.
- Forced-colors focus/current-state rules and reduced-motion rules are present in the global layer.

## Manual follow-up

Automated checks do not prove physical-device behavior, screen-reader usability, or full WCAG conformance. Before release, manually inspect 200% zoom, Windows High Contrast/forced colors, a real mobile keyboard covering the active Set action, VoiceOver/NVDA focus order, and touch targets on a physical phone. Rerun Firefox in CI or a clean runner without the `browserContext.close` protocol error before marking M-06 `DONE`.
