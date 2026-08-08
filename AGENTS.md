# Repository Guidelines

## Project Structure & Module Organization

This repository contains a React/TypeScript application foundation plus product documentation:

- `product-requirements.md` defines scope, requirements, and acceptance criteria.
- `user-flows.md` and `information-architecture.md` describe behavior, pages, and navigation.
- `design-system.md` defines visual tokens and responsive rules.
- `domain-model.md`, `database-schema.md`, and `data-rules.md` define data concepts and constraints; they are designs, not executable database files.
- `development-roadmap.md` covers architecture, milestones, and validation.
- `docs/references/` stores visual references, not product requirements.
- `src/app/` owns routing and navigation data.
- `src/components/layout/` contains the responsive shell; `src/components/ui/` contains shared primitives.
- `src/pages/` contains static MVP route placeholders; `src/styles/` contains global tokens and Tailwind layers.

Exercise Library logic now lives under `src/features/exercises/` and uses a Supabase repository adapter; migrations and seed data live under `supabase/`. The rest of the product remains placeholder UI.

## Build, Test, and Development Commands

Use the committed pnpm scripts:

```powershell
pnpm install
pnpm dev
pnpm typecheck
pnpm lint
pnpm build
pnpm test
```

`dev` starts Vite; `typecheck`, `lint`, `test`, and `build` are required before handoff. Use `pnpm test:e2e` for Playwright coverage after starting the local app/database.

## Coding Style & Naming Conventions

Write UTF-8 Markdown with one H1 per file, short sections, and relative links. Use kebab-case filenames such as `design-system.md`. Preserve the canonical terms Exercise, Workout Template, Routine, Active Session, and Completed Session. Follow established ID patterns such as `FR-AW-01`, `UF-06`, `P-07`, and `M-04`.

Use strict TypeScript, two-space indentation, double quotes, semicolons, PascalCase component names, and camelCase functions/props. ESLint is authoritative. Prefer Tailwind utilities backed by semantic CSS variables in `src/styles/globals.css`; avoid one-off colors and spacing.

## Testing Guidelines

For documentation changes, verify headings, links, terminology, MVP boundaries, and traceability. For UI changes, run typecheck, lint, and build, then inspect 360, 768, 1280, and 1600 px behavior. When tests are introduced, colocate names as `*.test.ts(x)` and document the runner and coverage target here.

## Commit & Pull Request Guidelines

No Git history is available to infer conventions. Use concise Conventional Commits provisionally, for example `docs: clarify snapshot rules`. Pull requests should summarize the change, list affected requirement or page IDs, state validation performed, and include screenshots for visual changes. Update every dependent document when scope or terminology changes.

## Security & Agent Instructions

Never commit credentials, production data, or health information. Before implementation work, read the core product, flow, architecture, design, and roadmap documents; treat `product-requirements.md` as the scope authority. Preserve unrelated files and avoid broad changes outside the requested task.
