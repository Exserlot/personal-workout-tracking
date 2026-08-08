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

The repository contains product documentation, domain design, and a React application foundation. The Exercise Library uses a validated Supabase repository adapter, private owner authentication, protected routes, and row-level ownership. Workout planning and broader sync behavior remain future slices.

## Tech Stack

- React
- TypeScript
- Vite
- Tailwind CSS
- pnpm
- Supabase REST API (browser-safe publishable/anon key only)

## Development

```bash
pnpm install
pnpm dev
pnpm typecheck
pnpm lint
pnpm build
```

For local database setup, see [docs/supabase-local-setup.md](docs/supabase-local-setup.md).
