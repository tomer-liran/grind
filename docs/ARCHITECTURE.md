# Architecture

Grind is a static, framework-free PWA. The browser owns rendering, persistence,
and optional webhook delivery; there is no first-party backend.

## Layers

```text
index.html
  └─ src/main.js
      └─ src/app/runtime.js           composition root
          ├─ src/domain/              pure rules
          ├─ src/infrastructure/      persistence and migrations
          ├─ src/app/                 browser orchestration
          ├─ src/ui/                  reusable UI primitives
          ├─ src/data/                workout catalog
          └─ src/styles/              CSS layers
```

Dependency direction is toward `domain/`. Domain modules do not read the DOM,
browser storage, or the network. The state repository may use domain
derivations, while app modules coordinate views and effects.

## Runtime composition

[`src/app/runtime.js`](../src/app/runtime.js) initializes modules once and
provides their dependencies. Existing app modules expose `init*` functions to
avoid hidden imports between every feature. New deterministic rules should be
added to `domain/`, not to the composition root.

Startup order:

1. Initialize module dependencies.
2. Import legacy storage into the versioned state envelope.
3. Normalize history, active-session timing, stable IDs, PRs, and week
   projections.
4. Wire DOM events.
5. Render Home and register online/outbox behavior.

## Canonical state

All managed records live inside one `localStorage` envelope:

```js
{
  schemaVersion: 1,
  updatedAt: "2026-10-20T12:00:00.000Z",
  records: {
    "grind:history": [],
    "grind:pr": {},
    "grind:session-active": null,
    "grind:week-2026-10-19": {},
    "grind:sync-queue": [],
    "grind:onboarding": {}
  },
  migration: {
    importedAt: "2026-10-20T12:00:00.000Z",
    legacyKeys: ["grind:history", "grind:pr"]
  }
}
```

The envelope is stored under `grind:state`. The `storageGet`, `storageSet`, and
`storageDel` compatibility API routes existing app modules through the
envelope. `storageTransaction` clones records, applies one mutation, and writes
the complete envelope once.

Legacy `grind:*` keys are imported but not deleted, providing a recovery copy.
The explicit Reset action removes both the canonical envelope and legacy keys.

## Stable identity

- Exercises have explicit IDs in `src/data/workouts.js`.
- Workout slots have stable template-local IDs.
- Sessions receive a UUID when created.
- Completed history entries retain the session ID.

Names are presentation. Stored progress and idempotency use stable IDs, so an
exercise can be renamed without losing its history.

## Session lifecycle

```text
create plan
  → active session
  → log sets in memory + active-session snapshot
  → preview PRs against completed history
  → commit completed session transaction
      ├─ append history once by session ID
      ├─ rebuild week completion and used exercises
      ├─ rebuild PR projections
      └─ remove active session
  → enqueue/deliver optional webhook payload
```

PR and week projections are not updated when an individual exercise finishes.
That prevents a discarded session from leaving ghost PRs or used-exercise
state.

Completion is idempotent: committing the same session ID twice produces one
history entry.

## Active-time accounting

Sessions store:

```js
{
  startTime: "...",
  activeStartedAt: "...",
  activeElapsedMs: 600000,
  pausedAt: null
}
```

Choosing “Keep for later” folds the current active interval into
`activeElapsedMs`. Resuming starts a new interval. Overnight pauses therefore
do not inflate workout duration.

Legacy sessions with only `startTime` are normalized on migration.

## Week model

Week keys are local-calendar Mondays formatted directly from local date parts.
They never round-trip through UTC.

```js
{
  templateChoices: ["A", "B", "C"],
  completed: ["A"],
  completedByTemplate: { A: "tuesday" },
  completedWeekdays: ["tuesday"],
  usedExercises: {
    "lower-quad": ["dumbbell-goblet-squat"]
  }
}
```

Week completion and used exercises are projections of completed history.
Deleting or restoring a history entry rebuilds those projections in the same
transaction.

## Progress model

Weighted exercise records contain maximum set weight, maximum completed-session
volume, last weight, and up to 52 session summaries. Bodyweight exercises use
total reps for charts and do not create weight/volume PRs.

Personal-best badges shown during a workout are previews. The canonical PR
record is rebuilt only when the workout is committed.

## Supersets

Slots sharing a `supersetGroup` progress round-robin. Completion checks the
expected and logged sets for every partner, so unequal set counts are valid.
Rest starts when progression wraps to an earlier partner.

## Webhook outbox

Sync is disabled by default. When enabled:

1. The completed payload is queued by session ID.
2. Delivery uses the same ID as an `Idempotency-Key` header.
3. Success removes the queue item.
4. Failure increments attempts and applies bounded exponential backoff.
5. The queue is capped and flushes at startup and on the browser `online`
   event.

The receiving endpoint remains responsible for authentication, CORS, input
validation, and server-side idempotency.

## Rendering and accessibility

Screen markup is in `index.html`; dynamic rows are rendered by app modules.
Configurable and stored text is escaped or assigned through `textContent`.

`src/ui/dialog.js` provides focus trapping, background inertness, initial focus,
and focus restoration. Screen changes move focus to the destination heading.
CSS includes reduced-motion behavior and a minimum 44px target token.

## Verification

- Vitest covers domain rules, timezones, migrations, transactions, progress,
  sync deduplication, and unequal supersets.
- Playwright covers mobile Chromium/WebKit flows and automated accessibility.
- CI runs formatting, lint, checked JavaScript, tests, repository validation,
  the production build, and browser tests.
