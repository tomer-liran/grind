# Contributing to Grind

Thanks for helping make Grind more reliable, accessible, and useful. Small,
focused pull requests are easiest to review.

## Set up the project

Requirements:

- Node.js `^20.19.0` or `>=22.12.0`
- npm (the lockfile is the source of truth)

```bash
git clone https://github.com/tomer-liran/grind.git
cd grind
npm ci
npm run dev
```

Open `http://localhost:5173`.

## Before opening a pull request

Run the complete local gate:

```bash
npm run check
```

For user-flow changes, also run:

```bash
npx playwright install chromium webkit
npm run test:e2e
```

The main commands are:

- `npm run lint` — ESLint
- `npm run typecheck` — checked JavaScript domain boundaries
- `npm test` — Vitest unit and integration tests
- `npm run test:coverage` — domain/infrastructure coverage report
- `npm run test:e2e` — Chromium and WebKit mobile flows
- `npm run build` — production PWA build
- `npm run validate:repo` — local links, metadata, and public assets

## Project boundaries

Grind intentionally remains a framework-free Vite application.

- `src/domain/` contains deterministic workout and calendar rules.
- `src/infrastructure/` owns versioned persistence and migrations.
- `src/app/` coordinates screens and browser behavior.
- `src/ui/` contains reusable browser UI primitives.
- `src/data/workouts.js` is the user-editable workout catalog.

Read [the architecture guide](docs/ARCHITECTURE.md) before changing storage,
session completion, workout selection, or sync behavior.

## Stored-data changes

User history must survive upgrades.

When changing persisted data:

1. Keep stable exercise, slot, and session IDs.
2. Add a migration instead of silently resetting data.
3. Test malformed and legacy input.
4. Keep session completion and history deletion transactional.
5. Document the schema change in `CHANGELOG.md`.

Export a backup from the Home screen before testing migrations against personal
data. Never commit a backup: it can contain workout history and webhook data.

## UI changes

For visible changes:

- Check a 390×844 phone, a short phone, landscape, and desktop.
- Test keyboard navigation, focus restoration, 200% zoom, and reduced motion.
- Keep interactive targets at least 44×44 CSS pixels.
- Attach before/after screenshots to the pull request.
- Do not add third-party analytics, fonts, or network requests without an
  explicit privacy discussion.

## Workout catalog changes

Every exercise in `src/data/workouts.js` needs a unique, stable `id`. Renaming a
display name is safe; changing an ID disconnects historical progress.

Run `npm test` after editing pools or templates. Validation rejects empty pools,
duplicate exercise IDs, invalid set counts, and missing slot references.

## Commit and review conventions

Use clear Conventional Commit-style subjects where practical:

- `fix: preserve active session when storage is full`
- `feat: add pounds display preference`
- `docs: clarify webhook privacy`

Maintainers prioritize correctness, data preservation, accessibility, and a
small offline footprint over feature count. Significant product or schema
changes should start with an issue so the approach can be discussed first.

By participating, you agree to follow the
[Code of Conduct](CODE_OF_CONDUCT.md).
