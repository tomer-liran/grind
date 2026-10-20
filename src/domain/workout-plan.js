// @ts-check

export function validateWorkoutConfig(days, exercises) {
  const errors = [];
  const exerciseIds = new Set();

  Object.entries(exercises || {}).forEach(([categoryKey, pool]) => {
    if (!Array.isArray(pool) || pool.length === 0) {
      errors.push(`Category "${categoryKey}" must contain at least one exercise.`);
      return;
    }

    pool.forEach((exercise, index) => {
      const label = `Exercise ${index + 1} in "${categoryKey}"`;
      if (!exercise?.id) errors.push(`${label} is missing a stable id.`);
      if (!exercise?.name) errors.push(`${label} is missing a name.`);
      if (!Number.isInteger(exercise?.sets) || exercise.sets < 1) {
        errors.push(`${label} must define a positive integer set count.`);
      }
      if (!Number.isFinite(exercise?.restSeconds) || exercise.restSeconds < 0) {
        errors.push(`${label} must define a non-negative rest duration.`);
      }
      if (exercise?.id) {
        if (exerciseIds.has(exercise.id)) {
          errors.push(`Exercise id "${exercise.id}" is duplicated.`);
        }
        exerciseIds.add(exercise.id);
      }
    });
  });

  Object.entries(days || {}).forEach(([templateId, day]) => {
    if (!Array.isArray(day?.slots) || day.slots.length === 0) {
      errors.push(`Template "${templateId}" must contain at least one slot.`);
      return;
    }

    day.slots.forEach((slot, index) => {
      if (!slot?.id) {
        errors.push(`Slot ${index + 1} in template "${templateId}" is missing an id.`);
      }
      if (!Array.isArray(exercises?.[slot?.key]) || exercises[slot.key].length === 0) {
        errors.push(
          `Slot "${slot?.label || index + 1}" in template "${templateId}" references empty category "${slot?.key}".`,
        );
      }
    });
  });

  return errors;
}

export function pickExerciseFromPool({
  pool,
  weekUsedIds = [],
  sessionUsedIds = [],
  excludedIds = [],
  random = Math.random,
}) {
  if (!Array.isArray(pool) || pool.length === 0) return null;

  const sessionExclusions = new Set([...sessionUsedIds, ...excludedIds]);
  const weekExclusions = new Set(weekUsedIds);
  const candidates = [
    pool.filter(
      (exercise) =>
        !weekExclusions.has(exercise.id) && !sessionExclusions.has(exercise.id),
    ),
    pool.filter((exercise) => !sessionExclusions.has(exercise.id)),
    pool.filter(
      (exercise) =>
        !weekExclusions.has(exercise.id) && !sessionUsedIds.includes(exercise.id),
    ),
    pool.filter((exercise) => !sessionUsedIds.includes(exercise.id)),
    pool,
  ].find((items) => items.length > 0);

  return candidates[Math.floor(random() * candidates.length)] ?? null;
}
