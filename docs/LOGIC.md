# Core logic

The implementation lives in `src/domain/` and is covered by Vitest. This guide
documents intent; code and tests remain authoritative.

## Local week key

Find local Monday, then format local date parts:

```js
const offsetToMonday = day === 0 ? -6 : 1 - day;
date.setDate(date.getDate() + offsetToMonday);
return `${year}-${month}-${dayOfMonth}`;
```

Do not use `toISOString()` here. UTC conversion can turn Monday midnight into
Sunday in positive UTC offsets.

## Exercise selection

For each workout slot:

1. Exclude exercise IDs completed in the same category this week.
2. Exclude exercise IDs already reserved by another matching slot in the
   active session.
3. Exclude the currently displayed exercise when swapping.
4. If the strict pool is empty, relax weekly exclusions before session
   exclusions.
5. Fall back to the whole pool only when it is smaller than the constraints.

Selection uses stable IDs; display-name changes do not bypass deduplication.
An empty or missing pool is a configuration error, never a signal to complete
the workout.

## Set logging

A weighted set is ready when reps are present. Weight is optional and
normalizes to `—` if invalid.

A bodyweight set:

- Stores `BW` as its load
- Renders no editable weight field
- Tracks total reps for progress
- Does not create weight or volume PRs

The next set inherits the just-completed weight and reps unless the user
already edited that field.

## Superset progression

After a set is logged:

1. Persist the current partner's set array in `partialSets`.
2. Find all partners in the same group with expected sets still incomplete.
3. If none remain, commit one exercise entry per partner.
4. Otherwise move to the next incomplete partner.
5. Start rest only when progression wraps to an earlier partner.

This supports partners with different set counts.

## Active duration

Duration is accumulated only while a session is active:

```text
activeElapsedMs
  + (now - activeStartedAt, when not paused)
```

Pausing stores elapsed time and clears `activeStartedAt`. Resuming starts a new
active interval. The final duration is rounded to minutes with a minimum of one
minute.

## Personal best previews

For weighted sets:

```text
max weight = maximum numeric set weight
volume = sum(weight × reps)
```

The exercise screen compares those metrics with completed-history projections
and may show a preview badge. It does not update canonical PR data.

When the session is committed, PR records are rebuilt from completed history.
This keeps discard, delete, restore, and migration behavior consistent.

## Progressive overload prompt

The prompt appears when the last three completed weighted sessions for an
exercise have the same maximum weight. It suggests `+2.5kg` and is suppressed
for 21 days after being shown.

This is a small heuristic, not a training prescription.

## Atomic completion

One state-envelope transaction:

1. Appends the history entry if its session ID is not already present.
2. Rebuilds week completion and weekly used exercise IDs.
3. Rebuilds PR projections.
4. Removes the active session.

If persistence fails, the app stays on the active workout and reports that it
could not save. Calling completion again with the same session ID is safe.

## History deletion and undo

Deletion and restoration each run as one transaction and rebuild every derived
projection. Weekly used exercise IDs therefore cannot remain stale after a
history edit.

## Webhook delivery

The payload includes a stable `session_id` and is queued before delivery.
Queue insertion deduplicates by that ID. Delivery sends:

```http
Idempotency-Key: <session_id>
Content-Type: application/json
```

Failures use bounded exponential backoff. Retrying cannot add another queue
item for the same session.
