# M-06 QA Report

วันที่ตรวจ: 16 สิงหาคม 2026

## Scope

ตรวจ shared shell, route focus, dialogs, popovers, timer feedback และ route states ของ P-01–P-13 โดยไม่เปลี่ยน repository contract, business rule หรือ Supabase schema

## Automated checks

| Check | Result | Evidence |
| --- | --- | --- |
| TypeScript typecheck | PASS | `tsc -b` |
| ESLint | PASS | `eslint . --max-warnings=0` |
| Unit tests | PASS | 20 files, 104 tests |
| Production build | PASS | Vite production build |
| Bundle budget | PASS | Initial JS 126,075 bytes gzip; largest lazy route 12,117 bytes gzip; precache 975,737 bytes |
| Supabase schema lint | PASS | No schema errors found |
| Supabase database regression | PASS | 7 files, 149 assertions |
| Existing mobile Chromium suite | PASS | Workout, Today, Planning, Exercise, History, Progress และ Settings flows |
| M-06 Chromium responsive suite | PASS | P-01–P-13, Skip Link, async route focus, modal focus/restore และ 320–1600px overflow |
| Axe WCAG A/AA baseline | PASS | P-01–P-13 route states |
| WebKit smoke | PASS | Mobile/desktop core routes และ keyboard navigation |
| Firefox smoke | PASS | Mobile/desktop core routes และ keyboard navigation; ไม่พบ protocol error ใน production-preview run ล่าสุด |
| Full browser suite | PASS | 54/54 tests |
| PWA suite | PASS | Manifest/icons, service-worker control, privacy-safe Cache Storage และ offline shell reload |

The Axe run uses `@axe-core/playwright` with WCAG 2A/2AA, 2.1 AA and 2.2 AA tags. No rules are disabled globally and no element-specific exclusions are currently used.

## Implemented checks

- Skip Link targets `#main-content`; the main region is programmatically focusable.
- Route pages set document titles and move focus to the page heading without adding a permanent tab stop; async title updatesไม่ดึง focus จาก control ที่กำลังใช้งาน.
- Desktop rail labels remain available when the label text is visually compacted; current navigation uses `aria-current` from `NavLink`.
- Shared `ModalDialog` handles Escape, focus trapping, body scroll lock, opaque surfaces and focus restoration. It is used by navigation, ad-hoc workout, exercise picker, archive, History confirmation and Settings recovery dialogs.
- Mobile Exercise filters use a modal bottom sheet with focus trap/body-scroll lock; anchored tablet filters expose `aria-expanded` และ `aria-controls`, dismiss on Escape/outside click and restore trigger focus.
- Rest Timer exposes a `role="timer"` value and announces start, pause, resume, reset, skip and finish without announcing every second.
- Forced-colors focus/current-state rules and reduced-motion rules are present in the global layer.

## Manual sign-off ที่ยังรอ

Automated checks do not prove physical-device behavior, screen-reader usability, or full WCAG conformance. ก่อนเปลี่ยน M-06 เป็น `DONE` ต้องลงผลรายการต่อไปนี้ใน [Release Checklist](release-checklist.md):

- [ ] Physical phone: touch targets, bottom navigation และ keyboard ไม่บัง Active Set/action
- [ ] Desktop 200% zoom และ Windows High Contrast
- [ ] Keyboard-only: Login → Today → Workout → History → Progress
- [ ] NVDA หรือ VoiceOver: headings, dialogs, form errors, timer และ charts
- [ ] ติดตั้ง PWA, เปิดใหม่ และเปิด cached Active Workout ขณะ offline

สถานะ M-06 จึงยังเป็น `PARTIAL` แม้ automated gate ผ่านทั้งหมดแล้ว
